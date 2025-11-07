import json
import logging
import azure.functions as func
import sys
import os

# Add parent directory to path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization, query_db, execute_db, get_blob_with_sas
from shared_python.face_client import (
    get_face_client, 
    ensure_person_group_exists,
    get_or_create_person,
    add_face_from_blob_url,
    PERSON_GROUP_ID
)

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Seed faces to Azure Face API from existing manually-tagged photos
    
    POST /api/faces/seed
    Body: { 
        "limit": 100,
        "maxPerPerson": 5,  // Optional - for baseline training
        "resume": true      // Optional - resume from previous incomplete session
    }
    """
    logging.info('Face seeding (Azure Face API) starting')
    
    # Check authorization
    authorized, user, error = check_authorization(req, 'Full')
    if not authorized:
        return func.HttpResponse(
            json.dumps({'error': error}),
            status_code=403,
            mimetype='application/json'
        )
    
    # Parse parameters
    try:
        req_body = req.get_json()
        limit = req_body.get('limit', 100) if req_body else 100
        max_per_person = req_body.get('maxPerPerson', None) if req_body else None
        resume = req_body.get('resume', False) if req_body else False
    except:
        limit = 100
        max_per_person = None
        resume = False
    
    try:
        # Initialize Face API
        face_client = get_face_client()
        ensure_person_group_exists(face_client)
        
        # Check for incomplete session to resume
        session_id = None
        processed_photos = set()
        
        if resume:
            logging.info('Checking for incomplete training session to resume...')
            incomplete_session = query_db('EXEC dbo.sp_GetIncompleteTrainingSession')
            
            if incomplete_session and len(incomplete_session) > 0:
                session = incomplete_session[0]
                session_id = session['SessionID']
                logging.info(f'Resuming session {session_id} - {session["ProcessedPhotos"]}/{session["TotalPhotos"]} photos completed')
                
                # Get list of already processed photos
                processed_results = query_db(
                    'EXEC dbo.sp_GetProcessedPhotosInSession @SessionID = ?',
                    (session_id,)
                )
                processed_photos = set(p['PFileName'] for p in processed_results)
                logging.info(f'Skipping {len(processed_photos)} already processed photos')
        
        # Start new session if not resuming
        if session_id is None:
            training_type = 'Baseline' if max_per_person else 'Full'
            logging.info(f'Starting new {training_type} training session')
            
            result = query_db(
                'EXEC dbo.sp_StartTrainingSession @TrainingType = ?, @MaxPerPerson = ?',
                (training_type, max_per_person)
            )
            session_id = result[0]['SessionID'] if result and len(result) > 0 else None
            
            if not session_id:
                raise Exception('Failed to create training session')
            
            logging.info(f'Created session {session_id}')
        
        # Get tagged photos that haven't been added to Azure yet
        if max_per_person:
            # Baseline training: limit per person
            query_sql = """
            WITH RankedPhotos AS (
                SELECT 
                    p.PFileName,
                    ne.ID as PersonID,
                    ne.neName as PersonName,
                    ROW_NUMBER() OVER (PARTITION BY ne.ID ORDER BY p.PYear DESC, p.PMonth DESC) as Rank
                FROM dbo.Pictures p
                INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                WHERE ne.neType = 'N' AND np.npID != 1
            )
            SELECT PFileName, PersonID, PersonName
            FROM RankedPhotos
            WHERE Rank <= ?
            ORDER BY PersonID
            """
            photos = query_db(query_sql, (max_per_person,))
        else:
            # Full training: all photos
            query_sql = """
            SELECT DISTINCT
                p.PFileName,
                ne.ID as PersonID,
                ne.neName as PersonName
            FROM dbo.Pictures p
            INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
            INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
            WHERE ne.neType = 'N' AND np.npID != 1
            ORDER BY ne.ID
            """
            photos = query_db(query_sql)
        
        if not photos:
            # Mark session as completed with no work
            execute_db(
                'EXEC dbo.sp_CompleteTrainingSession @SessionID = ?, @Status = ?',
                (session_id, 'Completed')
            )
            
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'No photos to process',
                    'photosProcessed': 0,
                    'facesAdded': 0,
                    'sessionId': session_id
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        # Filter out already processed photos if resuming
        if processed_photos:
            original_count = len(photos)
            photos = [p for p in photos if p['PFileName'] not in processed_photos]
            logging.info(f'Filtered {original_count - len(photos)} already-processed photos, {len(photos)} remaining')
        
        # Count unique persons
        unique_persons = set(p['PersonID'] for p in photos)
        total_persons = len(unique_persons)
        total_photos = len(photos)
        
        # Update session with totals
        execute_db(
            'EXEC dbo.sp_UpdateTrainingProgress @SessionID = ?, @TotalPersons = ?, @TotalPhotos = ?',
            (session_id, total_persons, total_photos)
        )
        
        logging.info(f'Processing {total_photos} photos for {total_persons} people (session {session_id})')
        
        # Process photos
        photos_processed = 0
        faces_added = 0
        errors = 0
        current_person_id = None
        azure_person_id = None
        processed_persons = 0
        
        for photo in photos[:limit]:
            try:
                filename = photo['PFileName']
                person_id = photo['PersonID']
                person_name = photo['PersonName']
                
                # Track person transitions
                if person_id != current_person_id:
                    if current_person_id is not None:
                        processed_persons += 1
                        # Update progress after each person
                        execute_db(
                            'EXEC dbo.sp_UpdateTrainingProgress @SessionID = ?, @ProcessedPersons = ?',
                            (session_id, processed_persons)
                        )
                    
                    current_person_id = person_id
                    logging.info(f'Processing person: {person_name} (ID: {person_id})')
                    
                    # Get or create Azure Person
                    azure_person_id = get_or_create_person(
                        face_client, person_id, person_name, PERSON_GROUP_ID
                    )
                
                # Get image URL with SAS token
                image_url = get_blob_with_sas(filename)
                
                # Add face to Azure
                result = add_face_from_blob_url(
                    face_client, PERSON_GROUP_ID, azure_person_id, image_url
                )
                
                if result['success']:
                    faces_added += 1
                    photos_processed += 1
                    
                    # Record success in progress tracking
                    execute_db(
                        'EXEC dbo.sp_RecordPhotoProgress @SessionID = ?, @PersonID = ?, @PersonName = ?, @PFileName = ?, @Success = 1',
                        (session_id, person_id, person_name, filename)
                    )
                else:
                    errors += 1
                    error_msg = result.get('error', 'Unknown error')
                    
                    # Record failure in progress tracking
                    execute_db(
                        'EXEC dbo.sp_RecordPhotoProgress @SessionID = ?, @PersonID = ?, @PersonName = ?, @PFileName = ?, @Success = 0, @ErrorMessage = ?',
                        (session_id, person_id, person_name, filename, error_msg)
                    )
                
                # Update progress counters
                execute_db(
                    'EXEC dbo.sp_UpdateTrainingProgress @SessionID = ?, @ProcessedPhotos = ?, @SuccessfulFaces = ?, @FailedFaces = ?, @LastProcessedPerson = ?, @LastProcessedPhoto = ?',
                    (session_id, photos_processed, faces_added, errors, person_id, filename)
                )
                    
            except Exception as e:
                logging.error(f"Failed {filename}: {str(e)}")
                errors += 1
                
                # Record failure
                try:
                    execute_db(
                        'EXEC dbo.sp_RecordPhotoProgress @SessionID = ?, @PersonID = ?, @PersonName = ?, @PFileName = ?, @Success = 0, @ErrorMessage = ?',
                        (session_id, person_id, person_name, filename, str(e))
                    )
                except:
                    pass  # Don't fail the whole process if progress recording fails
        
        # Mark final person as processed
        if current_person_id is not None:
            processed_persons += 1
        
        # Complete the session
        execute_db(
            'EXEC dbo.sp_CompleteTrainingSession @SessionID = ?, @Status = ?',
            (session_id, 'Completed')
        )
        
        logging.info(f'Session {session_id} completed: {faces_added} faces added, {errors} errors')
        
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'message': f'Added {faces_added} faces',
                'photosProcessed': photos_processed,
                'facesAdded': faces_added,
                'errors': errors,
                'sessionId': session_id,
                'totalPersons': total_persons,
                'processedPersons': processed_persons
            }),
            status_code=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        logging.error(f"Seeding failed: {str(e)}")
        
        # Try to mark session as failed
        if session_id:
            try:
                execute_db(
                    'EXEC dbo.sp_CompleteTrainingSession @SessionID = ?, @Status = ?, @ErrorMessage = ?',
                    (session_id, 'Cancelled', str(e))
                )
            except:
                pass
        
        return func.HttpResponse(
            json.dumps({'error': str(e)}),
            status_code=500,
            mimetype='application/json'
        )

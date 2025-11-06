import json
import logging
import azure.functions as func
import sys
import os

# Add parent directory to path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization, query_db, get_blob_with_sas
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
        "maxPerPerson": 5  // Optional - for baseline training
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
    except:
        limit = 100
        max_per_person = None
    
    try:
        # Initialize Face API
        face_client = get_face_client()
        ensure_person_group_exists(face_client)
        
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
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'No photos to process',
                    'photosProcessed': 0,
                    'facesAdded': 0
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        # Process photos
        photos_processed = 0
        faces_added = 0
        errors = 0
        current_person_id = None
        azure_person_id = None
        
        for photo in photos[:limit]:
            try:
                filename = photo['PFileName']
                person_id = photo['PersonID']
                person_name = photo['PersonName']
                
                # Get or create Azure Person
                if person_id != current_person_id:
                    current_person_id = person_id
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
                else:
                    errors += 1
                    
            except Exception as e:
                logging.error(f"Failed {filename}: {str(e)}")
                errors += 1
        
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'message': f'Added {faces_added} faces',
                'photosProcessed': photos_processed,
                'facesAdded': faces_added,
                'errors': errors
            }),
            status_code=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        logging.error(f"Seeding failed: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': str(e)}),
            status_code=500,
            mimetype='application/json'
        )

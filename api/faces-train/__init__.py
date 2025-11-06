import json
import logging
import azure.functions as func
import numpy as np
import sys
import os

# Add parent directory to path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization, query_db, execute_db

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Regenerate person encodings based on confirmed face tags
    This should be run after new photos are tagged or face matches are confirmed
    
    POST /api/faces/train
    Body: { "personId": 123 } // Optional - if omitted, trains all persons
    
    Returns: {
        "success": true,
        "personsUpdated": 5,
        "details": [...]
    }
    """
    logging.info('Face training function processing request')
    
    # Check authorization - requires Full role
    authorized, user, error = check_authorization(req, 'Full')
    if not authorized:
        return func.HttpResponse(
            json.dumps({'error': error}),
            status_code=403,
            mimetype='application/json'
        )
    
    # Parse request body
    try:
        req_body = req.get_json()
        person_id = req_body.get('personId') if req_body else None
    except ValueError:
        person_id = None
    
    try:
        # Get persons to train
        if person_id:
            persons_sql = """
            SELECT DISTINCT ne.NameID, ne.NName
            FROM dbo.NameEvent ne
            WHERE ne.NameID = ? AND ne.neType = 'N'
            """
            persons = query_db(persons_sql, (person_id,))
        else:
            # Train all persons who have confirmed face encodings
            persons_sql = """
            SELECT DISTINCT ne.NameID, ne.NName
            FROM dbo.NameEvent ne
            INNER JOIN dbo.FaceEncodings fe ON ne.NameID = fe.PersonID
            WHERE fe.IsConfirmed = 1 AND ne.neType = 'N'
            ORDER BY ne.NName
            """
            persons = query_db(persons_sql)
        
        if not persons:
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'No persons found to train',
                    'personsUpdated': 0
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        details = []
        persons_updated = 0
        
        for person in persons:
            person_id = person['NameID']
            person_name = person['NName']
            
            # Get all confirmed face encodings for this person
            encodings_sql = """
            SELECT Encoding
            FROM dbo.FaceEncodings
            WHERE PersonID = ? AND IsConfirmed = 1
            """
            
            encoding_rows = query_db(encodings_sql, (person_id,))
            
            if not encoding_rows:
                logging.info(f"No confirmed encodings for {person_name}")
                continue
            
            # Convert all encodings to numpy arrays
            encodings = []
            for row in encoding_rows:
                encoding = np.frombuffer(row['Encoding'], dtype=np.float64)
                encodings.append(encoding)
            
            # Calculate aggregate encoding (mean of all encodings)
            aggregate_encoding = np.mean(encodings, axis=0)
            aggregate_bytes = aggregate_encoding.tobytes()
            
            # Update or insert PersonEncodings record
            update_sql = """
            MERGE INTO dbo.PersonEncodings AS target
            USING (SELECT ? AS PersonID) AS source
            ON target.PersonID = source.PersonID
            WHEN MATCHED THEN
                UPDATE SET 
                    AggregateEncoding = ?,
                    EncodingCount = ?,
                    LastUpdated = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (PersonID, AggregateEncoding, EncodingCount, LastUpdated)
                VALUES (?, ?, ?, GETDATE());
            """
            
            execute_db(update_sql, (
                person_id,  # MERGE condition
                aggregate_bytes,  # UPDATE
                len(encodings),
                person_id,  # INSERT
                aggregate_bytes,
                len(encodings)
            ))
            
            persons_updated += 1
            details.append({
                'personId': person_id,
                'personName': person_name,
                'encodingCount': len(encodings)
            })
            
            logging.info(f"Updated encoding for {person_name} with {len(encodings)} samples")
        
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'personsUpdated': persons_updated,
                'details': details
            }),
            status_code=200,
            mimetype='application/json'
        )
    
    except Exception as e:
        logging.error(f"Face training failed: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': f'Face training failed: {str(e)}'}),
            status_code=500,
            mimetype='application/json'
        )

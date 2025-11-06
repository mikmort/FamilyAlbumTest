import json
import logging
import azure.functions as func
import numpy as np
import sys
import os
import math
from datetime import datetime

# Add parent directory to path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization, query_db, execute_db

def calculate_sample_size(total_faces):
    """
    Calculate optimal sample size using logarithmic scaling
    
    Strategy:
    - <= 10 faces: Use all (100%)
    - 11-50 faces: Use most (80-100%)
    - 51-100 faces: Use ~50-60
    - 101-500 faces: Use ~60-80 (logarithmic)
    - 501-1000 faces: Use ~80-100 (logarithmic)
    - 1000+ faces: Cap at ~100-120 (diminishing returns)
    
    Formula: min(total, max(10, 10 + 20*log10(total)))
    
    Examples:
    - 5 faces → 5 (100%)
    - 10 faces → 10 (100%)
    - 20 faces → 20 (100%)
    - 50 faces → 44 (88%)
    - 100 faces → 50 (50%)
    - 200 faces → 56 (28%)
    - 500 faces → 64 (13%)
    - 1000 faces → 70 (7%)
    - 5000 faces → 84 (1.7%)
    """
    if total_faces <= 10:
        return total_faces
    
    # Logarithmic scaling: 10 + 20*log10(n)
    sample_size = int(10 + 20 * math.log10(total_faces))
    
    # Cap at 120 for very large collections (diminishing returns)
    sample_size = min(sample_size, 120)
    
    # Never exceed total
    return min(sample_size, total_faces)

def select_diverse_samples(encoding_rows, sample_size):
    """
    Select a diverse sample of face encodings based on dates
    
    Strategy:
    1. Sort faces by date (PYear, PMonth)
    2. Divide timeline into equal buckets
    3. Take samples evenly distributed across time
    4. This captures aging and appearance changes
    
    Args:
        encoding_rows: List of dicts with Encoding, PYear, PMonth
        sample_size: Number of samples to select
        
    Returns:
        List of selected encoding rows
    """
    if len(encoding_rows) <= sample_size:
        return encoding_rows
    
    # Sort by date (year, month)
    # Handle NULL dates by putting them at the end
    sorted_rows = sorted(encoding_rows, key=lambda x: (
        x['PYear'] if x['PYear'] else 9999,
        x['PMonth'] if x['PMonth'] else 12
    ))
    
    # Select evenly spaced indices
    # This ensures we sample across the entire timeline
    total = len(sorted_rows)
    indices = []
    
    for i in range(sample_size):
        # Calculate position in the sorted list
        # Spreads samples evenly across timeline
        index = int((i * total) / sample_size)
        indices.append(index)
    
    selected = [sorted_rows[i] for i in indices]
    
    return selected

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
            
            # Get all confirmed face encodings for this person WITH DATES
            # Join with Pictures table to get photo dates for diversity sampling
            encodings_sql = """
            SELECT 
                fe.Encoding,
                p.PYear,
                p.PMonth
            FROM dbo.FaceEncodings fe
            INNER JOIN dbo.Pictures p ON fe.PFileName = p.PFileName
            WHERE fe.PersonID = ? AND fe.IsConfirmed = 1
            ORDER BY p.PYear, p.PMonth
            """
            
            encoding_rows = query_db(encodings_sql, (person_id,))
            
            if not encoding_rows:
                logging.info(f"No confirmed encodings for {person_name}")
                continue
            
            total_faces = len(encoding_rows)
            
            # Calculate optimal sample size using logarithmic scaling
            sample_size = calculate_sample_size(total_faces)
            
            # Select diverse samples across timeline
            selected_rows = select_diverse_samples(encoding_rows, sample_size)
            
            logging.info(f"Training {person_name}: using {len(selected_rows)} of {total_faces} faces ({int(100*len(selected_rows)/total_faces)}% sample)")
            
            # Convert selected encodings to numpy arrays
            encodings = []
            for row in selected_rows:
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
                    TotalFaces = ?,
                    LastUpdated = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (PersonID, AggregateEncoding, EncodingCount, TotalFaces, LastUpdated)
                VALUES (?, ?, ?, ?, GETDATE());
            """
            
            execute_db(update_sql, (
                person_id,  # MERGE condition
                aggregate_bytes,  # UPDATE
                len(selected_rows),  # Number of faces used in training
                total_faces,  # Total faces available
                person_id,  # INSERT
                aggregate_bytes,
                len(selected_rows),
                total_faces
            ))
            
            persons_updated += 1
            details.append({
                'personId': person_id,
                'personName': person_name,
                'encodingCount': len(selected_rows),
                'totalFaces': total_faces,
                'samplePercentage': int(100 * len(selected_rows) / total_faces)
            })
            
            logging.info(f"Updated encoding for {person_name} with {len(selected_rows)}/{total_faces} samples")
        
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

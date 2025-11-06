import json
import logging
import azure.functions as func
import face_recognition
import numpy as np
from io import BytesIO
from PIL import Image
import sys
import os

# Add parent directory to path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization, query_db, execute_db_with_identity, download_blob, query_db

# Constants
CONTAINER_NAME = 'family-album-media'
DISTANCE_THRESHOLD = 0.6  # Lower distance = better match (typical threshold: 0.6)
MIN_CONFIDENCE = 0.4  # Minimum confidence to suggest a match

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Detect faces in an uploaded image and match against known people
    
    POST /api/detect-faces
    Body: { "filename": "path/to/image.jpg", "autoConfirm": false }
    
    Returns: {
        "success": true,
        "faces": [
            {
                "faceId": 123,
                "boundingBox": {"top": 100, "right": 200, "bottom": 300, "left": 150},
                "suggestedPerson": {"id": 5, "name": "John Doe"},
                "confidence": 0.85,
                "distance": 0.35
            }
        ]
    }
    """
    logging.info('Face detection function processing request')
    
    # Check authorization - requires Full role to run face detection
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
    except ValueError:
        return func.HttpResponse(
            json.dumps({'error': 'Invalid JSON in request body'}),
            status_code=400,
            mimetype='application/json'
        )
    
    filename = req_body.get('filename')
    auto_confirm = req_body.get('autoConfirm', False)  # Auto-confirm high-confidence matches
    
    if not filename:
        return func.HttpResponse(
            json.dumps({'error': 'filename is required'}),
            status_code=400,
            mimetype='application/json'
        )
    
    try:
        # Download the image from blob storage
        logging.info(f"Downloading image: {filename}")
        image_data = download_blob(CONTAINER_NAME, filename)
        
        # Load image with PIL and convert to RGB
        image = Image.open(BytesIO(image_data))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array for face_recognition
        image_array = np.array(image)
        
        # Detect faces in the image
        logging.info("Detecting faces in image")
        face_locations = face_recognition.face_locations(image_array, model='hog')  # Use 'cnn' for better accuracy but slower
        
        if not face_locations:
            logging.info("No faces detected")
            return func.HttpResponse(
                json.dumps({'success': True, 'faces': [], 'message': 'No faces detected'}),
                status_code=200,
                mimetype='application/json'
            )
        
        logging.info(f"Found {len(face_locations)} face(s)")
        
        # Generate face encodings
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        
        # Load known person encodings from database
        known_persons = load_person_encodings()
        
        detected_faces = []
        
        for i, (face_encoding, face_location) in enumerate(zip(face_encodings, face_locations)):
            top, right, bottom, left = face_location
            
            # Convert bounding box to JSON
            bounding_box = json.dumps({
                'top': int(top),
                'right': int(right),
                'bottom': int(bottom),
                'left': int(left)
            })
            
            # Find best match among known persons
            best_match = find_best_match(face_encoding, known_persons)
            
            # Store face encoding in database
            encoding_bytes = face_encoding.tobytes()
            
            if best_match and best_match['distance'] < DISTANCE_THRESHOLD:
                person_id = best_match['person_id']
                confidence = 1.0 - best_match['distance']  # Convert distance to confidence
                distance = best_match['distance']
                
                # Only store if confidence meets minimum threshold
                if confidence >= MIN_CONFIDENCE:
                    # Auto-confirm if requested and confidence is very high (> 0.8)
                    is_confirmed = auto_confirm and confidence > 0.8
                    
                    face_id = save_face_encoding(
                        filename, 
                        person_id, 
                        encoding_bytes, 
                        bounding_box, 
                        confidence, 
                        distance,
                        is_confirmed
                    )
                    
                    detected_faces.append({
                        'faceId': face_id,
                        'boundingBox': json.loads(bounding_box),
                        'suggestedPerson': {
                            'id': best_match['person_id'],
                            'name': best_match['person_name']
                        },
                        'confidence': round(confidence, 3),
                        'distance': round(distance, 3),
                        'isConfirmed': is_confirmed
                    })
                    
                    logging.info(f"Face {i+1}: Matched to {best_match['person_name']} (confidence: {confidence:.3f})")
                else:
                    # Store as unidentified (low confidence)
                    face_id = save_face_encoding(
                        filename, 
                        None,  # No person ID
                        encoding_bytes, 
                        bounding_box, 
                        None, 
                        None,
                        False
                    )
                    
                    detected_faces.append({
                        'faceId': face_id,
                        'boundingBox': json.loads(bounding_box),
                        'suggestedPerson': None,
                        'confidence': None,
                        'distance': None,
                        'isConfirmed': False
                    })
                    
                    logging.info(f"Face {i+1}: No confident match (best distance: {best_match['distance']:.3f})")
            else:
                # No match found - store as unidentified
                face_id = save_face_encoding(
                    filename, 
                    None, 
                    encoding_bytes, 
                    bounding_box, 
                    None, 
                    None,
                    False
                )
                
                detected_faces.append({
                    'faceId': face_id,
                    'boundingBox': json.loads(bounding_box),
                    'suggestedPerson': None,
                    'confidence': None,
                    'distance': None,
                    'isConfirmed': False
                })
                
                logging.info(f"Face {i+1}: No match found")
        
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'faces': detected_faces,
                'message': f'Detected {len(detected_faces)} face(s)'
            }),
            status_code=200,
            mimetype='application/json'
        )
    
    except Exception as e:
        logging.error(f"Face detection failed: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': f'Face detection failed: {str(e)}'}),
            status_code=500,
            mimetype='application/json'
        )

def load_person_encodings():
    """Load all person encodings from database"""
    try:
        # Get all confirmed face encodings grouped by person
        sql = """
        SELECT 
            ne.NameID as PersonID,
            ne.NName as PersonName,
            fe.Encoding
        FROM dbo.FaceEncodings fe
        INNER JOIN dbo.NameEvent ne ON fe.PersonID = ne.NameID
        WHERE fe.IsConfirmed = 1 
            AND ne.neType = 'N'
        ORDER BY ne.NName
        """
        
        results = query_db(sql)
        
        # Group encodings by person
        persons = {}
        for row in results:
            person_id = row['PersonID']
            if person_id not in persons:
                persons[person_id] = {
                    'person_id': person_id,
                    'person_name': row['PersonName'],
                    'encodings': []
                }
            
            # Convert bytes back to numpy array
            encoding = np.frombuffer(row['Encoding'], dtype=np.float64)
            persons[person_id]['encodings'].append(encoding)
        
        logging.info(f"Loaded {len(persons)} persons with face encodings")
        return list(persons.values())
    
    except Exception as e:
        logging.error(f"Failed to load person encodings: {str(e)}")
        return []

def find_best_match(face_encoding, known_persons):
    """Find the best matching person for a face encoding"""
    if not known_persons:
        return None
    
    best_match = None
    best_distance = float('inf')
    
    for person in known_persons:
        # Compare against all encodings for this person
        distances = face_recognition.face_distance(person['encodings'], face_encoding)
        
        # Use the minimum distance (best match)
        min_distance = np.min(distances)
        
        if min_distance < best_distance:
            best_distance = min_distance
            best_match = {
                'person_id': person['person_id'],
                'person_name': person['person_name'],
                'distance': float(min_distance)
            }
    
    return best_match

def save_face_encoding(filename, person_id, encoding_bytes, bounding_box, confidence, distance, is_confirmed):
    """Save a face encoding to the database"""
    sql = """
    INSERT INTO dbo.FaceEncodings 
        (PFileName, PersonID, Encoding, BoundingBox, Confidence, Distance, IsConfirmed, IsRejected)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    """
    
    face_id = execute_db_with_identity(sql, (
        filename,
        person_id,
        encoding_bytes,
        bounding_box,
        confidence,
        distance,
        1 if is_confirmed else 0
    ))
    
    return face_id

import json
import logging
import azure.functions as func
import sys
import os

# Add parent directory to path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization, query_db, execute_db

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Get faces needing review, confirm or reject face matches
    
    GET /api/faces/review?limit=50
    Returns unconfirmed face suggestions
    
    POST /api/faces/review
    Body: { "action": "confirm|reject", "faceId": 123, "personId": 5 }
    Confirms or rejects a face match
    """
    logging.info('Face review function processing request')
    
    # Check authorization - requires Full role
    authorized, user, error = check_authorization(req, 'Full')
    if not authorized:
        return func.HttpResponse(
            json.dumps({'error': error}),
            status_code=403,
            mimetype='application/json'
        )
    
    method = req.method
    
    if method == 'GET':
        return handle_get_faces_for_review(req)
    elif method == 'POST':
        return handle_confirm_or_reject(req)
    else:
        return func.HttpResponse(
            json.dumps({'error': 'Method not allowed'}),
            status_code=405,
            mimetype='application/json'
        )

def handle_get_faces_for_review(req):
    """Get faces that need review"""
    try:
        limit = int(req.params.get('limit', '50'))
        
        # Get faces with suggestions that haven't been confirmed or rejected
        sql = """
        SELECT TOP (?)
            f.FaceID,
            f.PFileName,
            f.PersonID,
            ne.NName as SuggestedPersonName,
            f.BoundingBox,
            f.Confidence,
            f.Distance,
            f.CreatedDate
        FROM dbo.FaceEncodings f
        LEFT JOIN dbo.NameEvent ne ON f.PersonID = ne.NameID
        WHERE f.IsConfirmed = 0 
            AND f.IsRejected = 0
            AND f.PersonID IS NOT NULL
        ORDER BY f.Confidence DESC, f.CreatedDate DESC
        """
        
        faces = query_db(sql, (limit,))
        
        # Parse bounding boxes from JSON strings
        for face in faces:
            if face['BoundingBox']:
                face['BoundingBox'] = json.loads(face['BoundingBox'])
            face['CreatedDate'] = face['CreatedDate'].isoformat() if face['CreatedDate'] else None
        
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'faces': faces,
                'count': len(faces)
            }),
            status_code=200,
            mimetype='application/json'
        )
    
    except Exception as e:
        logging.error(f"Failed to get faces for review: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': f'Failed to get faces: {str(e)}'}),
            status_code=500,
            mimetype='application/json'
        )

def handle_confirm_or_reject(req):
    """Confirm or reject a face match"""
    try:
        req_body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({'error': 'Invalid JSON in request body'}),
            status_code=400,
            mimetype='application/json'
        )
    
    action = req_body.get('action')
    face_id = req_body.get('faceId')
    person_id = req_body.get('personId')  # Can be different from suggested
    
    if not action or not face_id:
        return func.HttpResponse(
            json.dumps({'error': 'action and faceId are required'}),
            status_code=400,
            mimetype='application/json'
        )
    
    try:
        if action == 'confirm':
            if not person_id:
                return func.HttpResponse(
                    json.dumps({'error': 'personId is required for confirm action'}),
                    status_code=400,
                    mimetype='application/json'
                )
            
            # Call stored procedure to confirm match
            confirm_sql = "EXEC dbo.sp_ConfirmFaceMatch ?, ?"
            execute_db(confirm_sql, (face_id, person_id))
            
            logging.info(f"Confirmed face {face_id} as person {person_id}")
            
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'Face match confirmed',
                    'faceId': face_id,
                    'personId': person_id
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        elif action == 'reject':
            # Call stored procedure to reject match
            reject_sql = "EXEC dbo.sp_RejectFaceMatch ?"
            execute_db(reject_sql, (face_id,))
            
            logging.info(f"Rejected face match {face_id}")
            
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'Face match rejected',
                    'faceId': face_id
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        else:
            return func.HttpResponse(
                json.dumps({'error': f'Invalid action: {action}. Must be "confirm" or "reject"'}),
                status_code=400,
                mimetype='application/json'
            )
    
    except Exception as e:
        logging.error(f"Failed to {action} face match: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': f'Failed to {action} face match: {str(e)}'}),
            status_code=500,
            mimetype='application/json'
        )

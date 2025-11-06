import json
import logging
import azure.functions as func
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization
from shared_python.face_client import (
    get_face_client,
    wait_for_training,
    PERSON_GROUP_ID
)

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Train the Azure Face API PersonGroup
    
    POST /api/faces/train
    Body: { "quickTrain": true }  // Optional - not used by Azure, but kept for compatibility
    """
    logging.info('Face training (Azure Face API) starting')
    
    # Check authorization
    authorized, user, error = check_authorization(req, 'Full')
    if not authorized:
        return func.HttpResponse(
            json.dumps({'error': error}),
            status_code=403,
            mimetype='application/json'
        )
    
    try:
        # Initialize Face API client
        face_client = get_face_client()
        
        # Start training
        logging.info(f"Starting training for PersonGroup '{PERSON_GROUP_ID}'")
        face_client.person_group.train(PERSON_GROUP_ID)
        
        # Wait for training to complete
        result = wait_for_training(face_client, PERSON_GROUP_ID, timeout=300)
        
        if result['status'] == 'succeeded':
            logging.info("Training completed successfully")
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'Training completed successfully'
                }),
                status_code=200,
                mimetype='application/json'
            )
        elif result['status'] == 'timeout':
            logging.warning("Training timed out")
            return func.HttpResponse(
                json.dumps({
                    'success': False,
                    'error': result['message']
                }),
                status_code=408,
                mimetype='application/json'
            )
        else:  # failed
            logging.error(f"Training failed: {result['message']}")
            return func.HttpResponse(
                json.dumps({
                    'success': False,
                    'error': result['message']
                }),
                status_code=500,
                mimetype='application/json'
            )
            
    except Exception as e:
        logging.error(f"Training failed: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': f'Training failed: {str(e)}'}),
            status_code=500,
            mimetype='application/json'
        )

import json
import logging
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Simple test endpoint to verify deployment works
    """
    logging.info('Simple face seeding test')
    
    return func.HttpResponse(
        json.dumps({
            'success': True,
            'message': 'Face seeding endpoint is deployed and working',
            'test': True
        }),
        status_code=200,
        mimetype='application/json'
    )

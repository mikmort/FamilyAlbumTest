import json
import logging
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('detect-faces endpoint called - currently disabled')
    return func.HttpResponse(
        json.dumps({'error': 'This endpoint is temporarily disabled during migration to Azure Face API', 'success': False}),
        status_code=501,
        mimetype='application/json'
    )

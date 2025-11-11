"""
Azure Function: Generate Face Embeddings using InsightFace ArcFace

Generates 512-dimensional face embeddings from images for better recognition accuracy.
Replaces face-api.js (128-dim FaceNet) with state-of-the-art InsightFace (512-dim ArcFace).

Input:
  POST /api/generate-embeddings
  Body: { "imageUrl": "https://..." } or multipart/form-data with image file

Output:
  {
    "success": true,
    "embedding": [512 floats],
    "confidence": 0.99,
    "faceCount": 1,
    "dimensions": 512,
    "model": "buffalo_l_arcface"
  }
"""

import azure.functions as func
import logging
import json
import sys
import os

# Add shared_python to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared_python.insightface_utils import generate_face_embedding
from azure.storage.blob import BlobServiceClient
from io import BytesIO
import requests


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Generate embeddings endpoint called')

    try:
        # Get image from request (either URL or file upload)
        content_type = req.headers.get('Content-Type', '')
        
        if 'multipart/form-data' in content_type:
            # Handle file upload
            files = req.files
            if 'image' not in files:
                return func.HttpResponse(
                    json.dumps({'error': 'No image file provided'}),
                    status_code=400,
                    mimetype='application/json'
                )
            
            image_file = files['image']
            image_bytes = image_file.read()
            
        else:
            # Handle JSON with imageUrl
            try:
                req_body = req.get_json()
            except ValueError:
                return func.HttpResponse(
                    json.dumps({'error': 'Invalid JSON body'}),
                    status_code=400,
                    mimetype='application/json'
                )
            
            image_url = req_body.get('imageUrl')
            if not image_url:
                return func.HttpResponse(
                    json.dumps({'error': 'imageUrl required in request body'}),
                    status_code=400,
                    mimetype='application/json'
                )
            
            # Download image from URL
            try:
                # Check if it's an Azure blob URL with SAS token
                if 'blob.core.windows.net' in image_url:
                    response = requests.get(image_url, timeout=30)
                    response.raise_for_status()
                    image_bytes = response.content
                else:
                    return func.HttpResponse(
                        json.dumps({'error': 'Only Azure blob URLs are supported'}),
                        status_code=400,
                        mimetype='application/json'
                    )
            except Exception as e:
                logging.error(f"Failed to download image: {e}")
                return func.HttpResponse(
                    json.dumps({'error': f'Failed to download image: {str(e)}'}),
                    status_code=400,
                    mimetype='application/json'
                )
        
        # Optional: max_faces parameter (default 3)
        max_faces = 3
        if req.params.get('maxFaces'):
            try:
                max_faces = int(req.params.get('maxFaces'))
            except ValueError:
                pass
        
        # Generate embedding using InsightFace
        result = generate_face_embedding(image_bytes, max_faces=max_faces)
        
        if result is None:
            return func.HttpResponse(
                json.dumps({
                    'success': False,
                    'error': 'No suitable face found in image'
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        # Convert numpy array to list for JSON serialization
        embedding_list = result['embedding'].tolist()
        
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'embedding': embedding_list,
                'confidence': result['confidence'],
                'faceCount': result['face_count'],
                'dimensions': len(embedding_list),
                'model': 'buffalo_l_arcface'
            }),
            status_code=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        logging.error(f"Error generating embeddings: {e}")
        return func.HttpResponse(
            json.dumps({
                'success': False,
                'error': str(e)
            }),
            status_code=500,
            mimetype='application/json'
        )

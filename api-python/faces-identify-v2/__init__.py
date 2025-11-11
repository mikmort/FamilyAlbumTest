"""
Azure Function: Identify Faces using InsightFace ArcFace (v2)

Matches detected faces against stored 512-dim InsightFace embeddings.
Uses cosine similarity with per-person aggregation (top-3 average).

Input:
  POST /api/faces-identify-v2
  Body: {
    "embedding": [512 floats],
    "threshold": 0.3,  // optional, default 0.3
    "topN": 5          // optional, return top N matches
  }

Output:
  {
    "matches": [
      {
        "personId": 123,
        "personName": "John Doe",
        "similarity": 0.85,
        "maxSimilarity": 0.92,
        "embeddingCount": 15
      }
    ]
  }
"""

import azure.functions as func
import logging
import json
import sys
import os
import pyodbc
import numpy as np

# Add shared_python to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared_python.insightface_utils import match_face_against_embeddings, cosine_similarity


def get_db_connection():
    """Get database connection using environment variables."""
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={os.environ['DB_SERVER']};"
        f"DATABASE={os.environ['DB_DATABASE']};"
        f"UID={os.environ['DB_USER']};"
        f"PWD={os.environ['DB_PASSWORD']}"
    )
    return pyodbc.connect(conn_str)


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Faces identify v2 (InsightFace) endpoint called')

    try:
        # Parse request body
        try:
            req_body = req.get_json()
        except ValueError:
            return func.HttpResponse(
                json.dumps({'error': 'Invalid JSON body'}),
                status_code=400,
                mimetype='application/json'
            )
        
        # Extract parameters
        embedding = req_body.get('embedding')
        if not embedding or not isinstance(embedding, list):
            return func.HttpResponse(
                json.dumps({'error': 'embedding array required in request body'}),
                status_code=400,
                mimetype='application/json'
            )
        
        # Validate embedding dimensions
        if len(embedding) != 512:
            return func.HttpResponse(
                json.dumps({'error': f'Expected 512-dim embedding, got {len(embedding)}'}),
                status_code=400,
                mimetype='application/json'
            )
        
        # Convert to numpy array
        query_embedding = np.array(embedding, dtype=np.float32)
        
        # Get threshold and topN from request (with defaults)
        threshold = req_body.get('threshold', 0.3)  # Default 0.3 for cosine similarity
        top_n = req_body.get('topN', 5)  # Return top 5 by default
        
        logging.info(f"Matching face with threshold={threshold}, topN={top_n}")
        
        # Get all InsightFace embeddings from database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Only fetch InsightFace embeddings (512-dim)
        query = """
            SELECT 
                fe.ID,
                fe.PersonID,
                ne.neName as PersonName,
                fe.Embedding,
                fe.PhotoFileName
            FROM FaceEmbeddings fe
            JOIN NameEvent ne ON fe.PersonID = ne.ID
            WHERE fe.ModelVersion = 'insightface-arcface'
            AND fe.EmbeddingDimensions = 512
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if len(rows) == 0:
            logging.warning("No InsightFace embeddings found in database")
            return func.HttpResponse(
                json.dumps({
                    'matches': [],
                    'message': 'No InsightFace embeddings in database. Train faces first with InsightFace model.'
                }),
                status_code=200,
                mimetype='application/json'
            )
        
        logging.info(f"Loaded {len(rows)} InsightFace embeddings from database")
        
        # Convert rows to list of dicts
        stored_embeddings = []
        for row in rows:
            try:
                embedding_json = json.loads(row.Embedding)
                stored_embeddings.append({
                    'ID': row.ID,
                    'PersonID': row.PersonID,
                    'PersonName': row.PersonName,
                    'Embedding': embedding_json,
                    'PhotoFileName': row.PhotoFileName
                })
            except json.JSONDecodeError:
                logging.error(f"Failed to parse embedding for ID {row.ID}")
                continue
        
        cursor.close()
        conn.close()
        
        # Match faces using InsightFace utilities
        matches = match_face_against_embeddings(
            query_embedding,
            stored_embeddings,
            threshold=threshold
        )
        
        # Limit to topN results
        matches = matches[:top_n]
        
        # Log top matches
        if len(matches) > 0:
            logging.info(f"Top 3 matches: {[f\"{m['personName']}: {m['similarity']:.2%}\" for m in matches[:3]]}")
        else:
            logging.info(f"No matches above threshold {threshold}")
        
        return func.HttpResponse(
            json.dumps({
                'matches': matches,
                'totalEmbeddings': len(stored_embeddings),
                'threshold': threshold,
                'model': 'insightface-arcface',
                'dimensions': 512
            }),
            status_code=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        logging.error(f"Error identifying faces: {e}", exc_info=True)
        return func.HttpResponse(
            json.dumps({
                'error': str(e)
            }),
            status_code=500,
            mimetype='application/json'
        )

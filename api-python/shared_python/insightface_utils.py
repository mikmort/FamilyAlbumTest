"""
InsightFace utilities for state-of-the-art face recognition.

Uses ArcFace model (buffalo_l) for 512-dimensional face embeddings.
Much better accuracy than face-api.js (128-dim FaceNet), especially across age progression.

Key improvements:
- 512-dim embeddings vs 128-dim (richer face representation)
- 99.8% accuracy on LFW benchmark vs ~95% for FaceNet
- Better handling of age, lighting, and pose variations
- Industry-standard model used in production systems
"""

import insightface
from insightface.app import FaceAnalysis
import numpy as np
from typing import List, Dict, Optional, Tuple
import logging
import cv2
from io import BytesIO
from PIL import Image

# Global model instance (loaded once, reused across requests)
_face_app: Optional[FaceAnalysis] = None
_model_loaded = False

def load_insightface_model() -> FaceAnalysis:
    """
    Load InsightFace model (buffalo_l with ArcFace).
    Model is loaded once and cached for subsequent requests.
    
    Returns:
        FaceAnalysis: Loaded InsightFace model
    """
    global _face_app, _model_loaded
    
    if _model_loaded and _face_app is not None:
        logging.info("InsightFace model already loaded")
        return _face_app
    
    try:
        logging.info("Loading InsightFace model (buffalo_l)...")
        
        # Initialize FaceAnalysis with ArcFace model
        # buffalo_l is the large variant with best accuracy
        _face_app = FaceAnalysis(
            name='buffalo_l',
            providers=['CPUExecutionProvider']  # Use CPU for Azure Functions
        )
        
        # Prepare model with image size 640x640 (good balance of speed/accuracy)
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
        
        _model_loaded = True
        logging.info("✓ InsightFace model loaded successfully")
        return _face_app
        
    except Exception as e:
        logging.error(f"Failed to load InsightFace model: {e}")
        raise RuntimeError(f"Failed to load InsightFace model: {e}")


def generate_face_embedding(
    image_bytes: bytes,
    max_faces: int = 3
) -> Optional[Dict]:
    """
    Generate 512-dim face embedding from image using InsightFace ArcFace.
    
    Strategy for selecting face in photos with multiple people:
    - Detect all faces in the image
    - Skip if more than max_faces (likely irrelevant group photo)
    - Select the largest face (by bounding box area) as the main subject
    
    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.)
        max_faces: Maximum allowed faces (default 3, skip if more)
    
    Returns:
        Dict with:
            - embedding: 512-dim numpy array (float32)
            - confidence: Detection confidence (0-1)
            - bbox: Bounding box [x1, y1, x2, y2]
            - face_count: Total faces detected
        Or None if no suitable face found
    """
    try:
        # Load model if not already loaded
        app = load_insightface_model()
        
        # Convert bytes to numpy array (OpenCV format)
        image = Image.open(BytesIO(image_bytes))
        image_np = np.array(image)
        
        # Convert RGB to BGR (OpenCV uses BGR)
        if len(image_np.shape) == 3 and image_np.shape[2] == 3:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        # Detect all faces
        faces = app.get(image_np)
        
        if len(faces) == 0:
            logging.info("No faces detected in image")
            return None
        
        # Skip if too many faces (likely group photo)
        if len(faces) > max_faces:
            logging.info(f"Skipping photo: {len(faces)} faces detected (max {max_faces} allowed)")
            return None
        
        # Select the largest face (by bounding box area)
        largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        
        # Extract embedding (already 512-dim, L2 normalized by InsightFace)
        embedding = largest_face.embedding
        
        logging.info(f"Generated 512-dim embedding, confidence: {largest_face.det_score:.3f}, faces: {len(faces)}")
        
        return {
            'embedding': embedding,  # 512-dim float32 array
            'confidence': float(largest_face.det_score),  # Convert to Python float
            'bbox': largest_face.bbox.tolist(),  # [x1, y1, x2, y2]
            'face_count': len(faces)
        }
        
    except Exception as e:
        logging.error(f"Error generating face embedding: {e}")
        return None


def cosine_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """
    Calculate cosine similarity between two embeddings.
    
    InsightFace embeddings are L2-normalized, so cosine similarity
    is equivalent to dot product. Returns value in [-1, 1] where:
    - 1.0 = identical
    - 0.0 = orthogonal (no similarity)
    - -1.0 = opposite
    
    Args:
        embedding1: First embedding (512-dim)
        embedding2: Second embedding (512-dim)
    
    Returns:
        Cosine similarity score (0-1, scaled to percentage)
    """
    # Ensure L2 normalization (InsightFace does this, but being explicit)
    embedding1 = embedding1 / np.linalg.norm(embedding1)
    embedding2 = embedding2 / np.linalg.norm(embedding2)
    
    # Cosine similarity via dot product
    similarity = np.dot(embedding1, embedding2)
    
    # Convert from [-1, 1] to [0, 1] for easier interpretation
    # (1 + similarity) / 2 maps: -1→0, 0→0.5, 1→1
    # But keeping raw similarity is more standard for face recognition
    return float(similarity)


def match_face_against_embeddings(
    query_embedding: np.ndarray,
    stored_embeddings: List[Dict],
    threshold: float = 0.3
) -> List[Dict]:
    """
    Match a query face embedding against stored embeddings.
    
    Uses cosine similarity with per-person aggregation (top-3 average).
    
    Args:
        query_embedding: 512-dim query embedding
        stored_embeddings: List of dicts with PersonID, PersonName, Embedding (512-dim JSON array)
        threshold: Minimum similarity threshold (default 0.3 for cosine similarity)
    
    Returns:
        List of matches sorted by similarity, each with:
            - personId, personName, similarity, embeddingCount
    """
    try:
        # Group embeddings by person
        scores_by_person = {}
        
        for stored in stored_embeddings:
            person_id = stored['PersonID']
            person_name = stored['PersonName']
            embedding_json = stored['Embedding']
            
            # Parse embedding from JSON
            stored_embedding = np.array(embedding_json, dtype=np.float32)
            
            # Calculate cosine similarity
            similarity = cosine_similarity(query_embedding, stored_embedding)
            
            # Group by person
            if person_id not in scores_by_person:
                scores_by_person[person_id] = {
                    'personId': person_id,
                    'personName': person_name,
                    'scores': []
                }
            
            scores_by_person[person_id]['scores'].append(similarity)
        
        # Calculate top-3 average for each person
        TOP_N = 3
        person_matches = []
        
        for person_id, data in scores_by_person.items():
            scores = sorted(data['scores'], reverse=True)  # Sort descending
            top_scores = scores[:min(TOP_N, len(scores))]
            avg_similarity = sum(top_scores) / len(top_scores)
            
            person_matches.append({
                'personId': data['personId'],
                'personName': data['personName'],
                'similarity': avg_similarity,
                'maxSimilarity': scores[0],
                'embeddingCount': len(scores)
            })
        
        # Sort by similarity and filter by threshold
        person_matches.sort(key=lambda x: x['similarity'], reverse=True)
        matches = [m for m in person_matches if m['similarity'] >= threshold]
        
        logging.info(f"Found {len(matches)} matches above threshold {threshold}")
        return matches
        
    except Exception as e:
        logging.error(f"Error matching faces: {e}")
        return []

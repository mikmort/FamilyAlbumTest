/**
 * Face Recognition Utilities using face-api.js with TensorFlow.js
 * 
 * This module provides client-side face detection and recognition using
 * pre-trained FaceNet models. All processing happens in the browser for privacy.
 */

import * as faceapi from 'face-api.js';

let modelsLoaded = false;

/**
 * Load face-api.js models from public/models directory
 * This should be called once when the app starts or before first use
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) {
    console.log('Face models already loaded');
    return;
  }

  try {
    console.log('Loading face recognition models...');
    const modelPath = '/models';

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
    ]);

    modelsLoaded = true;
    console.log('✓ Face models loaded successfully');
  } catch (error) {
    console.error('Error loading face models:', error);
    throw new Error('Failed to load face recognition models');
  }
}

/**
 * Detect a single face in an image and generate 128-dim embedding
 * Improved to select the best face in group photos:
 * - Detects all faces first
 * - Selects the largest face (likely the main subject)
 * - Returns null if too many faces (likely irrelevant group photo)
 * 
 * @param imageElement - HTMLImageElement or HTMLCanvasElement
 * @param maxFaces - Maximum faces allowed in photo (default 3 for training)
 * @returns Object with detection info and embedding, or null if no face found
 */
export async function detectFaceWithEmbedding(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  maxFaces: number = 3
): Promise<{
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
  descriptor: Float32Array; // 128-dim embedding
} | null> {
  if (!modelsLoaded) {
    throw new Error('Face models not loaded. Call loadFaceModels() first.');
  }

  try {
    // Detect all faces with good confidence threshold
    const results = await faceapi
      .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (results.length === 0) {
      return null;
    }

    // Skip if too many faces (likely group photo where we can't identify the target person)
    if (results.length > maxFaces) {
      console.log(`Skipping photo: ${results.length} faces detected (max ${maxFaces} allowed)`);
      return null;
    }

    // Select the largest face (by bounding box area) - usually the main subject
    let largestFace = results[0];
    let largestArea = 0;

    for (const result of results) {
      const box = result.detection.box;
      const area = box.width * box.height;
      if (area > largestArea) {
        largestArea = area;
        largestFace = result;
      }
    }

    console.log(`Selected largest face from ${results.length} detected (area: ${largestArea.toFixed(0)}px²)`);

    return {
      detection: largestFace.detection,
      landmarks: largestFace.landmarks,
      descriptor: largestFace.descriptor
    };
  } catch (error) {
    console.error('Error detecting face:', error);
    throw error;
  }
}

/**
 * Detect all faces in an image and generate embeddings for each
 * Uses a higher confidence threshold to reduce false positives
 * @param imageElement - HTMLImageElement or HTMLCanvasElement
 * @param minConfidence - Minimum detection confidence (0-1), default 0.6
 * @returns Array of detection results
 */
export async function detectAllFacesWithEmbeddings(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  minConfidence: number = 0.6
): Promise<Array<{
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
  descriptor: Float32Array;
}>> {
  if (!modelsLoaded) {
    throw new Error('Face models not loaded. Call loadFaceModels() first.');
  }

  try {
    // Use SSD MobileNet with higher score threshold to reduce false positives
    const results = await faceapi
      .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    console.log(`Detected ${results.length} faces with confidence >= ${minConfidence}`);
    
    // Additional filtering: only keep faces with good confidence
    const filteredResults = results.filter(result => 
      result.detection.score >= minConfidence
    );
    
    console.log(`After filtering: ${filteredResults.length} high-confidence faces`);

    return filteredResults.map(result => ({
      detection: result.detection,
      landmarks: result.landmarks,
      descriptor: result.descriptor
    }));
  } catch (error) {
    console.error('Error detecting faces:', error);
    throw error;
  }
}

/**
 * Load image from URL and create HTMLImageElement
 * @param imageUrl - URL of the image (can include SAS token)
 * @returns Promise<HTMLImageElement>
 */
export async function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS
    
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(new Error(`Failed to load image: ${imageUrl}`));
    
    img.src = imageUrl;
  });
}

/**
 * Calculate cosine similarity between two embeddings (client-side verification)
 * @param embedding1 - First 128-dim embedding
 * @param embedding2 - Second 128-dim embedding
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(
  embedding1: Float32Array | number[],
  embedding2: Float32Array | number[]
): number {
  if (embedding1.length !== 128 || embedding2.length !== 128) {
    throw new Error('Embeddings must be 128-dimensional');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < 128; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Check if face models are loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

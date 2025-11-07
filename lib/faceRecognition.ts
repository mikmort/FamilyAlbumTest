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
 * @param imageElement - HTMLImageElement or HTMLCanvasElement
 * @returns Object with detection info and embedding, or null if no face found
 */
export async function detectFaceWithEmbedding(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<{
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
  descriptor: Float32Array; // 128-dim embedding
} | null> {
  if (!modelsLoaded) {
    throw new Error('Face models not loaded. Call loadFaceModels() first.');
  }

  try {
    const result = await faceapi
      .detectSingleFace(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      return null;
    }

    return {
      detection: result.detection,
      landmarks: result.landmarks,
      descriptor: result.descriptor
    };
  } catch (error) {
    console.error('Error detecting face:', error);
    throw error;
  }
}

/**
 * Detect all faces in an image and generate embeddings for each
 * @param imageElement - HTMLImageElement or HTMLCanvasElement
 * @returns Array of detection results
 */
export async function detectAllFacesWithEmbeddings(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<Array<{
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
  descriptor: Float32Array;
}>> {
  if (!modelsLoaded) {
    throw new Error('Face models not loaded. Call loadFaceModels() first.');
  }

  try {
    const results = await faceapi
      .detectAllFaces(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptors();

    return results.map(result => ({
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

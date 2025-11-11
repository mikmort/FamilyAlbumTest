'use client';

import { useState, useRef, useEffect } from 'react';
import { loadFaceModels, detectAllFacesWithEmbeddings, areModelsLoaded } from '@/lib/faceRecognition';

interface FaceMatch {
  personId: number;
  personName: string;
  similarity: number;
  faceIndex: number;
}

export default function TestFaces() {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceMatches, setFaceMatches] = useState<FaceMatch[]>([]);
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadFaceModelsAsync();
  }, []);

  const loadFaceModelsAsync = async () => {
    if (areModelsLoaded()) {
      setModelsLoaded(true);
      return;
    }
    
    try {
      console.log('Loading face recognition models...');
      await loadFaceModels();
      setModelsLoaded(true);
      console.log('Models loaded successfully');
    } catch (err) {
      console.error('Error loading face models:', err);
      setError('Failed to load face recognition models');
    }
  };

  const recognizeFaces = async () => {
    if (!imageRef.current || !imageUrl) {
      setError('Please enter an image URL first');
      return;
    }

    setLoading(true);
    setError('');
    setFaceMatches([]);

    try {
      console.log('Detecting faces...');
      const faceDetections = await detectAllFacesWithEmbeddings(imageRef.current, 0.7);
      
      if (faceDetections.length === 0) {
        setError('No faces detected in the image');
        setLoading(false);
        return;
      }

      console.log(`Found ${faceDetections.length} face(s), identifying...`);
      
      const allMatches: FaceMatch[] = [];
      
      for (let i = 0; i < faceDetections.length; i++) {
        const face = faceDetections[i];
        const detectionScore = face.detection.score;
        
        console.log(`Face ${i + 1}: Detection confidence = ${(detectionScore * 100).toFixed(1)}%`);
        
        try {
          const identifyResponse = await fetch('/api/faces-identify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embedding: Array.from(face.descriptor),
              threshold: 0.5, // Lower threshold to see more matches
              topN: 10 // Get top 10 matches
            })
          });

          const identifyData = await identifyResponse.json();
          
          if (identifyData.success && identifyData.matches && identifyData.matches.length > 0) {
            console.log(`Face ${i + 1} matches:`, identifyData.matches.map((m: any) => 
              `${m.personName} (${(m.similarity * 100).toFixed(1)}%)`
            ));
            
            // Add all matches for this face
            identifyData.matches.forEach((match: any) => {
              allMatches.push({
                personId: match.personId,
                personName: match.personName,
                similarity: match.similarity,
                faceIndex: i
              });
            });
          } else {
            console.log(`Face ${i + 1}: No matches found`);
          }
        } catch (err) {
          console.error(`Error identifying face ${i}:`, err);
        }
      }
      
      setFaceMatches(allMatches);
      
    } catch (err: any) {
      console.error('Error recognizing faces:', err);
      setError(err.message || 'Failed to recognize faces');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Face Recognition Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p>Status: {modelsLoaded ? '✅ Models loaded' : '⏳ Loading models...'}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Image URL (from Azure Blob Storage):
        </label>
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://famprodgajerhxssqswm.blob.core.windows.net/..."
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Tip: Open a photo in the gallery, copy the blob URL from the Download link
        </p>
      </div>

      <button
        onClick={recognizeFaces}
        disabled={loading || !modelsLoaded || !imageUrl}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {loading ? 'Processing...' : 'Recognize Faces'}
      </button>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          marginBottom: '20px',
          color: '#c62828'
        }}>
          {error}
        </div>
      )}

      {imageUrl && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Image:</h3>
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Test"
            crossOrigin="anonymous"
            style={{ maxWidth: '100%', border: '1px solid #ccc' }}
            onError={() => setError('Failed to load image. Check the URL and CORS settings.')}
          />
        </div>
      )}

      {faceMatches.length > 0 && (
        <div>
          <h3>Face Recognition Results:</h3>
          {[...new Set(faceMatches.map(m => m.faceIndex))].map(faceIdx => (
            <div key={faceIdx} style={{
              marginBottom: '20px',
              padding: '15px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#f9f9f9'
            }}>
              <h4>Face #{faceIdx + 1}</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#eee' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Person</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {faceMatches
                    .filter(m => m.faceIndex === faceIdx)
                    .map((match, idx) => (
                      <tr key={idx} style={{ 
                        backgroundColor: match.similarity >= 0.65 ? '#e8f5e9' : 'white'
                      }}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                          {match.personName}
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                          {(match.similarity * 100).toFixed(1)}%
                          {match.similarity >= 0.65 && ' ✅'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

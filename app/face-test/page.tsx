'use client';

import { useState, useRef } from 'react';
import { loadFaceModels, detectAllFacesWithEmbeddings, areModelsLoaded } from '@/lib/faceRecognition';

interface Person {
  id: number;
  name: string;
  photos: string[];
}

interface TrainingResult {
  personId: number;
  personName: string;
  photoFileName: string;
  facesDetected: number;
  embeddingsSaved: number;
  success: boolean;
  error?: string;
}

interface RecognitionResult {
  faceIndex: number;
  matches: Array<{
    personName: string;
    similarity: number;
  }>;
}

export default function FaceTrainingTest() {
  const [step, setStep] = useState<'init' | 'select' | 'train' | 'test'>('init');
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [trainingResults, setTrainingResults] = useState<TrainingResult[]>([]);
  const [testPhotoUrl, setTestPhotoUrl] = useState('');
  const [recognitionResults, setRecognitionResults] = useState<RecognitionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [totalEmbeddings, setTotalEmbeddings] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load face models on mount
  useState(() => {
    loadFaceModels().then(() => setModelsLoaded(true)).catch(console.error);
  });

  const startTest = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Step 1: Clear existing embeddings
      console.log('Step 1: Clearing embeddings...');
      const clearResponse = await fetch('/api/faces-clear', { method: 'DELETE' });
      const clearData = await clearResponse.json();
      
      if (!clearData.success) {
        throw new Error(clearData.error || 'Failed to clear embeddings');
      }
      
      console.log(`Cleared ${clearData.deletedCount} embeddings`);
      
      // Step 2: Get people with photos
      console.log('Step 2: Fetching people with photos...');
      const peopleResponse = await fetch('/api/people');
      const peopleData = await peopleResponse.json();
      
      if (!peopleData.success) {
        throw new Error('Failed to fetch people');
      }
      
      // Get people with at least 5 photos (for better training)
      const eligiblePeople = peopleData.people
        .filter((p: any) => p.neCount >= 5)
        .slice(0, 10); // Take first 10 people
      
      console.log(`Found ${eligiblePeople.length} people with 5+ photos`);
      
      // Fetch photos for each person
      const peopleWithPhotos: Person[] = [];
      for (const person of eligiblePeople) {
        const photosResponse = await fetch(`/api/media?peopleIds=${person.ID}`);
        const photosData = await photosResponse.json();
        
        // API returns array of media items directly
        if (Array.isArray(photosData) && photosData.length > 0) {
          peopleWithPhotos.push({
            id: person.ID,
            name: person.neName,
            photos: photosData.map((p: any) => p.PFileName)
          });
        }
      }
      
      setPeople(peopleWithPhotos);
      setStep('select');
      
    } catch (err: any) {
      setError(err.message || 'Failed to initialize test');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const trainSelectedPeople = async () => {
    if (selectedPeople.length === 0) {
      setError('Please select at least one person to train');
      return;
    }
    
    setLoading(true);
    setError('');
    setTrainingResults([]);
    
    try {
      const results: TrainingResult[] = [];
      
      for (const personId of selectedPeople) {
        const person = people.find(p => p.id === personId);
        if (!person) continue;
        
        console.log(`Training ${person.name}...`);
        
        // Train on first 5 photos (keep rest for testing)
        const trainingPhotos = person.photos.slice(0, 5);
        
        for (const photoFileName of trainingPhotos) {
          try {
            // Get photo metadata and position data
            const urlResponse = await fetch(`/api/media?peopleIds=${personId}`);
            const mediaList = await urlResponse.json();
            
            // Find the specific photo in the list
            const photoData = Array.isArray(mediaList) 
              ? mediaList.find((m: any) => m.PFileName === photoFileName)
              : null;
            
            if (!photoData?.PBlobUrl) {
              results.push({
                personId,
                personName: person.name,
                photoFileName,
                facesDetected: 0,
                embeddingsSaved: 0,
                success: false,
                error: 'No blob URL'
              });
              continue;
            }
            
            // Get the person's position in this photo from the tagged people list
            const personPosition = photoData.TaggedPeople?.findIndex((p: any) => p.ID === personId) ?? -1;
            
            // Load image and detect faces
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = photoData.PBlobUrl;
            });
            
            const detections = await detectAllFacesWithEmbeddings(img, 0.5);
            
            // Skip photos with too many faces (likely poor quality training data)
            if (detections.length === 0) {
              results.push({
                personId,
                personName: person.name,
                photoFileName,
                facesDetected: 0,
                embeddingsSaved: 0,
                success: false,
                error: 'No faces detected'
              });
              continue;
            }
            
            if (detections.length > 4) {
              results.push({
                personId,
                personName: person.name,
                photoFileName,
                facesDetected: detections.length,
                embeddingsSaved: 0,
                success: false,
                error: `Skipped: ${detections.length} faces (too many)`
              });
              continue;
            }
            
            // Sort detections left-to-right by x position
            const sortedDetections = detections.slice().sort((a, b) => 
              a.detection.box.x - b.detection.box.x
            );
            
            // Get the face at the person's position
            let savedCount = 0;
            if (personPosition >= 0 && personPosition < sortedDetections.length) {
              const detection = sortedDetections[personPosition];
              const embedding = Array.from(detection.descriptor);
              
              const saveResponse = await fetch('/api/faces-add-embedding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  personId,
                  photoFileName,
                  embedding
                })
              });
              
              const saveData = await saveResponse.json();
              if (saveData.success) {
                savedCount++;
              }
            } else {
              // Position mismatch - detected faces don't match tagged count
              results.push({
                personId,
                personName: person.name,
                photoFileName,
                facesDetected: detections.length,
                embeddingsSaved: 0,
                success: false,
                error: `Position mismatch: person at pos ${personPosition}, but only ${detections.length} faces detected`
              });
              continue;
            }
            
            results.push({
              personId,
              personName: person.name,
              photoFileName,
              facesDetected: detections.length,
              embeddingsSaved: savedCount,
              success: savedCount > 0
            });
            
          } catch (err: any) {
            results.push({
              personId,
              personName: person.name,
              photoFileName,
              facesDetected: 0,
              embeddingsSaved: 0,
              success: false,
              error: err.message
            });
          }
        }
      }
      
      setTrainingResults(results);
      
      // Count total embeddings saved
      const totalSaved = results.reduce((sum, r) => sum + r.embeddingsSaved, 0);
      setTotalEmbeddings(totalSaved);
      
      setStep('test');
      
    } catch (err: any) {
      setError(err.message || 'Training failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const testRecognition = async () => {
    if (!testPhotoUrl || !imageRef.current) {
      setError('Please enter a photo URL');
      return;
    }
    
    setLoading(true);
    setError('');
    setRecognitionResults([]);
    
    try {
      console.log('Detecting faces...');
      const detections = await detectAllFacesWithEmbeddings(imageRef.current, 0.5);
      
      if (detections.length === 0) {
        setError('No faces detected in test photo');
        setLoading(false);
        return;
      }
      
      console.log(`Found ${detections.length} face(s), identifying...`);
      
      const results: RecognitionResult[] = [];
      
      for (let i = 0; i < detections.length; i++) {
        const detection = detections[i];
        const embedding = Array.from(detection.descriptor);
        
        const identifyResponse = await fetch('/api/faces-identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embedding,
            threshold: 0.7, // 70% threshold - higher = fewer false positives
            topN: 10 // Get more matches to see the distribution
          })
        });
        
        const identifyData = await identifyResponse.json();
        
        results.push({
          faceIndex: i,
          matches: identifyData.matches || []
        });
      }
      
      setRecognitionResults(results);
      
    } catch (err: any) {
      setError(err.message || 'Recognition failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Face Recognition Training Test</h1>
      <p>This tool helps test the face recognition system with a small, controlled dataset.</p>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <strong>Test Steps:</strong>
        <ol>
          <li>Clear existing training data</li>
          <li>Select a few people to train on</li>
          <li>Train on 5 photos per person</li>
          <li>Test recognition on a different photo</li>
        </ol>
      </div>

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', border: '1px solid #f44336', borderRadius: '4px', marginBottom: '20px', color: '#c62828' }}>
          {error}
        </div>
      )}

      {step === 'init' && (
        <div>
          <button
            onClick={startTest}
            disabled={loading || !modelsLoaded}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Initializing...' : modelsLoaded ? 'Start Test' : 'Loading models...'}
          </button>
        </div>
      )}

      {step === 'select' && (
        <div>
          <h2>Select People to Train ({people.length} available)</h2>
          <p>Select 2-3 people for testing:</p>
          
          <div style={{ marginBottom: '20px' }}>
            {people.map(person => (
              <label key={person.id} style={{ display: 'block', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(person.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPeople([...selectedPeople, person.id]);
                    } else {
                      setSelectedPeople(selectedPeople.filter(id => id !== person.id));
                    }
                  }}
                  style={{ marginRight: '10px' }}
                />
                {person.name} ({person.photos.length} photos)
              </label>
            ))}
          </div>

          <button
            onClick={trainSelectedPeople}
            disabled={loading || selectedPeople.length === 0}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: loading || selectedPeople.length === 0 ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || selectedPeople.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Training...' : `Train on ${selectedPeople.length} people`}
          </button>
        </div>
      )}

      {step === 'test' && (
        <div>
          <h2>Training Results</h2>
          <p><strong>Total embeddings saved: {totalEmbeddings}</strong></p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ backgroundColor: '#eee' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Person</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Photo</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Faces</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Saved</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {trainingResults.map((result, idx) => (
                <tr key={idx} style={{ backgroundColor: result.success ? '#e8f5e9' : '#ffebee' }}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{result.personName}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{result.photoFileName.split('/').pop()}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{result.facesDetected}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{result.embeddingsSaved}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                    {result.success ? '✅ Success' : `❌ ${result.error || 'Failed'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Test Recognition</h2>
          <p>Select a photo from the trained people to test recognition:</p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Suggested Test Photos:
            </label>
            <select
              onChange={(e) => setTestPhotoUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '10px'
              }}
            >
              <option value="">-- Select a photo --</option>
              {people
                .filter(p => selectedPeople.includes(p.id))
                .map(person => {
                  // Get untrained photos (6th photo onwards, since we train on first 5)
                  const untrainedPhotos = person.photos.slice(5);
                  return untrainedPhotos.map((photo, idx) => (
                    <option 
                      key={`${person.id}-${idx}`} 
                      value={`http://localhost:3000/api/media/${encodeURIComponent(photo)}`}
                    >
                      {person.name} - Photo #{idx + 6} ({photo.split('/').pop()})
                    </option>
                  ));
                })}
            </select>
            
            <label style={{ display: 'block', marginTop: '15px', marginBottom: '10px' }}>
              Or enter a custom URL:
            </label>
            <input
              type="text"
              value={testPhotoUrl}
              onChange={(e) => setTestPhotoUrl(e.target.value)}
              placeholder="http://localhost:3000/api/media/..."
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Tip: Photos used for training (first 5) are not shown in the dropdown
            </p>
          </div>

          <button
            onClick={testRecognition}
            disabled={loading || !testPhotoUrl}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: loading || !testPhotoUrl ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !testPhotoUrl ? 'not-allowed' : 'pointer',
              marginBottom: '20px'
            }}
          >
            {loading ? 'Testing...' : 'Test Recognition'}
          </button>

          {testPhotoUrl && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Test Image:</h3>
              <img
                ref={imageRef}
                src={testPhotoUrl}
                alt="Test"
                crossOrigin="anonymous"
                style={{ maxWidth: '100%', border: '1px solid #ccc' }}
                onError={() => setError('Failed to load test image')}
              />
            </div>
          )}

          {recognitionResults.length > 0 && (
            <div>
              <h3>Recognition Results:</h3>
              {recognitionResults.map((result, idx) => (
                <div key={idx} style={{
                  marginBottom: '20px',
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <h4>Face #{idx + 1}</h4>
                  {result.matches.length === 0 ? (
                    <p>No matches found</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#eee' }}>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Person</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Similarity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.matches.map((match, matchIdx) => (
                          <tr key={matchIdx} style={{
                            backgroundColor: match.similarity >= 0.6 ? '#e8f5e9' : 'white'
                          }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{match.personName}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                              {(match.similarity * 100).toFixed(1)}%
                              {match.similarity >= 0.6 && ' ✅'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setStep('init');
              setSelectedPeople([]);
              setTrainingResults([]);
              setTestPhotoUrl('');
              setRecognitionResults([]);
            }}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}

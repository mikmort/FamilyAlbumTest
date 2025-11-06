'use client';

import { useState, useEffect } from 'react';

interface Face {
  FaceID: number;
  PFileName: string;
  PersonID: number;
  SuggestedPersonName: string;
  BoundingBox: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  Confidence: number;
  Distance: number;
  CreatedDate: string;
}

interface Person {
  id: number;
  name: string;
}

export default function FaceReview() {
  const [faces, setFaces] = useState<Face[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadFacesAndPeople();
  }, []);

  const loadFacesAndPeople = async () => {
    try {
      setLoading(true);
      
      // Load faces needing review
      const facesResponse = await fetch('/api/faces/review?limit=50');
      if (!facesResponse.ok) {
        throw new Error('Failed to load faces');
      }
      const facesData = await facesResponse.json();
      
      // Load all people for manual selection
      const peopleResponse = await fetch('/api/people');
      if (!peopleResponse.ok) {
        throw new Error('Failed to load people');
      }
      const peopleData = await peopleResponse.json();
      
      setFaces(facesData.faces || []);
      setPeople(peopleData.map((p: any) => ({ id: p.NameID, name: p.NName })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (faceId: number, personId: number) => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/faces/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          faceId,
          personId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to confirm face match');
      }
      
      // Move to next face
      setCurrentIndex(prev => prev + 1);
      
      // Remove confirmed face from list
      setFaces(prev => prev.filter(f => f.FaceID !== faceId));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (faceId: number) => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/faces/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          faceId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reject face match');
      }
      
      // Move to next face
      setCurrentIndex(prev => prev + 1);
      
      // Remove rejected face from list
      setFaces(prev => prev.filter(f => f.FaceID !== faceId));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const handleChangeSelection = async (faceId: number, newPersonId: number) => {
    // Confirm with the new person ID
    await handleConfirm(faceId, newPersonId);
  };

  if (loading) {
    return <div className="text-center p-4">Loading faces for review...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
        <button 
          onClick={loadFacesAndPeople}
          className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (faces.length === 0) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">🎉 All caught up!</h2>
        <p className="text-gray-600">No faces need review at this time.</p>
        <button 
          onClick={loadFacesAndPeople}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Check Again
        </button>
      </div>
    );
  }

  const currentFace = faces[currentIndex] || faces[0];
  const progress = faces.length > 0 ? ((currentIndex / faces.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Face Recognition Review</h1>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{faces.length} face{faces.length !== 1 ? 's' : ''} remaining</span>
          <span>Face {currentIndex + 1} of {faces.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentFace && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Image with face bounding box */}
          <div className="relative bg-gray-100" style={{ minHeight: '400px' }}>
            <img 
              src={`/api/media/${currentFace.PFileName}`}
              alt="Photo with detected face"
              className="max-w-full mx-auto"
              style={{ maxHeight: '500px', objectFit: 'contain' }}
            />
            {/* Face bounding box overlay */}
            {currentFace.BoundingBox && (
              <div
                className="absolute border-4 border-yellow-400"
                style={{
                  top: `${currentFace.BoundingBox.top}px`,
                  left: `${currentFace.BoundingBox.left}px`,
                  width: `${currentFace.BoundingBox.right - currentFace.BoundingBox.left}px`,
                  height: `${currentFace.BoundingBox.bottom - currentFace.BoundingBox.top}px`
                }}
              />
            )}
          </div>

          {/* Face details and actions */}
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">Suggested Match</h3>
              <div className="flex items-center justify-between bg-blue-50 p-4 rounded">
                <div>
                  <p className="text-lg font-bold">{currentFace.SuggestedPersonName}</p>
                  <p className="text-sm text-gray-600">
                    Confidence: {(currentFace.Confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(currentFace.FaceID, currentFace.PersonID)}
                    disabled={processing}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-semibold"
                  >
                    ✓ Confirm
                  </button>
                  <button
                    onClick={() => handleReject(currentFace.FaceID)}
                    disabled={processing}
                    className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-400 font-semibold"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>

            {/* Alternative person selection */}
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2 text-gray-700">Or select a different person:</h4>
              <select
                className="w-full p-2 border border-gray-300 rounded"
                onChange={(e) => {
                  const personId = parseInt(e.target.value);
                  if (personId) {
                    handleChangeSelection(currentFace.FaceID, personId);
                  }
                }}
                disabled={processing}
                defaultValue=""
              >
                <option value="">-- Select different person --</option>
                {people
                  .filter(p => p.id !== currentFace.PersonID)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* Photo info */}
            <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
              <p><strong>Photo:</strong> {currentFace.PFileName}</p>
              <p><strong>Detected:</strong> {new Date(currentFace.CreatedDate).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between mt-4">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 disabled:bg-gray-200 disabled:text-gray-400"
        >
          ← Previous
        </button>
        <button
          onClick={() => setCurrentIndex(Math.min(faces.length - 1, currentIndex + 1))}
          disabled={currentIndex >= faces.length - 1}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 disabled:bg-gray-200 disabled:text-gray-400"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

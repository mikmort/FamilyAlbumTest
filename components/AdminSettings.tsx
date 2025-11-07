'use client';

import { useState, useEffect } from 'react';
import { loadFaceModels, detectFaceWithEmbedding, loadImage, areModelsLoaded } from '../lib/faceRecognition';

interface User {
  ID: number;
  Email: string;
  Role: 'Admin' | 'Full' | 'Read';
  Status: 'Active' | 'Pending' | 'Denied' | 'Suspended';
  RequestedAt: string;
  ApprovedAt: string | null;
  ApprovedBy: string | null;
  LastLoginAt: string | null;
  Notes: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

interface PendingRequest {
  ID: number;
  Email: string;
  RequestedAt: string;
  HoursSinceRequest: number;
  Notes: string | null;
}

interface RequestRoleSelection {
  [userId: number]: 'Admin' | 'Full' | 'Read';
}

interface AdminSettingsProps {
  onRequestsChange?: () => void;
}

export default function AdminSettings({ onRequestsChange }: AdminSettingsProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [requestRoles, setRequestRoles] = useState<RequestRoleSelection>({});
  
  // Face training state
  const [isTraining, setIsTraining] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<string>('');
  const [trainingResult, setTrainingResult] = useState<any>(null);
  const [incompleteSession, setIncompleteSession] = useState<any>(null);
  
  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Full' | 'Read'>('Read');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchPendingRequests();
    checkForIncompleteSession();
  }, []);

  const checkForIncompleteSession = async () => {
    try {
      const response = await fetch('/api/faces/training-progress');
      const data = await response.json();
      
      if (data.success && data.incompleteSession) {
        setIncompleteSession(data.incompleteSession);
      }
    } catch (err) {
      console.error('Error checking for incomplete session:', err);
    }
  };


  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Error loading users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/users?pending=true');
      const data = await response.json();
      
      if (data.success) {
        setPendingRequests(data.requests);
        // Initialize role selection for each request (default to 'Read')
        const initialRoles: RequestRoleSelection = {};
        data.requests.forEach((req: PendingRequest) => {
          initialRoles[req.ID] = 'Read';
        });
        setRequestRoles(initialRoles);
      }
    } catch (err) {
      console.error('Error loading pending requests:', err);
    }
  };

  const addUser = async () => {
    if (!newEmail) {
      alert('Email is required');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          role: newRole,
          status: 'Active',
          notes: newNotes || undefined
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setNewEmail('');
        setNewRole('Read');
        setNewNotes('');
        setShowAddUser(false);
        fetchUsers();
        // Success - no notification needed
      } else {
        alert(data.error || 'Failed to add user');
      }
    } catch (err) {
      alert('Error adding user');
      console.error(err);
    }
  };

  const updateUser = async (userId: number, updates: Partial<User>) => {
    try {
      // Transform capitalized field names to lowercase for API
      const apiUpdates: any = { id: userId };
      if (updates.Role !== undefined) apiUpdates.role = updates.Role;
      if (updates.Status !== undefined) apiUpdates.status = updates.Status;
      if (updates.Notes !== undefined) apiUpdates.notes = updates.Notes;
      
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiUpdates)
      });

      const data = await response.json();
      
      if (data.success) {
        fetchUsers();
        fetchPendingRequests();
        setEditingUser(null);
        // Notify parent component to refresh auth status (updates badge count)
        if (onRequestsChange) {
          onRequestsChange();
        }
        // Success - no notification needed
      } else {
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      alert('Error updating user');
      console.error(err);
    }
  };

  const deleteUser = async (userId: number, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      });

      const data = await response.json();
      
      if (data.success) {
        fetchUsers();
        // Success - no notification needed
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user');
      console.error(err);
    }
  };

  const approveRequest = async (userId: number, role: 'Admin' | 'Full' | 'Read' = 'Read') => {
    try {
      // Optimistically update UI - remove request immediately
      setPendingRequests(prev => prev.filter(req => req.ID !== userId));
      
      // Notify parent to update badge immediately
      if (onRequestsChange) {
        onRequestsChange();
      }

      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: role, status: 'Active' })
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh data to ensure consistency
        fetchUsers();
        fetchPendingRequests();
      } else {
        // If failed, restore the request and show error
        fetchPendingRequests();
        alert(data.error || 'Failed to approve request');
      }
    } catch (err) {
      // If failed, restore the request and show error
      fetchPendingRequests();
      alert('Error approving request');
      console.error(err);
    }
  };

  const denyRequest = async (userId: number) => {
    try {
      // Optimistically update UI - remove request immediately
      setPendingRequests(prev => prev.filter(req => req.ID !== userId));
      
      // Notify parent to update badge immediately
      if (onRequestsChange) {
        onRequestsChange();
      }

      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, status: 'Denied' })
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh data to ensure consistency
        fetchUsers();
        fetchPendingRequests();
      } else {
        // If failed, restore the request and show error
        fetchPendingRequests();
        alert(data.error || 'Failed to deny request');
      }
    } catch (err) {
      // If failed, restore the request and show error
      fetchPendingRequests();
      alert('Error denying request');
      console.error(err);
    }
  };

  const trainAzureFaces = async (resume: boolean = false) => {
    setIsTraining(true);
    setIsPaused(false);
    setTrainingStatus(resume ? 'Resuming training from checkpoint...' : 'Initializing Azure Face API training...');
    setTrainingResult(null);

    try {
      // Step 1: Check if baseline training has been done (if not resuming)
      let isQuickTrain = false;
      let maxPerPerson: number | undefined = undefined;
      
      if (!resume) {
        setTrainingStatus('Checking for existing training data...');
        
        const checkResponse = await fetch('/api/check-training-status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const checkData = await checkResponse.json();
        const hasBaselineTraining = checkData.success && checkData.trainedPersons > 0;
        
        isQuickTrain = !hasBaselineTraining;
        maxPerPerson = isQuickTrain ? 5 : undefined;
      }
      
      if (isPaused) {
        setTrainingStatus('Training cancelled by user');
        setIsTraining(false);
        return;
      }

      // Step 2: Seed faces from tagged photos
      setTrainingStatus(
        resume 
          ? 'Resuming face seeding from previous checkpoint...'
          : isQuickTrain 
            ? 'Seeding baseline faces (up to 5 per person)...'
            : 'Seeding all tagged faces...'
      );
      
      const seedBody: any = { 
        limit: 100,
        resume: resume
      };
      
      if (!resume && maxPerPerson) {
        seedBody.maxPerPerson = maxPerPerson;
      }
      
      const seedResponse = await fetch('/api/faces/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seedBody)
      });
      
      if (!seedResponse.ok) {
        throw new Error('Face seeding failed');
      }
      
      const seedData = await seedResponse.json();
      
      if (!seedData.success) {
        throw new Error(seedData.error || 'Face seeding failed');
      }
      
      if (isPaused) {
        setTrainingStatus('Training cancelled by user');
        setIsTraining(false);
        return;
      }

      // Step 3: Train the PersonGroup
      setTrainingStatus('Training Azure Face API model...');
      
      const trainResponse = await fetch('/api/faces/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!trainResponse.ok) {
        throw new Error('Face training failed');
      }
      
      const trainData = await trainResponse.json();
      
      if (!trainData.success) {
        throw new Error(trainData.error || 'Face training failed');
      }

      // Training complete
      const trainMode = resume ? 'Resumed training' : isQuickTrain ? 'Baseline training' : 'Full training';
      setTrainingStatus(
        `✓ ${trainMode} complete! ` +
        `Added ${seedData.facesAdded} faces for ${seedData.totalPersons} people.`
      );
      setTrainingResult({ 
        success: true, 
        personsUpdated: seedData.totalPersons,
        facesAdded: seedData.facesAdded,
        photosProcessed: seedData.photosProcessed,
        errors: seedData.errors,
        isQuickTrain: !resume && isQuickTrain,
        isResume: resume
      });
      
      // Clear incomplete session if we were resuming
      if (resume) {
        setIncompleteSession(null);
      }

    } catch (err) {
      console.error('Error training Azure faces:', err);
      setTrainingStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTrainingResult({ error: String(err) });
    } finally {
      setIsTraining(false);
      setIsPaused(false);
    }
  };

  const trainFaces = async () => {
    setIsTraining(true);
    setIsPaused(false);
    setTrainingStatus('Initializing face recognition...');
    setTrainingResult(null);

    try {
      // Step 1: Load face-api.js models (client-side)
      if (!areModelsLoaded()) {
        setTrainingStatus('Loading face recognition models (first time only, ~6MB)...');
        await loadFaceModels();
      }
      
      if (isPaused) {
        setTrainingStatus('Training cancelled by user');
        setIsTraining(false);
        return;
      }

      // Step 2: Check if baseline training has been done
      setTrainingStatus('Checking for existing training data...');
      
      const checkResponse = await fetch('/api/check-training-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const checkData = await checkResponse.json();
      const hasBaselineTraining = checkData.success && checkData.trainedPersons > 0;
      
      const isQuickTrain = !hasBaselineTraining;
      const maxPerPerson = isQuickTrain ? 5 : undefined; // Baseline: 5 photos per person
      
      if (isPaused) {
        setTrainingStatus('Training cancelled by user');
        setIsTraining(false);
        return;
      }

      // Step 3: Get photos with manual tags
      setTrainingStatus(
        isQuickTrain 
          ? 'Fetching tagged photos (up to 5 per person)...'
          : 'Fetching all tagged photos...'
      );
      
      // Query for photos with manual tags using dedicated endpoint
      const queryParams = maxPerPerson ? `?maxPerPerson=${maxPerPerson}` : '';
      const photosResponse = await fetch(`/api/faces-tagged-photos${queryParams}`);
      if (!photosResponse.ok) {
        throw new Error('Failed to fetch tagged photos');
      }
      
      const photosData = await photosResponse.json();
      const photos = photosData.photos || [];
      
      if (photos.length === 0) {
        setTrainingStatus('No manually tagged photos found. Please add some tags first!');
        setTrainingResult({ success: false, error: 'No tagged photos' });
        setIsTraining(false);
        return;
      }

      // Group photos by person for progress tracking
      const photosByPerson: { [personId: number]: any[] } = {};
      photos.forEach((photo: any) => {
        const personId = photo.PersonID;
        if (!photosByPerson[personId]) {
          photosByPerson[personId] = [];
        }
        photosByPerson[personId].push(photo);
      });

      const totalPhotos = photos.length;
      const totalPeople = Object.keys(photosByPerson).length;

      setTrainingStatus(`Processing ${totalPhotos} photos for ${totalPeople} people...`);

      // Step 4: Process each photo and generate embeddings
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const photo of photos) {
        if (isPaused) {
          setTrainingStatus('Training cancelled by user');
          setIsTraining(false);
          return;
        }

        try {
          processedCount++;
          setTrainingStatus(
            `Processing ${photo.PersonName}: ${processedCount}/${totalPhotos} photos...`
          );

          // Load image with SAS token
          const imageUrl = photo.url;
          const img = await loadImage(imageUrl);

          // Detect face and generate embedding
          const faceResult = await detectFaceWithEmbedding(img);

          if (!faceResult) {
            console.warn(`No face detected in ${photo.PFileName} for ${photo.PersonName}`);
            errorCount++;
            continue;
          }

          // Convert Float32Array to regular array for JSON
          const embeddingArray = Array.from(faceResult.descriptor);

          // Send embedding to server
          const addResponse = await fetch('/api/faces-add-embedding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personId: photo.PersonID,
              photoFileName: photo.PFileName,
              embedding: embeddingArray
            })
          });

          if (addResponse.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Failed to save embedding for ${photo.PFileName}`);
          }

        } catch (error) {
          errorCount++;
          console.error(`Error processing ${photo.PFileName}:`, error);
        }

        // Update progress every 5 photos
        if (processedCount % 5 === 0 || processedCount === totalPhotos) {
          setTrainingStatus(
            `Processed ${processedCount}/${totalPhotos} photos (${successCount} successful, ${errorCount} failed)`
          );
        }
      }

      // Training complete
      if (successCount > 0) {
        const trainMode = isQuickTrain ? 'Baseline training' : 'Full training';
        setTrainingStatus(
          `✓ ${trainMode} complete! ` +
          `Processed ${successCount} faces for ${totalPeople} people.`
        );
        setTrainingResult({ 
          success: true, 
          personsUpdated: totalPeople,
          facesAdded: successCount,
          photosProcessed: totalPhotos,
          errors: errorCount,
          isQuickTrain
        });
      } else {
        setTrainingStatus('Training failed: No faces could be processed');
        setTrainingResult({ 
          success: false, 
          error: 'No faces detected',
          errors: errorCount 
        });
      }

    } catch (err) {
      console.error('Error training faces:', err);
      setTrainingStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTrainingResult({ error: String(err) });
    } finally {
      setIsTraining(false);
      setIsPaused(false);
    }
  };

  const pauseTraining = () => {
    setIsPaused(true);
    setTrainingStatus('Cancelling training...');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return '#dc3545';
      case 'Full': return '#007bff';
      case 'Read': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#28a745';
      case 'Pending': return '#ffc107';
      case 'Denied': return '#dc3545';
      case 'Suspended': return '#6c757d';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading admin settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchUsers}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h1>🔐 User Management</h1>
        <p className="manager-subtitle">Manage user permissions and access</p>
      </div>

      {/* Incomplete Training Session Banner */}
      {incompleteSession && !isTraining && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>
            ⚠️ Incomplete Training Session Found
          </h3>
          <p style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>
            A previous training session was interrupted. Progress: {incompleteSession.processedPhotos}/{incompleteSession.totalPhotos} photos 
            ({incompleteSession.percentComplete}%) across {incompleteSession.processedPersons}/{incompleteSession.totalPersons} people.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => trainAzureFaces(true)}
            style={{ marginRight: '0.5rem' }}
          >
            ↻ Resume Training
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              if (confirm('Are you sure you want to start over? This will discard the incomplete session.')) {
                setIncompleteSession(null);
              }
            }}
          >
            🗑️ Start Over
          </button>
        </div>
      )}

      {/* Face Recognition Training Section */}
      <div className="card" style={{ marginBottom: '2rem', background: '#f0f8ff', borderColor: '#007bff' }}>
        <h2 style={{ marginTop: 0 }}>🧠 Face Recognition Training</h2>
        <p style={{ color: '#666', marginBottom: '0.5rem' }}>
          Train the face recognition AI on confirmed face tags to improve accuracy and performance.
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
          Uses intelligent sampling: people with many photos are sampled across their timeline to capture aging and appearance changes.
        </p>
        <p style={{ color: '#007bff', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: '500' }}>
          💡 Tip: First training run processes up to 5 photos per person for quick baseline. Click again for full training!
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: trainingStatus ? '1rem' : 0 }}>
          <button 
            className="btn btn-primary"
            onClick={() => trainAzureFaces(false)}
            disabled={isTraining}
          >
            {isTraining ? '⏳ Training...' : '🚀 Train Now'}
          </button>
          {isTraining && !isPaused && (
            <button 
              className="btn btn-danger"
              onClick={pauseTraining}
              style={{ background: '#dc3545' }}
            >
              ⏸ Cancel
            </button>
          )}
        </div>
        
        {trainingStatus && (
          <div style={{ 
            padding: '1rem', 
            background: 'white', 
            borderRadius: '8px', 
            border: '1px solid #ddd',
            marginTop: '1rem'
          }}>
            <div style={{ 
              fontSize: '0.95rem', 
              color: trainingResult?.success ? '#28a745' : '#666',
              fontWeight: '500'
            }}>
              {trainingStatus}
            </div>
            {trainingResult?.success && trainingResult.details && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                {trainingResult.seedData && trainingResult.seedData.photosProcessed > 0 && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#e7f3ff', borderRadius: '4px' }}>
                    <strong>Seeding from existing tags:</strong>
                    <ul style={{ marginTop: '0.25rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                      <li>Photos processed: {trainingResult.seedData.photosProcessed}</li>
                      <li>Faces detected: {trainingResult.seedData.facesDetected}</li>
                      <li>Faces matched: {trainingResult.seedData.facesMatched}</li>
                      {trainingResult.seedData.facesUnmatched > 0 && (
                        <li style={{ color: '#856404' }}>Unmatched faces: {trainingResult.seedData.facesUnmatched}</li>
                      )}
                    </ul>
                  </div>
                )}
                <strong>Training results:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                  <li>Persons updated: {trainingResult.personsUpdated}</li>
                  {trainingResult.details.slice(0, 5).map((detail: any, idx: number) => (
                    <li key={idx}>
                      {detail.personName}: {detail.encodingCount}/{detail.totalFaces} faces ({detail.samplePercentage}% sample)
                    </li>
                  ))}
                  {trainingResult.details.length > 5 && (
                    <li style={{ color: '#666', fontStyle: 'italic' }}>
                      ... and {trainingResult.details.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', background: '#fff3cd', borderColor: '#ffc107' }}>
          <h2 style={{ marginTop: 0 }}>⏳ Pending Access Requests ({pendingRequests.length})</h2>
          {pendingRequests.map(request => (
            <div key={request.ID} style={{ 
              padding: '1rem', 
              background: 'white', 
              borderRadius: '8px', 
              marginBottom: '0.5rem',
              border: '1px solid #ffc107'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ flex: '1 1 250px' }}>
                  <strong>{request.Email}</strong>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                    Requested {Math.floor(request.HoursSinceRequest / 24)}d {request.HoursSinceRequest % 24}h ago
                  </div>
                  {request.Notes && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      {request.Notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    value={requestRoles[request.ID] || 'Read'}
                    onChange={(e) => setRequestRoles({
                      ...requestRoles,
                      [request.ID]: e.target.value as 'Admin' | 'Full' | 'Read'
                    })}
                    style={{ 
                      padding: '0.4rem 0.6rem', 
                      borderRadius: '4px', 
                      border: '1px solid #ddd',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="Read">Read</option>
                    <option value="Full">Full</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => approveRequest(request.ID, requestRoles[request.ID] || 'Read')}
                  >
                    ✓ Approve
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => denyRequest(request.ID)}
                  >
                    ✗ Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Button */}
      <div className="manager-toolbar">
        <button 
          className="btn btn-success"
          onClick={() => setShowAddUser(!showAddUser)}
        >
          ➕ Add New User
        </button>
      </div>

      {/* Add User Form */}
      {showAddUser && (
        <div className="manager-form-card">
          <h3>Add New User</h3>
          <div className="form-group">
            <label>Email *</label>
            <input 
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
              <option value="Read">Read - View only access</option>
              <option value="Full">Full - Can edit and upload</option>
              <option value="Admin">Admin - Full management access</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea 
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
          <div className="flex flex-gap mt-2">
            <button className="btn btn-success" onClick={addUser}>
              ✓ Add User
            </button>
            <button className="btn btn-secondary" onClick={() => setShowAddUser(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="manager-list-card">
        <h2>All Users ({users.length})</h2>
        <div className="manager-table-container">
          <table className="manager-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.ID}>
                  <td className="name-cell">{user.Email}</td>
                  <td>
                    {editingUser?.ID === user.ID ? (
                      <select 
                        value={editingUser.Role}
                        onChange={(e) => setEditingUser({...editingUser, Role: e.target.value as any})}
                        style={{ padding: '0.25rem', borderRadius: '4px' }}
                      >
                        <option value="Read">Read</option>
                        <option value="Full">Full</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        background: getRoleColor(user.Role),
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {user.Role}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingUser?.ID === user.ID ? (
                      <select 
                        value={editingUser.Status}
                        onChange={(e) => setEditingUser({...editingUser, Status: e.target.value as any})}
                        style={{ padding: '0.25rem', borderRadius: '4px' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Denied">Denied</option>
                      </select>
                    ) : (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        background: getStatusColor(user.Status),
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {user.Status}
                      </span>
                    )}
                  </td>
                  <td className="relation-cell">
                    {user.LastLoginAt 
                      ? new Date(user.LastLoginAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="actions-cell">
                    {editingUser?.ID === user.ID ? (
                      <>
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => updateUser(user.ID, { 
                            Role: editingUser.Role, 
                            Status: editingUser.Status 
                          })}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => setEditingUser(null)}
                          title="Cancel"
                        >
                          ✗
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => setEditingUser(user)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => deleteUser(user.ID, user.Email)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Role Permissions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: getRoleColor('Admin') }}>Admin:</strong> Full access including user management, can add/remove users, modify all content
          </div>
          <div>
            <strong style={{ color: getRoleColor('Full') }}>Full:</strong> Can view, upload, edit, and tag photos. Cannot manage users
          </div>
          <div>
            <strong style={{ color: getRoleColor('Read') }}>Read:</strong> View-only access, can browse and download photos
          </div>
        </div>
      </div>
    </div>
  );
}

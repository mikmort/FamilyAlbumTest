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

  const checkForIncompleteSession = () => {
    try {
      const checkpointStr = localStorage.getItem('faceTrainingCheckpoint');
      if (checkpointStr) {
        const checkpoint = JSON.parse(checkpointStr);
        setIncompleteSession(checkpoint);
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

  // trainAzureFaces function removed - requires Microsoft Limited Access approval
  // See docs/AZURE_FACE_API_RESTRICTIONS.md for details
  
  const trainFaces = async (resumeFromCheckpoint: boolean = false) => {
    setIsTraining(true);
    setIsPaused(false);
    setTrainingStatus(resumeFromCheckpoint ? 'Resuming from checkpoint...' : 'Initializing face recognition...');
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

      // Step 2: Check for existing checkpoint or training status
      let processedPhotos = new Set<string>();
      let checkpointData: any = null;
      
      if (resumeFromCheckpoint) {
        const checkpoint = localStorage.getItem('faceTrainingCheckpoint');
        if (checkpoint) {
          checkpointData = JSON.parse(checkpoint);
          processedPhotos = new Set(checkpointData.processedPhotos || []);
          setTrainingStatus(`Resuming from checkpoint: ${processedPhotos.size} photos already processed...`);
        }
      } else {
        // Clear any old checkpoint when starting fresh
        localStorage.removeItem('faceTrainingCheckpoint');
      }

      setTrainingStatus('Checking for existing training data...');
      
      const checkResponse = await fetch('/api/check-training-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const checkData = await checkResponse.json();
      const hasBaselineTraining = checkData.success && checkData.trainedPersons > 0;
      
      // Always use smart sampling (distributed across timeline, logarithmic scaling)
      const smartSample = true;
      
      if (isPaused) {
        setTrainingStatus('Training cancelled by user');
        setIsTraining(false);
        return;
      }

      // Step 3: Get photos with manual tags using smart sampling
      // Fetch all batches automatically until hasMore=false
      setTrainingStatus(
        resumeFromCheckpoint
          ? 'Fetching remaining photos to process...'
          : 'Fetching tagged photos with intelligent sampling...'
      );
      
      let photos: any[] = [];
      let currentBatch = 0;
      let batchInfo: any = null;
      
      do {
        if (isPaused) {
          setTrainingStatus('Training cancelled by user');
          setIsTraining(false);
          return;
        }
        
        // Fetch next batch (50 people per batch to keep request time under 30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        try {
          const batchResponse = await fetch(`/api/faces-tagged-photos?smartSample=true&batch=${currentBatch}&batchSize=50`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!batchResponse.ok) {
            const errorText = await batchResponse.text();
            console.error('Failed to fetch tagged photos batch:', batchResponse.status, errorText);
            throw new Error(`Failed to fetch tagged photos batch ${currentBatch}: ${batchResponse.status} - ${errorText.substring(0, 200)}`);
          }
          
          const batchData = await batchResponse.json();
          batchInfo = batchData.batch;
          
          if (batchData.photos && batchData.photos.length > 0) {
            photos.push(...batchData.photos);
            setTrainingStatus(
              `Fetching batch ${currentBatch + 1}/${batchInfo?.totalBatches || '?'}: ` +
              `${photos.length} photos from ${batchInfo?.totalPersons || '?'} people...`
            );
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Request timeout: batch ${currentBatch} took longer than 60 seconds`);
          }
          throw fetchError;
        }
        
        currentBatch++;
      } while (batchInfo?.hasMore === true);
      
      // Filter out already processed photos if resuming
      if (resumeFromCheckpoint && processedPhotos.size > 0) {
        photos = photos.filter((p: any) => !processedPhotos.has(p.PFileName));
        setTrainingStatus(`${photos.length} photos remaining to process...`);
      }
      
      if (photos.length === 0) {
        if (resumeFromCheckpoint && processedPhotos.size > 0) {
          setTrainingStatus('✓ All photos already processed!');
          setTrainingResult({ 
            success: true,
            personsUpdated: checkpointData?.totalPeople || 0,
            facesAdded: checkpointData?.successCount || 0,
            photosProcessed: checkpointData?.totalPhotos || 0,
            errors: checkpointData?.errorCount || 0
          });
          localStorage.removeItem('faceTrainingCheckpoint');
        } else {
          setTrainingStatus('No manually tagged photos found. Please add some tags first!');
          setTrainingResult({ success: false, error: 'No tagged photos' });
        }
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

      // Use the actual filtered photos count for accurate progress tracking
      const totalPhotos = photos.length;
      const totalPeople = Object.keys(photosByPerson).length;
      const alreadyProcessed = resumeFromCheckpoint ? processedPhotos.size : 0;
      const totalBatches = batchInfo?.totalBatches || 1;
      const totalPersonsInDB = batchInfo?.totalPersons || totalPeople;

      setTrainingStatus(
        `Fetched ${totalBatches} batch${totalBatches > 1 ? 'es' : ''}: ` +
        `${photos.length} photos for ${totalPeople} people (${totalPersonsInDB} total in DB)...` +
        (alreadyProcessed > 0 ? ` (${alreadyProcessed} already done)` : '')
      );

      // Step 4: Process each photo and generate embeddings
      let processedCount = alreadyProcessed;
      let successCount = checkpointData?.successCount || 0;
      let errorCount = checkpointData?.errorCount || 0;
      
      // Track current person for better progress display
      let currentPersonId: number | null = null;
      let currentPersonPhotoNum = 0;
      let currentPersonTotalPhotos = 0;
      let completedPeople = 0;

      for (const photo of photos) {
        if (isPaused) {
          setTrainingStatus('Training cancelled by user');
          setIsTraining(false);
          return;
        }

        try {
          processedCount++;
          
          // Track person progress
          if (currentPersonId !== photo.PersonID) {
            if (currentPersonId !== null) {
              completedPeople++;
            }
            currentPersonId = photo.PersonID;
            currentPersonPhotoNum = 0;
            currentPersonTotalPhotos = photosByPerson[photo.PersonID].length;
          }
          currentPersonPhotoNum++;
          
          setTrainingStatus(
            `[${completedPeople + 1}/${totalPeople} people] ${photo.PersonName}: ` +
            `photo ${currentPersonPhotoNum}/${currentPersonTotalPhotos} ` +
            `(${processedCount}/${totalPhotos} total)`
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
            processedPhotos.add(photo.PFileName);
          } else {
            errorCount++;
            console.error(`Failed to save embedding for ${photo.PFileName}`);
          }

        } catch (error) {
          errorCount++;
          console.error(`Error processing ${photo.PFileName}:`, error);
        }

        // Save checkpoint every 10 photos
        if (processedCount % 10 === 0) {
          const checkpoint = {
            processedPhotos: Array.from(processedPhotos),
            successCount,
            errorCount,
            totalPhotos,
            totalPeople,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('faceTrainingCheckpoint', JSON.stringify(checkpoint));
        }
      }

      // Training complete - clear checkpoint
      localStorage.removeItem('faceTrainingCheckpoint');
      setIncompleteSession(null);
      
      if (successCount > 0) {
        setTrainingStatus(
          `✓ Training complete! ` +
          `Processed ${successCount} faces for ${totalPeople} people.`
        );
        setTrainingResult({ 
          success: true, 
          personsUpdated: totalPeople,
          facesAdded: successCount,
          photosProcessed: totalPhotos,
          errors: errorCount
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

      {/* Face Recognition Training Section */}
      <div className="card" style={{ marginBottom: '2rem', background: '#f0f8ff', borderColor: '#007bff' }}>
        <h2 style={{ marginTop: 0 }}>🧠 Face Recognition Training</h2>
        <p style={{ color: '#666', marginBottom: '0.5rem' }}>
          Train the face recognition AI on confirmed face tags to improve accuracy and performance.
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
          Uses intelligent sampling: samples are distributed across each person's timeline to capture aging and appearance changes.
        </p>
        <p style={{ color: '#007bff', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: '500' }}>
          💡 Smart sampling: 5-10 photos for people with few photos, up to 60 photos for those with thousands. Logarithmic scaling ensures efficiency!
        </p>
        
        {/* Checkpoint Resume Banner */}
        {incompleteSession && !isTraining && (
          <div style={{
            padding: '1rem',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <div style={{ fontWeight: '600', color: '#856404', marginBottom: '0.5rem' }}>
              ⚠️ Incomplete Training Session Found
            </div>
            <div style={{ fontSize: '0.9rem', color: '#856404', marginBottom: '0.75rem' }}>
              Progress: {incompleteSession.processedPhotos?.length || 0} of {incompleteSession.totalPhotos} photos processed
              {incompleteSession.totalPeople && ` (${incompleteSession.totalPeople} people)`}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-primary"
                onClick={() => trainFaces(true)}
                style={{ fontSize: '0.9rem' }}
              >
                ▶️ Resume Training
              </button>
              <button 
                className="btn"
                onClick={() => {
                  localStorage.removeItem('faceTrainingCheckpoint');
                  setIncompleteSession(null);
                }}
                style={{ fontSize: '0.9rem', background: '#6c757d', color: 'white' }}
              >
                🗑️ Clear & Start Over
              </button>
            </div>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: trainingStatus ? '1rem' : 0 }}>
          <button 
            className="btn btn-primary"
            onClick={() => trainFaces()}
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

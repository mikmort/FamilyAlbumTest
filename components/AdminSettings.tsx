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
  const [faceModel, setFaceModel] = useState<'face-api-js' | 'insightface'>('insightface'); // Default to better model
  
  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Full' | 'Read'>('Read');
  const [newNotes, setNewNotes] = useState('');
  
  // Midsize generation state
  const [midsizeStatus, setMidsizeStatus] = useState<{
    filesNeedingMidsize: number;
    message: string;
  } | null>(null);
  const [midsizeProgress, setMidsizeProgress] = useState<any>(null);
  const [isGeneratingMidsize, setIsGeneratingMidsize] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState<any>(null);
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false);
  const [thumbnailRegenerateResult, setThumbnailRegenerateResult] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
    fetchPendingRequests();
    fetchMidsizeStatus();
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

  const fetchMidsizeStatus = async () => {
    try {
      const response = await fetch('/api/generate-midsize');
      const data = await response.json();
      setMidsizeStatus(data);
    } catch (err) {
      console.error('Error loading midsize status:', err);
    }
  };

  const startMidsizeGeneration = async (batchSize: number = 50) => {
    try {
      setIsGeneratingMidsize(true);
      setMidsizeProgress(null); // Clear previous progress
      
      // Keep processing batches until no more files need processing
      let hasMore = true;
      let totalProcessed = 0;
      let totalSucceeded = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      
      while (hasMore) {
        const response = await fetch('/api/generate-midsize/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          alert(`Error: ${data.error}`);
          break;
        }
        
        // Poll for this batch to complete
        hasMore = await waitForBatchCompletion();
        
        // Update totals
        if (midsizeProgress) {
          totalProcessed += midsizeProgress.processed;
          totalSucceeded += midsizeProgress.succeeded;
          totalFailed += midsizeProgress.failed;
          totalSkipped += midsizeProgress.skipped;
        }
        
        // Check if there are more files to process
        const statusResponse = await fetch('/api/generate-midsize');
        const statusData = await statusResponse.json();
        
        if (statusData.filesNeedingMidsize === 0) {
          hasMore = false;
        }
      }
      
      // Final status update
      setMidsizeProgress({
        isRunning: false,
        processed: totalProcessed,
        succeeded: totalSucceeded,
        failed: totalFailed,
        skipped: totalSkipped
      });
      
      setIsGeneratingMidsize(false);
      fetchMidsizeStatus();
      alert(`✅ All batches complete! Processed ${totalProcessed} images.`);
      
    } catch (err: any) {
      console.error('Error starting midsize generation:', err);
      alert(`Error: ${err.message}`);
      setIsGeneratingMidsize(false);
    }
  };

  const waitForBatchCompletion = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch('/api/generate-midsize/progress');
          const data = await response.json();
          setMidsizeProgress(data);
          
          if (!data.isRunning) {
            clearInterval(pollInterval);
            resolve(true);
          }
        } catch (err) {
          console.error('Error polling progress:', err);
          clearInterval(pollInterval);
          resolve(false);
        }
      }, 2000); // Poll every 2 seconds
    });
  };

  const pollMidsizeProgress = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/generate-midsize/progress');
        const data = await response.json();
        setMidsizeProgress(data);
        
        if (!data.isRunning) {
          clearInterval(pollInterval);
          setIsGeneratingMidsize(false);
          // Refresh status
          fetchMidsizeStatus();
        }
      } catch (err) {
        console.error('Error polling progress:', err);
        clearInterval(pollInterval);
        setIsGeneratingMidsize(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  const startRegenerateMidsize = async () => {
    if (!confirm('This will regenerate ALL existing midsize images with correct EXIF orientation. This may take a while. Continue?')) {
      return;
    }

    try {
      setIsRegenerating(true);
      const response = await fetch('/api/regenerate-midsize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Regeneration started! Check progress below.');
        pollRegenerateProgress();
      } else {
        alert(`Error: ${data.error}`);
        setIsRegenerating(false);
      }
    } catch (err: any) {
      console.error('Error starting regeneration:', err);
      alert(`Error: ${err.message}`);
      setIsRegenerating(false);
    }
  };

  const pollRegenerateProgress = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/regenerate-midsize/progress');
        const data = await response.json();
        setRegenerateProgress(data);
        
        if (!data.isRunning) {
          clearInterval(pollInterval);
          setIsRegenerating(false);
        }
      } catch (err) {
        console.error('Error polling regenerate progress:', err);
        clearInterval(pollInterval);
        setIsRegenerating(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  const regenerateThumbnails = async () => {
    if (!confirm('This will regenerate ALL photo thumbnails with correct EXIF orientation. This may take several minutes. Continue?')) {
      return;
    }

    try {
      setIsRegeneratingThumbnails(true);
      setThumbnailRegenerateResult(null);
      
      const response = await fetch('/api/regenerate-photo-thumbnails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setThumbnailRegenerateResult(data);
        alert(`Thumbnail regeneration complete!\n\nSuccess: ${data.success}\nFailed: ${data.failed}\nSkipped: ${data.skipped}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      console.error('Error regenerating thumbnails:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsRegeneratingThumbnails(false);
    }
  };

  const fixMissingDimensions = async () => {
    if (!confirm('This will extract and update dimensions for all pictures with missing width/height. Continue?')) {
      return;
    }

    try {
      setIsRegeneratingThumbnails(true); // Reuse loading state
      
      const response = await fetch('/api/fix-missing-dimensions', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const msg = `Dimension fix complete!\n\nTotal: ${data.total}\nFixed: ${data.fixed}\nFailed: ${data.failed}`;
        alert(msg);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      console.error('Error fixing dimensions:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsRegeneratingThumbnails(false);
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
      // Step 1: Load models if using face-api.js (client-side)
      if (faceModel === 'face-api-js') {
        if (!areModelsLoaded()) {
          setTrainingStatus('Loading face-api.js models (first time only, ~6MB)...');
          await loadFaceModels();
        }
      } else {
        setTrainingStatus('Using InsightFace (Python API) for state-of-the-art recognition...');
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
        
        // Fetch next batch (10 people per batch to keep request time under 30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        try {
          const batchResponse = await fetch(`/api/faces-tagged-photos?smartSample=true&batch=${currentBatch}&batchSize=10`, {
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
          
          let embeddingArray: number[];
          let modelVersion: string;
          let embeddingDimensions: number;
          
          if (faceModel === 'insightface') {
            // Use Python API for InsightFace (512-dim, better accuracy)
            const generateResponse = await fetch('/api/generate-embeddings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl })
            });
            
            if (!generateResponse.ok) {
              const errorText = await generateResponse.text();
              console.error(`InsightFace failed for ${photo.PFileName}:`, errorText);
              errorCount++;
              continue;
            }
            
            const generateData = await generateResponse.json();
            
            if (!generateData.success) {
              console.warn(`No face detected (InsightFace) in ${photo.PFileName} for ${photo.PersonName}`);
              errorCount++;
              continue;
            }
            
            embeddingArray = generateData.embedding;
            modelVersion = 'insightface-arcface';
            embeddingDimensions = 512;
            
          } else {
            // Use face-api.js (128-dim, browser-based)
            const img = await loadImage(imageUrl);
            const faceResult = await detectFaceWithEmbedding(img);

            if (!faceResult) {
              console.warn(`No face detected in ${photo.PFileName} for ${photo.PersonName}`);
              errorCount++;
              continue;
            }

            // Convert Float32Array to regular array for JSON
            embeddingArray = Array.from(faceResult.descriptor);
            modelVersion = 'face-api-js';
            embeddingDimensions = 128;
          }

          // Send embedding to server
          const addResponse = await fetch('/api/faces-add-embedding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personId: photo.PersonID,
              photoFileName: photo.PFileName,
              embedding: embeddingArray,
              modelVersion,
              embeddingDimensions
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

      {/* Face Recognition section moved to bottom, after all user management sections */}

      {/* MIDSIZE IMAGE GENERATION SECTION - DELETED - See git history to restore if needed */}

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

      {/* Thumbnail Regeneration Section */}
      <div className="card" style={{ marginBottom: '2rem', background: '#fff9e6', borderColor: '#ffc107' }}>
        <h2 style={{ marginTop: 0 }}>🖼️ Image Maintenance</h2>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Thumbnail Regeneration</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Regenerate photo thumbnails with correct EXIF orientation. Use this if thumbnails appear rotated incorrectly.
          </p>
          
          <button 
            className="btn btn-warning"
            onClick={regenerateThumbnails}
            disabled={isRegeneratingThumbnails}
            style={{ marginRight: '1rem' }}
          >
            {isRegeneratingThumbnails ? '⏳ Processing...' : '🔄 Regenerate All Thumbnails'}
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Fix Missing Dimensions</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Extract and update dimensions for pictures with missing width/height information.
          </p>
          
          <button 
            className="btn btn-primary"
            onClick={fixMissingDimensions}
            disabled={isRegeneratingThumbnails}
          >
            {isRegeneratingThumbnails ? '⏳ Processing...' : '📐 Fix Missing Dimensions'}
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Generate Midsize Images</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Generate 1080px midsize versions for large images (&gt;1MB and &gt;1080px) to improve loading performance.
            {midsizeStatus && (
              <span style={{ display: 'block', marginTop: '0.5rem', fontWeight: '500', color: '#856404' }}>
                📊 {midsizeStatus.filesNeedingMidsize} images need midsize versions
              </span>
            )}
          </p>
          
          <button 
            className="btn btn-primary"
            onClick={() => startMidsizeGeneration(50)}
            disabled={isGeneratingMidsize || (midsizeStatus?.filesNeedingMidsize === 0)}
          >
            {isGeneratingMidsize ? '⏳ Generating...' : '🖼️ Generate Midsize Images'}
          </button>

          {midsizeProgress && midsizeProgress.isRunning && (
            <div style={{ 
              marginTop: '1rem',
              padding: '1rem', 
              background: 'white', 
              borderRadius: '8px', 
              border: '1px solid #ddd'
            }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                📈 Progress: {midsizeProgress.processed}/{midsizeProgress.total}
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                <span style={{ color: '#28a745' }}>✅ {midsizeProgress.succeeded} succeeded</span>
                {' · '}
                <span style={{ color: '#dc3545' }}>❌ {midsizeProgress.failed} failed</span>
                {' · '}
                <span style={{ color: '#6c757d' }}>⏭️ {midsizeProgress.skipped} skipped</span>
              </div>
            </div>
          )}

          {midsizeProgress && !midsizeProgress.isRunning && midsizeProgress.processed > 0 && (
            <div style={{ 
              marginTop: '1rem',
              padding: '1rem', 
              background: 'white', 
              borderRadius: '8px', 
              border: '1px solid #ddd'
            }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem', color: '#28a745' }}>
                ✅ Batch Complete
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                <li>Total processed: {midsizeProgress.processed}</li>
                <li style={{ color: '#28a745' }}>Success: {midsizeProgress.succeeded}</li>
                {midsizeProgress.failed > 0 && (
                  <li style={{ color: '#dc3545' }}>Failed: {midsizeProgress.failed}</li>
                )}
                {midsizeProgress.skipped > 0 && (
                  <li style={{ color: '#6c757d' }}>Skipped: {midsizeProgress.skipped}</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {thumbnailRegenerateResult && (
          <div style={{ 
            marginTop: '1rem',
            padding: '1rem', 
            background: 'white', 
            borderRadius: '8px', 
            border: '1px solid #ddd'
          }}>
            <div style={{ fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              ✅ Regeneration Complete
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>Total photos: {thumbnailRegenerateResult.total}</li>
              <li style={{ color: '#28a745' }}>Success: {thumbnailRegenerateResult.success}</li>
              {thumbnailRegenerateResult.failed > 0 && (
                <li style={{ color: '#dc3545' }}>Failed: {thumbnailRegenerateResult.failed}</li>
              )}
              {thumbnailRegenerateResult.skipped > 0 && (
                <li style={{ color: '#6c757d' }}>Skipped: {thumbnailRegenerateResult.skipped}</li>
              )}
            </ul>
            {thumbnailRegenerateResult.errors && thumbnailRegenerateResult.errors.length > 0 && (
              <details style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', color: '#dc3545' }}>View Errors</summary>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  {thumbnailRegenerateResult.errors.map((err: any, idx: number) => (
                    <li key={idx}>{err.fileName}: {err.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Face Recognition Training Section - MOVED AFTER USER MANAGEMENT */}
      <div className="card" style={{ marginBottom: '2rem', background: '#f0f8ff', borderColor: '#007bff' }}>
        <h2 style={{ marginTop: 0 }}>🧠 Face Recognition Training</h2>
        <p style={{ color: '#666', marginBottom: '0.5rem' }}>
          Train the face recognition AI on confirmed face tags to improve accuracy and performance.
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
          Uses intelligent sampling: prioritizes most recent photos and solo/duo shots for optimal training quality.
        </p>
        <p style={{ color: '#007bff', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: '500' }}>
          💡 Smart sampling: 5-10 photos for people with few photos, up to 60 photos for those with thousands. Logarithmic scaling ensures efficiency!
        </p>
        
        {/* Model Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
            Face Recognition Model:
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.5rem', border: '2px solid', borderColor: faceModel === 'insightface' ? '#007bff' : '#ddd', borderRadius: '8px', background: faceModel === 'insightface' ? '#e7f3ff' : 'white' }}>
              <input
                type="radio"
                value="insightface"
                checked={faceModel === 'insightface'}
                onChange={(e) => setFaceModel(e.target.value as 'insightface' | 'face-api-js')}
                disabled={isTraining}
                style={{ marginRight: '0.5rem' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#007bff' }}>InsightFace (Recommended)</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>512-dim ArcFace · 99.8% accuracy · Better across ages</div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.5rem', border: '2px solid', borderColor: faceModel === 'face-api-js' ? '#007bff' : '#ddd', borderRadius: '8px', background: faceModel === 'face-api-js' ? '#e7f3ff' : 'white' }}>
              <input
                type="radio"
                value="face-api-js"
                checked={faceModel === 'face-api-js'}
                onChange={(e) => setFaceModel(e.target.value as 'insightface' | 'face-api-js')}
                disabled={isTraining}
                style={{ marginRight: '0.5rem' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#666' }}>face-api.js (Legacy)</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>128-dim FaceNet · Browser-based · Faster but less accurate</div>
              </div>
            </label>
          </div>
        </div>
        
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

    </div>
  );
}

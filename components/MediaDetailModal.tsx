'use client';

import { useState, useEffect, useRef } from 'react';
import { MediaItem, Person, Event } from '../lib/types';

interface MediaDetailModalProps {
  media: MediaItem;
  onClose: () => void;
  onUpdate?: (updatedMedia: MediaItem) => void;
  startFullscreen?: boolean;
}

export default function MediaDetailModal({
  media,
  onClose,
  onUpdate,
  startFullscreen = false,
}: MediaDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(startFullscreen);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const [description, setDescription] = useState(media.PDescription || '');
  const [month, setMonth] = useState<number | ''>(media.PMonth || '');
  const [year, setYear] = useState<number | ''>(media.PYear || '');
  // Initialize selectedEvent from media.Event if available
  const [selectedEvent, setSelectedEvent] = useState<number | ''>(() => {
    return media.Event?.ID || '';
  });
  const computeOrderedTaggedPeople = (
    tagged: Array<{ ID: number; neName: string; neRelation?: string }> | undefined,
    peopleList: string | undefined
  ) => {
    const taggedArr = tagged || [];
    console.log('computeOrderedTaggedPeople - tagged array:', JSON.stringify(taggedArr, null, 2));
    if (!peopleList) return taggedArr;
    // PPeopleList contains comma-separated IDs that reference NameEvent records.
    // The server now returns them in the correct order, so just return them as-is.
    return taggedArr;
  };

  const [taggedPeople, setTaggedPeople] = useState<
    Array<{ ID: number; neName: string; neRelation?: string }>
  >(() => computeOrderedTaggedPeople(media.TaggedPeople, media.PPeopleList));

  // Keep taggedPeople in sync if the media prop updates
  useEffect(() => {
    setTaggedPeople(computeOrderedTaggedPeople(media.TaggedPeople, media.PPeopleList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.PPeopleList, JSON.stringify(media.TaggedPeople || [])]);

  // Initialize selectedEvent from media.Event
  useEffect(() => {
    if (media.Event?.ID) {
      setSelectedEvent(media.Event.ID);
    }
  }, [media.Event]);
  
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [showPeopleSelector, setShowPeopleSelector] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [savingTag, setSavingTag] = useState(false);
  const [insertPosition, setInsertPosition] = useState<number | 'end'>('end');
  const [peopleSearchFilter, setPeopleSearchFilter] = useState('');
  
  // Inline creation state
  const [showCreatePerson, setShowCreatePerson] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRelation, setNewPersonRelation] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newEventDetails, setNewEventDetails] = useState('');
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [selectedPersonDetail, setSelectedPersonDetail] = useState<{ ID: number; neName: string; neRelation?: string } | null>(null);

  useEffect(() => {
    if (editing && allEvents.length === 0) {
      fetchEvents();
    }
  }, [editing]);

  useEffect(() => {
    if (showPeopleSelector && allPeople.length === 0) {
      fetchPeople();
    }
  }, [showPeopleSelector]);

  const fetchPeople = async () => {
    try {
      setLoadingPeople(true);
      console.log('📥 Fetching people from /api/people...');
      
      const res = await fetch('/api/people');
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('📦 Raw API response:', data);
      
      // API returns { success: true, people: [...] }
      const peopleArray = data.people || data;
      
      if (peopleArray && Array.isArray(peopleArray) && peopleArray.length > 0) {
        console.log(`✅ Loaded ${peopleArray.length} people from API`);
        setAllPeople(peopleArray);
      } else {
        console.error('❌ API returned empty or invalid data:', data);
        setAllPeople([]);
      }
    } catch (error) {
      console.error('❌ MediaDetailModal fetchPeople error:', error);
      setAllPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const { fetchWithFallback, sampleEvents } = await import('../lib/api');
      const data = await fetchWithFallback('/api/events');
      if (data && data.success && Array.isArray(data.events)) {
        setAllEvents(data.events);
      } else if (Array.isArray(data)) {
        // older APIs might return an array directly
        setAllEvents(data);
      } else {
        setAllEvents(normalizeEvents(sampleEvents()));
      }
    } catch (error) {
      console.error('❌ MediaDetailModal fetchEvents error:', error);
  setAllEvents(normalizeEvents((await import('../lib/api')).sampleEvents()));
    } finally {
      setLoadingEvents(false);
    }
  };

  // Helpers to normalize sample/API data to expected types
  const normalizePeople = (arr: any[]): Person[] => {
    return (arr || []).map((p) => ({
      ...p,
      neDateLastModified: p.neDateLastModified ? new Date(p.neDateLastModified) : new Date(0),
    }));
  };

  const normalizeEvents = (arr: any[]): Event[] => {
    return (arr || []).map((e) => ({
      ...e,
      neDateLastModified: e.neDateLastModified ? new Date(e.neDateLastModified) : new Date(0),
    }));
  };

  const handleAddPerson = async (personId: number) => {
    // Check if already tagged
    if (taggedPeople.some(p => p.ID === personId)) {
      alert('This person is already tagged in this photo');
      return;
    }

    try {
      setSavingTag(true);
      
      // Determine the actual position to use
      let positionValue = 0;
      if (insertPosition === 'end') {
        positionValue = taggedPeople.length;
      } else {
        // Clamp position to valid range
        positionValue = Math.max(0, Math.min(insertPosition as number, taggedPeople.length));
      }

      // Normalize backslashes to forward slashes, then encode each path segment separately
      const normalizedPath = media.PFileName.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/media/${encodedPath}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, position: positionValue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Tag person API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData
        });
        
        // Construct detailed error message for user
        let errorMessage = errorData.error || 'Failed to tag person';
        if (errorData.details) {
          errorMessage += `\n\nDetails: ${errorData.details}`;
        }
        if (errorData.searchedFor) {
          errorMessage += `\n\nSearched for: ${errorData.searchedFor}`;
        }
        if (errorData.similarFilesFound !== undefined) {
          errorMessage += `\nSimilar files found: ${errorData.similarFilesFound}`;
        }
        if (errorData.stack) {
          errorMessage += `\n\nStack: ${errorData.stack}`;
        }
        
        throw new Error(errorMessage);
      }

      // Find the person details
      const person = allPeople.find(p => p.ID === personId);
      if (person) {
        const newTaggedPeople = [...taggedPeople];
        newTaggedPeople.splice(positionValue, 0, { ID: person.ID, neName: person.neName, neRelation: person.neRelation });
        setTaggedPeople(newTaggedPeople);
        
        // Update parent component if callback provided
        if (onUpdate) {
          onUpdate({ ...media, TaggedPeople: newTaggedPeople });
        }
      }
      
      // Reset position for next add
      setInsertPosition('end');
      setShowPeopleSelector(false);
      setPeopleSearchFilter('');
    } catch (error) {
      console.error('❌ MediaDetailModal handleAddPerson error:', error);
      
      let displayMessage = 'Failed to tag person';
      if (error instanceof Error) {
        displayMessage = error.message;
        console.error('📋 Full error details:');
        console.error('  Message:', error.message);
        console.error('  Stack:', error.stack);
      }
      
      // Show all details in a single alert so user can copy/paste
      alert(`❌ Failed to tag person\n\nError: ${displayMessage}\n\nCheck browser console (F12) for more details.`);
    } finally {
      setSavingTag(false);
    }
  };

  const handleRemovePerson = async (personId: number) => {
    if (!confirm('Remove this person tag?')) return;

    try {
      // Normalize backslashes to forward slashes, then encode each path segment separately
      const normalizedPath = media.PFileName.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/media/${encodedPath}/tags/${personId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Remove tag API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData
        });
        throw new Error(errorData.message || 'Failed to remove person tag');
      }

      const newTaggedPeople = taggedPeople.filter(p => p.ID !== personId);
      setTaggedPeople(newTaggedPeople);
      
      // Update parent component if callback provided
      if (onUpdate) {
        onUpdate({ ...media, TaggedPeople: newTaggedPeople });
      }
    } catch (error) {
      console.error('❌ MediaDetailModal handleRemovePerson error:', error);
      alert('Failed to remove person tag');
    }
  };

  const handleSave = async () => {
    try {
      // Normalize backslashes to forward slashes, then encode each segment
      const normalizedPath = media.PFileName.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/media/${encodedPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          month: month || null,
          year: year || null,
          eventID: selectedEvent || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Update media API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData
        });
        throw new Error(errorData.message || 'Failed to update media');
      }

      const data = await response.json();
      
      if (data.success && onUpdate) {
        // Update parent with new data
        onUpdate({ ...media, ...data.media, TaggedPeople: taggedPeople });
      }

      setEditing(false);
      alert('Successfully updated!');
    } catch (error) {
      console.error('❌ MediaDetailModal handleSave error:', error);
      alert('Failed to update media');
    }
  };

  const handleReplayVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleDownload = async () => {
    try {
      // Fetch the blob URL
      const response = await fetch(media.PBlobUrl);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from PFileName
      const filename = media.PFileName.split(/[\/\\]/).pop() || 'download';
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file');
    }
  };

  const handleDelete = async () => {
    const filename = media.PFileName.split(/[\/\\]/).pop() || media.PFileName;
    
    if (!confirm(`Delete cannot be undone. Do you want to delete this image anyway?`)) {
      return;
    }

    try {
      // Normalize the path for the API call
      const normalizedPath = media.PFileName.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
      
      console.log('DELETE request to:', `/api/media/${encodedPath}`);
      
      const response = await fetch(`/api/media/${encodedPath}`, {
        method: 'DELETE',
      });

      console.log('DELETE response status:', response.status);
      console.log('DELETE response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { error: 'Non-JSON response', body: text };
        }
        
        console.error('DELETE error response:', errorData);
        throw new Error(errorData.error || errorData.message || `Failed to delete: ${response.status}`);
      }

      const result = await response.json();
      console.log('DELETE success:', result);

      alert('File deleted successfully');
      onClose(); // Close the modal
      
      // Refresh the page to update the gallery
      window.location.reload();
    } catch (error: any) {
      console.error('Delete failed:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      setCreatingPerson(true);
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          neName: newPersonName.trim(),
          neRelation: newPersonRelation.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to create person');
      }

      const data = await response.json();
      
      if (data.success && data.person) {
        // Add to people list
        const newPerson = { ...data.person, neCount: 0 };
        setAllPeople([...allPeople, newPerson].sort((a, b) => a.neName.localeCompare(b.neName)));
        
        // Automatically tag the newly created person
        await handleAddPerson(data.person.ID);
        
        // Reset form
        setNewPersonName('');
        setNewPersonRelation('');
        setShowCreatePerson(false);
      }
    } catch (error) {
      console.error('❌ Create person error:', error);
      alert('Failed to create person');
    } finally {
      setCreatingPerson(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      alert('Please enter an event name');
      return;
    }

    try {
      setCreatingEvent(true);
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          neName: newEventName.trim(),
          neRelation: newEventDetails.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to create event');
      }

      const data = await response.json();
      
      if (data.success && data.event) {
        // Add to events list
        const newEvent = { ...data.event, neCount: 0 };
        setAllEvents([...allEvents, newEvent].sort((a, b) => a.neName.localeCompare(b.neName)));
        
        // Automatically select the newly created event
        setSelectedEvent(data.event.ID);
        
        // Reset form
        setNewEventName('');
        setNewEventDetails('');
        setShowCreateEvent(false);
      }
    } catch (error) {
      console.error('❌ Create event error:', error);
      alert('Failed to create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <>
      {/* Full Screen View */}
      {isFullScreen && (
        <div 
          className="fullscreen-overlay" 
          onClick={() => setIsFullScreen(false)}
        >
          <button
            onClick={() => setIsFullScreen(false)}
            className="fullscreen-close"
          >
            ✕
          </button>
          {media.PType === 1 ? (
            imageError ? (
              <div style={{
                color: 'white',
                textAlign: 'center',
                padding: '2rem'
              }}>
                <p style={{ fontSize: '1.5rem' }}>⚠️ Image failed to load</p>
                <p style={{ marginTop: '1rem' }}>{media.PFileName}</p>
              </div>
            ) : (
              <img 
                src={media.PBlobUrl} 
                alt={media.PDescription || media.PFileName}
                className="fullscreen-image"
                onError={() => setImageError(true)}
              />
            )
          ) : (
            <video 
              controls 
              src={media.PBlobUrl}
              className="fullscreen-video"
              autoPlay
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      )}

      {/* Person Detail Modal */}
      {selectedPersonDetail && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedPersonDetail(null)}
          style={{ zIndex: 1001 }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '400px',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <button
              onClick={() => setSelectedPersonDetail(null)}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: 'none',
                border: 'none',
                fontSize: '2rem',
                cursor: 'pointer',
                color: '#6c757d',
                padding: '0',
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
            
            <div style={{ marginTop: '0.5rem' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#0056b3',
                margin: '1rem 0 0.5rem 0'
              }}>
                {selectedPersonDetail.neName}
              </h2>
              
              <div style={{
                fontSize: '1.25rem',
                color: '#495057',
                margin: '0.5rem 0 1rem 0',
                fontWeight: '500'
              }}>
                {selectedPersonDetail.neRelation || 'No relation specified'}
              </div>
              
              {/* Debug info */}
              <div style={{
                fontSize: '0.75rem',
                color: '#999',
                marginTop: '1rem',
                padding: '0.5rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                fontFamily: 'monospace',
                textAlign: 'left',
                wordBreak: 'break-all'
              }}>
                DEBUG: {JSON.stringify(selectedPersonDetail)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleDownload}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '4rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            zIndex: 10,
          }}
          title="Download"
        >
          ⬇ Download
        </button>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '2rem',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          ×
        </button>

        <div className="detail-view">
          <div className="media-display">
            {media.PType === 1 ? (
              imageError ? (
                <div style={{
                  background: '#f8f9fa',
                  border: '2px dashed #dee2e6',
                  borderRadius: '8px',
                  padding: '3rem',
                  textAlign: 'center',
                  color: '#6c757d',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                    ⚠️ Image failed to load
                  </p>
                  <p style={{ marginBottom: '0.5rem', color: '#495057' }}>
                    <strong>File:</strong> {media.PFileName}
                  </p>
                  <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    The image may have a path encoding issue or may not exist in blob storage.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => {
                        setImageError(false);
                        // Force reload
                        const img = document.createElement('img');
                        img.src = media.PBlobUrl + '?t=' + Date.now();
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ↻ Retry
                    </button>
                    <button
                      onClick={handleDownload}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ⬇️ Try Download
                    </button>
                  </div>
                  <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#868e96' }}>
                    URL: {media.PBlobUrl}
                  </p>
                </div>
              ) : (
                <img 
                  src={media.PBlobUrl} 
                  alt={media.PDescription || media.PFileName}
                  onClick={() => setIsFullScreen(true)}
                  style={{ cursor: 'pointer' }}
                  onError={(e) => {
                    console.error('Image load error:', media.PFileName);
                    console.error('Image URL:', media.PBlobUrl);
                    setImageError(true);
                  }}
                />
              )
            ) : (
              <div style={{ position: 'relative' }}>
                {videoError ? (
                  <div style={{
                    background: '#f8f9fa',
                    border: '2px dashed #dee2e6',
                    borderRadius: '8px',
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#6c757d'
                  }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                      ⚠️ This video format cannot be played in your browser
                    </p>
                    <p style={{ marginBottom: '1.5rem' }}>
                      MOV files often use codecs (like H.265/HEVC) that aren't supported in web browsers.
                    </p>
                    <button
                      onClick={handleDownload}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      ⬇️ Download Video to Play Locally
                    </button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef}
                      controls 
                      autoPlay
                      src={media.PBlobUrl}
                      onClick={() => setIsFullScreen(true)}
                      style={{ cursor: 'pointer', width: '100%' }}
                      onError={(e) => {
                        console.error('Video playback error:', e);
                        setVideoError(true);
                      }}
                      onLoadedMetadata={() => {
                        // Check if video duration is valid
                        if (videoRef.current && (isNaN(videoRef.current.duration) || videoRef.current.duration === 0)) {
                          console.warn('Video has invalid duration, may not be playable');
                        }
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplayVideo();
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        padding: '8px 16px',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                      title="Replay video from beginning"
                    >
                      ↻ Replay
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="metadata-panel">
            <h2 style={{ marginTop: 0 }}>{media.PFileName}</h2>
            <p>
              <strong>Dimensions:</strong> {media.PWidth} x {media.PHeight}
            </p>
            {media.PType === 2 && media.PTime && (
              <p>
                <strong>Duration:</strong>{' '}
                {Math.floor(media.PTime / 60)}:{(media.PTime % 60).toString().padStart(2, '0')}
              </p>
            )}

            <div className="form-group mt-2">
              <label>Date:</label>
              {editing ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : '')}
                  >
                    <option value="">Month</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="Year"
                    style={{ width: '100px' }}
                  />
                </div>
              ) : (
                <p>
                  {month && year
                    ? `${new Date(2000, (month as number) - 1).toLocaleString('default', {
                        month: 'long',
                      })} ${year}`
                    : 'Not set'}
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Description:</label>
              {editing ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              ) : (
                <p>{description || 'No description'}</p>
              )}
            </div>

            <div className="form-group">
              <label>Event:</label>
              {editing ? (
                loadingEvents ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value ? parseInt(e.target.value) : '')}
                        style={{ flex: 1 }}
                      >
                        <option value="">-- No Event --</option>
                        {allEvents.map((event) => (
                          <option key={event.ID} value={event.ID}>
                            {event.neName} ({event.neCount} photos)
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowCreateEvent(true)}
                        title="Create new event"
                      >
                        + New
                      </button>
                    </div>
                    
                    {/* Inline Event Creation Form */}
                    {showCreateEvent && (
                      <div className="inline-create-form">
                        <h4>Create New Event</h4>
                        <input
                          type="text"
                          placeholder="Event name"
                          value={newEventName}
                          onChange={(e) => setNewEventName(e.target.value)}
                          autoFocus
                        />
                        <textarea
                          placeholder="Event details (optional)"
                          value={newEventDetails}
                          onChange={(e) => setNewEventDetails(e.target.value)}
                          rows={2}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={handleCreateEvent}
                            disabled={creatingEvent || !newEventName.trim()}
                          >
                            {creatingEvent ? 'Creating...' : 'Create & Select'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setShowCreateEvent(false);
                              setNewEventName('');
                              setNewEventDetails('');
                            }}
                            disabled={creatingEvent}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : (
                <p>{media.Event?.neName || 'Not set'}</p>
              )}
            </div>

            <div className="form-group">
              <label>Tagged People:</label>
              {taggedPeople.length > 0 ? (
                <div className="tagged-people-list">
                  {taggedPeople.map((person, idx) => (
                    <div key={person.ID} className="tagged-person-item" style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: '#e7f3ff',
                      border: '1px solid #b3d9ff',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                        console.log('Clicked person:', JSON.stringify(person, null, 2));
                        setSelectedPersonDetail(person);
                      }}>
                        <div style={{ fontWeight: '600', color: '#0056b3', fontSize: '1rem', textDecoration: 'underline' }}>
                          {idx + 1}. {person.neName}
                        </div>
                      </div>
                      {editing && (
                        <button
                          onClick={() => handleRemovePerson(person.ID)}
                          className="btn-remove-tag"
                          title="Remove tag"
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No one tagged yet</p>
              )}
              
              {editing && (
                <>
                  {!showPeopleSelector ? (
                    <button
                      className="btn btn-secondary mt-1"
                      onClick={() => setShowPeopleSelector(true)}
                      style={{ width: '100%' }}
                    >
                      + Add Person
                    </button>
                  ) : (
                    <div className="people-selector-dropdown">
                      <div className="flex flex-between mb-1">
                        <strong>Select a person:</strong>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => setShowCreatePerson(true)}
                            title="Create new person"
                          >
                            + New
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setShowPeopleSelector(false);
                              setPeopleSearchFilter('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      
                      {/* Position selector */}
                      {taggedPeople.length > 0 && (
                        <div style={{ 
                          padding: '0.75rem', 
                          marginBottom: '1rem', 
                          backgroundColor: '#f8f9fa', 
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            Insert position:
                          </label>
                          <select 
                            value={typeof insertPosition === 'number' ? insertPosition : 'end'}
                            onChange={(e) => setInsertPosition(e.target.value === 'end' ? 'end' : parseInt(e.target.value))}
                            className="form-select form-select-sm"
                            style={{ maxWidth: '300px' }}
                          >
                            {taggedPeople.map((person, idx) => (
                              <option key={idx} value={idx}>
                                Before {person.neName}
                              </option>
                            ))}
                            <option value="end">At end</option>
                          </select>
                        </div>
                      )}
                      
                      {/* Inline Person Creation Form */}
                      {showCreatePerson && (
                        <div className="inline-create-form" style={{ marginBottom: '1rem' }}>
                          <h4>Create New Person</h4>
                          <input
                            type="text"
                            placeholder="Full name"
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Relationship (e.g., Uncle, Cousin)"
                            value={newPersonRelation}
                            onChange={(e) => setNewPersonRelation(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={handleCreatePerson}
                              disabled={creatingPerson || !newPersonName.trim()}
                            >
                              {creatingPerson ? 'Creating...' : 'Create & Tag'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setShowCreatePerson(false);
                                setNewPersonName('');
                                setNewPersonRelation('');
                              }}
                              disabled={creatingPerson}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Search filter input */}
                      {!loadingPeople && allPeople && allPeople.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <input
                            type="text"
                            placeholder="Type to filter names..."
                            value={peopleSearchFilter}
                            onChange={(e) => setPeopleSearchFilter(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              fontSize: '0.95rem'
                            }}
                            autoFocus
                          />
                        </div>
                      )}
                      
                      {loadingPeople ? (
                        <div className="loading-spinner"></div>
                      ) : (
                        <div className="people-list-scroll">
                          {allPeople && allPeople.length > 0 ? (
                            allPeople
                              .filter(p => !taggedPeople.some(tp => tp.ID === p.ID))
                              .filter(p => !peopleSearchFilter || p.neName.toLowerCase().includes(peopleSearchFilter.toLowerCase()))
                              .map((person) => (
                                <button
                                  key={person.ID}
                                  className="person-list-item"
                                  onClick={() => handleAddPerson(person.ID)}
                                  disabled={savingTag}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '0.75rem',
                                    marginBottom: '0.5rem',
                                    textAlign: 'left',
                                    backgroundColor: '#f8f9fa',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    cursor: savingTag ? 'not-allowed' : 'pointer',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => !savingTag && (e.currentTarget.style.backgroundColor = '#e9ecef')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                                >
                                  <div style={{ fontWeight: '600', color: '#0056b3' }}>
                                    {person.neName || `Person #${person.ID}`}
                                  </div>
                                </button>
                              ))
                          ) : (
                            <p className="text-center" style={{ padding: '1rem', color: '#6c757d' }}>
                              No people available to tag
                            </p>
                          )}
                          {allPeople && allPeople.filter(p => !taggedPeople.some(tp => tp.ID === p.ID)).length === 0 && allPeople.length > 0 && (
                            <p className="text-center" style={{ padding: '1rem', color: '#6c757d' }}>
                              All people are already tagged
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-gap mt-2">
              {editing ? (
                <>
                  <button className="btn btn-success" onClick={handleSave}>
                    Save
                  </button>
                  <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={handleDelete} style={{ marginLeft: '0.5rem' }}>
                    Delete Picture
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

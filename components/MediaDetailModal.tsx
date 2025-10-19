'use client';

import { useState, useEffect } from 'react';
import { MediaItem, Person, Event } from '@/lib/types';

interface MediaDetailModalProps {
  media: MediaItem;
  onClose: () => void;
  onUpdate?: (updatedMedia: MediaItem) => void;
}

export default function MediaDetailModal({
  media,
  onClose,
  onUpdate,
}: MediaDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [description, setDescription] = useState(media.PDescription || '');
  const [month, setMonth] = useState<number | ''>(media.PMonth || '');
  const [year, setYear] = useState<number | ''>(media.PYear || '');
  const [selectedEvent, setSelectedEvent] = useState<number | ''>('');
  const [taggedPeople, setTaggedPeople] = useState<Array<{ ID: number; neName: string }>>(
    media.TaggedPeople || []
  );
  
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [showPeopleSelector, setShowPeopleSelector] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [savingTag, setSavingTag] = useState(false);

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
      const response = await fetch('/api/people');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ People API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData
        });
        throw new Error(errorData.message || 'Failed to fetch people');
      }
      const data = await response.json();
      setAllPeople(data);
    } catch (error) {
      console.error('❌ MediaDetailModal fetchPeople error:', error);
      alert('Failed to load people list');
    } finally {
      setLoadingPeople(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const response = await fetch('/api/events');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Events API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData
        });
        throw new Error(errorData.message || 'Failed to fetch events');
      }
      const data = await response.json();
      if (data.success) {
        setAllEvents(data.events);
      }
    } catch (error) {
      console.error('❌ MediaDetailModal fetchEvents error:', error);
      alert('Failed to load events list');
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleAddPerson = async (personId: number) => {
    // Check if already tagged
    if (taggedPeople.some(p => p.ID === personId)) {
      alert('This person is already tagged in this photo');
      return;
    }

    try {
      setSavingTag(true);
      const response = await fetch(`/api/media/${encodeURIComponent(media.PFileName)}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, position: 0 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Tag person API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData
        });
        throw new Error(errorData.message || 'Failed to tag person');
      }

      // Find the person details
      const person = allPeople.find(p => p.ID === personId);
      if (person) {
        const newTaggedPeople = [...taggedPeople, { ID: person.ID, neName: person.neName }];
        setTaggedPeople(newTaggedPeople);
        
        // Update parent component if callback provided
        if (onUpdate) {
          onUpdate({ ...media, TaggedPeople: newTaggedPeople });
        }
      }
      
      setShowPeopleSelector(false);
    } catch (error) {
      console.error('❌ MediaDetailModal handleAddPerson error:', error);
      alert('Failed to tag person');
    } finally {
      setSavingTag(false);
    }
  };

  const handleRemovePerson = async (personId: number) => {
    if (!confirm('Remove this person tag?')) return;

    try {
      const response = await fetch(`/api/media/${encodeURIComponent(media.PFileName)}/tags/${personId}`, {
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
      const response = await fetch(`/api/media/${encodeURIComponent(media.PFileName)}`, {
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
            <img 
              src={media.PBlobUrl} 
              alt={media.PDescription || media.PFileName}
              className="fullscreen-image"
            />
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

      {/* Detail Modal */}
      <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
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
          }}
        >
          ×
        </button>

        <div className="detail-view">
          <div className="media-display">
            {media.PType === 1 ? (
              <img 
                src={media.PBlobUrl} 
                alt={media.PDescription || media.PFileName}
                onClick={() => setIsFullScreen(true)}
                style={{ cursor: 'pointer' }}
              />
            ) : (
              <video 
                controls 
                src={media.PBlobUrl}
                onClick={() => setIsFullScreen(true)}
                style={{ cursor: 'pointer' }}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="metadata-panel">
            <h2>{media.PFileName}</h2>
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
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value ? parseInt(e.target.value) : '')}
                  >
                    <option value="">-- No Event --</option>
                    {allEvents.map((event) => (
                      <option key={event.ID} value={event.ID}>
                        {event.neName} ({event.neCount} photos)
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <p>{selectedEvent ? allEvents.find(e => e.ID === selectedEvent)?.neName || 'Not set' : 'Not set'}</p>
              )}
            </div>

            <div className="form-group">
              <label>Tagged People:</label>
              {taggedPeople.length > 0 ? (
                <div className="tagged-people-list">
                  {taggedPeople.map((person) => (
                    <div key={person.ID} className="tagged-person-item">
                      <span>{person.neName}</span>
                      {editing && (
                        <button
                          onClick={() => handleRemovePerson(person.ID)}
                          className="btn-remove-tag"
                          title="Remove tag"
                        >
                          ✕
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
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowPeopleSelector(false)}
                        >
                          Cancel
                        </button>
                      </div>
                      {loadingPeople ? (
                        <div className="loading-spinner"></div>
                      ) : (
                        <div className="people-list-scroll">
                          {allPeople
                            .filter(p => !taggedPeople.some(tp => tp.ID === p.ID))
                            .map((person) => (
                              <button
                                key={person.ID}
                                className="person-list-item"
                                onClick={() => handleAddPerson(person.ID)}
                                disabled={savingTag}
                              >
                                {person.neName}
                                {person.neCount > 0 && (
                                  <span className="person-count">({person.neCount} photos)</span>
                                )}
                              </button>
                            ))}
                          {allPeople.filter(p => !taggedPeople.some(tp => tp.ID === p.ID)).length === 0 && (
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
                <button className="btn btn-primary" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

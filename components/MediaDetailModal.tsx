'use client';

import { useState, useEffect } from 'react';
import { MediaItem, Person, Event } from '../lib/types';

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
  const computeOrderedTaggedPeople = (
    tagged: Array<{ ID: number; neName: string }> | undefined,
    peopleList: string | undefined
  ) => {
    const taggedArr = tagged || [];
    if (!peopleList) return taggedArr;
    // PPeopleList historically stored comma-separated person IDs. Some older
    // data or migrations used names. Support both: prefer matching by ID when
    // tokens are numeric, otherwise fall back to matching by name.
    const tokens = peopleList
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (tokens.length === 0) return taggedArr;

    const byId = new Map(taggedArr.map((p) => [String(p.ID), p]));
    const byName = new Map(taggedArr.map((p) => [p.neName, p]));

    const ordered: Array<{ ID: number; neName: string }> = [];
    const used = new Set<number>();

    for (const tok of tokens) {
      // Prefer ID match
      const byIdMatch = byId.get(tok);
      if (byIdMatch) {
        ordered.push(byIdMatch);
        used.add(byIdMatch.ID);
        continue;
      }

      // Fallback to name match
      const byNameMatch = byName.get(tok);
      if (byNameMatch) {
        ordered.push(byNameMatch);
        used.add(byNameMatch.ID);
      }
    }

    // Append any tagged people not present in PPeopleList at the end
    for (const p of taggedArr) {
      if (!used.has(p.ID)) ordered.push(p);
    }

    return ordered;
  };

  const [taggedPeople, setTaggedPeople] = useState<
    Array<{ ID: number; neName: string }>
  >(() => computeOrderedTaggedPeople(media.TaggedPeople, media.PPeopleList));

  // Keep taggedPeople in sync if the media prop updates
  useEffect(() => {
    setTaggedPeople(computeOrderedTaggedPeople(media.TaggedPeople, media.PPeopleList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.PPeopleList, JSON.stringify(media.TaggedPeople || [])]);
  
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [showPeopleSelector, setShowPeopleSelector] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [savingTag, setSavingTag] = useState(false);
  
  // Inline creation state
  const [showCreatePerson, setShowCreatePerson] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRelation, setNewPersonRelation] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newEventDetails, setNewEventDetails] = useState('');
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

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
      const { fetchWithFallback, samplePeople } = await import('../lib/api');
      const data = await fetchWithFallback('/api/people');
      if (data && Array.isArray(data)) {
        setAllPeople(data);
      } else {
        // fallback to sample data when API unavailable or returns unexpected shape
        setAllPeople(normalizePeople(samplePeople()));
      }
    } catch (error) {
      console.error('❌ MediaDetailModal fetchPeople error:', error);
  setAllPeople(normalizePeople((await import('../lib/api')).samplePeople()));
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => setShowPeopleSelector(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      
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
                                {person.neRelation && (
                                  <span className="person-relation"> - {person.neRelation}</span>
                                )}
                                {person.neCount > 0 && (
                                  <span className="person-count"> ({person.neCount} photos)</span>
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

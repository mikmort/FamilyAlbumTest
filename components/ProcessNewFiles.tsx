'use client';

import React, { useState, useEffect } from 'react';

interface UnindexedFile {
  uiID: number;
  uiFileName: string;
  uiDirectory: string;
  uiThumbUrl: string;
  uiType: number; // 1=image, 2=video
  uiWidth: number;
  uiHeight: number;
  uiVtime: number; // video duration in seconds
  uiStatus: string;
  uiBlobUrl: string;
  uiDateAdded: string;
  uiMonth?: number; // extracted from EXIF/metadata
  uiYear?: number; // extracted from EXIF/metadata
}

interface Person {
  ID: number;
  neName: string;
  neRelation: string;
  neCount: number;
}

interface Event {
  ID: number;
  neName: string;
  neRelation: string;
  neCount: number;
}

export default function ProcessNewFiles() {
  const [currentFile, setCurrentFile] = useState<UnindexedFile | null>(null);
  const [allFiles, setAllFiles] = useState<UnindexedFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  // Form fields
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState<number | ''>('');
  const [year, setYear] = useState<number | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<number | ''>('');
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  
  // Search/filter states
  const [eventSearch, setEventSearch] = useState('');
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleDropdownOpen, setPeopleDropdownOpen] = useState(false);

  // Data for dropdowns
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);

  // New event creation
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Load people and events for dropdowns
  useEffect(() => {
    loadPeople();
    loadEvents();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.autocomplete-wrapper')) {
        setEventDropdownOpen(false);
        setPeopleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load next file on mount and after processing
  useEffect(() => {
    loadAllFiles();
    loadRemainingCount();
  }, []);

  // Update current file when index changes
  useEffect(() => {
    if (allFiles.length > 0 && currentIndex >= 0 && currentIndex < allFiles.length) {
      setCurrentFile(allFiles[currentIndex]);
      const file = allFiles[currentIndex];
      // Reset form when changing files
      setDescription('');
      // Pre-populate month/year if extracted from metadata
      setMonth(file.uiMonth || '');
      setYear(file.uiYear || '');
      setSelectedEvent('');
      setEventSearch('');
      setSelectedPeople([]);
      setPeopleSearch('');
    } else if (allFiles.length === 0) {
      setCurrentFile(null);
    }
  }, [currentIndex, allFiles]);

  const loadPeople = async () => {
    setPeopleLoading(true);
    try {
      const res = await fetch('/api/people');
      const data = await res.json();
      if (data.success) {
        setPeople(data.people);
      }
    } catch (err) {
      console.error('Error loading people:', err);
    } finally {
      setPeopleLoading(false);
    }
  };

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      setError('Event name is required');
      return;
    }

    setCreatingEvent(true);
    setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEventName.trim(),
          relation: newEventDesc.trim() || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const data = await res.json();
      
      // Add new event to the list
      const newEvent: Event = {
        ID: data.id || data.event?.ID,
        neName: data.name || data.event?.neName,
        neRelation: data.relation || data.event?.neRelation || '',
        neCount: 0
      };
      
      setEvents(prev => [newEvent, ...prev]);
      
      // Select the newly created event
      setSelectedEvent(newEvent.ID);
      
      // Close form and reset
      setShowNewEventForm(false);
      setNewEventName('');
      setNewEventDesc('');
      setEventDropdownOpen(false);
      
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  const loadAllFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/unindexed/list');
      const data = await res.json();
      
      if (data.success) {
        setAllFiles(data.files || []);
        setCurrentIndex(0);
      } else {
        console.error('❌ Unindexed API error:', data);
        setError(data.error || 'Failed to load files');
        setAllFiles([]);
      }
    } catch (err: any) {
      console.error('❌ ProcessNewFiles loadAllFiles error:', err);
      setError(err.message || 'Failed to load files');
      setAllFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadNextFile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/unindexed/next');
      const data = await res.json();
      
      if (data.success) {
        if (data.file) {
          setCurrentFile(data.file);
          // Reset form
          setDescription('');
          setMonth('');
          setYear('');
          setSelectedEvent('');
          setSelectedPeople([]);
          
          // Try to auto-extract month/year from file metadata if available
          // For now, we'll leave them blank - could enhance this later
        } else {
          setCurrentFile(null);
        }
      } else {
        console.error('❌ Unindexed API error:', data);
        setError(data.error || 'Failed to load file');
      }
    } catch (err: any) {
      console.error('❌ ProcessNewFiles loadNextFile error:', err);
      setError(err.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const loadRemainingCount = async () => {
    try {
      const res = await fetch('/api/unindexed/count');
      const data = await res.json();
      if (data.success) {
        setRemainingCount(data.count);
      }
    } catch (err) {
      console.error('Error loading count:', err);
    }
  };

  const handleSaveAndNext = async () => {
    if (!currentFile) return;

    setProcessing(true);
    setError('');

    try {
      const res = await fetch('/api/unindexed/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uiID: currentFile.uiID,
          fileName: currentFile.uiFileName,
          directory: currentFile.uiDirectory,
          description,
          month: month || null,
          year: year || null,
          eventID: selectedEvent || null,
          people: selectedPeople,
          blobUrl: currentFile.uiBlobUrl,
          thumbUrl: currentFile.uiThumbUrl,
          type: currentFile.uiType,
          width: currentFile.uiWidth,
          height: currentFile.uiHeight,
          vtime: currentFile.uiVtime
        })
      });

      const data = await res.json();
      
      if (data.success) {
        // Reload all files to refresh the list
        await loadAllFiles();
        await loadRemainingCount();
        // Stay at same index (will show next file since current was removed)
      } else {
        console.error('❌ Process file API error:', data);
        setError(data.error || 'Failed to process file');
      }
    } catch (err: any) {
      console.error('❌ ProcessNewFiles handleSaveAndNext error:', err);
      setError(err.message || 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    // Move to next file without saving
    if (currentIndex < allFiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < allFiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDelete = async () => {
    if (!currentFile) return;
    
    if (!confirm(`Are you sure you want to delete "${currentFile.uiFileName}"? This cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const res = await fetch(`/api/unindexed/${currentFile.uiID}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      
      if (data.success) {
        await loadAllFiles();
        await loadRemainingCount();
        // Stay at same index (will show next file since current was removed)
      } else {
        console.error('❌ Delete file API error:', data);
        setError(data.error || 'Failed to delete file');
      }
    } catch (err: any) {
      console.error('❌ ProcessNewFiles handleDelete error:', err);
      setError(err.message || 'Failed to delete file');
    } finally {
      setProcessing(false);
    }
  };

  const togglePerson = (personID: number) => {
    setSelectedPeople(prev => {
      if (prev.includes(personID)) {
        return prev.filter(id => id !== personID);
      } else {
        return [...prev, personID];
      }
    });
    setPeopleSearch('');
    setPeopleDropdownOpen(false);
  };

  // Filter events based on search - prioritize starts-with, then contains, then rest
  const filteredEvents = eventSearch
    ? [
        ...events.filter(event => event.neName.toLowerCase().startsWith(eventSearch.toLowerCase())).sort((a, b) => a.neName.localeCompare(b.neName)),
        ...events.filter(event => !event.neName.toLowerCase().startsWith(eventSearch.toLowerCase()) && event.neName.toLowerCase().includes(eventSearch.toLowerCase())).sort((a, b) => a.neName.localeCompare(b.neName)),
        ...events.filter(event => !event.neName.toLowerCase().includes(eventSearch.toLowerCase())).sort((a, b) => a.neName.localeCompare(b.neName))
      ]
    : events.slice().sort((a, b) => a.neName.localeCompare(b.neName));

  // Filter people based on search - prioritize starts-with, then contains, then rest
  const filteredPeople = peopleSearch
    ? [
        ...people.filter(person => person.neName.toLowerCase().startsWith(peopleSearch.toLowerCase())).sort((a, b) => a.neName.localeCompare(b.neName)),
        ...people.filter(person => !person.neName.toLowerCase().startsWith(peopleSearch.toLowerCase()) && person.neName.toLowerCase().includes(peopleSearch.toLowerCase())).sort((a, b) => a.neName.localeCompare(b.neName)),
        ...people.filter(person => !person.neName.toLowerCase().includes(peopleSearch.toLowerCase())).sort((a, b) => a.neName.localeCompare(b.neName))
      ]
    : people.slice().sort((a, b) => a.neName.localeCompare(b.neName));

  // Get selected event name
  const getSelectedEventName = () => {
    const event = events.find(e => e.ID === selectedEvent);
    return event ? event.neName : '';
  };

  // Get selected people names
  const getSelectedPeopleNames = () => {
    return people
      .filter(p => selectedPeople.includes(p.ID))
      .map(p => p.neName)
      .join(', ');
  };

  if (loading) {
    return (
      <div className="process-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <p>Loading unindexed files...</p>
        </div>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="process-container">
        <div className="completion-card">
          <div className="completion-icon">✓</div>
          <h2>All Files Processed!</h2>
          <p>There are no unindexed files remaining.</p>
          <p className="completion-hint">Upload new files to add them to the review queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="process-container">
      <div className="process-header">
        <h2>Process New Files</h2>
        <div className="process-count">
          {allFiles.length > 0 ? (
            <>
              File {currentIndex + 1} of {allFiles.length} 
              {remainingCount > 0 && ` (${remainingCount} unprocessed)`}
            </>
          ) : (
            <>0 files remaining</>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      {allFiles.length > 1 && (
        <div className="navigation-controls">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || processing}
            className="btn btn-secondary"
          >
            ← Previous
          </button>
          <span className="nav-indicator">
            {currentIndex + 1} / {allFiles.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex >= allFiles.length - 1 || processing}
            className="btn btn-secondary"
          >
            Next →
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="process-layout">
        {/* Left: Preview */}
        <div className="process-preview">
          <div className="preview-header">
            <h3>Preview</h3>
            <div className="file-info">
              <div className="info-row">
                <span className="label">File:</span>
                <span className="value">{currentFile.uiFileName}</span>
              </div>
              <div className="info-row">
                <span className="label">Dimensions:</span>
                <span className="value">{currentFile.uiWidth} × {currentFile.uiHeight}</span>
              </div>
              {currentFile.uiType === 2 && currentFile.uiVtime > 0 && (
                <div className="info-row">
                  <span className="label">Duration:</span>
                  <span className="value">{Math.floor(currentFile.uiVtime / 60)}:{(currentFile.uiVtime % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              {(currentFile.uiMonth || currentFile.uiYear) && (
                <div className="info-row">
                  <span className="label">Date Taken:</span>
                  <span className="value">
                    {currentFile.uiMonth && currentFile.uiYear 
                      ? `${currentFile.uiMonth}/${currentFile.uiYear}`
                      : currentFile.uiYear || ''}
                    {' '}
                    <span style={{color: '#10b981', fontSize: '0.85em'}}>(from metadata)</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="preview-content">
            {currentFile.uiType === 1 ? (
              <img 
                src={currentFile.uiBlobUrl} 
                alt={currentFile.uiFileName}
                className="preview-image"
              />
            ) : (
              <video 
                src={currentFile.uiBlobUrl} 
                controls
                className="preview-video"
              />
            )}
          </div>
        </div>

        {/* Right: Form */}
        <div className="process-form">
          <h3>Add Metadata</h3>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description..."
              rows={3}
              disabled={processing}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : '')}
                disabled={processing}
              >
                <option value="">-- Select --</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            <div className="form-group">
              <label>Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="YYYY"
                min="1900"
                max="2100"
                disabled={processing}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Event {events.length > 0 && `(${events.length} available)`}</label>
            <div className="autocomplete-wrapper">
              <input
                type="text"
                value={eventSearch}
                onChange={(e) => {
                  setEventSearch(e.target.value);
                  setEventDropdownOpen(true);
                }}
                onFocus={() => setEventDropdownOpen(true)}
                placeholder={selectedEvent ? getSelectedEventName() : "Type to search events..."}
                disabled={processing || eventsLoading}
                className="autocomplete-input"
              />
              {eventDropdownOpen && !processing && !eventsLoading && (
                <div className="autocomplete-dropdown">
                  <div 
                    className="autocomplete-item"
                    onClick={() => {
                      setSelectedEvent('');
                      setEventSearch('');
                      setEventDropdownOpen(false);
                    }}
                  >
                    <em>-- No Event --</em>
                  </div>
                  
                  {/* Create New Event Button */}
                  <div 
                    className="autocomplete-item create-new"
                    onClick={() => {
                      setShowNewEventForm(true);
                      setEventDropdownOpen(false);
                    }}
                  >
                    <strong>+ Create New Event</strong>
                  </div>
                  
                  {filteredEvents.length === 0 ? (
                    <div className="autocomplete-item disabled">
                      <em>No matching events found</em>
                    </div>
                  ) : (
                    filteredEvents.map(event => (
                      <div
                        key={event.ID}
                        className="autocomplete-item"
                        onClick={() => {
                          setSelectedEvent(event.ID);
                          setEventSearch('');
                          setEventDropdownOpen(false);
                        }}
                      >
                        {event.neName} <span className="count">({event.neCount} photos)</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {selectedEvent && (
                <div className="selected-tags">
                  <span className="tag">
                    {getSelectedEventName()}
                    <button
                      type="button"
                      onClick={() => setSelectedEvent('')}
                      className="tag-remove"
                      disabled={processing}
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Tag People {people.length > 0 && `(${people.length} available)`}</label>
            <div className="autocomplete-wrapper">
              <input
                type="text"
                value={peopleSearch}
                onChange={(e) => {
                  setPeopleSearch(e.target.value);
                  setPeopleDropdownOpen(true);
                }}
                onFocus={() => setPeopleDropdownOpen(true)}
                placeholder="Type to search people..."
                disabled={processing || peopleLoading}
                className="autocomplete-input"
              />
              {peopleDropdownOpen && !processing && !peopleLoading && (
                <div className="autocomplete-dropdown">
                  {filteredPeople.length === 0 ? (
                    <div className="autocomplete-item disabled">
                      <em>No people in database</em>
                    </div>
                  ) : (
                    filteredPeople.map(person => (
                      <div
                        key={person.ID}
                        className={`autocomplete-item ${selectedPeople.includes(person.ID) ? 'selected' : ''}`}
                        onClick={() => {
                          togglePerson(person.ID);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPeople.includes(person.ID)}
                          onChange={() => {}}
                          className="person-checkbox"
                        />
                        {person.neName} <span className="relation">({person.neRelation})</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {selectedPeople.length > 0 && (
                <div className="selected-tags">
                  {people
                    .filter(p => selectedPeople.includes(p.ID))
                    .map(person => (
                      <span key={person.ID} className="tag">
                        {person.neName}
                        <button
                          type="button"
                          onClick={() => togglePerson(person.ID)}
                          className="tag-remove"
                          disabled={processing}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              onClick={handleSaveAndNext}
              disabled={processing}
              className="btn btn-primary"
            >
              {processing ? 'Processing...' : 'Save & Continue'}
            </button>
            <button
              onClick={handleDelete}
              disabled={processing}
              className="btn btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* New Event Modal */}
      {showNewEventForm && (
        <div className="modal-overlay" onClick={() => setShowNewEventForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Event</h3>
            <div className="form-group">
              <label>Event Name *</label>
              <input
                type="text"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="e.g., Summer Vacation 2024"
                autoFocus
                disabled={creatingEvent}
              />
            </div>
            <div className="form-group">
              <label>Description (Optional)</label>
              <input
                type="text"
                value={newEventDesc}
                onChange={(e) => setNewEventDesc(e.target.value)}
                placeholder="e.g., Family trip to the beach"
                disabled={creatingEvent}
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={handleCreateEvent}
                disabled={creatingEvent || !newEventName.trim()}
                className="btn btn-primary"
              >
                {creatingEvent ? 'Creating...' : 'Create Event'}
              </button>
              <button
                onClick={() => {
                  setShowNewEventForm(false);
                  setNewEventName('');
                  setNewEventDesc('');
                }}
                disabled={creatingEvent}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Data for dropdowns
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Load people and events for dropdowns
  useEffect(() => {
    loadPeople();
    loadEvents();
  }, []);

  // Load next file on mount and after processing
  useEffect(() => {
    loadNextFile();
    loadRemainingCount();
  }, []);

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
        setError(data.error || 'Failed to load file');
      }
    } catch (err: any) {
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
        // Load next file
        await loadNextFile();
        await loadRemainingCount();
      } else {
        setError(data.error || 'Failed to process file');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    // For now, skip just loads next - could implement a skip mechanism
    loadNextFile();
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
        await loadNextFile();
        await loadRemainingCount();
      } else {
        setError(data.error || 'Failed to delete file');
      }
    } catch (err: any) {
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
          {remainingCount} file{remainingCount !== 1 ? 's' : ''} remaining
        </div>
      </div>

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
            <label>Event</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value ? parseInt(e.target.value) : '')}
              disabled={processing || eventsLoading}
            >
              <option value="">-- No Event --</option>
              {events.map(event => (
                <option key={event.ID} value={event.ID}>
                  {event.neName} ({event.neCount} photos)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Tag People</label>
            <div className="people-checkboxes">
              {peopleLoading ? (
                <p className="loading-text">Loading people...</p>
              ) : people.length === 0 ? (
                <p className="empty-text">No people in database</p>
              ) : (
                people.map(person => (
                  <label key={person.ID} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(person.ID)}
                      onChange={() => togglePerson(person.ID)}
                      disabled={processing}
                    />
                    <span className="person-name">{person.neName}</span>
                    <span className="person-relation">({person.neRelation})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              onClick={handleSaveAndNext}
              disabled={processing}
              className="btn btn-primary"
            >
              {processing ? 'Processing...' : 'Save & Next'}
            </button>
            <button
              onClick={handleSkip}
              disabled={processing}
              className="btn btn-secondary"
            >
              Skip
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
    </div>
  );
}

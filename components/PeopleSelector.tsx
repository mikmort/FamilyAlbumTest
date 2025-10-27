'use client';

import { useState, useEffect } from 'react';
import { Person, Event } from '../lib/types';

interface PeopleSelectorProps {
  selectedPeople: number[];
  selectedEvent: number | null;
  showNoPeople: boolean;
  sortOrder: 'asc' | 'desc';
  exclusiveFilter: boolean;
  onSelectedPeopleChange: (peopleIds: number[]) => void;
  onSelectedEventChange: (eventId: number | null) => void;
  onShowNoPeopleChange: (show: boolean) => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onExclusiveFilterChange: (exclusive: boolean) => void;
  onContinue: () => void;
}

export default function PeopleSelector({
  selectedPeople,
  selectedEvent,
  showNoPeople,
  sortOrder,
  exclusiveFilter,
  onSelectedPeopleChange,
  onSelectedEventChange,
  onShowNoPeopleChange,
  onSortOrderChange,
  onExclusiveFilterChange,
  onContinue,
}: PeopleSelectorProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);

  // Helpers to normalize API/sample data into expected types
  const normalizePeople = (arr: any[]): Person[] =>
    (arr || []).map((p) => ({
      ...p,
      neDateLastModified: p.neDateLastModified ? new Date(p.neDateLastModified) : new Date(),
    } as Person));

  const normalizeEvents = (arr: any[]): Event[] =>
    (arr || []).map((e) => ({
      ...e,
      neDateLastModified: e.neDateLastModified ? new Date(e.neDateLastModified) : new Date(),
    } as Event));

  useEffect(() => {
    // Only fetch if we haven't loaded data yet
    if (!dataLoaded) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [dataLoaded]);

  // Auto-retry logic for cold starts
  useEffect(() => {
    if (isWarmingUp && autoRetryAttempt < 12) { // Max 12 attempts (60 seconds at 5s intervals)
      const retryTimer = setTimeout(() => {
        setAutoRetryAttempt(prev => prev + 1);
        fetchData();
      }, 5000); // Check every 5 seconds
      return () => clearTimeout(retryTimer);
    }
  }, [isWarmingUp, autoRetryAttempt]);

  const fetchData = async () => {
    try {
      // Only set loading on first attempt to avoid flash during auto-retries
      if (!isWarmingUp || autoRetryAttempt === 0) {
        setLoading(true);
      }
      setError(null);

  // Try the app API but gracefully fall back to sample data when unavailable.
  const { fetchWithFallback, samplePeople, sampleEvents } = await import('../lib/api');

      const [peopleData, eventsData] = await Promise.all([
        fetchWithFallback('/api/people'),
        fetchWithFallback('/api/events'),
      ]);

      if (peopleData && eventsData) {
        // Handle both old format (array) and new format ({success, people})
        const peopleArray = peopleData.success ? peopleData.people : peopleData;
        const eventsArray = eventsData.success ? eventsData.events : eventsData;
        setPeople(normalizePeople(peopleArray));
        setEvents(normalizeEvents(eventsArray));
        setDataLoaded(true);
        setRetryCount(0);
        setIsWarmingUp(false);
        setAutoRetryAttempt(0);
        return;
      }

      // If API calls failed (null returned), use sample data so UI remains usable.
  console.warn('PeopleSelector: API unavailable, falling back to sample data');
  setPeople(normalizePeople(samplePeople()));
  setEvents(normalizeEvents(sampleEvents()));
      setDataLoaded(true);
      setRetryCount(0);
      setIsWarmingUp(false);
      setAutoRetryAttempt(0);
    } catch (err) {
      console.error('❌ PeopleSelector fetch error:', err);
      setError('An error occurred fetching people/events');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setIsWarmingUp(false);
    setAutoRetryAttempt(0);
    fetchData();
  };

  const togglePerson = (personId: number) => {
    if (selectedPeople.includes(personId)) {
      onSelectedPeopleChange(selectedPeople.filter((id) => id !== personId));
    } else if (selectedPeople.length < 5) {
      onSelectedPeopleChange([...selectedPeople, personId]);
    }
  };

  if (loading && isWarmingUp) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h2>Database is Warming Up</h2>
          <p className="loading-message">
            The Azure SQL database is starting up after being idle.
            This usually takes 10-30 seconds.
          </p>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <p className="loading-hint">
            ☕ Grab a coffee! We're checking every 5 seconds...
            {autoRetryAttempt > 0 && ` (Attempt ${autoRetryAttempt + 1}/12)`}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <h1 className="text-center mb-2">Select People to Browse</h1>
        <div className="form-group">
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>Loading people...</label>
          <div style={{ 
            height: '350px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            backgroundColor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '1rem', color: '#6c757d' }}>
              Loading {people.length > 0 ? `${people.length} people` : 'data'}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isWarmingUp) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h2>Unable to Load People List</h2>
          <p className="error-message">{error}</p>
          <div className="error-hint">
            <p><strong>💡 Tip:</strong> Try clicking retry below.</p>
            <p>If the issue persists, the database may need to warm up.</p>
          </div>
          <button className="btn btn-primary mt-2" onClick={handleRetry}>
            🔄 Retry {retryCount > 0 && `(Attempt ${retryCount + 1})`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-center mb-2">Select People to Browse</h1>

      <div className="form-group">
        <label style={{ marginBottom: '0.5rem', display: 'block' }}>Select People (up to 5):</label>
        <div style={{ 
          maxHeight: '350px', 
          overflowY: 'auto', 
          border: '1px solid #ddd', 
          borderRadius: '4px',
          backgroundColor: '#fff'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.95rem'
          }}>
            <thead style={{ 
              position: 'sticky', 
              top: 0, 
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #dee2e6'
            }}>
              <tr>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: '600' }}>Name</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: '600' }}>Description</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: '600', width: '100px' }}>Photos</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr 
                  key={person.ID} 
                  style={{ 
                    borderBottom: '1px solid #eee',
                    backgroundColor: selectedPeople.includes(person.ID) ? '#e3f2fd' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => togglePerson(person.ID)}
                >
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(person.ID)}
                      onChange={() => togglePerson(person.ID)}
                      disabled={!selectedPeople.includes(person.ID) && selectedPeople.length >= 5}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td style={{ 
                    padding: '0.75rem 0.5rem', 
                    fontWeight: '500',
                    color: '#212529'
                  }}>
                    {person.neName}
                  </td>
                  <td style={{ 
                    padding: '0.75rem 0.5rem',
                    color: '#6c757d',
                    fontSize: '0.9rem'
                  }}>
                    {person.neRelation || '—'}
                  </td>
                  <td style={{ 
                    padding: '0.75rem 0.5rem', 
                    textAlign: 'center',
                    fontWeight: '500',
                    color: '#495057'
                  }}>
                    {person.neCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-group">
        <label>Or Select an Event:</label>
        <select
          value={selectedEvent || ''}
          onChange={(e) => onSelectedEventChange(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">-- Select Event --</option>
          {events.map((event) => (
            <option key={event.ID} value={event.ID}>
              {event.neName} ({event.neCount} photos)
            </option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ 
        padding: '0.75rem', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          margin: 0,
          fontSize: '0.95rem'
        }}>
          <input
            type="checkbox"
            checked={showNoPeople}
            onChange={(e) => onShowNoPeopleChange(e.target.checked)}
            style={{ marginRight: '0.75rem', cursor: 'pointer' }}
          />
          <span>Show photos with no people tagged</span>
        </label>
      </div>

      {selectedPeople.length > 1 && (
        <div className="form-group" style={{ 
          padding: '0.75rem', 
          backgroundColor: '#fff3cd', 
          borderRadius: '4px',
          border: '1px solid #ffc107'
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            margin: 0,
            fontSize: '0.95rem'
          }}>
            <input
              type="checkbox"
              checked={exclusiveFilter}
              onChange={(e) => onExclusiveFilterChange(e.target.checked)}
              style={{ marginRight: '0.75rem', cursor: 'pointer' }}
            />
            <span>Only these people (no one else tagged)</span>
          </label>
        </div>
      )}

      <div className="form-group">
        <label>Sort Order:</label>
        <select value={sortOrder} onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}>
          <option value="desc">Newest to Oldest</option>
          <option value="asc">Oldest to Newest</option>
        </select>
      </div>

      <div className="flex flex-gap mt-2">
        <button
          className="btn btn-secondary"
          onClick={() => {
            onSelectedPeopleChange([]);
            onSelectedEventChange(null);
            onShowNoPeopleChange(false);
          }}
        >
          Clear Selection
        </button>
        <button
          className="btn btn-primary"
          onClick={onContinue}
          disabled={selectedPeople.length === 0 && !selectedEvent && !showNoPeople}
        >
          Continue to Gallery
        </button>
      </div>
    </div>
  );
}

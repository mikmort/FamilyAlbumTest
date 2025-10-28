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
  
  // Search/filter states for autocomplete
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleDropdownOpen, setPeopleDropdownOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.autocomplete-wrapper')) {
        setPeopleDropdownOpen(false);
        setEventDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open people dropdown when data is loaded
  useEffect(() => {
    if (dataLoaded && people.length > 0 && !selectedEvent) {
      setPeopleDropdownOpen(true);
    }
  }, [dataLoaded, people.length, selectedEvent]);

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
    if (isWarmingUp && autoRetryAttempt < 24) { // Max 24 attempts (2 minutes at 5s intervals)
      const retryTimer = setTimeout(() => {
        setAutoRetryAttempt(prev => prev + 1);
        fetchData();
      }, 5000); // Check every 5 seconds
      return () => clearTimeout(retryTimer);
    } else if (isWarmingUp && autoRetryAttempt >= 24) {
      // After 2 minutes, give up and show error
      setIsWarmingUp(false);
      setLoading(false);
      setError('Database is taking longer than expected to warm up. Please try again in a moment.');
    }
  }, [isWarmingUp, autoRetryAttempt]);

  const fetchData = async () => {
    try {
      // Only set loading on first attempt to avoid flash during auto-retries
      if (!isWarmingUp || autoRetryAttempt === 0) {
        setLoading(true);
      }
      setError(null);

      // Fetch from API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const [peopleResponse, eventsResponse] = await Promise.all([
        fetch('/api/people', { signal: controller.signal }),
        fetch('/api/events', { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      // Check if responses are OK
      if (!peopleResponse.ok || !eventsResponse.ok) {
        // If 503 or 504, it's likely warming up
        if (peopleResponse.status === 503 || eventsResponse.status === 503 || 
            peopleResponse.status === 504 || eventsResponse.status === 504) {
          if (!isWarmingUp) {
            setIsWarmingUp(true);
            setAutoRetryAttempt(0);
          }
          return;
        }
        throw new Error('Failed to fetch data');
      }

      const peopleData = await peopleResponse.json();
      const eventsData = await eventsResponse.json();

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

      // If we got here, data format was unexpected
      throw new Error('Unexpected data format from API');
    } catch (err: any) {
      console.error('❌ PeopleSelector fetch error:', err);
      
      // If it's a timeout or network error during initial load, treat as warm-up needed
      if ((err.name === 'AbortError' || err.message.includes('fetch')) && !isWarmingUp) {
        setIsWarmingUp(true);
        setAutoRetryAttempt(0);
        return;
      }
      
      // For other errors, show error message (but don't use sample data)
      setError('Failed to load data from database. Please try refreshing.');
      setLoading(false);
    } finally {
      if (!isWarmingUp) {
        setLoading(false);
      }
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

  // Filter people based on search, prioritizing starts-with matches
  const filteredPeople = people
    .filter(p => !selectedPeople.includes(p.ID)) // Exclude already selected
    .filter(p => {
      const search = peopleSearch.toLowerCase();
      if (!search) return true;
      const name = p.neName.toLowerCase();
      return name.includes(search);
    })
    .sort((a, b) => {
      const search = peopleSearch.toLowerCase();
      if (!search) return a.neName.localeCompare(b.neName);
      
      const aName = a.neName.toLowerCase();
      const bName = b.neName.toLowerCase();
      const aStarts = aName.startsWith(search);
      const bStarts = bName.startsWith(search);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });

  // Filter events based on search
  const filteredEvents = events
    .filter(e => {
      const search = eventSearch.toLowerCase();
      if (!search) return true;
      const name = e.neName.toLowerCase();
      return name.includes(search);
    })
    .sort((a, b) => {
      const search = eventSearch.toLowerCase();
      if (!search) return a.neName.localeCompare(b.neName);
      
      const aName = a.neName.toLowerCase();
      const bName = b.neName.toLowerCase();
      const aStarts = aName.startsWith(search);
      const bStarts = bName.startsWith(search);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });

  const getSelectedPeopleNames = () => {
    return selectedPeople.map(id => people.find(p => p.ID === id)?.neName).filter(Boolean);
  };

  const getSelectedEventName = () => {
    return events.find(e => e.ID === selectedEvent)?.neName || '';
  };

  if (loading && isWarmingUp) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h2>Database is Warming Up</h2>
          <p className="loading-message">
            The Azure SQL database is starting up after being idle.
            This usually takes 10-60 seconds.
          </p>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <p className="loading-hint">
            ☕ Please wait... We're checking every 5 seconds.
            {autoRetryAttempt > 0 && ` (Attempt ${autoRetryAttempt + 1}/24)`}
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
      <h1 className="text-center mb-2" style={{ fontWeight: 'bold', fontSize: '2.5rem', marginBottom: '1.5rem' }}>
        Family Album
      </h1>
      <h2 className="text-center mb-2" style={{ fontSize: '1.5rem', fontWeight: '500', marginBottom: '1.5rem' }}>
        Select People to Browse
      </h2>

      {/* People Selection - TOP */}
      <div className="form-group" style={{ marginBottom: '18rem' }}>
        <label>Select People (up to 5) {people.length > 0 && `(${people.length} available)`}</label>
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
            disabled={selectedPeople.length >= 5 || selectedEvent !== null}
            className="autocomplete-input"
          />
          {peopleDropdownOpen && selectedPeople.length < 5 && !selectedEvent && (
            <div className="autocomplete-dropdown">
              {filteredPeople.length === 0 ? (
                <div className="autocomplete-item disabled">
                  <em>{peopleSearch ? 'No matching people found' : 'All people selected'}</em>
                </div>
              ) : (
                filteredPeople.slice(0, 20).map(person => (
                  <div
                    key={person.ID}
                    className="autocomplete-item"
                    onClick={() => {
                      togglePerson(person.ID);
                      setPeopleSearch('');
                      setPeopleDropdownOpen(false);
                    }}
                  >
                    <span className="person-name">{person.neName}</span>
                    {person.neRelation && (
                      <span className="person-relation"> — {person.neRelation}</span>
                    )}
                    <span className="count"> ({person.neCount} photos)</span>
                  </div>
                ))
              )}
            </div>
          )}
          {selectedPeople.length > 0 && (
            <div className="selected-tags">
              {selectedPeople.map(personId => {
                const person = people.find(p => p.ID === personId);
                if (!person) return null;
                return (
                  <span key={personId} className="tag">
                    {person.neName}
                    <button
                      type="button"
                      onClick={() => togglePerson(personId)}
                      className="tag-remove"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {selectedPeople.length >= 5 && (
            <div style={{ marginTop: '0.5rem', color: '#856404', fontSize: '0.9rem' }}>
              Maximum of 5 people reached. Remove someone to add another.
            </div>
          )}
          {selectedEvent && (
            <div style={{ marginTop: '0.5rem', color: '#856404', fontSize: '0.9rem' }}>
              People selection disabled when an event is selected.
            </div>
          )}
        </div>
      </div>

      {/* Filter Checkboxes - Compact style */}
      <div className="form-group" style={{ 
        padding: '0.5rem 0.75rem', 
        backgroundColor: selectedPeople.length > 1 ? '#fff3cd' : '#f8f9fa', 
        borderRadius: '4px',
        border: selectedPeople.length > 1 ? '1px solid #ffc107' : '1px solid #dee2e6',
        opacity: selectedPeople.length > 1 ? 1 : 0.6,
        marginBottom: '0.5rem'
      }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: selectedPeople.length > 1 ? 'pointer' : 'not-allowed',
          margin: 0,
          fontSize: '0.9rem'
        }}>
          <input
            type="checkbox"
            checked={exclusiveFilter}
            onChange={(e) => onExclusiveFilterChange(e.target.checked)}
            disabled={selectedPeople.length <= 1}
            style={{ 
              marginRight: '0.5rem', 
              cursor: selectedPeople.length > 1 ? 'pointer' : 'not-allowed',
              width: '16px',
              height: '16px'
            }}
          />
          <span>Only these people (no one else tagged)</span>
        </label>
      </div>

      {/* No People Checkbox */}
      <div className="form-group" style={{ 
        padding: '0.5rem 0.75rem', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        border: '1px solid #dee2e6',
        marginBottom: '1rem'
      }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          margin: 0,
          fontSize: '0.9rem'
        }}>
          <input
            type="checkbox"
            checked={showNoPeople}
            onChange={(e) => onShowNoPeopleChange(e.target.checked)}
            disabled={selectedEvent !== null}
            style={{ 
              marginRight: '0.5rem', 
              cursor: 'pointer',
              width: '16px',
              height: '16px'
            }}
          />
          <span>Show photos with no people tagged</span>
        </label>
      </div>

      {/* Event Selection - BOTTOM */}
      <div className="form-group">
        <label>Or Select an Event {events.length > 0 && `(${events.length} available)`}</label>
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
            disabled={selectedPeople.length > 0 || showNoPeople}
            className="autocomplete-input"
          />
          {eventDropdownOpen && selectedPeople.length === 0 && !showNoPeople && (
            <div className="autocomplete-dropdown">
              <div 
                className="autocomplete-item"
                onClick={() => {
                  onSelectedEventChange(null);
                  setEventSearch('');
                  setEventDropdownOpen(false);
                }}
              >
                <em>-- No Event --</em>
              </div>
              {filteredEvents.length === 0 ? (
                <div className="autocomplete-item disabled">
                  <em>{eventSearch ? 'No matching events found' : 'No events in database'}</em>
                </div>
              ) : (
                filteredEvents.map(event => (
                  <div
                    key={event.ID}
                    className="autocomplete-item"
                    onClick={() => {
                      onSelectedEventChange(event.ID);
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
                  onClick={() => onSelectedEventChange(null)}
                  className="tag-remove"
                >
                  ×
                </button>
              </span>
            </div>
          )}
          {selectedPeople.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: '#856404', fontSize: '0.9rem' }}>
              Event selection disabled when people are selected.
            </div>
          )}
          {showNoPeople && (
            <div style={{ marginTop: '0.5rem', color: '#856404', fontSize: '0.9rem' }}>
              Event selection disabled when "Show photos with no people" is checked.
            </div>
          )}
        </div>
      </div>

      {/* Sort and Action Buttons */}
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

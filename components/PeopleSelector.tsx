'use client';

import { useState, useEffect } from 'react';
import { Person, Event } from '@/lib/types';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [peopleRes, eventsRes] = await Promise.all([
        fetch('/api/people'),
        fetch('/api/events'),
      ]);

      if (!peopleRes.ok || !eventsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const peopleData = await peopleRes.json();
      const eventsData = await eventsRes.json();

      setPeople(peopleData);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const togglePerson = (personId: number) => {
    if (selectedPeople.includes(personId)) {
      onSelectedPeopleChange(selectedPeople.filter((id) => id !== personId));
    } else if (selectedPeople.length < 5) {
      onSelectedPeopleChange([...selectedPeople, personId]);
    }
  };

  if (loading) {
    return (
      <div className="card text-center">
        <div className="loading-spinner"></div>
        <p className="mt-2">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn btn-primary mt-2" onClick={fetchData}>
          Retry
        </button>
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
            <span>Show only photos with <strong>ALL</strong> selected people (AND logic)</span>
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

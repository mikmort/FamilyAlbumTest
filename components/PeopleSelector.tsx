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
        <label>Select People (up to 5):</label>
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '0.5rem', borderRadius: '4px' }}>
          {people.map((person) => (
            <div key={person.ID} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(person.ID)}
                  onChange={() => togglePerson(person.ID)}
                  disabled={!selectedPeople.includes(person.ID) && selectedPeople.length >= 5}
                  style={{ marginRight: '0.5rem' }}
                />
                <span>
                  <strong>{person.neName}</strong>
                  {person.neRelation && ` - ${person.neRelation}`}
                  {` (${person.neCount} photos)`}
                </span>
              </label>
            </div>
          ))}
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

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showNoPeople}
            onChange={(e) => onShowNoPeopleChange(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          Show photos with no people tagged
        </label>
      </div>

      {selectedPeople.length > 1 && (
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={exclusiveFilter}
              onChange={(e) => onExclusiveFilterChange(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Show only photos with ALL selected people (AND logic)
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

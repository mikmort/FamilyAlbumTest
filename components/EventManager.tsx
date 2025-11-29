'use client';

import { useState, useEffect } from 'react';
import { Event } from '../lib/types';
import { formatDateOnly } from '../lib/utils';

export default function EventManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formEventDate, setFormEventDate] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data.success ? data.events : data); // Handle both formats
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      alert('Please enter an event name');
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: formName, 
          details: formDetails,
          eventDate: formEventDate || undefined 
        }),
      });

      if (!response.ok) throw new Error('Failed to create event');
      
      await fetchEvents();
      setIsCreating(false);
      setFormName('');
      setFormDetails('');
      setFormEventDate('');
    } catch (err) {
      alert('Error creating event: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdate = async () => {
    if (!editingEvent || !formName.trim()) {
      alert('Please enter an event name');
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingEvent.ID, 
          name: formName, 
          details: formDetails,
          eventDate: formEventDate || undefined
        }),
      });

      if (!response.ok) throw new Error('Failed to update event');
      
      await fetchEvents();
      setEditingEvent(null);
      setFormName('');
      setFormDetails('');
      setFormEventDate('');
    } catch (err) {
      alert('Error updating event: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async (event: Event) => {
    if (!confirm(`Delete event "${event.neName}"? This will remove it from all photos.`)) {
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.ID }),
      });

      if (!response.ok) throw new Error('Failed to delete event');
      
      await fetchEvents();
    } catch (err) {
      alert('Error deleting event: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const startEdit = (event: Event) => {
    setEditingEvent(event);
    setFormName(event.neName);
    setFormDetails(event.neRelation || '');
    // Ensure date is in YYYY-MM-DD format for date input
    const dateValue = event.EventDate ? event.EventDate.split('T')[0] : '';
    setFormEventDate(dateValue);
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingEvent(null);
    setFormName('');
    setFormDetails('');
    setFormEventDate('');
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingEvent(null);
    setFormName('');
    setFormDetails('');
    setFormEventDate('');
  };

  const filteredEvents = events.filter(e => 
    e.neName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h3 className="mt-2">Loading events...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h2>Unable to Load Events</h2>
          <p className="error-message">{error}</p>
          <button className="btn btn-primary mt-2" onClick={fetchEvents}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h1>📅 Event Manager</h1>
        <p className="manager-subtitle">Manage family events, weddings, reunions, and more</p>
      </div>

      <div className="manager-toolbar">
        <input
          type="text"
          placeholder="🔍 Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button className="btn btn-success" onClick={startCreate}>
          ➕ Add New Event
        </button>
      </div>

      {(isCreating || editingEvent) && (
        <div className="manager-form-card">
          <h3>{isCreating ? 'Add New Event' : `Edit ${editingEvent?.neName}`}</h3>
          <div className="form-group">
            <label>Event Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Sarah's Wedding, Summer Reunion 2024"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Event Date</label>
            <input
              type="date"
              value={formEventDate}
              onChange={(e) => setFormEventDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Event Details</label>
            <textarea
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder="Additional information about the event..."
              rows={3}
            />
          </div>
          <div className="flex flex-gap mt-2">
            {isCreating ? (
              <button className="btn btn-success" onClick={handleCreate}>
                ✓ Create
              </button>
            ) : (
              <button className="btn btn-success" onClick={handleUpdate}>
                ✓ Save Changes
              </button>
            )}
            <button className="btn btn-secondary" onClick={cancelForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="manager-list-card">
        <div className="manager-stats">
          <strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? 'event' : 'events'}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No events found.</p>
            {searchTerm && <p className="text-muted">Try adjusting your search.</p>}
          </div>
        ) : (
          <div className="manager-table-container">
            <table className="manager-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Details</th>
                  <th>Photos</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.ID}>
                    <td className="name-cell">{event.neName}</td>
                    <td className="relation-cell">
                      {event.EventDate ? (
                        <span className="event-date-badge">
                          {formatDateOnly(event.EventDate)}
                        </span>
                      ) : '—'}
                      {event.neRelation && (
                        <span className="event-details-preview" style={{ display: 'block', marginTop: event.EventDate ? '4px' : '0' }}>
                          {event.neRelation.length > 100 
                            ? event.neRelation.substring(0, 100) + '...' 
                            : event.neRelation}
                        </span>
                      )}
                    </td>
                    <td className="count-cell">{event.neCount || 0}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => startEdit(event)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(event)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

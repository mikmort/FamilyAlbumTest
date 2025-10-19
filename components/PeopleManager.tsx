'use client';

import { useState, useEffect } from 'react';
import { Person } from '@/lib/types';

export default function PeopleManager() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formRelation, setFormRelation] = useState('');

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/people');
      if (!response.ok) throw new Error('Failed to fetch people');
      const data = await response.json();
      setPeople(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, relation: formRelation }),
      });

      if (!response.ok) throw new Error('Failed to create person');
      
      await fetchPeople();
      setIsCreating(false);
      setFormName('');
      setFormRelation('');
    } catch (err) {
      alert('Error creating person: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdate = async () => {
    if (!editingPerson || !formName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      const response = await fetch('/api/people', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingPerson.ID, 
          name: formName, 
          relation: formRelation 
        }),
      });

      if (!response.ok) throw new Error('Failed to update person');
      
      await fetchPeople();
      setEditingPerson(null);
      setFormName('');
      setFormRelation('');
    } catch (err) {
      alert('Error updating person: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async (person: Person) => {
    if (!confirm(`Delete ${person.neName}? This will remove them from all photos.`)) {
      return;
    }

    try {
      const response = await fetch('/api/people', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: person.ID }),
      });

      if (!response.ok) throw new Error('Failed to delete person');
      
      await fetchPeople();
    } catch (err) {
      alert('Error deleting person: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const startEdit = (person: Person) => {
    setEditingPerson(person);
    setFormName(person.neName);
    setFormRelation(person.neRelation || '');
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingPerson(null);
    setFormName('');
    setFormRelation('');
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingPerson(null);
    setFormName('');
    setFormRelation('');
  };

  const filteredPeople = people.filter(p => 
    p.neName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h3 className="mt-2">Loading people...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h2>Unable to Load People</h2>
          <p className="error-message">{error}</p>
          <button className="btn btn-primary mt-2" onClick={fetchPeople}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h1>👥 People Manager</h1>
        <p className="manager-subtitle">Manage family members and friends</p>
      </div>

      <div className="manager-toolbar">
        <input
          type="text"
          placeholder="🔍 Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button className="btn btn-success" onClick={startCreate}>
          ➕ Add New Person
        </button>
      </div>

      {(isCreating || editingPerson) && (
        <div className="manager-form-card">
          <h3>{isCreating ? 'Add New Person' : `Edit ${editingPerson?.neName}`}</h3>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Relationship</label>
            <input
              type="text"
              value={formRelation}
              onChange={(e) => setFormRelation(e.target.value)}
              placeholder="e.g., Grandmother, Uncle, Friend"
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
          <strong>{filteredPeople.length}</strong> {filteredPeople.length === 1 ? 'person' : 'people'}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        {filteredPeople.length === 0 ? (
          <div className="empty-state">
            <p>No people found.</p>
            {searchTerm && <p className="text-muted">Try adjusting your search.</p>}
          </div>
        ) : (
          <div className="manager-table-container">
            <table className="manager-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Photos</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => (
                  <tr key={person.ID}>
                    <td className="name-cell">{person.neName}</td>
                    <td className="relation-cell">{person.neRelation || '—'}</td>
                    <td className="count-cell">{person.neCount || 0}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => startEdit(person)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(person)}
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

'use client';

import { useState, useEffect } from 'react';
import { MediaItem, PersonWithRelation } from '@/lib/types';

interface MediaDetailModalProps {
  filename: string;
  onClose: () => void;
}

interface MediaDetails {
  media: MediaItem;
  people: PersonWithRelation[];
  event: { ID: number; Name: string; Details: string } | null;
}

export default function MediaDetailModal({
  filename,
  onClose,
}: MediaDetailModalProps) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState<number | ''>('');
  const [year, setYear] = useState<number | ''>('');

  useEffect(() => {
    fetchDetails();
  }, [filename]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/${encodeURIComponent(filename)}`);

      if (!res.ok) {
        throw new Error('Failed to fetch media details');
      }

      const data = await res.json();
      setDetails(data);
      setDescription(data.media.PDescription || '');
      setMonth(data.media.PMonth || '');
      setYear(data.media.PYear || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!details) return;

    try {
      const res = await fetch(`/api/media/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          month: month || null,
          year: year || null,
          peopleIds: details.people.map((p) => p.ID),
          eventId: details.event?.ID || null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update media');
      }

      setEditing(false);
      fetchDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading-spinner"></div>
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>Error</h2>
          <p>{error || 'Media not found'}</p>
          <button className="btn btn-primary mt-2" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const { media, people, event } = details;

  return (
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
              <img src={media.PBlobUrl} alt={media.PDescription || media.PFileName} />
            ) : (
              <video controls src={media.PBlobUrl}>
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="metadata-panel">
            <h2>{media.PFileName}</h2>
            <p>
              <strong>Dimensions:</strong> {media.PWidth} x {media.PHeight}
            </p>
            {media.PType === 2 && (
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

            {event && (
              <div className="form-group">
                <label>Event:</label>
                <p>
                  <strong>{event.Name}</strong>
                </p>
                {event.Details && <p>{event.Details}</p>}
              </div>
            )}

            <div className="form-group">
              <label>Tagged People:</label>
              {people.length > 0 ? (
                <ul className="people-list">
                  {people.map((person) => (
                    <li key={person.ID}>
                      <strong>{person.Name}</strong>
                      {person.Relationship && ` - ${person.Relationship}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No people tagged</p>
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
  );
}

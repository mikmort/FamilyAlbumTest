'use client';

import { useState, useEffect } from 'react';
import { MediaItem } from '@/lib/types';

interface ThumbnailGalleryProps {
  peopleIds: number[];
  eventId: number | null;
  noPeople: boolean;
  sortOrder: 'asc' | 'desc';
  exclusiveFilter: boolean;
  onMediaClick: (media: MediaItem) => void;
}

export default function ThumbnailGallery({
  peopleIds,
  eventId,
  noPeople,
  sortOrder,
  exclusiveFilter,
  onMediaClick,
}: ThumbnailGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [peopleIds, eventId, noPeople, sortOrder, exclusiveFilter]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (peopleIds.length > 0) {
        params.append('peopleIds', peopleIds.join(','));
        if (exclusiveFilter) {
          params.append('exclusiveFilter', 'true');
        }
      }
      if (eventId) {
        params.append('eventId', eventId.toString());
      }
      if (noPeople) {
        params.append('noPeople', 'true');
      }
      params.append('sortOrder', sortOrder);

      const res = await fetch(`/api/media?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch media');
      }

      const data = await res.json();
      setMedia(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="loading-spinner"></div>
        <p className="mt-2">Loading media...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn btn-primary mt-2" onClick={fetchMedia}>
          Retry
        </button>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="card text-center">
        <h2>No Photos Found</h2>
        <p>No photos match your selected criteria.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card mb-2">
        <p>
          <strong>{media.length}</strong> photo{media.length !== 1 ? 's' : ''} found
        </p>
      </div>

      <div className="thumbnail-gallery">
        {media.map((item) => (
          <div
            key={item.PFileName}
            className="thumbnail-item"
            onClick={() => onMediaClick(item)}
          >
            <img
              src={item.PThumbnailUrl || '/placeholder.svg'}
              alt={item.PDescription || item.PFileName}
            />
            {item.PType === 2 && (
              <div className="video-indicator">
                VIDEO {item.PTime ? `(${Math.floor(item.PTime / 60)}:${(item.PTime % 60).toString().padStart(2, '0')})` : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

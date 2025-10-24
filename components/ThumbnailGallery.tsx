'use client';

import { useState, useEffect } from 'react';
import { MediaItem } from '../lib/types';

interface ThumbnailGalleryProps {
  peopleIds: number[];
  eventId: number | null;
  noPeople: boolean;
  sortOrder: 'asc' | 'desc';
  exclusiveFilter: boolean;
  onMediaClick: (media: MediaItem) => void;
  onMediaFullscreen?: (media: MediaItem) => void;
}

export default function ThumbnailGallery({
  peopleIds,
  eventId,
  noPeople,
  sortOrder,
  exclusiveFilter,
  onMediaClick,
  onMediaFullscreen,
}: ThumbnailGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [peopleIds, eventId, noPeople, sortOrder, exclusiveFilter]);

  const fetchMedia = async (isRetry = false) => {
    try {
      setLoading(true);
      setError(null);
      
      if (isRetry && retryCount === 0) {
        setIsWarmingUp(true);
      }
      
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

      // Increase timeout for cold starts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const res = await fetch(`/api/media?${params.toString()}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        
        // Log detailed error info to console for debugging
        console.error('❌ Media API Error:', {
          status: res.status,
          statusText: res.statusText,
          url: res.url,
          errorData: errorData
        });
        
        // If we have detailed error info from the server, log it
        if (errorData.message) {
          console.error('Error message:', errorData.message);
        }
        if (errorData.stack) {
          console.error('Stack trace:', errorData.stack);
        }
        if (errorData.debug) {
          console.error('Debug info:', errorData.debug);
        }
        
        throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      
      // Log video thumbnails for debugging
      const videoItems = data.filter((item: MediaItem) => item.PType === 2);
      if (videoItems.length > 0) {
        console.log('📹 Video items loaded:', videoItems.map((item: MediaItem) => ({
          fileName: item.PFileName,
          thumbnailUrl: item.PThumbnailUrl
        })));
      }
      
      setMedia(data);
      setRetryCount(0);
      setIsWarmingUp(false);
    } catch (err) {
      console.error('❌ ThumbnailGallery fetch error:', err);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('The request timed out. The database may be warming up. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchMedia(true);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          {isWarmingUp ? (
            <>
              <h3 className="mt-2">Waking up the database...</h3>
              <p className="loading-message">
                The database is starting up. This may take a moment on the first request.
              </p>
              <div className="loading-progress">
                <div className="loading-progress-bar"></div>
              </div>
              <p className="loading-hint">Please wait, this usually takes 10-30 seconds...</p>
            </>
          ) : (
            <>
              <h3 className="mt-2">Loading your photos...</h3>
              <p className="loading-message">Fetching media from the database</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h2>Unable to Load Photos</h2>
          <p className="error-message">{error}</p>
          {error.includes('warming up') || error.includes('timed out') ? (
            <div className="error-hint">
              <p><strong>💡 Tip:</strong> The database may need a moment to start up.</p>
              <p>Click retry below - it should work on the second try!</p>
            </div>
          ) : null}
          <button className="btn btn-primary mt-2" onClick={handleRetry}>
            🔄 Retry {retryCount > 0 && `(Attempt ${retryCount + 1})`}
          </button>
        </div>
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
            className={`thumbnail-item ${item.PType === 2 ? 'video-thumbnail' : ''}`}
            onClick={() => onMediaClick(item)}
            onContextMenu={(e) => {
              e.preventDefault(); // Prevent default context menu
              if (onMediaFullscreen) {
                onMediaFullscreen(item);
              }
            }}
          >
            <img
              src={item.PThumbnailUrl || '/placeholder.svg'}
              alt={item.PDescription || item.PFileName}
              onError={(e) => {
                console.error('❌ Thumbnail failed to load:', {
                  fileName: item.PFileName,
                  thumbnailUrl: item.PThumbnailUrl,
                  type: item.PType === 2 ? 'video' : 'image'
                });
                // Set a gray placeholder on error
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif"%3ENo Thumbnail%3C/text%3E%3C/svg%3E';
              }}
            />
            {item.PType === 2 && (
              <div className="video-indicator">
                {item.PTime ? `${Math.floor(item.PTime / 60)}:${(item.PTime % 60).toString().padStart(2, '0')}` : 'VIDEO'}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

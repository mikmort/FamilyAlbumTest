'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import useSWR from 'swr';
import { MediaItem } from '../lib/types';

interface ThumbnailGalleryProps {
  peopleIds: number[];
  eventId: number | null;
  noPeople: boolean;
  sortOrder: 'asc' | 'desc';
  exclusiveFilter: boolean;
  recentDays?: number | null;
  onMediaClick: (media: MediaItem, allMedia: MediaItem[]) => void;
  onMediaFullscreen?: (media: MediaItem, allMedia: MediaItem[]) => void;
}

// Memoized thumbnail component for better performance
const ThumbnailItem = memo(({ 
  item, 
  onItemClick, 
  onItemContextMenu 
}: { 
  item: MediaItem;
  onItemClick: () => void;
  onItemContextMenu: (e: React.MouseEvent) => void;
}) => {
  return (
    <div
      className={`thumbnail-item ${item.PType === 2 ? 'video-thumbnail' : ''}`}
      onClick={onItemClick}
      onContextMenu={onItemContextMenu}
    >
      <img
        src={
          item.PThumbnailUrl 
            ? `${item.PThumbnailUrl}${item.PThumbnailUrl.includes('?') ? '&' : '?'}v=${new Date(item.PLastModifiedDate).getTime()}` 
            : '/placeholder.svg'
        }
        alt={item.PDescription || item.PFileName}
        loading="lazy"
        onLoad={(e) => {
          const img = e.target as HTMLImageElement;
          console.log(`✅ Thumbnail loaded: ${item.PFileName}`, {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            ratio: `${img.naturalWidth}x${img.naturalHeight}`,
            url: item.PThumbnailUrl
          });
        }}
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
  );
});

ThumbnailItem.displayName = 'ThumbnailItem';

// Custom fetcher for SWR with retry logic
const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
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
      
      throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

function ThumbnailGallery({
  peopleIds,
  eventId,
  noPeople,
  sortOrder,
  exclusiveFilter,
  recentDays,
  onMediaClick,
  onMediaFullscreen,
}: ThumbnailGalleryProps) {
  const [retryCount, setRetryCount] = useState(0);

  // Memoize the query string to prevent unnecessary re-fetches
  const queryString = useMemo(() => {
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
    if (recentDays) {
      params.append('recentDays', recentDays.toString());
    }
    params.append('sortOrder', sortOrder);
    return params.toString();
  }, [peopleIds, eventId, noPeople, sortOrder, exclusiveFilter, recentDays]);

  // Use SWR for data fetching with caching
  const { data: media, error, isLoading, mutate } = useSWR<MediaItem[]>(
    `/api/media?${queryString}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  );

  // Detect if error is a warmup/timeout error
  const isWarmingUp = useMemo(() => {
    if (!error) return false;
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('timeout') || errorMessage.includes('warming up') || errorMessage.includes('abort');
  }, [error]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    mutate();
  }, [mutate]);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleMediaClick = useCallback((item: MediaItem) => {
    console.log('Thumbnail clicked:', {
      fileName: item.PFileName,
      blobUrl: item.PBlobUrl,
      thumbnailUrl: item.PThumbnailUrl,
      type: item.PType
    });
    onMediaClick(item, media || []);
  }, [media, onMediaClick]);

  const handleMediaContextMenu = useCallback((e: React.MouseEvent, item: MediaItem) => {
    e.preventDefault(); // Prevent default context menu
    if (onMediaFullscreen) {
      onMediaFullscreen(item, media || []);
    }
  }, [media, onMediaFullscreen]);

  if (isLoading) {
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
          <p className="error-message">{error.message}</p>
          {isWarmingUp ? (
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

  if (!media || media.length === 0) {
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
          <ThumbnailItem
            key={item.PFileName}
            item={item}
            onItemClick={() => handleMediaClick(item)}
            onItemContextMenu={(e) => handleMediaContextMenu(e, item)}
          />
        ))}
      </div>
    </>
  );
}

export default memo(ThumbnailGallery);
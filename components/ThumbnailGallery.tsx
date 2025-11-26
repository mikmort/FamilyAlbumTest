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
  peopleNames?: string[];
  eventName?: string | null;
  updatedMedia?: MediaItem | null; // Updated media item from modal
  onMediaClick: (media: MediaItem, allMedia: MediaItem[]) => void;
  onMediaFullscreen?: (media: MediaItem, allMedia: MediaItem[]) => void;
}

// Memoized thumbnail component for better performance
const ThumbnailItem = memo(({ 
  item, 
  onItemClick, 
  onItemContextMenu,
  cacheBuster
}: {
  item: MediaItem;
  onItemClick: () => void;
  onItemContextMenu: (e: React.MouseEvent) => void;
  cacheBuster?: string;
}) => { 
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
            ? `${item.PThumbnailUrl}${item.PThumbnailUrl.includes('?') ? '&' : '?'}v=${cacheBuster || new Date(item.PLastModifiedDate).getTime()}` 
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
  peopleNames,
  eventName,
  updatedMedia,
  onMediaClick,
  onMediaFullscreen,
}: ThumbnailGalleryProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cacheBuster, setCacheBuster] = useState<string>('');

  // Check if a thumbnail was rotated and add cache buster
  useEffect(() => {
    const rotationTimestamp = sessionStorage.getItem('thumbnailRotated');
    if (rotationTimestamp) {
      setCacheBuster(rotationTimestamp);
      sessionStorage.removeItem('thumbnailRotated');
    }
  }, []);

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

  // Initial fetch with limit=100 for fast initial load
  const { data: initialMedia, error, isLoading, mutate } = useSWR<MediaItem[]>(
    `/api/media?${queryString}&limit=100`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  );

  // When initial data loads, fetch all remaining items in background
  useEffect(() => {
    if (initialMedia && initialMedia.length > 0) {
      // Set initial media immediately for fast perceived performance
      setAllMedia(initialMedia);
      
      // Check if there might be more items (if we got exactly 100, likely more exist)
      if (initialMedia.length === 100) {
        setHasMore(true);
        setIsLoadingMore(true);
        
        // Fetch all items in background
        const fetchAll = async () => {
          try {
            const response = await fetch(`/api/media?${queryString}`);
            if (response.ok) {
              const allItems = await response.json();
              // Only update if we got more items than initially
              if (allItems.length > initialMedia.length) {
                setAllMedia(allItems);
                console.log(`📊 Progressive load: ${initialMedia.length} → ${allItems.length} items`);
              }
            }
          } catch (err) {
            console.warn('Background fetch failed:', err);
          } finally {
            setIsLoadingMore(false);
            setHasMore(false);
          }
        };
        
        // Small delay to ensure initial render is smooth
        setTimeout(fetchAll, 100);
      } else {
        setHasMore(false);
      }
    }
  }, [initialMedia, queryString]);

  // Update allMedia when an item is updated externally (e.g., from modal)
  useEffect(() => {
    if (updatedMedia) {
      setAllMedia(prevMedia => {
        // Check if the updated item still matches the current filters
        let matchesFilter = true;
        
        // Check "No People Tagged" filter
        if (noPeople) {
          // Item matches if it has no real people (only ID=1, or empty, or only events)
          // Real people are any IDs that are NOT ID=1
          const realPeople = (updatedMedia.TaggedPeople || []).filter(p => p.ID !== 1);
          matchesFilter = realPeople.length === 0;
          console.log(`🔍 No People filter check:`, {
            taggedPeople: updatedMedia.TaggedPeople,
            realPeople,
            matchesFilter
          });
        }
        
        // Check people filter
        if (matchesFilter && peopleIds.length > 0) {
          const taggedIds = (updatedMedia.TaggedPeople || []).map(p => p.ID);
          if (exclusiveFilter) {
            // AND logic - must have ALL selected people
            matchesFilter = peopleIds.every(id => taggedIds.includes(id));
          } else {
            // OR logic - must have at least ONE selected person
            matchesFilter = peopleIds.some(id => taggedIds.includes(id));
          }
        }
        
        // Check event filter
        if (matchesFilter && eventId !== null) {
          matchesFilter = updatedMedia.Event?.ID === eventId;
        }
        
        console.log(`📝 ThumbnailGallery: Updated ${updatedMedia.PFileName}`, {
          matchesFilter,
          noPeople,
          peopleIds,
          eventId,
          taggedPeople: updatedMedia.TaggedPeople,
          event: updatedMedia.Event
        });
        
        if (matchesFilter) {
          // Item still matches - update it in place
          return prevMedia.map(item => 
            item.PFileName === updatedMedia.PFileName ? updatedMedia : item
          );
        } else {
          // Item no longer matches - remove it from the list
          console.log(`🗑️ Removing ${updatedMedia.PFileName} - no longer matches filter`);
          return prevMedia.filter(item => item.PFileName !== updatedMedia.PFileName);
        }
      });
    }
  }, [updatedMedia, noPeople, peopleIds, eventId, exclusiveFilter]);

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
    onMediaClick(item, allMedia || []);
  }, [allMedia, onMediaClick]);

  const handleMediaContextMenu = useCallback((e: React.MouseEvent, item: MediaItem) => {
    e.preventDefault(); // Prevent default context menu
    if (onMediaFullscreen) {
      onMediaFullscreen(item, allMedia || []);
    }
  }, [allMedia, onMediaFullscreen]);

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

  if (!allMedia || allMedia.length === 0) {
    // Still loading or no results
    if (isLoading) {
      return null; // Loading state handled above
    }
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
          <strong>{allMedia.length}</strong> photo{allMedia.length !== 1 ? 's' : ''} found
          {isLoadingMore && <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9em' }}>Loading more...</span>}
        </p>
      </div>

      <div className="thumbnail-gallery">
        {allMedia.map((item: MediaItem) => (
          <ThumbnailItem
            key={item.PFileName}
            item={item}
            onItemClick={() => handleMediaClick(item)}
            onItemContextMenu={(e) => handleMediaContextMenu(e, item)}
            cacheBuster={cacheBuster}
          />
        ))}
      </div>
    </>
  );
}

export default memo(ThumbnailGallery);
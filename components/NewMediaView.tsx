'use client';

import { useState, useEffect } from 'react';
import { MediaItem } from '@/lib/types';

interface NewMediaViewProps {
  onMediaClick?: (media: MediaItem, allMedia: MediaItem[]) => void;
  onMediaFullscreen?: (media: MediaItem, allMedia: MediaItem[]) => void;
}

export default function NewMediaView({ onMediaClick, onMediaFullscreen }: NewMediaViewProps) {
  const [newMedia, setNewMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastViewedTime, setLastViewedTime] = useState<string | null>(null);

  useEffect(() => {
    loadNewMedia();
  }, []);

  const loadNewMedia = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/new-media');
      
      if (!response.ok) {
        throw new Error('Failed to load new media');
      }

      const data = await response.json();
      setNewMedia(data.media || []);
      setLastViewedTime(data.lastViewedTime);
      
      console.log(`Loaded ${data.count} new media items`);
      console.log('New media items:', data.media);
    } catch (err) {
      console.error('Error loading new media:', err);
      setError(err instanceof Error ? err.message : 'Failed to load new media');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsViewed = async () => {
    try {
      const response = await fetch('/api/new-media', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as viewed');
      }

      const data = await response.json();
      setLastViewedTime(data.lastViewedTime);
      
      // After marking as viewed, reload to show updated list
      await loadNewMedia();
    } catch (err) {
      console.error('Error marking as viewed:', err);
      alert('Failed to mark as viewed. Please try again.');
    }
  };

  const handleMediaClick = (filename: string) => {
    // Find the media item and call the callback
    const mediaItem = newMedia.find(m => m.PFileName === filename);
    console.log('NewMediaView handleMediaClick:', {
      filename,
      found: !!mediaItem,
      mediaItem: mediaItem ? {
        PFileName: mediaItem.PFileName,
        PBlobUrl: mediaItem.PBlobUrl,
        PType: mediaItem.PType,
        TaggedPeople: mediaItem.TaggedPeople,
        Event: mediaItem.Event
      } : null
    });
    if (mediaItem && onMediaClick) {
      onMediaClick(mediaItem, newMedia);
    }
  };

  const handleMediaFullscreen = (filename: string) => {
    // Find the media item and call the callback
    const mediaItem = newMedia.find(m => m.PFileName === filename);
    console.log('NewMediaView handleMediaFullscreen:', {
      filename,
      found: !!mediaItem,
      mediaItem: mediaItem ? {
        PFileName: mediaItem.PFileName,
        PBlobUrl: mediaItem.PBlobUrl,
        PType: mediaItem.PType
      } : null
    });
    if (mediaItem && onMediaFullscreen) {
      onMediaFullscreen(mediaItem, newMedia);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>New Media</h1>
        <p>Loading new media...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>New Media</h1>
        <div style={{
          padding: '20px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24'
        }}>
          <strong>Error:</strong> {error}
        </div>
        <p style={{ marginTop: '20px', color: '#666' }}>
          Use the Back button above to return to the gallery.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px' 
      }}>
        <h1>✨ New Media ({newMedia.length})</h1>
        <div>
          {newMedia.length > 0 && (
            <button
              onClick={handleMarkAsViewed}
              style={{
                background: '#28a745',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Mark All as Viewed
            </button>
          )}
        </div>
      </div>

      {lastViewedTime && (
        <p style={{ 
          color: '#666', 
          fontSize: '0.9rem',
          marginBottom: '20px' 
        }}>
          Showing media added since {new Date(lastViewedTime).toLocaleString()}
        </p>
      )}

      {newMedia.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f8f9fa',
          borderRadius: '8px',
          color: '#666'
        }}>
          <h2>🎉 You're all caught up!</h2>
          <p>No new media since your last visit.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
          padding: '20px 0'
        }}>
          {newMedia.map((item) => (
            <div
              key={item.PFileName}
              onClick={() => handleMediaClick(item.PFileName)}
              onContextMenu={(e) => {
                e.preventDefault(); // Prevent default context menu
                handleMediaFullscreen(item.PFileName);
              }}
              style={{
                cursor: 'pointer',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                background: '#fff',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <img
                src={
                  item.PThumbnailUrl 
                    ? `${item.PThumbnailUrl}${item.PThumbnailUrl.includes('?') ? '&' : '?'}v=${new Date(item.PLastModifiedDate).getTime()}` 
                    : `/api/media/${item.PFileName}?thumb=true`
                }
                alt={item.PDescription || item.PFileName}
                style={{
                  width: '100%',
                  height: '200px',
                  objectFit: 'cover'
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
                <div style={{
                  position: 'absolute',
                  bottom: '40px',
                  right: '8px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {item.PTime ? `${Math.floor(item.PTime / 60)}:${(item.PTime % 60).toString().padStart(2, '0')}` : 'VIDEO'}
                </div>
              )}
              <div style={{ padding: '8px' }}>
                <p style={{ 
                  fontSize: '0.85rem', 
                  color: '#666',
                  margin: 0 
                }}>
                  {new Date(item.PDateEntered).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

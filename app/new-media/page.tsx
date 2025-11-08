'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThumbnailGallery from '@/components/ThumbnailGallery';

interface MediaItem {
  PFileName: string;
  PMediaType: number;
  PDateTaken: string;
  PDateModified: string;
  PDateCreated: string;
  PPeopleList: string;
  PNameCount: number;
  PDescription: string;
  PWidth: number;
  PHeight: number;
}

export default function NewMediaPage() {
  const router = useRouter();
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
    // Navigate to gallery with this media item selected
    router.push(`/gallery?file=${encodeURIComponent(filename)}`);
  };

  const handleBack = () => {
    router.push('/');
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
        <button onClick={handleBack} style={{ marginTop: '20px' }}>
          Back to Home
        </button>
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
          <button onClick={handleBack}>
            Back to Home
          </button>
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
          <button 
            onClick={handleBack}
            style={{ marginTop: '20px' }}
          >
            Go to Gallery
          </button>
        </div>
      ) : (
        <ThumbnailGallery
          media={newMedia}
          onMediaClick={handleMediaClick}
        />
      )}
    </div>
  );
}

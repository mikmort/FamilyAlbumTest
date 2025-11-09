'use client';

import { useState, useEffect } from 'react';
import { MediaItem, Person, Event } from '../lib/types';

interface HomePageProps {
  onMediaClick: (media: MediaItem, allMedia: MediaItem[]) => void;
  onMediaFullscreen: (media: MediaItem, allMedia: MediaItem[]) => void;
  onSelectPeople: () => void;
}

interface HomePageData {
  onThisDay: MediaItem[];
  recentUploads: MediaItem[];
  totalPhotos: number;
  totalPeople: number;
  totalEvents: number;
  featuredPerson?: Person;
  featuredEvent?: Event;
  randomSuggestion?: Event;
}

export default function HomePage({
  onMediaClick,
  onMediaFullscreen,
  onSelectPeople,
}: HomePageProps) {
  const [data, setData] = useState<HomePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHomePageData();
  }, []);

  const loadHomePageData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/homepage');
      if (!response.ok) {
        throw new Error('Failed to load homepage data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading homepage data:', err);
      setError('Failed to load homepage data');
    } finally {
      setLoading(false);
    }
  };

  const handleRandomMemory = () => {
    // This will be implemented to show a random photo/event
    alert('Random memory feature coming soon!');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
        <p>Loading your family memories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#dc3545' }}>
        <p>{error}</p>
        <button onClick={loadHomePageData} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Try Again
        </button>
      </div>
    );
  }

  const today = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '3rem',
        color: 'white',
        marginBottom: '2rem',
        textAlign: 'center',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
      }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0', fontWeight: 'bold' }}>
          Welcome to Your Family Album
        </h1>
        <p style={{ fontSize: '1.2rem', margin: '0 0 2rem 0', opacity: 0.95 }}>
          Preserving memories, connecting generations
        </p>
        
        {/* Search Bar */}
        <div style={{ 
          background: 'white', 
          borderRadius: '50px', 
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <span style={{ fontSize: '1.5rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search for people, events, or years..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: '#333',
            }}
            onClick={onSelectPeople}
            readOnly
          />
        </div>

        <button
          onClick={handleRandomMemory}
          style={{
            marginTop: '1.5rem',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid white',
            color: 'white',
            padding: '0.75rem 2rem',
            borderRadius: '50px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#667eea';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.color = 'white';
          }}
        >
          🎲 Surprise Me!
        </button>
      </div>

      {/* Stats Bar */}
      {data && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3498db' }}>
              {data.totalPhotos.toLocaleString()}
            </div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>Photos & Videos</div>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#9b59b6' }}>
              {data.totalPeople.toLocaleString()}
            </div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>Family Members</div>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e74c3c' }}>
              {data.totalEvents.toLocaleString()}
            </div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>Events</div>
          </div>
        </div>
      )}

      {/* On This Day Section */}
      {data && data.onThisDay && data.onThisDay.length > 0 && (
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ 
            fontSize: '1.8rem', 
            marginBottom: '1rem', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🎉 On This Day - {monthNames[today.getMonth()]} {today.getDate()}
          </h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Memories from years past on this date
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {data.onThisDay.slice(0, 6).map((media, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  paddingBottom: '100%',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'transform 0.2s',
                }}
                onClick={() => onMediaClick(media, data.onThisDay)}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <img
                  src={media.PThumbnailUrl}
                  alt={media.PDescription || 'Family photo'}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                  color: 'white',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                }}>
                  {media.PYear}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Uploads Section */}
      {data && data.recentUploads && data.recentUploads.length > 0 && (
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ 
            fontSize: '1.8rem', 
            marginBottom: '1rem', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ✨ Recent Uploads
          </h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            New memories added this week
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {data.recentUploads.slice(0, 6).map((media, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  paddingBottom: '100%',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'transform 0.2s',
                }}
                onClick={() => onMediaClick(media, data.recentUploads)}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <img
                  src={media.PThumbnailUrl}
                  alt={media.PDescription || 'Family photo'}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {media.PType === 2 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '3rem',
                    color: 'white',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  }}>
                    ▶️
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Person Section */}
      {data && data.featuredPerson && (
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ 
            fontSize: '1.8rem', 
            marginBottom: '1rem', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⭐ Featured: {data.featuredPerson.neName}
          </h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            {data.featuredPerson.neRelation}
          </p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>
            {data.featuredPerson.neCount} photos
          </p>
        </section>
      )}

      {/* Featured Event Section */}
      {data && data.featuredEvent && (
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ 
            fontSize: '1.8rem', 
            marginBottom: '1rem', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📸 Event Highlight: {data.featuredEvent.neName}
          </h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            {data.featuredEvent.neRelation}
          </p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>
            {data.featuredEvent.neCount} photos
          </p>
        </section>
      )}

      {/* Suggested Albums */}
      {data && data.randomSuggestion && (
        <section style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          padding: '2rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem', margin: 0 }}>
            🎭 Haven't Visited Lately
          </h2>
          <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
            {data.randomSuggestion.neName}
          </p>
          <button
            onClick={onSelectPeople}
            style={{
              background: 'white',
              color: '#f5576c',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '50px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginTop: '1rem',
            }}
          >
            Explore Now →
          </button>
        </section>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { MediaItem, Person, Event } from '../lib/types';
import Fuse from 'fuse.js';
import { getNameVariations } from '../lib/nicknames';

interface HomePageProps {
  onMediaClick: (media: MediaItem, allMedia: MediaItem[]) => void;
  onMediaFullscreen: (media: MediaItem, allMedia: MediaItem[]) => void;
  onSelectPeople: () => void;
  onNavigateToGallery: (peopleIds: number[], eventId: number | null) => void;
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
  onNavigateToGallery,
}: HomePageProps) {
  const [data, setData] = useState<HomePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);

  useEffect(() => {
    loadHomePageData();
    loadPeopleAndEvents();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-wrapper')) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadHomePageData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/homepage');
      
      // Handle database warmup scenario (503 Service Unavailable)
      if (response.status === 503) {
        const errorData = await response.json();
        if (errorData.databaseWarming) {
          console.log('Database is warming up, retrying in 3 seconds...');
          // Wait and retry
          setTimeout(() => {
            loadHomePageData();
          }, 3000);
          return;
        }
      }
      
      if (!response.ok) {
        // Log detailed error information for debugging
        const errorText = await response.text();
        console.error('Homepage API error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          responseBody: errorText
        });
        throw new Error('Failed to load homepage data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading homepage data:', err);
      // Log additional context for debugging
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          stack: err.stack
        });
      }
      setError('Failed to load homepage data');
    } finally {
      setLoading(false);
    }
  };

  const loadPeopleAndEvents = async () => {
    try {
      const [peopleResponse, eventsResponse] = await Promise.all([
        fetch('/api/people'),
        fetch('/api/events'),
      ]);

      if (peopleResponse.ok && eventsResponse.ok) {
        const peopleData = await peopleResponse.json();
        const eventsData = await eventsResponse.json();
        
        const peopleArray = peopleData.success ? peopleData.people : peopleData;
        const eventsArray = eventsData.success ? eventsData.events : eventsData;
        
        setAllPeople(peopleArray || []);
        setAllEvents(eventsArray || []);
      }
    } catch (err) {
      console.error('Error loading people and events:', err);
    }
  };

  // Create Fuse instances for fuzzy search
  const peopleFuse = useMemo(() => {
    return new Fuse(allPeople, {
      keys: ['neName'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [allPeople]);

  const eventsFuse = useMemo(() => {
    return new Fuse(allEvents, {
      keys: ['neName'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [allEvents]);

  // Filter people and events based on search query with fuzzy matching and nicknames
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return { people: [], events: [] };
    }

    const searchVariations = getNameVariations(searchQuery.toLowerCase().trim());
    
    // Try exact/nickname matches for people
    const exactPeopleMatches = allPeople.filter(person => {
      const personNameLower = person.neName.toLowerCase();
      return searchVariations.some(variation => 
        personNameLower.includes(variation) || variation.includes(personNameLower)
      );
    });

    // If we have exact matches, use those; otherwise, use fuzzy search
    const peopleResults = exactPeopleMatches.length > 0
      ? exactPeopleMatches
      : peopleFuse.search(searchQuery).map(result => result.item);

    // Fuzzy search for events
    const eventResults = eventsFuse.search(searchQuery).map(result => result.item);

    return {
      people: peopleResults.slice(0, 5),
      events: eventResults.slice(0, 5),
    };
  }, [searchQuery, allPeople, allEvents, peopleFuse, eventsFuse]);

  const handleSearchItemClick = (type: 'person' | 'event', id: number) => {
    setSearchQuery('');
    setSearchDropdownOpen(false);
    if (type === 'person') {
      onNavigateToGallery([id], null);
    } else {
      onNavigateToGallery([], id);
    }
  };

  const handleRandomMemory = async () => {
    try {
      // Fetch a random media item from the API
      const response = await fetch('/api/media?random=1&limit=1');
      if (response.ok) {
        const result = await response.json();
        if (result.media && result.media.length > 0) {
          const randomMedia = result.media[0];
          onMediaFullscreen(randomMedia, result.media);
        }
      }
    } catch (err) {
      console.error('Error loading random memory:', err);
    }
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
        background: 'linear-gradient(135deg, #8B9DC3 0%, #6B7FA8 100%)',
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
        <div className="search-wrapper" style={{ 
          background: 'white', 
          borderRadius: '50px', 
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '600px',
          margin: '0 auto',
          position: 'relative',
        }}>
          <span style={{ fontSize: '1.5rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search for people, events, or years..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchDropdownOpen(true);
            }}
            onFocus={() => setSearchDropdownOpen(true)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: '#333',
            }}
          />
          {searchDropdownOpen && searchQuery && (searchResults.people.length > 0 || searchResults.events.length > 0) && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '0.5rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 1000,
            }}>
              {searchResults.people.length > 0 && (
                <>
                  <div style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#666',
                    borderBottom: '1px solid #f0f0f0',
                  }}>
                    People
                  </div>
                  {searchResults.people.map((person) => (
                    <div
                      key={`person-${person.ID}`}
                      onClick={() => handleSearchItemClick('person', person.ID)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <span style={{ color: '#333', fontWeight: '500' }}>{person.neName}</span>
                      <span style={{ color: '#999', fontSize: '0.85rem' }}>{person.neCount} photos</span>
                    </div>
                  ))}
                </>
              )}
              {searchResults.events.length > 0 && (
                <>
                  <div style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#666',
                    borderBottom: '1px solid #f0f0f0',
                  }}>
                    Events
                  </div>
                  {searchResults.events.map((event) => (
                    <div
                      key={`event-${event.ID}`}
                      onClick={() => handleSearchItemClick('event', event.ID)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <span style={{ color: '#333', fontWeight: '500' }}>{event.neName}</span>
                      <span style={{ color: '#999', fontSize: '0.85rem' }}>{event.neCount} photos</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
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
            🎉 In This Month - {monthNames[today.getMonth()]}
          </h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Memories from years past in {monthNames[today.getMonth()]}
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
            New memories added recently
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {data.recentUploads.slice(0, 10).map((media, idx) => (
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
          {data.recentUploads.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  // Navigate to a view of all recent uploads
                  onMediaClick(data.recentUploads[0], data.recentUploads);
                }}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#5568d3'}
                onMouseOut={(e) => e.currentTarget.style.background = '#667eea'}
              >
                Show More ({data.recentUploads.length - 10} more)
              </button>
            </div>
          )}
        </section>
      )}

      {/* Featured Person Section */}
      {data && data.featuredPerson && (
        <section 
          onClick={() => onNavigateToGallery([data.featuredPerson!.ID], null)}
          style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
        >
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
            {data.featuredPerson.neCount} photos • Click to view →
          </p>
        </section>
      )}

      {/* Featured Event Section */}
      {data && data.featuredEvent && (
        <section 
          onClick={() => onNavigateToGallery([], data.featuredEvent!.ID)}
          style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
        >
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
            {data.featuredEvent.neCount} photos • Click to view →
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
            onClick={() => onNavigateToGallery([], data.randomSuggestion!.ID)}
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

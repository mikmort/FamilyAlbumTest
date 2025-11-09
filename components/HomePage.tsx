'use client';

import { useState, useEffect, useMemo } from 'react';
import { MediaItem, Person, Event } from '../lib/types';
import Fuse from 'fuse.js';
import { getNameVariations } from '../lib/nicknames';

// Helper function for relative time display
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

interface HomePageProps {
  onMediaClick: (media: MediaItem, allMedia: MediaItem[]) => void;
  onMediaFullscreen: (media: MediaItem, allMedia: MediaItem[]) => void;
  onSelectPeople: () => void;
  onNavigateToGallery: (peopleIds: number[], eventId: number | null) => void;
  onViewNewMedia: () => void;
  onViewRecentUploads: () => void;
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
  onViewNewMedia,
  onViewRecentUploads,
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
      {/* Hero Section with Gradient Background */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '4rem 3rem',
        color: 'white',
        marginBottom: '2rem',
        textAlign: 'center',
        boxShadow: '0 15px 40px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative pattern overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ 
            fontSize: '3rem', 
            margin: '0 0 1rem 0', 
            fontWeight: 'bold',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          }}>
            Welcome to Your Family Album
          </h1>
          <p style={{ fontSize: '1.3rem', margin: '0 0 2.5rem 0', opacity: 0.95 }}>
            Preserving memories, connecting generations
          </p>
          
          {/* Search Bar */}
          <div className="search-wrapper" style={{ 
            background: 'rgba(255, 255, 255, 0.95)', 
            borderRadius: '50px', 
            padding: '1.2rem 2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            maxWidth: '650px',
            margin: '0 auto 1.5rem',
            position: 'relative',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(10px)',
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
                fontSize: '1.05rem',
                color: '#333',
                background: 'transparent',
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
            background: 'rgba(255, 255, 255, 0.25)',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            color: 'white',
            padding: '1rem 2.5rem',
            borderRadius: '50px',
            fontSize: '1.1rem',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#667eea';
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
          }}
        >
          🎲 Surprise Me!
        </button>
        </div>
      </div>

      {/* Recent Uploads Section */}
      {data && data.recentUploads && data.recentUploads.length > 0 && (
        <section style={{
          background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
          borderRadius: '16px',
          padding: '2.5rem',
          marginBottom: '2rem',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
        }}>
          <h2 style={{ 
            fontSize: '2rem', 
            marginBottom: '0.5rem', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 'bold',
          }}>
            ✨ Recent Uploads
          </h2>
          <p style={{ color: '#6c757d', marginBottom: '2rem', fontSize: '1.05rem' }}>
            New memories added in the last 60 days
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}>
            {data.recentUploads.slice(0, 10).map((media, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  paddingBottom: '100%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => onMediaClick(media, data.recentUploads)}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.2)';
                  const overlay = e.currentTarget.querySelector('.hover-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
                  const overlay = e.currentTarget.querySelector('.hover-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '0';
                }}
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
                
                {/* Timestamp badge */}
                {media.PDateEntered && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    color: 'white',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    backdropFilter: 'blur(8px)',
                  }}>
                    {getRelativeTime(media.PDateEntered.toString())}
                  </div>
                )}

                {/* Video play indicator */}
                {media.PType === 2 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '3.5rem',
                    color: 'white',
                    textShadow: '0 3px 10px rgba(0,0,0,0.6)',
                  }}>
                    ▶️
                  </div>
                )}

                {/* Hover overlay with people info */}
                <div 
                  className="hover-overlay"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)',
                    padding: '3rem 1rem 1rem',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none',
                  }}
                >
                  {media.TaggedPeople && media.TaggedPeople.length > 0 && (
                    <div style={{
                      color: 'white',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                    }}>
                      {media.TaggedPeople.slice(0, 3).map(p => p.neName).join(', ')}
                      {media.TaggedPeople.length > 3 && ` +${media.TaggedPeople.length - 3} more`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.recentUploads.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={onViewRecentUploads}
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

      {/* Featured Person Section */}
      {data && data.featuredPerson && (
        <section 
          onClick={() => onNavigateToGallery([data.featuredPerson!.ID], null)}
          style={{
            background: 'linear-gradient(135deg, #fff9e6 0%, #fff3d6 100%)',
            borderRadius: '16px',
            padding: '2.5rem',
            marginBottom: '2rem',
            boxShadow: '0 8px 20px rgba(255, 193, 7, 0.15)',
            border: '2px solid #ffeaa7',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(255, 193, 7, 0.25)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 193, 7, 0.15)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
              fontSize: '3.5rem',
              background: 'linear-gradient(135deg, #ffd93d 0%, #ffc107 100%)',
              borderRadius: '50%',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)',
            }}>
              ⭐
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#f57c00',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Featured Person
              </div>
              <h2 style={{ 
                fontSize: '2rem', 
                margin: '0 0 0.5rem 0', 
                color: '#2c3e50',
                fontWeight: 'bold',
              }}>
                {data.featuredPerson.neName}
              </h2>
              <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>
                {data.featuredPerson.neRelation}
              </p>
              <p style={{ color: '#999', fontSize: '0.95rem', margin: 0 }}>
                📸 {data.featuredPerson.neCount} photos • Click to explore →
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Featured Event Section */}
      {data && data.featuredEvent && (
        <section 
          onClick={() => onNavigateToGallery([], data.featuredEvent!.ID)}
          style={{
            background: 'linear-gradient(135deg, #e3f2fd 0%, #d1e7fd 100%)',
            borderRadius: '16px',
            padding: '2.5rem',
            marginBottom: '2rem',
            boxShadow: '0 8px 20px rgba(33, 150, 243, 0.15)',
            border: '2px solid #bbdefb',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(33, 150, 243, 0.25)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(33, 150, 243, 0.15)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
              fontSize: '3.5rem',
              background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)',
              borderRadius: '50%',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
            }}>
              🎉
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#1565c0',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Event Highlight
              </div>
              <h2 style={{ 
                fontSize: '2rem', 
                margin: '0 0 0.5rem 0', 
                color: '#2c3e50',
                fontWeight: 'bold',
              }}>
                {data.featuredEvent.neName}
              </h2>
              <p style={{ color: '#999', fontSize: '0.95rem', margin: 0 }}>
                📸 {data.featuredEvent.neCount} photos • Click to relive the moments →
              </p>
            </div>
          </div>
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

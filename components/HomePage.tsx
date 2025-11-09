'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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

// Animated Section component with scroll reveal
function AnimatedSection({ 
  children, 
  delay = 0 
}: { 
  children: React.ReactNode; 
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [delay]);

  return (
    <div
      ref={sectionRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
      }}
    >
      {children}
    </div>
  );
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
  
  // Background carousel state
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const backgroundPhotos = useMemo(() => {
    if (!data) return [];
    // Get up to 5 random photos from recent uploads for background
    const photos = [...(data.recentUploads || [])];
    const selected = photos
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .filter(p => p.PThumbnailUrl);
    console.log('Background photos for carousel:', selected.length, selected.map(p => p.PThumbnailUrl));
    return selected;
  }, [data]);

  useEffect(() => {
    loadHomePageData();
    loadPeopleAndEvents();
  }, []);

  // Rotate background photos every 8 seconds
  useEffect(() => {
    if (backgroundPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBgIndex(prev => (prev + 1) % backgroundPhotos.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [backgroundPhotos.length]);

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
        padding: '2.5rem 2rem',
        color: 'white',
        marginBottom: '2rem',
        textAlign: 'center',
        boxShadow: '0 15px 40px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated Background Photos */}
        {backgroundPhotos.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          }}>
            {backgroundPhotos.map((photo, idx) => (
              <div
                key={photo.PFileName}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `url(${photo.PThumbnailUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(15px) brightness(0.8)',
                  opacity: currentBgIndex === idx ? 1 : 0,
                  transition: 'opacity 2s ease-in-out',
                }}
              />
            ))}
          </div>
        )}
        
        {/* Gradient overlay to ensure text readability */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.5) 0%, rgba(118, 75, 162, 0.5) 100%)',
          zIndex: 2,
        }} />
        
        {/* Decorative pattern overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 3,
        }} />
        
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            margin: '0 0 0.75rem 0', 
            fontWeight: 'bold',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          }}>
            Welcome to Your Family Album
          </h1>
          <p style={{ fontSize: '1.1rem', margin: '0 0 1.75rem 0', opacity: 0.95 }}>
            Preserving memories, connecting generations
          </p>
          
          {/* Search Bar */}
          <div className="search-wrapper" style={{ 
            background: 'rgba(255, 255, 255, 0.95)', 
            borderRadius: '50px', 
            padding: '1rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            maxWidth: '600px',
            margin: '0 auto 1.25rem',
            position: 'relative',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(10px)',
            zIndex: 100,
          }}>
            <span style={{ fontSize: '1.4rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Search for people or events..."
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
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 10000,
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
        </div>
      </div>

      {/* Recent Uploads Section */}
      {/* Recent Uploads Section */}
      {data && data.recentUploads && data.recentUploads.length > 0 && (
        <AnimatedSection delay={0}>
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
            display: 'flex',
            gap: '1.5rem',
            overflowX: 'hidden',
            justifyContent: 'flex-start',
          }}>
            {data.recentUploads.slice(0, 5).map((media, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  flex: '0 0 auto',
                  width: 'calc((100% - 6rem) / 5)', // 5 items with 1.5rem gaps
                  paddingBottom: 'calc((100% - 6rem) / 5)', // Square aspect ratio
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
          {data.recentUploads.length > 5 && (
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
                View All in Gallery ({data.recentUploads.length} photos)
              </button>
            </div>
          )}
        </section>
        </AnimatedSection>
      )}

      {/* On This Day Section */}
      {data && data.onThisDay && data.onThisDay.length > 0 && (
        <AnimatedSection delay={150}>
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
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}>
            {data.onThisDay.slice(0, 10).map((media, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  flex: '0 0 auto',
                  width: 'calc((100% - 6rem) / 5)', // 5 items per row with 1.5rem gaps
                  paddingBottom: 'calc((100% - 6rem) / 5)', // Square aspect ratio
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => onMediaClick(media, data.onThisDay)}
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
                
                {/* Year badge */}
                {media.PYear && (
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
                    {media.PYear}
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

                {/* Hover overlay with description */}
                <div 
                  className="hover-overlay"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.3))',
                    color: 'white',
                    padding: '1.2rem 1rem 0.8rem',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {media.PDescription && (
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {media.PDescription}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {data.onThisDay.length > 10 && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to gallery filtered by this month
                  onSelectPeople();
                }}
                style={{
                  padding: '0.9rem 2rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                }}
              >
                View All in Gallery ({data.onThisDay.length} photos)
              </button>
            </div>
          )}
        </section>
        </AnimatedSection>
      )}

      {/* Featured Person Section */}
      {data && data.featuredPerson && (
        <AnimatedSection delay={300}>
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
        </AnimatedSection>
      )}

      {/* Featured Event Section */}
      {data && data.featuredEvent && (
        <AnimatedSection delay={450}>
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
        </AnimatedSection>
      )}

      {/* Suggested Albums */}
      {data && data.randomSuggestion && (
        <AnimatedSection delay={600}>
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
        </AnimatedSection>
      )}
    </div>
  );
}

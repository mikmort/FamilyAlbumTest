// trigger redeploy: trivial change
'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import UserInfo from '@/components/UserInfo';
import PeopleSelector from '@/components/PeopleSelector';
import ThumbnailGallery from '@/components/ThumbnailGallery';
import MediaDetailModal from '@/components/MediaDetailModal';
import PeopleManager from '@/components/PeopleManager';
import EventManager from '@/components/EventManager';
import ProcessNewFiles from '@/components/ProcessNewFiles';
import UploadMedia from '@/components/UploadMedia';
import AdminSettings from '@/components/AdminSettings';
import AccessRequest from '@/components/AccessRequest';
import NewMediaView from '@/components/NewMediaView';
import HomePage from '@/components/HomePage';
import SettingsMenu from '@/components/SettingsMenu';
import { Person, Event, MediaItem } from '../lib/types';

interface AuthStatus {
  authenticated: boolean;
  authorized: boolean;
  user: {
    email: string;
    name: string;
    role: string;
    status: string;
  } | null;
  pendingCount?: number;
  databaseWarming?: boolean;
  error: string | null;
}

export default function Home() {
  const [view, setView] = useState<'home' | 'select' | 'gallery' | 'manage-people' | 'manage-events' | 'process-files' | 'upload-media' | 'admin-settings' | 'new-media'>('home');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [newMediaCount, setNewMediaCount] = useState(0);
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [selectedPeopleNames, setSelectedPeopleNames] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showNoPeople, setShowNoPeople] = useState(false);
  const [exclusiveFilter, setExclusiveFilter] = useState(false);
  const [recentDays, setRecentDays] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [startFullscreen, setStartFullscreen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Wake up database immediately on mount (before auth check)
  // This helps reduce perceived loading time for serverless SQL databases
  useEffect(() => {
    // Fire and forget - we don't wait for this to complete
    fetch('/api/db-warmup').catch(() => {
      // Ignore errors - this is just a warmup hint
    });
  }, []);

  // Check authorization on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle URL parameters (e.g., ?file=xyz.jpg&fullscreen=true)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    const fileParam = params.get('file');
    const fullscreenParam = params.get('fullscreen');
    
    if (fileParam) {
      // Load the specific media file and open it
      const loadMediaFromParam = async () => {
        try {
          const response = await fetch(`/api/media/${encodeURIComponent(fileParam)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.media) {
              setSelectedMedia(data.media);
              setMediaList([data.media]); // Single item for now
              setView('gallery');
              if (fullscreenParam === 'true') {
                setStartFullscreen(true);
              }
              // Clear URL parameters after loading
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        } catch (err) {
          console.error('Error loading media from URL param:', err);
        }
      };
      loadMediaFromParam();
    }
  }, []);

  // Load new media count when authenticated
  useEffect(() => {
    if (authStatus?.authenticated && authStatus?.authorized) {
      loadNewMediaCount();
    }
  }, [authStatus]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth-status');
      const data = await response.json();
      
      // If database is warming up, retry after a delay
      if (data.databaseWarming) {
        setAuthStatus(data);
        setTimeout(() => {
          checkAuthStatus();
        }, 3000); // Retry every 3 seconds
        return;
      }
      
      setAuthStatus(data);
    } catch (err) {
      console.error('Error checking auth status:', err);
    } finally {
      setLoadingAuth(false);
    }
  };

  const loadNewMediaCount = async () => {
    try {
      const response = await fetch('/api/new-media');
      if (response.ok) {
        const data = await response.json();
        setNewMediaCount(data.count || 0);
      }
    } catch (err) {
      console.error('Error loading new media count:', err);
    }
  };

  const handleContinue = () => {
    setView('gallery');
  };

  const handleBack = () => {
    setView('home');
    setSelectedMedia(null);
    setStartFullscreen(false);
    setRecentDays(null);
  };

  const handleMediaClick = (media: MediaItem, allMedia: MediaItem[]) => {
    console.log('handleMediaClick called with:', {
      fileName: media.PFileName,
      blobUrl: media.PBlobUrl,
      type: media.PType,
      event: media.Event // Add event to debug log
    });
    setSelectedMedia(media);
    setMediaList(allMedia);
    setStartFullscreen(false);
  };

  const handleMediaFullscreen = (media: MediaItem, allMedia: MediaItem[]) => {
    console.log('handleMediaFullscreen called with:', media.PFileName);
    setSelectedMedia(media);
    setMediaList(allMedia);
    setStartFullscreen(true);
  };

  const handleNavigateToGallery = (peopleIds: number[], eventId: number | null) => {
    setSelectedPeople(peopleIds);
    setSelectedEvent(eventId);
    setRecentDays(null);
    setView('gallery');
  };

  const handleViewRecentUploads = () => {
    setSelectedPeople([]);
    setSelectedEvent(null);
    setShowNoPeople(false);
    setRecentDays(60);
    setView('gallery');
  };

  // Show database warming message
  if (authStatus?.databaseWarming) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ margin: '0 0 15px 0', color: '#333' }}>Database is Loading</h1>
          <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6', marginBottom: '20px' }}>
            The database is warming up. This typically takes 30-60 seconds when the site hasn't been accessed recently.
          </p>
          <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
          <p style={{ color: '#999', fontSize: '14px' }}>
            Please wait, you'll be automatically redirected when ready...
          </p>
        </div>
      </div>
    );
  }

  // Show loading while checking auth
  if (loadingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show access request page if not authenticated or not authorized
  if (!authStatus?.authenticated || !authStatus?.authorized) {
    return <AccessRequest />;
  }

  const isAdmin = authStatus?.user?.role === 'Admin';

  return (
    <>

      <div className="app-header">
        <Navigation
          onHome={() => setView('home')}
          onSelectPeople={() => setView('select')}
          onUploadMedia={() => setView('upload-media')}
          onNewMedia={() => setView('new-media')}
          onSettings={() => setShowSettingsMenu(true)}
          newMediaCount={newMediaCount}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setShowSettingsMenu(true)}
            style={{
              background: '#3498db',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ⚙️ Settings
          </button>
          <UserInfo />
        </div>
      </div>

      <main className="container">
        {view === 'home' && (
          <HomePage
            onMediaClick={handleMediaClick}
            onMediaFullscreen={handleMediaFullscreen}
            onSelectPeople={() => setView('select')}
            onNavigateToGallery={handleNavigateToGallery}
            onViewNewMedia={() => setView('new-media')}
            onViewRecentUploads={handleViewRecentUploads}
          />
        )}

        {view === 'select' && (
          <PeopleSelector
            selectedPeople={selectedPeople}
            selectedEvent={selectedEvent}
            showNoPeople={showNoPeople}
            sortOrder={sortOrder}
            exclusiveFilter={exclusiveFilter}
            onSelectedPeopleChange={(ids, names) => {
              setSelectedPeople(ids);
              setSelectedPeopleNames(names || []);
            }}
            onSelectedEventChange={(id, name) => {
              setSelectedEvent(id);
              setSelectedEventName(name || null);
            }}
            onShowNoPeopleChange={setShowNoPeople}
            onSortOrderChange={setSortOrder}
            onExclusiveFilterChange={setExclusiveFilter}
            onContinue={handleContinue}
          />
        )}

        {view === 'gallery' && (
          <div className="gallery-view">
            <div className="gallery-controls">
              <button className="btn btn-secondary" onClick={handleBack}>
                ← Back {recentDays ? 'to Home' : 'to Selection'}
              </button>
              <div className="flex flex-gap">
                <button
                  className="btn btn-secondary"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  Sort: {sortOrder === 'asc' ? 'Old to New' : 'New to Old'}
                </button>
              </div>
            </div>

            {recentDays && (
              <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
                Recent Uploads (Last {recentDays} Days)
              </h2>
            )}

            <ThumbnailGallery
              peopleIds={selectedPeople}
              eventId={selectedEvent}
              noPeople={showNoPeople}
              sortOrder={sortOrder}
              exclusiveFilter={exclusiveFilter}
              recentDays={recentDays}
              peopleNames={selectedPeopleNames}
              eventName={selectedEventName}
              onMediaClick={handleMediaClick}
              onMediaFullscreen={handleMediaFullscreen}
              onNavigateHome={() => setView('home')}
            />
          </div>
        )}

        {view === 'manage-people' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('home')}>
              ← Back
            </button>
            <PeopleManager />
          </>
        )}

        {view === 'manage-events' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('home')}>
              ← Back
            </button>
            <EventManager />
          </>
        )}

        {view === 'process-files' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('home')}>
              ← Back
            </button>
            <ProcessNewFiles />
          </>
        )}

        {view === 'upload-media' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('home')}>
              ← Back
            </button>
            <UploadMedia onProcessFiles={() => setView('process-files')} />
          </>
        )}

        {view === 'new-media' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('home')}>
              ← Back
            </button>
            <NewMediaView 
              onMediaClick={handleMediaClick}
              onMediaFullscreen={handleMediaFullscreen}
            />
          </>
        )}

        {view === 'admin-settings' && isAdmin && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('home')}>
              ← Back
            </button>
            <AdminSettings onRequestsChange={checkAuthStatus} />
          </>
        )}

        {selectedMedia && (
          <MediaDetailModal
            media={selectedMedia}
            allMedia={mediaList}
            onClose={() => {
              setSelectedMedia(null);
              setStartFullscreen(false);
            }}
            onUpdate={(updatedMedia) => {
              // Update the media in the list
              setMediaList(prevList => 
                prevList.map(item => 
                  item.PFileName === updatedMedia.PFileName ? updatedMedia : item
                )
              );
              // Update selectedMedia so it has the latest data
              setSelectedMedia(updatedMedia);
            }}
            onMediaChange={setSelectedMedia}
            startFullscreen={startFullscreen}
          />
        )}

        {showSettingsMenu && (
          <SettingsMenu
            onManagePeople={() => setView('manage-people')}
            onManageEvents={() => setView('manage-events')}
            onProcessFiles={() => setView('process-files')}
            onAdminSettings={isAdmin ? () => setView('admin-settings') : undefined}
            pendingCount={authStatus?.pendingCount || 0}
            onClose={() => setShowSettingsMenu(false)}
          />
        )}
      </main>
    </>
  );
}

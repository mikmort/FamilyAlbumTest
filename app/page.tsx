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
  const [view, setView] = useState<'select' | 'gallery' | 'manage-people' | 'manage-events' | 'process-files' | 'upload-media' | 'admin-settings'>('select');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showNoPeople, setShowNoPeople] = useState(false);
  const [exclusiveFilter, setExclusiveFilter] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [startFullscreen, setStartFullscreen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);

  // Check authorization on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

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

  const handleContinue = () => {
    setView('gallery');
  };

  const handleBack = () => {
    setView('select');
    setSelectedMedia(null);
    setStartFullscreen(false);
  };

  const handleMediaClick = (media: MediaItem, allMedia: MediaItem[]) => {
    console.log('handleMediaClick called with:', {
      fileName: media.PFileName,
      blobUrl: media.PBlobUrl,
      type: media.PType
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
          onManagePeople={() => setView('manage-people')}
          onManageEvents={() => setView('manage-events')}
          onSelectPeople={() => setView('select')}
          onProcessFiles={() => setView('process-files')}
          onUploadMedia={() => setView('upload-media')}
          onAdminSettings={isAdmin ? () => setView('admin-settings') : undefined}
          pendingCount={authStatus?.pendingCount || 0}
        />
        <UserInfo />
      </div>

      <main className="container">
        {view === 'select' && (
          <PeopleSelector
            selectedPeople={selectedPeople}
            selectedEvent={selectedEvent}
            showNoPeople={showNoPeople}
            sortOrder={sortOrder}
            exclusiveFilter={exclusiveFilter}
            onSelectedPeopleChange={setSelectedPeople}
            onSelectedEventChange={setSelectedEvent}
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
                ← Back to Selection
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

            <ThumbnailGallery
              peopleIds={selectedPeople}
              eventId={selectedEvent}
              noPeople={showNoPeople}
              sortOrder={sortOrder}
              exclusiveFilter={exclusiveFilter}
              onMediaClick={handleMediaClick}
              onMediaFullscreen={handleMediaFullscreen}
            />
          </div>
        )}

        {view === 'manage-people' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('select')}>
              ← Back
            </button>
            <PeopleManager />
          </>
        )}

        {view === 'manage-events' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('select')}>
              ← Back
            </button>
            <EventManager />
          </>
        )}

        {view === 'process-files' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('select')}>
              ← Back
            </button>
            <ProcessNewFiles />
          </>
        )}

        {view === 'upload-media' && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('select')}>
              ← Back
            </button>
            <UploadMedia onProcessFiles={() => setView('process-files')} />
          </>
        )}

        {view === 'admin-settings' && isAdmin && (
          <>
            <button className="btn btn-secondary mb-2" onClick={() => setView('select')}>
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
            onMediaChange={setSelectedMedia}
            startFullscreen={startFullscreen}
          />
        )}
      </main>
    </>
  );
}

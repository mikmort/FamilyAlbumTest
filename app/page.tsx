'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import PeopleSelector from '@/components/PeopleSelector';
import ThumbnailGallery from '@/components/ThumbnailGallery';
import MediaDetailModal from '@/components/MediaDetailModal';
import PeopleManager from '@/components/PeopleManager';
import EventManager from '@/components/EventManager';
import ProcessNewFiles from '@/components/ProcessNewFiles';
import { Person, Event, MediaItem } from '../lib/types';

export default function Home() {
  const [view, setView] = useState<'select' | 'gallery' | 'manage-people' | 'manage-events' | 'process-files'>('select');
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showNoPeople, setShowNoPeople] = useState(false);
  const [exclusiveFilter, setExclusiveFilter] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const handleContinue = () => {
    setView('gallery');
  };

  const handleBack = () => {
    setView('select');
    setSelectedMedia(null);
  };

  return (
    <>
      <Navigation
        onManagePeople={() => setView('manage-people')}
        onManageEvents={() => setView('manage-events')}
        onSelectPeople={() => setView('select')}
        onProcessFiles={() => setView('process-files')}
        onBackup={() => {
          // TODO: Implement backup
          alert('Backup functionality coming soon');
        }}
      />

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
          <>
            <div className="flex flex-between mb-2">
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
              onMediaClick={setSelectedMedia}
            />
          </>
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

        {selectedMedia && (
          <MediaDetailModal
            media={selectedMedia}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </main>
    </>
  );
}

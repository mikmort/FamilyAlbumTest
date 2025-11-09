'use client';

interface NavigationProps {
  onHome: () => void;
  onSelectPeople: () => void;
  onUploadMedia: () => void;
  onNewMedia: () => void;
  onSettings: () => void;
  newMediaCount?: number;
}

export default function Navigation({
  onHome,
  onSelectPeople,
  onUploadMedia,
  onNewMedia,
  onSettings,
  newMediaCount = 0,
}: NavigationProps) {
  return (
    <nav className="nav-menu">
      <button onClick={onHome} style={{ fontWeight: 'bold' }}>
        🏠 Home
      </button>
      <button onClick={onSelectPeople}>Find People/Events</button>
      <button 
        onClick={onNewMedia}
        style={{ position: 'relative' }}
      >
        ✨ New Pictures/Videos
        {newMediaCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#28a745',
            color: '#fff',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {newMediaCount}
          </span>
        )}
      </button>
      <button onClick={onUploadMedia}>Upload Media</button>
      <button onClick={onSettings}>
        ⚙️ Settings
      </button>
    </nav>
  );
}

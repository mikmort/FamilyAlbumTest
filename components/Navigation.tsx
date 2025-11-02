'use client';

interface NavigationProps {
  onManagePeople: () => void;
  onManageEvents: () => void;
  onSelectPeople: () => void;
  onProcessFiles: () => void;
  onUploadMedia: () => void;
  onAdminSettings?: () => void;
  pendingCount?: number;
}

export default function Navigation({
  onManagePeople,
  onManageEvents,
  onSelectPeople,
  onProcessFiles,
  onUploadMedia,
  onAdminSettings,
  pendingCount = 0,
}: NavigationProps) {
  return (
    <nav className="nav-menu">
      <button onClick={onSelectPeople}>Select People</button>
      <button onClick={onManagePeople}>Manage People</button>
      <button onClick={onManageEvents}>Manage Events</button>
      <button onClick={onUploadMedia}>Upload Media</button>
      <button onClick={onProcessFiles}>Process New Files</button>
      {onAdminSettings && (
        <button onClick={onAdminSettings} style={{ 
          background: '#dc3545', 
          borderColor: '#dc3545',
          position: 'relative'
        }}>
          🔒 Admin Settings
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: '#ffc107',
              color: '#000',
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
              {pendingCount}
            </span>
          )}
        </button>
      )}
    </nav>
  );
}

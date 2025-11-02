'use client';

interface NavigationProps {
  onManagePeople: () => void;
  onManageEvents: () => void;
  onSelectPeople: () => void;
  onProcessFiles: () => void;
  onUploadMedia: () => void;
  onAdminSettings?: () => void;
}

export default function Navigation({
  onManagePeople,
  onManageEvents,
  onSelectPeople,
  onProcessFiles,
  onUploadMedia,
  onAdminSettings,
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
          borderColor: '#dc3545' 
        }}>
          🔒 Admin Settings
        </button>
      )}
    </nav>
  );
}

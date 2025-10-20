'use client';

interface NavigationProps {
  onManagePeople: () => void;
  onManageEvents: () => void;
  onSelectPeople: () => void;
  onProcessFiles: () => void;
  onBackup: () => void;
}

export default function Navigation({
  onManagePeople,
  onManageEvents,
  onSelectPeople,
  onProcessFiles,
  onBackup,
}: NavigationProps) {
  return (
    <nav className="nav-menu">
      <button onClick={onSelectPeople}>Select People</button>
      <button onClick={onManagePeople}>Manage People</button>
      <button onClick={onManageEvents}>Manage Events</button>
      <button onClick={onProcessFiles}>Process New Files</button>
      <button onClick={onBackup}>Backup Database</button>
    </nav>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, getLoginUrl, logout, ClientPrincipal } from '@/lib/auth';

interface UserMenuProps {
  user: ClientPrincipal | null;
  onLogin: () => void;
  onLogout: () => void;
}

function UserMenu({ user, onLogin, onLogout }: UserMenuProps) {
  if (!user) {
    return (
      <button onClick={onLogin} className="btn btn-primary">
        Sign In to Edit
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span style={{ color: 'white' }}>
        Hello, {user.userDetails}
      </span>
      <button onClick={onLogout} className="btn btn-secondary">
        Sign Out
      </button>
    </div>
  );
}

interface NavigationProps {
  onManagePeople: () => void;
  onManageEvents: () => void;
  onSelectPeople: () => void;
  onBackup: () => void;
}

export default function Navigation({
  onManagePeople,
  onManageEvents,
  onSelectPeople,
  onBackup,
}: NavigationProps) {
  const [user, setUser] = useState<ClientPrincipal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking authentication:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="nav-menu">
      <div style={{ display: 'flex', gap: '1rem', flexGrow: 1 }}>
        <button onClick={onSelectPeople}>Select People</button>
        {user && (
          <>
            <button onClick={onManagePeople}>Manage People</button>
            <button onClick={onManageEvents}>Manage Events</button>
            <button onClick={onBackup}>Backup Database</button>
          </>
        )}
      </div>
      
      {!loading && (
        <UserMenu user={user} onLogin={handleLogin} onLogout={handleLogout} />
      )}
    </nav>
  );
}

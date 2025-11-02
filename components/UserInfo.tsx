'use client';

import { useEffect, useState } from 'react';

interface UserPrincipal {
  userId: string;
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
}

export default function UserInfo() {
  const [user, setUser] = useState<UserPrincipal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/.auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.clientPrincipal) {
          setUser(data.clientPrincipal);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!user) return null;

  const getProviderIcon = () => {
    switch (user.identityProvider) {
      case 'aad':
        return '🔷'; // Microsoft
      case 'google':
        return '🔴'; // Google
      case 'github':
        return '⚫'; // GitHub
      default:
        return '👤';
    }
  };

  return (
    <div className="user-info">
      <span className="user-name">{getProviderIcon()} {user.userDetails}</span>
      <a href="/.auth/logout?post_logout_redirect_uri=/login.html" className="logout-link">
        Sign Out
      </a>
    </div>
  );
}

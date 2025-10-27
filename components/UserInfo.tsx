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

  return (
    <div className="user-info">
      <span className="user-name">👤 {user.userDetails}</span>
      <a href="/.auth/logout" className="logout-link">Logout</a>
    </div>
  );
}

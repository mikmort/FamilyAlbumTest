'use client';

import { useEffect, useState } from 'react';

interface UserClaim {
  typ: string;
  val: string;
}

interface UserPrincipal {
  userId: string;
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
  claims?: UserClaim[];
}

export default function UserInfo() {
  const [user, setUser] = useState<UserPrincipal | null>(null);
  const [loading, setLoading] = useState(true);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/.auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.clientPrincipal) {
          setUser(data.clientPrincipal);
          
          // Extract picture URL from claims
          if (data.clientPrincipal.claims) {
            const pictureClaim = data.clientPrincipal.claims.find((claim: UserClaim) => 
              claim.typ === 'picture' || 
              claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture' ||
              claim.typ === 'urn:google:picture'
            );
            
            if (pictureClaim) {
              setPictureUrl(pictureClaim.val);
            }
          }
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
      <span className="user-name">
        {pictureUrl ? (
          <img 
            src={pictureUrl} 
            alt="User profile" 
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              marginRight: '8px',
              verticalAlign: 'middle',
              objectFit: 'cover'
            }}
            onError={() => setPictureUrl(null)}
          />
        ) : (
          <span style={{ marginRight: '4px' }}>{getProviderIcon()}</span>
        )}
        {user.userDetails}
      </span>
      <a href="/.auth/logout?post_logout_redirect_uri=/login.html" className="logout-link">
        Sign Out
      </a>
    </div>
  );
}

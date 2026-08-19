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
    switch (user?.identityProvider) {
      case 'aad':    return '🔷';
      case 'google': return '🔴';
      case 'github': return '⚫';
      default:       return '👤';
    }
  };

  const displayEmail = (() => {
    const isReal = (v: string) => v.includes('@') && !v.endsWith('.onmicrosoft.com');
    const types = [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'email',
      'emails',
      'preferred_username',
    ];
    for (const typ of types) {
      const val = user.claims?.find(c => c.typ === typ)?.val;
      if (val && isReal(val)) return val;
    }
    const any = user.claims?.find(c => isReal(c.val))?.val;
    return any || user.userDetails;
  })();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem', color: 'white', fontSize: '14px' }}>
      {pictureUrl ? (
        <img
          src={pictureUrl}
          alt="User profile"
          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          onError={() => setPictureUrl(null)}
        />
      ) : (
        <span>{getProviderIcon()}</span>
      )}
      <span>{displayEmail}</span>
    </div>
  );
}


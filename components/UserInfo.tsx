'use client';

import { useEffect, useState } from 'react';
import { getLogoutUrl } from '../lib/auth';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-wrapper')) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

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
    <div className="user-menu-wrapper" style={{ position: 'relative' }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0.5rem',
          fontSize: '14px',
        }}
      >
        {pictureUrl ? (
          <img 
            src={pictureUrl} 
            alt="User profile" 
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
            onError={() => setPictureUrl(null)}
          />
        ) : (
          <span>{getProviderIcon()}</span>
        )}
        <span>{user.userDetails}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>

      {dropdownOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          minWidth: '200px',
          zIndex: 1000,
        }}>
          <a
            href={getLogoutUrl()}
            style={{
              display: 'block',
              padding: '0.75rem 1rem',
              color: '#333',
              textDecoration: 'none',
              borderBottom: '1px solid #f0f0f0',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
          >
            🔄 Sign in as Different User
          </a>
          <a
            href={getLogoutUrl()}
            style={{
              display: 'block',
              padding: '0.75rem 1rem',
              color: '#dc3545',
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
          >
            🚪 Sign Out
          </a>
        </div>
      )}
    </div>
  );
}

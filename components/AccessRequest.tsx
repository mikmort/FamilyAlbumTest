'use client';

import { useState, useEffect } from 'react';
import { getLogoutUrl } from '../lib/auth';

interface AuthStatus {
  authenticated: boolean;
  authorized: boolean;
  user: {
    email: string;
    name: string;
    role: string;
    status: string;
  } | null;
  databaseWarming?: boolean;
  error: string | null;
}

export default function AccessRequest() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', relationship: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth-status');
      const data = await response.json();
      
      // If database is warming up, retry after a delay
      if (data.databaseWarming) {
        setAuthStatus(data);
        setLoading(false); // Show the warmup message
        setTimeout(() => {
          checkAuthStatus();
        }, 3000); // Retry every 3 seconds
        return;
      }
      
      setAuthStatus(data);

      if (data.user?.email) {
        // Check if this user already submitted their info (persisted across page refreshes)
        const storageKey = `familyAlbum_requestSubmitted_${data.user.email}`;
        if (localStorage.getItem(storageKey)) {
          setFormSubmitted(true);
        }
        // Pre-fill name from OAuth provider if available
        if (data.user.name) {
          setFormData(prev => prev.name ? prev : { ...prev, name: data.user.name });
        }
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authStatus?.user || formSubmitting) return;

    if (!formData.name.trim() || !formData.relationship.trim()) {
      setFormError('Please fill in both fields.');
      return;
    }

    setFormError('');
    setFormSubmitting(true);
    try {
      await fetch('/api/notify-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: authStatus.user.email,
          userName: formData.name.trim(),
          relationship: formData.relationship.trim(),
          message: `Relationship to family: ${formData.relationship.trim()}`
        })
      });

      // Persist submission state so the form is not shown again on refresh
      const storageKey = `familyAlbum_requestSubmitted_${authStatus.user.email}`;
      localStorage.setItem(storageKey, 'true');
      setFormSubmitted(true);
    } catch (err) {
      console.error('Error submitting access request:', err);
      setFormError('Something went wrong. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getStatusMessage = () => {
    // Database warming up
    if (authStatus?.databaseWarming) {
      return {
        icon: '⏳',
        title: 'Database is Loading',
        message: 'The database is warming up. This typically takes 30-60 seconds when the site hasn\'t been accessed recently.',
        subtitle: 'Please wait...',
        details: [
          'The database will be ready shortly',
          'You will be automatically redirected',
          'No action is required from you'
        ]
      };
    }
    
    if (!authStatus?.user) {
      return {
        icon: '🔒',
        title: 'Please Sign In',
        message: 'You must be signed in to access the Family Album.',
        action: 'Sign In',
        actionLink: '/login.html'
      };
    }

    switch (authStatus.user.status) {
      case 'Pending':
        if (!formSubmitted) {
          // Form not yet submitted — handled separately in render
          return null;
        }
        return {
          icon: '⏳',
          title: 'Access Request Pending',
          message: `Your request for access has been received and is awaiting approval from an administrator. You will be notified via email at ${authStatus.user.email} once your access has been approved.`,
          subtitle: 'What happens next?',
          details: [
            'An administrator will review your request',
            'You will receive an email notification when approved',
            'This usually takes 1-2 business days'
          ]
        };
      
      case 'Denied':
        return {
          icon: '❌',
          title: 'Access Denied',
          message: 'Your access request has been denied. If you believe this is an error, please contact a family administrator.',
          subtitle: 'Need help?',
          details: [
            'Contact: mikmort@hotmail.com',
            'Explain why you need access',
            'Include your email: ' + authStatus.user.email
          ]
        };
      
      case 'Suspended':
        return {
          icon: '🚫',
          title: 'Account Suspended',
          message: 'Your account has been suspended. Please contact an administrator for more information.',
          subtitle: 'Need help?',
          details: [
            'Contact: mikmort@hotmail.com',
            'Your email: ' + authStatus.user.email
          ]
        };
      
      default:
        return {
          icon: '📧',
          title: 'Request Access',
          message: `Hi ${authStatus.user.name || authStatus.user.email}! Your account has been created but you need administrator approval to access the Family Album.`,
          subtitle: 'Request sent!',
          details: [
            'Your access request has been automatically submitted',
            'An administrator will review your request',
            'You will receive an email notification when approved'
          ]
        };
    }
  };

  if (loading && !authStatus?.databaseWarming) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          textAlign: 'center'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
          <p>Checking your access...</p>
        </div>
      </div>
    );
  }

  // Show the "tell us about yourself" form for new pending users
  if (authStatus?.user?.status === 'Pending' && !formSubmitted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>👋</div>
            <h1 style={{ margin: '0 0 15px 0', color: '#333' }}>Request Access</h1>
            <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>
              Welcome! To help the family administrator review your request, please tell us a little about yourself.
            </p>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                Your Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Jane Smith"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                How are you related to the Morton family? *
              </label>
              <input
                type="text"
                value={formData.relationship}
                onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                placeholder="e.g. Mike's daughter, married to John Morton, childhood friend of Sue..."
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {formError && (
              <p style={{ color: '#dc3545', fontSize: '14px', marginBottom: '16px' }}>{formError}</p>
            )}

            <button
              type="submit"
              disabled={formSubmitting}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                background: formSubmitting ? '#aaa' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '16px',
                cursor: formSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
              }}
            >
              {formSubmitting ? 'Submitting...' : 'Submit Access Request'}
            </button>
          </form>

          <div style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e0e0e0',
            fontSize: '14px',
            color: '#999',
            textAlign: 'center'
          }}>
            Signed in as: <strong style={{ color: '#666' }}>{authStatus.user.email}</strong>
            <br />
            <button
              onClick={() => {
                sessionStorage.clear();
                localStorage.clear();
                window.location.href = getLogoutUrl();
              }}
              style={{
                color: '#667eea',
                backgroundColor: 'white',
                textDecoration: 'none',
                marginTop: '10px',
                display: 'inline-block',
                padding: '8px 16px',
                border: '1px solid #667eea',
                borderRadius: '4px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🔄 Sign in with different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = getStatusMessage();
  if (!status) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>{status.icon}</div>
          <h1 style={{ margin: '0 0 15px 0', color: '#333' }}>{status.title}</h1>
          <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>
            {status.message}
          </p>
        </div>

        {authStatus?.databaseWarming && (
          <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
        )}

        {status.subtitle && (
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333' }}>
              {status.subtitle}
            </h3>
            <ul style={{ 
              margin: 0, 
              paddingLeft: '20px', 
              color: '#666',
              fontSize: '14px',
              lineHeight: '1.8'
            }}>
              {status.details?.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        )}

        {status.action && status.actionLink && (
          <a 
            href={status.actionLink}
            style={{
              display: 'block',
              width: '100%',
              padding: '14px',
              background: '#667eea',
              color: 'white',
              textAlign: 'center',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
          >
            {status.action}
          </a>
        )}

        {authStatus?.user && (
          <div style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e0e0e0',
            fontSize: '14px',
            color: '#999',
            textAlign: 'center'
          }}>
            Signed in as: <strong style={{ color: '#666' }}>{authStatus.user.email}</strong>
            <br />
            <button
              onClick={() => {
                // Clear any client-side session data
                sessionStorage.clear();
                localStorage.clear();
                // Redirect to app logout, which chains to Microsoft logout, then back to login
                window.location.href = getLogoutUrl();
              }}
              style={{ 
                color: '#667eea',
                backgroundColor: 'white',
                textDecoration: 'none', 
                marginTop: '10px', 
                display: 'inline-block',
                padding: '8px 16px',
                border: '1px solid #667eea',
                borderRadius: '4px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🔄 Sign in with different account
            </button>
            <div style={{ marginTop: '15px', fontSize: '12px', color: '#aaa' }}>
              Or use <a href="/.auth/login/google?post_login_redirect_uri=/&prompt=select_account" style={{ color: '#667eea' }}>Google sign-in</a> with your other email
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

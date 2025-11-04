'use client';

import { useState, useEffect } from 'react';

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
  const [message, setMessage] = useState('');
  const [notificationSent, setNotificationSent] = useState(false);

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
      
      // If user has just authenticated and status is Pending, send notification
      if (data.authenticated && data.user && data.user.status === 'Pending' && !notificationSent) {
        await notifyAdmins(data.user.email, data.user.name);
        setNotificationSent(true);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
    } finally {
      setLoading(false);
    }
  };

  const notifyAdmins = async (userEmail: string, userName: string) => {
    try {
      await fetch('/api/notify-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          userName,
          message: 'New user requesting access to Family Album'
        })
      });
    } catch (err) {
      console.error('Error notifying admins:', err);
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

  const status = getStatusMessage();

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
            <a 
              href="/.auth/logout?post_logout_redirect_uri=/login.html"
              style={{ color: '#667eea', textDecoration: 'none', marginTop: '10px', display: 'inline-block' }}
            >
              Sign out
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

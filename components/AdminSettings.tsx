'use client';

import { useState, useEffect } from 'react';

interface User {
  ID: number;
  Email: string;
  Role: 'Admin' | 'Full' | 'Read';
  Status: 'Active' | 'Pending' | 'Denied' | 'Suspended';
  RequestedAt: string;
  ApprovedAt: string | null;
  ApprovedBy: string | null;
  LastLoginAt: string | null;
  Notes: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

interface PendingRequest {
  ID: number;
  Email: string;
  RequestedAt: string;
  HoursSinceRequest: number;
  Notes: string | null;
}

interface RequestRoleSelection {
  [userId: number]: 'Admin' | 'Full' | 'Read';
}

interface AdminSettingsProps {
  onRequestsChange?: () => void;
}

export default function AdminSettings({ onRequestsChange }: AdminSettingsProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [requestRoles, setRequestRoles] = useState<RequestRoleSelection>({});
  
  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Full' | 'Read'>('Read');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchPendingRequests();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Error loading users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/users?pending=true');
      const data = await response.json();
      
      if (data.success) {
        setPendingRequests(data.requests);
        // Initialize role selection for each request (default to 'Read')
        const initialRoles: RequestRoleSelection = {};
        data.requests.forEach((req: PendingRequest) => {
          initialRoles[req.ID] = 'Read';
        });
        setRequestRoles(initialRoles);
      }
    } catch (err) {
      console.error('Error loading pending requests:', err);
    }
  };

  const addUser = async () => {
    if (!newEmail) {
      alert('Email is required');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          role: newRole,
          status: 'Active',
          notes: newNotes || undefined
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setNewEmail('');
        setNewRole('Read');
        setNewNotes('');
        setShowAddUser(false);
        fetchUsers();
        alert('User added successfully');
      } else {
        alert(data.error || 'Failed to add user');
      }
    } catch (err) {
      alert('Error adding user');
      console.error(err);
    }
  };

  const updateUser = async (userId: number, updates: Partial<User>) => {
    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, ...updates })
      });

      const data = await response.json();
      
      if (data.success) {
        fetchUsers();
        fetchPendingRequests();
        setEditingUser(null);
        // Notify parent component to refresh auth status (updates badge count)
        if (onRequestsChange) {
          onRequestsChange();
        }
        alert('User updated successfully');
      } else {
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      alert('Error updating user');
      console.error(err);
    }
  };

  const deleteUser = async (userId: number, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      });

      const data = await response.json();
      
      if (data.success) {
        fetchUsers();
        alert('User deleted successfully');
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user');
      console.error(err);
    }
  };

  const approveRequest = async (userId: number, role: 'Admin' | 'Full' | 'Read' = 'Read') => {
    await updateUser(userId, { Role: role, Status: 'Active' });
  };

  const denyRequest = async (userId: number) => {
    await updateUser(userId, { Status: 'Denied' });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return '#dc3545';
      case 'Full': return '#007bff';
      case 'Read': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#28a745';
      case 'Pending': return '#ffc107';
      case 'Denied': return '#dc3545';
      case 'Suspended': return '#6c757d';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading admin settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchUsers}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h1>🔐 User Management</h1>
        <p className="manager-subtitle">Manage user permissions and access</p>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', background: '#fff3cd', borderColor: '#ffc107' }}>
          <h2 style={{ marginTop: 0 }}>⏳ Pending Access Requests ({pendingRequests.length})</h2>
          {pendingRequests.map(request => (
            <div key={request.ID} style={{ 
              padding: '1rem', 
              background: 'white', 
              borderRadius: '8px', 
              marginBottom: '0.5rem',
              border: '1px solid #ffc107'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ flex: '1 1 250px' }}>
                  <strong>{request.Email}</strong>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                    Requested {Math.floor(request.HoursSinceRequest / 24)}d {request.HoursSinceRequest % 24}h ago
                  </div>
                  {request.Notes && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      {request.Notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    value={requestRoles[request.ID] || 'Read'}
                    onChange={(e) => setRequestRoles({
                      ...requestRoles,
                      [request.ID]: e.target.value as 'Admin' | 'Full' | 'Read'
                    })}
                    style={{ 
                      padding: '0.4rem 0.6rem', 
                      borderRadius: '4px', 
                      border: '1px solid #ddd',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="Read">Read</option>
                    <option value="Full">Full</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => approveRequest(request.ID, requestRoles[request.ID] || 'Read')}
                  >
                    ✓ Approve
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => denyRequest(request.ID)}
                  >
                    ✗ Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Button */}
      <div className="manager-toolbar">
        <button 
          className="btn btn-success"
          onClick={() => setShowAddUser(!showAddUser)}
        >
          ➕ Add New User
        </button>
      </div>

      {/* Add User Form */}
      {showAddUser && (
        <div className="manager-form-card">
          <h3>Add New User</h3>
          <div className="form-group">
            <label>Email *</label>
            <input 
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
              <option value="Read">Read - View only access</option>
              <option value="Full">Full - Can edit and upload</option>
              <option value="Admin">Admin - Full management access</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea 
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
          <div className="flex flex-gap mt-2">
            <button className="btn btn-success" onClick={addUser}>
              ✓ Add User
            </button>
            <button className="btn btn-secondary" onClick={() => setShowAddUser(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="manager-list-card">
        <h2>All Users ({users.length})</h2>
        <div className="manager-table-container">
          <table className="manager-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.ID}>
                  <td className="name-cell">{user.Email}</td>
                  <td>
                    {editingUser?.ID === user.ID ? (
                      <select 
                        value={user.Role}
                        onChange={(e) => setEditingUser({...user, Role: e.target.value as any})}
                        style={{ padding: '0.25rem', borderRadius: '4px' }}
                      >
                        <option value="Read">Read</option>
                        <option value="Full">Full</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        background: getRoleColor(user.Role),
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {user.Role}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingUser?.ID === user.ID ? (
                      <select 
                        value={user.Status}
                        onChange={(e) => setEditingUser({...user, Status: e.target.value as any})}
                        style={{ padding: '0.25rem', borderRadius: '4px' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Denied">Denied</option>
                      </select>
                    ) : (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        background: getStatusColor(user.Status),
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {user.Status}
                      </span>
                    )}
                  </td>
                  <td className="relation-cell">
                    {user.LastLoginAt 
                      ? new Date(user.LastLoginAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="actions-cell">
                    {editingUser?.ID === user.ID ? (
                      <>
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => updateUser(user.ID, { 
                            Role: editingUser.Role, 
                            Status: editingUser.Status 
                          })}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => setEditingUser(null)}
                          title="Cancel"
                        >
                          ✗
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => setEditingUser(user)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => deleteUser(user.ID, user.Email)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Role Permissions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: getRoleColor('Admin') }}>Admin:</strong> Full access including user management, can add/remove users, modify all content
          </div>
          <div>
            <strong style={{ color: getRoleColor('Full') }}>Full:</strong> Can view, upload, edit, and tag photos. Cannot manage users
          </div>
          <div>
            <strong style={{ color: getRoleColor('Read') }}>Read:</strong> View-only access, can browse and download photos
          </div>
        </div>
      </div>
    </div>
  );
}

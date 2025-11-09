'use client';

import { useState } from 'react';

interface SettingsMenuProps {
  onManagePeople: () => void;
  onManageEvents: () => void;
  onProcessFiles: () => void;
  onAdminSettings?: () => void;
  pendingCount?: number;
  onClose: () => void;
}

export default function SettingsMenu({
  onManagePeople,
  onManageEvents,
  onProcessFiles,
  onAdminSettings,
  pendingCount = 0,
  onClose,
}: SettingsMenuProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Menu */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            minWidth: '400px',
            maxWidth: '600px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1.5rem',
            borderBottom: '2px solid #e0e0e0',
            paddingBottom: '1rem'
          }}>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.5rem' }}>⚙️ Settings</h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#999',
                padding: '0.25rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => {
                onManagePeople();
                onClose();
              }}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '1rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#2980b9';
                e.currentTarget.style.transform = 'translateX(5px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#3498db';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>👥</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Manage People</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Add, edit, or remove people</div>
              </div>
            </button>

            <button
              onClick={() => {
                onManageEvents();
                onClose();
              }}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '1rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#2980b9';
                e.currentTarget.style.transform = 'translateX(5px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#3498db';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📅</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Manage Events</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Add, edit, or remove events</div>
              </div>
            </button>

            <button
              onClick={() => {
                onProcessFiles();
                onClose();
              }}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '1rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#2980b9';
                e.currentTarget.style.transform = 'translateX(5px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#3498db';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📁</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Process New Files</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Tag and organize uploaded files</div>
              </div>
            </button>

            {onAdminSettings && (
              <button
                onClick={() => {
                  onAdminSettings();
                  onClose();
                }}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#c82333';
                  e.currentTarget.style.transform = 'translateX(5px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc3545';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🔒</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>Admin Settings</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Manage users and permissions</div>
                </div>
                {pendingCount > 0 && (
                  <span style={{
                    background: '#ffc107',
                    color: '#000',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

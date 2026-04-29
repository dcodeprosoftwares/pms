'use client';

import React, { useState } from 'react';

type View = 'dashboard' | 'tape-chart' | 'bookings' | 'housekeeping' | 'billing' | 'guests' | 'reports' | 'room-setup' | 'expenses' | 'inventory' | 'settings';

interface SidebarProps {
  activeView: View;
  onNavigate: (v: View) => void;
  onOpenModal: (type: any) => void;
  onLogout?: () => void;
  hotelName?: string;
  managerName?: string;
  managerTitle?: string;
}

const navItems = [
  { id: 'dashboard',    icon: '⊞',  label: 'Dashboard',     section: 'FRONT DESK' },
  { id: 'tape-chart',   icon: '▦',  label: 'Tape Chart',    section: null },
  { id: 'bookings',     icon: '📋',  label: 'Bookings',      section: null },
  { id: 'guests',       icon: '👤', label: 'Guests',        section: null },
  { id: 'billing',      icon: '₹',  label: 'Billing',       section: null },
  { id: 'housekeeping', icon: '🛏', label: 'Housekeeping',  section: 'OPERATIONS' },
  { id: 'expenses',     icon: '💸', label: 'Expenses',      section: null },
  { id: 'inventory',    icon: '📦',  label: 'Inventory',     section: null },
  { id: 'reports',      icon: '📈',  label: 'Reports',       section: 'ANALYTICS' },
  { id: 'room-setup',   icon: '🏢',  label: 'Setup',         section: 'ADMIN' },
  { id: 'settings',     icon: '⚙️',  label: 'Settings',      section: null },
];

const mobileItems = [
  { id: 'dashboard', icon: '⊞', label: 'Home' },
  { id: 'tape-chart', icon: '▦', label: 'Chart' },
  { id: 'bookings', icon: '📋', label: 'Bookings' },
  { id: 'housekeeping', icon: '🛏', label: 'HK' },
  { id: 'settings', icon: '⚙️', label: 'Menu' },
];

export default function Sidebar({ 
  activeView, 
  onNavigate, 
  onLogout,
  managerName = 'User',
  managerTitle = 'Manager'
}: SidebarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className={`sidebar print-hide ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ padding: '20px 20px 0px 20px', height: 'auto', marginBottom: '0px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <img 
              src="/weazy-logo.png" 
              alt="Weazy PMS" 
              style={{ height: 38, width: 'auto', objectFit: 'contain' }} 
            />
          </div>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item, i) => {
            const prev = i > 0 ? navItems[i - 1] : null;
            const showSection = item.section && (!prev || prev.section !== item.section);
            return (
              <div key={item.id}>
                {showSection && (
                  <div className="nav-section-label">{item.section}</div>
                )}
                <div
                  className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.id as View);
                    setIsSidebarOpen(false);
                  }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </div>
            );
          })}
          
          {onLogout && (
            <div
              className="nav-item"
              style={{ marginTop: 'auto', color: 'var(--status-ooo-fg)' }}
              onClick={onLogout}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🚪</span>
              <span>Logout</span>
            </div>
          )}
        </div>

        <div style={{
          padding: '20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--grad-primary)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white',
            boxShadow: 'var(--shadow-glow)'
          }}>{managerName.charAt(0)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{managerName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{managerTitle}</div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav print-hide">
        {mobileItems.map((item) => (
          <div 
            key={item.id} 
            className={`mobile-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id as View)}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

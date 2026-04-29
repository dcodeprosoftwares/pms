'use client';

import { useState, useEffect } from 'react';

interface RoomCategory {
  name: string;
  totalRooms: number;
}

interface RoomData {
  number: string;
  type: string;
  status: string;
}

interface BookingData {
  id: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}

interface AvailabilityCalendarProps {
  categories: RoomCategory[];
  rooms: RoomData[];
  bookings: BookingData[];
}

export default function AvailabilityCalendar({ categories, rooms, bookings }: AvailabilityCalendarProps) {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div style={{ height: 400 }} />;

  const baseDate = new Date(startDate);
  
  const dates = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="card animate-fade-in" style={{ overflowX: 'auto' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title">Availability Matrix</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Start Date:</span>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}
          />
        </div>
      </div>
      <div style={{ padding: 24, minWidth: 1000 }}>
        <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 200, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 10, borderRight: '2px solid var(--border-subtle)' }}>Room Category</th>
              {dates.map((d, i) => (
                <th key={i} style={{ textAlign: 'center', padding: '12px 8px', borderLeft: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              // Blocked is usually OOO rooms in this category. We'll count physical rooms marked OOO.
              const blockedCount = rooms.filter(r => r.type === cat.name && r.status === 'OOO').length;

              return (
                <tr key={cat.name}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 10, borderRight: '2px solid var(--border-subtle)', padding: '16px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-main)', marginBottom: 4 }}>{cat.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Total: {cat.totalRooms}</span>
                      <span>Blocked: {blockedCount}</span>
                    </div>
                  </td>
                  {dates.map((d, i) => {
                    const time = d.getTime();
                    
                    // Count bookings that span this date
                    const bookedCount = bookings.filter(b => {
                      if (b.roomType !== cat.name) return false;
                      if (b.status === 'CANCELLED' || b.status === 'CHECKED_OUT') return false;
                      
                      const checkIn = new Date(b.checkInDate).setHours(0,0,0,0);
                      const checkOut = new Date(b.checkOutDate).setHours(0,0,0,0);
                      
                      return time >= checkIn && time < checkOut;
                    }).length;

                    const availableCount = cat.totalRooms - blockedCount - bookedCount;
                    const availabilityPercent = availableCount / cat.totalRooms;
                    
                    let bg = 'transparent';
                    if (availabilityPercent === 0) bg = 'var(--status-ooo-bg)'; // red-ish
                    else if (availabilityPercent < 0.3) bg = 'var(--status-dirty-bg)'; // orange-ish
                    else bg = 'var(--status-clean-bg)'; // green-ish

                    return (
                      <td key={i} style={{ borderLeft: '1px solid var(--border-subtle)', padding: '12px 8px', verticalAlign: 'top', background: bg }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)' }}>
                            {availableCount} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>Avail</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-around', color: 'var(--text-muted)', fontSize: 11 }}>
                            <span>Bkd: {bookedCount}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { RoomData } from './RoomMatrix';

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const ROOMS = [
  { id: 'r1', number: '101', type: 'STANDARD' },
  { id: 'r2', number: '102', type: 'STANDARD' },
  { id: 'r3', number: '103', type: 'DELUXE' },
  { id: 'r4', number: '201', type: 'DELUXE' },
  { id: 'r5', number: '202', type: 'SUITE' },
];

type ResStatus = 'confirmed' | 'checked-in' | 'checked-out';

interface Reservation {
  roomId: string;
  guestName: string;
  checkIn: number;  // day offset from today (0 = today)
  nights: number;
  status: ResStatus;
}

const RESERVATIONS: Reservation[] = [
  { roomId: 'r1', guestName: 'R. Mehta',   checkIn: -1, nights: 3, status: 'checked-in' },
  { roomId: 'r2', guestName: 'P. Singh',   checkIn: 0,  nights: 2, status: 'confirmed' },
  { roomId: 'r3', guestName: 'A. Shah',    checkIn: -2, nights: 5, status: 'checked-in' },
  { roomId: 'r4', guestName: 'N. Kapoor',  checkIn: 2,  nights: 3, status: 'confirmed' },
  { roomId: 'r5', guestName: 'V. Raj',     checkIn: -1, nights: 4, status: 'checked-in' },
];

const DAYS = 10;

function getDayLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface TapeChartProps {
  rooms: RoomData[];
  bookings: any[]; // Using any to avoid circular imports, but it's BookingData
}

export default function TapeChart({ rooms, bookings }: TapeChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="tape-chart" style={{ height: 200 }} />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getOffset = (dateStr: string) => {
    if (!dateStr) return -999;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="tape-chart animate-fade-in">
      <div className="tc-header-row">
        <div className="tc-room-cell" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Tape Chart</span>
        </div>
        {Array.from({ length: DAYS }, (_, i) => i - 1).map(offset => (
          <div key={offset} className={`tc-date-cell ${offset === 0 ? 'today' : ''}`}>
            {getDayLabel(offset)}
            {offset === 0 && <div style={{ fontSize: 9, marginTop: 4 }}>TODAY</div>}
          </div>
        ))}
      </div>
      
      {rooms.map(room => (
        <div key={room.id} className="tc-row">
          <div className="tc-room-cell">
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-main)' }}>{room.number}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: 1 }}>{room.type}</span>
          </div>
          {Array.from({ length: DAYS }, (_, i) => i - 1).map(offset => {
            const bkg = bookings.find(b => {
              if (b.roomNumber !== room.number) return false;
              const inOffset = getOffset(b.checkInDate);
              const outOffset = getOffset(b.checkOutDate);
              return offset >= inOffset && offset < outOffset;
            });
            
            const isStart = bkg && offset === getOffset(bkg.checkInDate);

            return (
              <div key={offset} className="tc-grid-cell">
                {isStart && bkg && (() => {
                  const outOffset = getOffset(bkg.checkOutDate);
                  const nights = outOffset - getOffset(bkg.checkInDate);
                  return (
                    <div
                      className={`tc-block ${
                        bkg.status === 'CHECKED_IN' ? 'res-checkedin' :
                        bkg.status === 'CONFIRMED' ? 'res-confirmed' : 'res-checkout'
                      }`}
                      style={{ width: `calc(${nights * 100}% - 4px)` }}
                      title={`${bkg.guestName} (${bkg.status})`}
                    >
                      {bkg.guestName}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

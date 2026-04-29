'use client';

import { useState } from 'react';

export type RoomStatus = 'CLEAN' | 'DIRTY' | 'OOO' | 'INSPECTED' | 'OCCUPIED';

export interface RoomData {
  id: string;
  number: string;
  type: string;
  status: RoomStatus;
  guest?: string;
  floor: number;
}

interface RoomMatrixProps {
  rooms: RoomData[];
  onUpdateRooms: (rooms: RoomData[]) => void;
  adminPassword?: string;
}

export default function RoomMatrix({ rooms, onUpdateRooms, adminPassword }: RoomMatrixProps) {
  const [filter, setFilter] = useState<RoomStatus | 'ALL'>('ALL');

  const filtered = filter === 'ALL' ? rooms : rooms.filter(r => r.status === filter);

  const cycleStatus = (id: string) => {
    if (adminPassword) {
      const pwd = window.prompt("Security Check: Enter Admin Password to change room status");
      if (pwd === null) return; // User cancelled
      if (pwd !== adminPassword) {
        window.alert("❌ Incorrect Admin Password!");
        return;
      }
    }
    onUpdateRooms(rooms.map(r => {
      if (r.id !== id) return r;
      // Cycle: DIRTY -> CLEAN -> INSPECTED -> OCCUPIED -> OOO -> DIRTY
      const cycle: Record<RoomStatus, RoomStatus> = {
        'DIRTY': 'CLEAN',
        'CLEAN': 'INSPECTED',
        'INSPECTED': 'OCCUPIED',
        'OCCUPIED': 'OOO',
        'OOO': 'DIRTY'
      };
      return { ...r, status: cycle[r.status] };
    }));
  };

  return (
    <div className="card animate-slide-up stagger-1">
      <div className="card-header">
        <div className="card-title">Housekeeping Status</div>
        <div className="flex-center" style={{ gap: '8px', flexWrap: 'wrap' }}>
          {(['ALL', 'CLEAN', 'DIRTY', 'OOO', 'INSPECTED', 'OCCUPIED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? 'rgba(15, 23, 42, 0.08)' : 'transparent',
                color: filter === s ? 'var(--text-main)' : 'var(--text-muted)',
                border: '1px solid ' + (filter === s ? 'rgba(15, 23, 42, 0.15)' : 'transparent'),
                borderRadius: 'var(--radius-full)',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '24px' }}>
        <div className="room-matrix">
          {filtered.map(room => (
            <div 
              key={room.id} 
              className={`room-tile ${room.status}`}
              onClick={() => cycleStatus(room.id)}
              title="Click to change status"
            >
              <div className="room-num">{room.number}</div>
              <div className="room-type">{room.type}</div>
              <div className={`status-pill status-${room.status}`}>{room.status}</div>
              {room.guest && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '12px',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {room.guest}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

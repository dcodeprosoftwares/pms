'use client';

interface ActivityFeedProps {
  bookings?: any[];
  rooms?: any[];
}

interface Activity {
  type: string;
  title: string;
  sub: string;
  time: string;
  icon: string;
  rawTime: string;
}

export default function ActivityFeed({ bookings = [], rooms = [] }: ActivityFeedProps) {
  // Synthesize activities from state
  const activities: Activity[] = [];

  bookings.forEach(b => {
    // Check-outs
    if (b.actualCheckOutTime) {
      activities.push({
        type: 'checkout',
        title: `${b.guestName} checked out`,
        sub: `Room ${b.roomNumber} · Bill: ₹${b.amount}`,
        time: b.actualCheckOutTime.split(',')[0], // Extract time part roughly
        icon: '👋',
        rawTime: b.actualCheckOutTime
      });
    }
    
    // Check-ins
    if (b.actualCheckInTime) {
      activities.push({
        type: 'checkin',
        title: `${b.guestName} checked in`,
        sub: `Room ${b.roomNumber} · ${b.roomType}`,
        time: b.actualCheckInTime.split(',')[0],
        icon: '🔑',
        rawTime: b.actualCheckInTime
      });
    }

    // New Reservations (if they aren't checked in yet)
    if (!b.actualCheckInTime && b.status === 'CONFIRMED') {
      activities.push({
        type: 'reservation',
        title: `New Reservation: ${b.guestName}`,
        sub: `${b.roomType} · ₹${b.amount}`,
        time: 'Pending',
        icon: '📅',
        rawTime: b.id // just to give it a key
      });
    }
  });

  // Housekeeping (Rooms that are DIRTY)
  rooms.filter(r => r.status === 'DIRTY').forEach(r => {
    activities.push({
      type: 'hk',
      title: `Room ${r.number} marked Dirty`,
      sub: 'Awaiting housekeeping service',
      time: 'Now',
      icon: '🧹',
      rawTime: `hk-${r.number}`
    });
  });

  // Since we don't have exact timestamps for everything, we just limit it to 8 most recent
  const displayActivities = activities.slice(0, 8);

  return (
    <div className="card animate-slide-up stagger-3">
      <div className="card-header">
        <span className="card-title">Live Activity</span>
        <span className="status-pill status-CLEAN" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" style={{ width: 4, height: 4 }} />
          Real-time
        </span>
      </div>
      <div className="activity-list">
        {displayActivities.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity.</div>
        )}
        {displayActivities.map((a, i) => (
          <div key={i} className="activity-item">
            <div className="act-icon">{a.icon}</div>
            <div className="act-content">
              <div className="act-title text-main">{a.title}</div>
              <div className="act-desc">{a.sub}</div>
            </div>
            <div className="act-time">{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

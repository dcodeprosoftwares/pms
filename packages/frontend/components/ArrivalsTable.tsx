'use client';

interface ArrivalsTableProps {
  bookings?: any[]; // optional to prevent breaking if not passed
}

export default function ArrivalsTable({ bookings = [] }: ArrivalsTableProps) {
  // Get today's string in YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  // Filter bookings that are either scheduled for today, or have checked in today
  const arrivals = bookings.filter(b => b.checkInDate === today && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'));

  return (
    <div className="card animate-slide-up stagger-2">
      <div className="card-header">
        <span className="card-title">Today's Arrivals</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-secondary)' }}>
          {arrivals.length} Guests
        </span>
      </div>
      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Room Type</th>
              <th>Nights</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {arrivals.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No arrivals scheduled for today.</td>
              </tr>
            )}
            {arrivals.map((a, i) => {
              const start = new Date(a.checkInDate).getTime();
              const end = new Date(a.checkOutDate).getTime();
              const nights = Math.max(1, Math.round((end - start) / 86400000));
              
              return (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.guestName}</div>
                    {a.actualCheckInTime && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Arrived: {a.actualCheckInTime}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.roomType}</div>
                    {a.roomNumber && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Assigned: Room {a.roomNumber}</div>}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{nights}N</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>₹{a.amount}</td>
                  <td>
                    <span className={`status-pill status-${a.status === 'CHECKED_IN' ? 'CLEAN' : 'DIRTY'}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

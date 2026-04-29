'use client';

interface StatsGridProps {
  rooms?: any[];
  bookings?: any[];
}

export default function StatsGrid({ rooms = [], bookings = [] }: StatsGridProps) {
  const today = new Date().toISOString().split('T')[0];

  // Occupancy
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
  const occupancyRate = totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100);

  // Revenue (Let's sum the amount of all currently checked-in guests + checked out today)
  let todayRevenue = 0;
  bookings.forEach(b => {
    if (b.status === 'CHECKED_IN' || (b.status === 'CHECKED_OUT' && b.actualCheckOutTime && b.checkOutDate === today)) {
      todayRevenue += b.amount;
    }
  });

  // Check-ins Today
  const arrivingToday = bookings.filter(b => b.checkInDate === today);
  const checkedInToday = arrivingToday.filter(b => b.status === 'CHECKED_IN').length;
  const pendingArrivals = arrivingToday.filter(b => b.status === 'CONFIRMED').length;

  const stats = [
    {
      label: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      icon: '📈',
      trend: occupancyRate > 50 ? 'up' : 'down',
      sub: `Based on active inventory`,
    },
    {
      label: 'Occupied Rooms',
      value: `${occupiedRooms}/${totalRooms}`,
      icon: '🛏',
      trend: 'up',
      sub: `${totalRooms - occupiedRooms} rooms available`,
    },
    {
      label: "Active Folio Revenue",
      value: `₹${(todayRevenue / 1000).toFixed(1)}k`,
      icon: '₹',
      trend: 'up',
      sub: 'From in-house guests',
    },
    {
      label: 'Check-ins Today',
      value: `${checkedInToday}`,
      icon: '🛬',
      trend: pendingArrivals > 0 ? 'down' : 'up',
      sub: `${pendingArrivals} pending arrivals`,
    },
  ];

  return (
    <div className="stats-grid animate-fade-in">
      {stats.map((s, i) => (
        <div key={i} className={`stat-card stagger-${i}`}>
          <div className="stat-header">
            <span className="stat-label">{s.label}</span>
            <div className="stat-icon">{s.icon}</div>
          </div>
          <div className="stat-value text-gradient">{s.value}</div>
          <div className="stat-sub">
            <span className={`stat-trend ${s.trend}`}>●</span> {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

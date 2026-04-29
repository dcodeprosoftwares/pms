'use client';

interface TopbarProps {
  onOpenModal: (type: any) => void;
  hotelName: string;
}

export default function Topbar({ onOpenModal, hotelName }: TopbarProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="topbar">
      <div className="flex-center">
        <div>
          <div className="topbar-title text-gradient">{hotelName}</div>
          <div className="topbar-date">{dateStr} · {timeStr} IST</div>
        </div>
        <div className="flex-center" style={{ marginLeft: 24, background: 'var(--status-clean-bg)', padding: '4px 12px', borderRadius: '20px' }}>
          <span className="live-dot" />
          <span style={{ fontSize: 11, color: 'var(--status-clean-fg)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>System Live</span>
        </div>
      </div>

      <div className="topbar-right">
        <button className="btn" onClick={() => onOpenModal('audit')}>
          <span>🌙</span> Night Audit
        </button>
        <button className="btn" onClick={() => onOpenModal('checkin')}>
          <span>✓</span> Quick Check-in
        </button>
        <button className="btn primary" style={{ marginLeft: 8 }} onClick={() => onOpenModal('reservation')}>
          <span>+</span> New Reservation
        </button>
      </div>
    </header>
  );
}

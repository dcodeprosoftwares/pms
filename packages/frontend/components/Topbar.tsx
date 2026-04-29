'use client';

interface TopbarProps {
  onOpenModal: (type: any) => void;
  hotelName: string;
}

export default function Topbar({ onOpenModal, hotelName }: TopbarProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="topbar print-hide">
      <div className="flex-center">
        <div>
          <div className="topbar-title text-gradient" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
            {hotelName}
          </div>
          <div className="topbar-date" style={{ fontSize: '11px' }}>
            {dateStr} · {timeStr}
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <button className="btn" onClick={() => onOpenModal('checkin')}>
          <span className="icon-only">✓</span> <span>Check-in</span>
        </button>
        <button className="btn primary" onClick={() => onOpenModal('reservation')}>
          <span className="icon-only">+</span> <span>New</span>
        </button>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          .topbar-date {
            display: none;
          }
          .icon-only {
            font-size: 18px;
            font-weight: 800;
          }
        }
      `}</style>
    </header>
  );
}

'use client';

import { useState } from 'react';

export default function ReportsModule({ bookings, rooms, settings, categories }: any) {
  const [reportType, setReportType] = useState('revenue');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filtering Logic
  const filteredBookings = bookings.filter((b: any) => {
    if (!startDate && !endDate) return true;
    const bStart = new Date(b.checkInDate).getTime();
    const bEnd = new Date(b.checkOutDate).getTime();
    
    const s = startDate ? new Date(startDate).getTime() : 0;
    const e = endDate ? new Date(endDate).getTime() + 86400000 : Infinity; // Include the end date fully

    return bStart <= e && bEnd >= s;
  });

  // Calculate Metrics based on active tab
  let reportContent = null;
  let csvData = { headers: [] as string[], rows: [] as string[][] };

  if (reportType === 'revenue') {
    let gross = 0, net = 0, gst = 0;
    const revenueRows: any[] = [];
    
    filteredBookings.forEach((b: any) => {
      if (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') {
        const base = settings.gstIncluded ? b.amount / (1 + settings.gstPercent / 100) : b.amount;
        const tax = settings.gstIncluded ? b.amount - base : b.amount * (settings.gstPercent / 100);
        const g = settings.gstIncluded ? b.amount : b.amount + tax;
        gross += g; net += base; gst += tax;
        
        revenueRows.push({
          id: b.id,
          guestName: b.guestName,
          room: b.roomNumber || b.roomType,
          date: b.checkInDate,
          base: base,
          tax: tax,
          total: g
        });
      }
    });

    csvData.headers = ['Booking ID', 'Guest Name', 'Room', 'Date', 'Net Revenue', 'GST Collected', 'Total Revenue'];
    csvData.rows = revenueRows.map(r => [r.id, `"${r.guestName}"`, r.room, r.date, r.base.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2)]);

    reportContent = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <div className="card" style={{ padding: 24, borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Net Revenue (Hotel)</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--text-main)', fontFamily: 'JetBrains Mono, monospace' }}>₹{net.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="card" style={{ padding: 24, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>GST Collected</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--text-main)', fontFamily: 'JetBrains Mono, monospace' }}>₹{gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="card" style={{ padding: 24, borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Gross Revenue</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--text-main)', fontFamily: 'JetBrains Mono, monospace' }}>₹{gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Detailed Revenue Breakdown</h3>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Guest Name</th>
                <th>Room</th>
                <th>Check-in Date</th>
                <th>Net (₹)</th>
                <th>Tax (₹)</th>
                <th>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {revenueRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>{r.id}</td>
                  <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                  <td>{r.room}</td>
                  <td>{new Date(r.date).toLocaleDateString('en-IN')}</td>
                  <td>{r.base.toFixed(2)}</td>
                  <td>{r.tax.toFixed(2)}</td>
                  <td style={{ fontWeight: 700 }}>{r.total.toFixed(2)}</td>
                </tr>
              ))}
              {revenueRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No revenue entries found for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportType === 'tax') {
    const taxRows: any[] = [];
    filteredBookings.forEach((b: any) => {
      if (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') {
        const base = settings.gstIncluded ? b.amount / (1 + settings.gstPercent / 100) : b.amount;
        const totalTax = settings.gstIncluded ? b.amount - base : b.amount * (settings.gstPercent / 100);
        const gross = settings.gstIncluded ? b.amount : b.amount + totalTax;
        
        taxRows.push({
          id: b.id,
          name: b.guestName,
          date: b.checkInDate,
          taxable: base,
          cgst: totalTax / 2,
          sgst: totalTax / 2,
          totalTax: totalTax,
          gross: gross,
          rate: settings.gstPercent,
          company: b.companyName,
          customerGst: b.customerGst,
          billingDate: b.checkOutDate
        });
      }
    });

    csvData.headers = ['Booking ID', 'Guest Name', 'Billing Date', 'Company', 'Customer GSTIN', 'Taxable Value', 'CGST', 'SGST', 'Total GST', 'Total Amount', 'Tax Rate %'];
    csvData.rows = taxRows.map(r => [r.id, `"${r.name}"`, r.billingDate, `"${r.company || ''}"`, r.customerGst || '', r.taxable.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.totalTax.toFixed(2), r.gross.toFixed(2), r.rate.toString()]);

    reportContent = (
      <div>
        <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
          💡 <strong>GST Summary for CA:</strong> This report provides a detailed breakdown of all tax-eligible bookings. GST is divided into CGST ({settings.gstPercent/2}%) and SGST ({settings.gstPercent/2}%) as per standard filing requirements.
        </div>
        <table className="modern-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Guest Name</th>
              <th>Billing Date</th>
              <th>Business / GSTIN</th>
              <th>Taxable Val (₹)</th>
              <th>CGST (₹)</th>
              <th>SGST (₹)</th>
              <th>Total GST (₹)</th>
              <th>Total Bill (₹)</th>
            </tr>
          </thead>
          <tbody>
            {taxRows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>{r.id}</td>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td style={{ fontSize: '13px' }}>{new Date(r.billingDate).toLocaleDateString('en-IN')}</td>
                <td style={{ fontSize: '12px' }}>
                  {r.company && <div style={{ fontWeight: 600 }}>{r.company}</div>}
                  {r.customerGst && <div style={{ color: 'var(--text-muted)' }}>{r.customerGst}</div>}
                  {!r.company && !r.customerGst && <span style={{ color: 'var(--text-dim)' }}>-</span>}
                </td>
                <td>{r.taxable.toFixed(2)}</td>
                <td style={{ color: '#0ea5e9' }}>{r.cgst.toFixed(2)}</td>
                <td style={{ color: '#8b5cf6' }}>{r.sgst.toFixed(2)}</td>
                <td style={{ fontWeight: 600 }}>{r.totalTax.toFixed(2)}</td>
                <td style={{ fontWeight: 700 }}>{r.gross.toFixed(2)}</td>
              </tr>
            ))}
            {taxRows.length > 0 && (
              <tr style={{ background: 'rgba(15, 23, 42, 0.05)', fontWeight: 800 }}>
                <td colSpan={4} style={{ textAlign: 'right' }}>TOTALS:</td>
                <td>{taxRows.reduce((s, r) => s + r.taxable, 0).toFixed(2)}</td>
                <td>{taxRows.reduce((s, r) => s + r.cgst, 0).toFixed(2)}</td>
                <td>{taxRows.reduce((s, r) => s + r.sgst, 0).toFixed(2)}</td>
                <td>{taxRows.reduce((s, r) => s + r.totalTax, 0).toFixed(2)}</td>
                <td>{taxRows.reduce((s, r) => s + r.gross, 0).toFixed(2)}</td>
              </tr>
            )}
            {taxRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No taxable bookings found.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  if (reportType === 'bookings') {
    csvData.headers = ['Booking ID', 'Guest Name', 'Check In', 'Check Out', 'Room Type', 'Status', 'Amount'];
    csvData.rows = filteredBookings.map((b: any) => [b.id, `"${b.guestName}"`, b.checkInDate, b.checkOutDate, b.roomType, b.status, b.amount.toString()]);

    reportContent = (
      <table className="modern-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Guest Name</th>
            <th>Dates</th>
            <th>Room</th>
            <th>Status</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {filteredBookings.map((b: any) => (
            <tr key={b.id}>
              <td style={{ fontFamily: 'JetBrains Mono' }}>{b.id}</td>
              <td style={{ fontWeight: 600 }}>{b.guestName}</td>
              <td>{new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()}</td>
              <td>{b.roomType}</td>
              <td><span className="status-pill status-CLEAN">{b.status}</span></td>
              <td style={{ fontFamily: 'JetBrains Mono' }}>{b.amount}</td>
            </tr>
          ))}
          {filteredBookings.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No bookings found in this range.</td></tr>}
        </tbody>
      </table>
    );
  }

  if (reportType === 'occupancy') {
    // Basic occupancy calculation for the period
    const totalRoomNights = rooms.length * (filteredBookings.length > 0 ? 30 : 1); // Mock 30 days if no filter, or exact days. We'll simplify.
    
    reportContent = (
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>Occupancy Overview</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Detailed daily occupancy graphs will appear here. Currently, the live occupancy is 
          <strong> {Math.round((rooms.filter((r: any) => r.status === 'OCCUPIED').length / rooms.length) * 100) || 0}% </strong>
          based on real-time front desk status.
        </p>
      </div>
    );
  }

  if (reportType === 'category') {
    const catStats: Record<string, { count: number; rev: number }> = {};
    filteredBookings.forEach((b: any) => {
      if (!catStats[b.roomType]) catStats[b.roomType] = { count: 0, rev: 0 };
      catStats[b.roomType].count += 1;
      catStats[b.roomType].rev += b.amount;
    });

    csvData.headers = ['Category', 'Bookings', 'Revenue Generated'];
    csvData.rows = Object.entries(catStats).map(([cat, stats]) => [cat, stats.count.toString(), stats.rev.toString()]);

    reportContent = (
      <table className="modern-table">
        <thead>
          <tr>
            <th>Room Category</th>
            <th>Total Bookings</th>
            <th>Revenue Generated (₹)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(catStats).map(([cat, stats]) => (
            <tr key={cat}>
              <td style={{ fontWeight: 600 }}>{cat}</td>
              <td>{stats.count}</td>
              <td style={{ fontFamily: 'JetBrains Mono' }}>{stats.rev.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === 'ota') {
    const otaStats: Record<string, { count: number; rev: number }> = {};
    filteredBookings.forEach((b: any) => {
      const source = b.source || 'Direct Walk-in';
      if (!otaStats[source]) otaStats[source] = { count: 0, rev: 0 };
      otaStats[source].count += 1;
      otaStats[source].rev += b.amount;
    });

    csvData.headers = ['Channel / OTA', 'Bookings', 'Revenue'];
    csvData.rows = Object.entries(otaStats).map(([src, stats]) => [src, stats.count.toString(), stats.rev.toString()]);

    reportContent = (
      <table className="modern-table">
        <thead>
          <tr>
            <th>Source Channel</th>
            <th>Total Bookings</th>
            <th>Revenue Generated (₹)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(otaStats).map(([src, stats]) => (
            <tr key={src}>
              <td style={{ fontWeight: 600 }}>{src}</td>
              <td>{stats.count}</td>
              <td style={{ fontFamily: 'JetBrains Mono' }}>{stats.rev.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === 'cancellations') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cancellations = filteredBookings.filter((b: any) => {
      const isPast = new Date(b.checkInDate) < today;
      return b.status === 'CANCELLED' || (b.status === 'CONFIRMED' && isPast);
    }).map((b: any) => {
      const isPast = new Date(b.checkInDate) < today;
      return {
        ...b,
        cancelReason: b.status === 'CANCELLED' ? 'User Cancelled' : (isPast ? 'No-Show (Expired)' : '-')
      };
    });
    
    csvData.headers = ['Booking ID', 'Guest Name', 'Check-in Date', 'Room Type', 'Reason'];
    csvData.rows = cancellations.map((b: any) => [b.id, b.guestName, b.checkInDate, b.roomType, b.cancelReason]);

    reportContent = (
      <table className="modern-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Guest Name</th>
            <th>Check-in Date</th>
            <th>Room Type</th>
            <th>Cancellation Reason</th>
          </tr>
        </thead>
        <tbody>
          {cancellations.map((b: any) => (
            <tr key={b.id}>
              <td style={{ fontFamily: 'JetBrains Mono' }}>{b.id}</td>
              <td style={{ fontWeight: 600 }}>{b.guestName}</td>
              <td>{new Date(b.checkInDate).toLocaleDateString('en-IN')}</td>
              <td>{b.roomType}</td>
              <td>
                <span className={`status-pill ${b.cancelReason.includes('No-Show') ? 'status-DIRTY' : 'status-OOO'}`} style={{ fontSize: '11px' }}>
                  {b.cancelReason.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
          {cancellations.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No cancellations or no-shows found.</td></tr>}
        </tbody>
      </table>
    );
  }

  const handleDownload = () => {
    const csv = [csvData.headers.join(','), ...csvData.rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weazy_${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in print-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-main)' }}>Intelligence & Reports</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" onClick={() => window.print()}>🖨️ Print Report</button>
          <button className="btn primary" onClick={handleDownload}>📥 Download CSV</button>
        </div>
      </div>

      <div className="card print-hide" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Report Type</div>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
              <option value="revenue">Revenue Report</option>
              <option value="tax">Tax Report (GST Filing)</option>
              <option value="bookings">Booking Report</option>
              <option value="occupancy">Occupancy Report</option>
              <option value="category">Room Category Report</option>
              <option value="ota">OTA / Channel Report</option>
              <option value="cancellations">Cancellation Report</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Start Date</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>End Date</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
          </div>
          <div>
            <button className="btn" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear Dates</button>
          </div>
        </div>
      </div>

      {reportContent && (
        <div className="card" style={{ padding: 24 }}>
          <div className="print-only" style={{ marginBottom: 24, fontSize: 18, fontWeight: 700 }}>
            {reportType.toUpperCase()} REPORT ({startDate || 'All Time'} to {endDate || 'All Time'})
          </div>
          {reportContent}
        </div>
      )}
    </div>
  );
}

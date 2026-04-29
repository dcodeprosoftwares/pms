'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function GuestPortalContent() {
  const searchParams = useSearchParams();
  const hotelId = searchParams.get('hotelId');
  const type = searchParams.get('type') || 'reservation';

  const [hotel, setHotel] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [guestName, setGuestName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');

  // Check-in State
  const [searchBkgId, setSearchBkgId] = useState('');

  useEffect(() => {
    if (!hotelId) return;

    // 1. Check if guest is already checked in (Persistence)
    const savedCheckIn = localStorage.getItem(`weazy_checkin_${hotelId}`);
    if (savedCheckIn) {
      const data = JSON.parse(savedCheckIn);
      setBookingId(data.bookingId);
      setSelectedRoom(data.roomNum);
      setStep(3);
    }

    const loadHotel = async () => {
      try {
        const { data: h, error: hErr } = await supabase.from('hotels').select('*').eq('id', hotelId).single();
        if (hErr) throw hErr;
        if (h) {
          setHotel(h);
          const { data: cats } = await supabase.from('room_categories').select('*').eq('hotel_id', hotelId);
          setCategories(cats || []);
        }
      } catch (err: any) {
        setError(`Portal Error: ${err.message || 'Hotel not found'}`);
      } finally {
        setLoading(false);
      }
    };

    loadHotel();
  }, [hotelId]);

  const handleReserve = async () => {
    setError('');
    if (!guestName || !mobile || !selectedCat || !checkInDate || !checkOutDate) {
      return setError('Please fill all required fields');
    }

    const cat = categories.find(c => c.name === selectedCat);
    if (!cat) return;

    const bkgId = `GUEST-${Math.floor(Math.random() * 90000) + 10000}`;
    setIsProcessing(true);
    try {
      const { error: bError } = await supabase.from('bookings').insert([{
        hotel_id: hotelId,
        custom_id: bkgId,
        guest_name: guestName,
        mobile: mobile,
        email: email,
        room_type: selectedCat,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        amount: cat.base_rate,
        status: 'CONFIRMED',
        source: 'Guest Portal'
      }]).select().single();

      if (bError) throw bError;
      
      setBookingId(bkgId);
      setStep(2);
      loadAvailableRooms(selectedCat);
    } catch (err: any) {
      setError(`Reservation Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadAvailableRooms = async (category: string) => {
    try {
      const { data: rms, error: rErr } = await supabase.from('rooms')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('type', category) // Must match the booked category
        .eq('status', 'CLEAN');
      
      if (rErr) throw rErr;
      setAvailableRooms(rms || []);
    } catch (err: any) {
      console.error("Room Load Error:", err);
      setError(`Could not load rooms: ${err.message}`);
    }
  };

  const handleCheckInSearch = async () => {
    setError('');
    setIsProcessing(true);
    try {
      const { data: bkg, error: bError } = await supabase.from('bookings')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('custom_id', searchBkgId.toUpperCase())
        .maybeSingle();

      if (bError) throw bError;
      if (!bkg) return setError('Booking ID not found');
      if (bkg.status !== 'CONFIRMED') return setError('Already checked in or cancelled');

      setBookingId(bkg.custom_id);
      setGuestName(bkg.guest_name);
      setStep(2);
      loadAvailableRooms(bkg.room_type);
    } catch (err: any) {
      setError(`Search Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finishCheckIn = async (roomId: string, roomNum: string) => {
    setError('');
    setIsProcessing(true);
    const now = new Date().toLocaleString('en-IN');
    
    try {
      await new Promise(r => setTimeout(r, 1200));

      const { error: bErr } = await supabase.from('bookings').update({
        status: 'CHECKED_IN',
        room_number: roomNum,
        actual_check_in_time: now
      }).eq('custom_id', bookingId).eq('hotel_id', hotelId);

      if (bErr) throw bErr;

      const { error: rErr } = await supabase.from('rooms').update({
        status: 'OCCUPIED',
        current_guest: guestName
      }).eq('id', roomId);

      if (rErr) throw rErr;

      // SAVE TO PERSISTENCE
      localStorage.setItem(`weazy_checkin_${hotelId}`, JSON.stringify({
        bookingId, roomNum, timestamp: Date.now()
      }));

      setSelectedRoom(roomNum);
      setStep(3);
    } catch (err: any) {
      setError(`Check-in Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="portal-loader">Loading Guest Portal...</div>;

  return (
    <div className="guest-portal">
      <header className="portal-header">
        <img src="/weazy-logo.png" alt="Logo" className="portal-logo" />
        <h1>{hotel?.name}</h1>
      </header>

      <main className="portal-content">
        {isProcessing && (
          <div className="card text-center animate-fade-in">
            <div className="spinner-large"></div>
            <h2 style={{ marginTop: 24 }}>Processing...</h2>
            <p>Finalizing your stay. Please wait.</p>
          </div>
        )}

        {!isProcessing && step === 1 && (
          <div className="card animate-fade-in">
            {type === 'reservation' ? (
              <>
                <h2>Fast Reservation</h2>
                <div className="form-grid">
                  <input type="text" placeholder="Full Name" value={guestName} onChange={e => setGuestName(e.target.value)} />
                  <input type="tel" placeholder="Mobile Number" value={mobile} onChange={e => setMobile(e.target.value)} />
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                    <option value="">Category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name} - ₹{c.base_rate}</option>)}
                  </select>
                  <div className="date-inputs">
                    <div><label>Check-in</label><input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} /></div>
                    <div><label>Check-out</label><input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} /></div>
                  </div>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <button className="submit-btn" onClick={handleReserve}>Reserve Now</button>
              </>
            ) : (
              <>
                <h2>Self Check-in</h2>
                <input type="text" placeholder="BOOKING ID" value={searchBkgId} onChange={e => setSearchBkgId(e.target.value)} className="search-input" style={{ textTransform: 'uppercase' }} />
                {error && <div className="error-msg">{error}</div>}
                <button className="submit-btn" onClick={handleCheckInSearch}>Find Booking</button>
              </>
            )}
          </div>
        )}

        {!isProcessing && step === 2 && (
          <div className="card animate-fade-in">
            <div className="success-badge">✅</div>
            <h2>Booking Found!</h2>
            <div className="bkg-badge">ID: {bookingId}</div>
            <hr style={{ margin: '20px 0', opacity: 0.1 }} />
            <h3>Select Your Room</h3>
            <div className="room-selection-grid">
              {availableRooms.map(r => (
                <div key={r.id} className="room-option" onClick={() => finishCheckIn(r.id, r.number)}>
                  <div className="room-num">{r.number}</div>
                  <div className="room-status">READY</div>
                </div>
              ))}
            </div>
            {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
          </div>
        )}

        {!isProcessing && step === 3 && (
          <div className="card final-card animate-slide-up">
            <div className="final-icon">🏨</div>
            <h2 style={{ textAlign: 'center' }}>Welcome!</h2>
            <p className="final-msg" style={{ textAlign: 'center' }}>Checked-in to <strong>Room {selectedRoom}</strong>.</p>
            <div className="notification-box">📢 Please collect your key from reception.</div>
            
            {(hotel?.wifi_id || hotel?.wifi_password) && (
              <div className="wifi-box">
                <div style={{ fontWeight: 700, marginBottom: '8px' }}>📶 Stay Connected</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Network:</span><strong>{hotel.wifi_id}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Password:</span><strong>{hotel.wifi_password}</strong></div>
              </div>
            )}
            <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b' }}>Have a wonderful stay at {hotel?.name}!</p>
            <button className="submit-btn" style={{ background: '#f1f5f9', color: '#475569', marginTop: 20 }} onClick={() => { localStorage.removeItem(`weazy_checkin_${hotelId}`); window.location.reload(); }}>New Action</button>
          </div>
        )}
      </main>

      <style jsx>{`
        .guest-portal { min-height: 100vh; background: #f8fafc; padding: 20px; font-family: 'Inter', sans-serif; }
        .portal-header { text-align: center; margin-bottom: 32px; padding-top: 20px; }
        .portal-logo { height: 50px; margin-bottom: 12px; }
        .portal-header h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
        .card { background: white; border-radius: 24px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; }
        .form-grid { display: flex; flex-direction: column; gap: 12px; }
        input, select { width: 100%; padding: 12px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 15px; }
        .date-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .date-inputs label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .submit-btn { width: 100%; background: #0f172a; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 700; margin-top: 20px; cursor: pointer; }
        .room-selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; margin-top: 16px; }
        .room-option { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; cursor: pointer; }
        .room-num { font-size: 18px; font-weight: 800; color: #0f172a; }
        .room-status { font-size: 10px; font-weight: 700; color: #10b981; }
        .success-badge { font-size: 48px; text-align: center; }
        .bkg-badge { background: #f1f5f9; padding: 8px; border-radius: 8px; text-align: center; font-family: monospace; font-weight: 700; }
        .final-icon { font-size: 64px; text-align: center; margin-bottom: 24px; }
        .notification-box { background: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 12px; color: #92400e; font-size: 14px; margin: 20px 0; }
        .wifi-box { background: #f0f9ff; border: 1px solid #bae6fd; padding: 16px; border-radius: 12px; color: #0369a1; font-size: 14px; margin-bottom: 20px; }
        .error-msg { color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 12px; text-align: center; }
        .spinner-large { width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-slide-up { animation: slideUp 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default function GuestPortal() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GuestPortalContent />
    </Suspense>
  );
}

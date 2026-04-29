'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function GuestPortalContent() {
  const searchParams = useSearchParams();
  const hotelId = searchParams.get('hotelId');
  const type = searchParams.get('type') || 'reservation'; // 'reservation' or 'checkin'

  const [hotel, setHotel] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Form, 2: Success/Checkin, 3: Final
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Form State
  const [guestName, setGuestName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [error, setError] = useState('');

  // Check-in State (for existing booking)
  const [searchBkgId, setSearchBkgId] = useState('');

  useEffect(() => {
    if (!hotelId) return;

    const loadHotel = async () => {
      const { data: h } = await supabase.from('hotels').select('*').eq('id', hotelId).single();
      if (h) {
        setHotel(h);
        const { data: cats } = await supabase.from('room_categories').select('*').eq('hotel_id', hotelId);
        setCategories(cats || []);
      }
      setLoading(false);
    };

    loadHotel();
  }, [hotelId]);

  const handleReserve = async () => {
    if (!guestName || !mobile || !selectedCat || !checkInDate || !checkOutDate) {
      return setError('Please fill all required fields');
    }

    const cat = categories.find(c => c.name === selectedCat);
    if (!cat) return;

    const bkgId = `GUEST-${Math.floor(Math.random() * 90000) + 10000}`;
    
    const { data, error: bError } = await supabase.from('bookings').insert([{
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

    if (bError) {
      setError(bError.message);
    } else {
      setBookingId(bkgId);
      setStep(2);
      loadAvailableRooms(selectedCat);
    }
  };

  const loadAvailableRooms = async (category: string) => {
    const { data: rms } = await supabase.from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'CLEAN');
    
    // In a real app, we'd filter by category too, but for now we'll show all clean rooms
    setAvailableRooms(rms || []);
  };

  const handleCheckInSearch = async () => {
    const { data: bkg, error: bError } = await supabase.from('bookings')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('custom_id', searchBkgId.toUpperCase())
      .single();

    if (bError || !bkg) {
      return setError('Booking ID not found');
    }

    if (bkg.status !== 'CONFIRMED') {
      return setError('This booking is already checked in or cancelled');
    }

    setBookingId(bkg.custom_id);
    setGuestName(bkg.guest_name);
    setStep(2);
    loadAvailableRooms(bkg.room_type);
  };

  const finishCheckIn = async (roomId: string, roomNum: string) => {
    const now = new Date().toLocaleString('en-IN');
    
    // Update Booking
    await supabase.from('bookings').update({
      status: 'CHECKED_IN',
      room_number: roomNum,
      actual_check_in_time: now
    }).eq('custom_id', bookingId).eq('hotel_id', hotelId);

    // Update Room
    await supabase.from('rooms').update({
      status: 'OCCUPIED',
      current_guest: guestName
    }).eq('id', roomId);

    setSelectedRoom(roomNum);
    setStep(3);
  };

  if (loading) return <div className="portal-loader">Loading Guest Portal...</div>;
  if (!hotel) return <div className="portal-error">Invalid Hotel ID</div>;

  return (
    <div className="guest-portal">
      <header className="portal-header">
        <img src="/weazy-logo.png" alt="Logo" className="portal-logo" />
        <h1>{hotel.name}</h1>
      </header>

      <main className="portal-content">
        {step === 1 && (
          <div className="card animate-fade-in">
            {type === 'reservation' ? (
              <>
                <h2>Fast Reservation</h2>
                <p>Complete your booking in seconds</p>
                <div className="form-grid">
                  <input type="text" placeholder="Your Full Name" value={guestName} onChange={e => setGuestName(e.target.value)} />
                  <input type="tel" placeholder="Mobile Number" value={mobile} onChange={e => setMobile(e.target.value)} />
                  <input type="email" placeholder="Email (Optional)" value={email} onChange={e => setEmail(e.target.value)} />
                  <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                    <option value="">Select Room Category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name} - ₹{c.base_rate}</option>)}
                  </select>
                  <div className="date-inputs">
                    <div>
                      <label>Check-in</label>
                      <input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} />
                    </div>
                    <div>
                      <label>Check-out</label>
                      <input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} />
                    </div>
                  </div>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <button className="submit-btn" onClick={handleReserve}>Reserve Now</button>
              </>
            ) : (
              <>
                <h2>Self Check-in</h2>
                <p>Already have a booking? Check-in here.</p>
                <input 
                  type="text" 
                  placeholder="Enter Booking ID (e.g. BKG-1234)" 
                  value={searchBkgId} 
                  onChange={e => setSearchBkgId(e.target.value)}
                  className="search-input"
                />
                {error && <div className="error-msg">{error}</div>}
                <button className="submit-btn" onClick={handleCheckInSearch}>Find Booking</button>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="card animate-fade-in">
            <div className="success-badge">✅</div>
            <h2>Booking Confirmed!</h2>
            <div className="bkg-badge">ID: {bookingId}</div>
            
            <hr />
            
            <h3>Select Your Room</h3>
            <p>Choose an available room to complete check-in</p>
            <div className="room-selection-grid">
              {availableRooms.length === 0 ? (
                <p className="no-rooms">No rooms currently available. Please see reception.</p>
              ) : (
                availableRooms.map(r => (
                  <div key={r.id} className="room-option" onClick={() => finishCheckIn(r.id, r.number)}>
                    <div className="room-num">{r.number}</div>
                    <div className="room-status">READY</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card final-card animate-slide-up">
            <div className="final-icon">🏨</div>
            <h2>Welcome to {hotel.name}!</h2>
            <p className="final-msg">
              Check-in Successful for <strong>Room {selectedRoom}</strong>.
            </p>
            <div className="notification-box">
              📢 Please collect the key of selected room <strong>{selectedRoom}</strong> from reception.
            </div>
            
            {(hotel.wifi_id || hotel.wifi_password) && (
              <div className="wifi-box">
                <div style={{ fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📶 Stay Connected
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Network:</span>
                  <strong>{hotel.wifi_id || 'Hotel_Guest_WiFi'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Password:</span>
                  <strong>{hotel.wifi_password || 'Welcome!'}</strong>
                </div>
              </div>
            )}

            <p className="blessing">Have a wonderful stay at {hotel.name}!</p>
          </div>
        )}
      </main>

      <style jsx>{`
        /* ... existing styles ... */
        .wifi-box {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          padding: 16px;
          border-radius: 12px;
          color: #0369a1;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .guest-portal {
          min-height: 100vh;
          background: #f8fafc;
          padding: 20px;
          font-family: 'Inter', sans-serif;
        }
        .portal-header {
          text-align: center;
          margin-bottom: 32px;
          padding-top: 20px;
        }
        .portal-logo {
          height: 50px;
          margin-bottom: 12px;
        }
        .portal-header h1 {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .card {
          background: white;
          border-radius: 24px;
          padding: 32px 24px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          max-width: 500px;
          margin: 0 auto;
        }
        h2 { font-size: 22px; margin-bottom: 8px; color: #0f172a; }
        p { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .form-grid { display: flex; flex-direction: column; gap: 16px; }
        input, select {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          font-size: 15px;
          transition: border-color 0.2s;
        }
        input:focus, select:focus { border-color: #6366f1; outline: none; }
        .date-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .date-inputs label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .submit-btn {
          width: 100%;
          background: #0f172a;
          color: white;
          border: none;
          padding: 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          margin-top: 24px;
          cursor: pointer;
        }
        .success-badge { font-size: 48px; text-align: center; margin-bottom: 16px; }
        .bkg-badge {
          background: #f1f5f9;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          text-align: center;
          margin-bottom: 24px;
        }
        .room-selection-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .room-option {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .room-option:hover { border-color: #6366f1; background: #f5f3ff; }
        .room-num { font-size: 18px; font-weight: 800; color: #0f172a; }
        .room-status { font-size: 10px; font-weight: 700; color: #10b981; }
        .final-icon { font-size: 64px; text-align: center; margin-bottom: 24px; }
        .notification-box {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          padding: 16px;
          border-radius: 12px;
          color: #92400e;
          font-size: 14px;
          line-height: 1.5;
          margin: 20px 0;
        }
        .error-msg { color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 12px; text-align: center; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
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

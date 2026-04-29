'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import StatsGrid from '@/components/StatsGrid';
import TapeChart from '@/components/TapeChart';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import RoomMatrix from '@/components/RoomMatrix';
import ReportsModule from '@/components/ReportsModule';
import ArrivalsTable from '@/components/ArrivalsTable';
import ActivityFeed from '@/components/ActivityFeed';
import Auth from '@/components/Auth';

import { RoomData, RoomStatus } from '@/components/RoomMatrix';

export type ModalType = 'reservation' | 'checkin' | 'audit' | 'pos' | 'add-category' | 'add-room' | 'checkout-details' | 'record-expense' | 'add-expense-type' | 'add-inv-item' | 'add-vendor' | 'record-inv-transaction' | 'booking-detail' | 'settings' | null;

interface RoomCategory {
  name: string;
  totalRooms: number;
  prices: Record<string, number>;
}

const DEFAULT_ROOMS: RoomData[] = [];

export interface BookingData {
  id: string;
  guestName: string;
  dates: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  roomType: string;
  roomNumber: string;
  amount: number;
  status: string;
  mobile?: string;
  idProof?: string;
  address?: string;
  purpose?: string;
  invoiceNumber?: number;
  amountPaid?: number;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  customerGst?: string;
  companyName?: string;
  folioId?: string;
}

export interface ExpenseData {
  id: string;
  date: string;
  type: string;
  amount: number;
  notes: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: 'Perishable' | 'Non-Perishable' | 'Amenities' | 'Linens' | 'Other';
  uom: string;
  currentStock: number;
  minStockLevel: number;
}

export interface Vendor {
  id: string;
  name: string;
  contactInfo: string;
  taxId: string;
  leadTimeDays: number;
}

export interface InvTransaction {
  id: string;
  date: string;
  itemId: string;
  type: 'Stock In' | 'Stock Out' | 'Transfer';
  quantity: number;
  notes: string;
}

const today = new Date();
const dt = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const DEFAULT_BOOKINGS: BookingData[] = [];

export default function Dashboard() {
  const [activeView, setActiveView] = useState<'dashboard' | 'tape-chart' | 'housekeeping' | 'billing' | 'guests' | 'bookings' | 'reports' | 'inventory' | 'room-setup' | 'expenses' | 'settings'>('dashboard');
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [roomCategories, setRoomCategories] = useState<RoomCategory[]>([]);

  const [globalRooms, setGlobalRooms] = useState<RoomData[]>(DEFAULT_ROOMS);
  const [globalBookings, setGlobalBookings] = useState<BookingData[]>(DEFAULT_BOOKINGS);

  const [resCheckIn, setResCheckIn] = useState('');
  const [resCheckOut, setResCheckOut] = useState('');
  const [resRoomRows, setResRoomRows] = useState<number[]>([1]);

  const [checkinBkgId, setCheckinBkgId] = useState('');

  const [selectedBillingBkg, setSelectedBillingBkg] = useState<string | null>(null);
  const [selectedGuestHistory, setSelectedGuestHistory] = useState<string | null>(null);

  const [globalExpenseTypes, setGlobalExpenseTypes] = useState<string[]>([]);
  const [globalExpenses, setGlobalExpenses] = useState<ExpenseData[]>([]);
  const [expenseFilterStart, setExpenseFilterStart] = useState<string>('');
  const [expenseFilterEnd, setExpenseFilterEnd] = useState<string>('');

  const [globalInventory, setGlobalInventory] = useState<InventoryItem[]>([]);
  const [globalVendors, setGlobalVendors] = useState<Vendor[]>([]);
  const [globalInvTransactions, setGlobalInvTransactions] = useState<InvTransaction[]>([]);
  const [invTab, setInvTab] = useState<'items' | 'vendors' | 'transactions'>('items');
  const [chartTab, setChartTab] = useState<'tape' | 'availability'>('availability');
  const [settingsTab, setSettingsTab] = useState<'general' | 'operational' | 'financial' | 'security'>('general');
  const [resCategorySelections, setResCategorySelections] = useState<Record<number, string>>({});
  const [checkoutBkgId, setCheckoutBkgId] = useState<string | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedDetailBkg, setSelectedDetailBkg] = useState<string | null>(null);

  const closeModals = () => {
    setModalType(null);
    setResCategorySelections({});
    setResRoomRows([Date.now()]);
    setResCheckIn('');
    setResCheckOut('');
    setCheckoutBkgId(null);
  };

  const [isLoaded, setIsLoaded] = useState(false);

  const [hotelSettings, setHotelSettings] = useState({
    name: 'Loading Property...',
    location: '',
    mobile: '',
    email: '',
    website: '',
    currency: '₹',
    checkInTime: '12:00 PM',
    checkOutTime: '11:00 AM',
    taxNumber: '',
    gstPercent: 12,
    gstIncluded: true,
    invoicePrefix: 'INV-',
    currentInvoiceNumber: 1,
    bookingPrefix: 'BKG-',
    currentBookingNumber: 1,
    managerName: '',
    managerTitle: 'Property Manager',
    adminPassword: '',
    wifiId: '',
    wifiPassword: ''
  });

  const getAvailableCategories = () => {
    if (!resCheckIn || !resCheckOut) return roomCategories.map(c => ({ ...c, available: c.totalRooms }));
    const start = new Date(resCheckIn).getTime();
    const end = new Date(resCheckOut).getTime();
    
    if (start >= end) return [];
    
    return roomCategories.map(cat => {
      const blockedCount = globalRooms.filter(r => r.type === cat.name && r.status === 'OOO').length;
      let maxOccupiedOnAnyDay = 0;
      
      for (let t = start; t < end; t += 86400000) {
        let occupiedOnThisDay = 0;
        globalBookings.forEach(b => {
          if (b.roomType !== cat.name) return;
          if (b.status === 'CANCELLED' || b.status === 'CHECKED_OUT') return;
          
          const bStart = new Date(b.checkInDate).getTime();
          const bEnd = new Date(b.checkOutDate).getTime();
          
          if (bStart <= t && bEnd > t) {
            occupiedOnThisDay++;
          }
        });
        if (occupiedOnThisDay > maxOccupiedOnAnyDay) maxOccupiedOnAnyDay = occupiedOnThisDay;
      }
      return { ...cat, available: Math.max(0, cat.totalRooms - blockedCount - maxOccupiedOnAnyDay) };
    });
  };

  const handleCheckout = (bkgId: string) => {
    setCheckoutBkgId(bkgId);
    setModalType('checkout-details');
  };

  const finishCheckout = async (bkgId: string, company?: string, gst?: string) => {
    const timestamp = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
    const newInvoiceNumber = hotelSettings.currentInvoiceNumber;

    // Find all bookings in this folio
    const bkg = globalBookings.find(b => b.id === bkgId);
    if (!bkg) return;
    
    const folioId = bkg.folioId || `${bkg.guestName}|${bkg.mobile}`;
    const folioBkgs = globalBookings.filter(b => (b.folioId === folioId || `${b.guestName}|${b.mobile}` === folioId) && b.status === 'CHECKED_IN');

    // Cloud Mutation
    const { error: bError } = await supabase.from('bookings')
      .update({ 
        status: 'CHECKED_OUT', 
        actual_check_out_time: timestamp, 
        invoice_number: newInvoiceNumber,
        company_name: company,
        customer_gst: gst
      })
      .or(`folio_id.eq.${folioId},and(guest_name.eq.${bkg.guestName},mobile.eq.${bkg.mobile})`)
      .eq('status', 'CHECKED_IN')
      .eq('hotel_id', hotelId);

    if (bError) return setToast(`❌ Checkout Failed: ${bError.message}`);

    // Update Sequence
    if (!hotelId) return;
    await supabase.from('hotels').update({ current_invoice_number: newInvoiceNumber + 1 }).eq('id', hotelId);

    // Free up Rooms (Mark as CLEAN so they are immediately available)
    const roomNums = folioBkgs.map(f => f.roomNumber).filter(n => !!n);
    if (roomNums.length > 0) {
      await supabase.from('rooms').update({ status: 'CLEAN', current_guest: null }).in('number', roomNums).eq('hotel_id', hotelId);
    }

    // Local State
    setGlobalBookings(prev => prev.map(b => {
      const isInFolio = (b.folioId === folioId || `${b.guestName}|${b.mobile}` === folioId) && b.status === 'CHECKED_IN';
      if (isInFolio) {
        return { 
          ...b, 
          status: 'CHECKED_OUT', 
          actualCheckOutTime: timestamp, 
          invoiceNumber: newInvoiceNumber,
          companyName: company ?? b.companyName,
          customerGst: gst ?? b.customerGst
        };
      }
      return b;
    }));
    
    setHotelSettings(prev => ({ ...prev, currentInvoiceNumber: prev.currentInvoiceNumber + 1 }));

    folioBkgs.forEach(fb => {
      if (fb.roomNumber) {
        setGlobalRooms(prev => prev.map(r => r.number === fb.roomNumber ? { ...r, status: 'DIRTY', guest: undefined } : r));
      }
    });

    setToast(`✅ Folio for ${bkg.guestName} successfully checked out. Invoice #${hotelSettings.invoicePrefix}${newInvoiceNumber} generated.`);
    closeModals();
  };

  const [hotelId, setHotelId] = useState<string | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      // Get Current User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get or Create Hotel for THIS user
      let { data: hotel, error: hError } = await supabase.from('hotels').select('*').eq('owner_id', user.id).maybeSingle();
      let currentHotel = hotel;

      if (!currentHotel) {
        const { data: newHotel, error: cError } = await supabase.from('hotels').insert([{ 
          owner_id: user.id,
          name: user.user_metadata?.property_name || 'NEW WEAZY PROPERTY',
          location: 'Update your location in Settings',
          mobile: user.user_metadata?.mobile || user.phone || 'Update mobile',
          email: user.email
        }]).select().single();
        
        if (cError) {
          console.error("Hotel Creation Error:", cError);
          setToast(`❌ Database Error: ${cError.message}`);
          return;
        }
        currentHotel = newHotel;
      }

      if (currentHotel) {
        setHotelId(currentHotel.id);
        setHotelSettings({
          name: currentHotel.name,
          location: currentHotel.location,
          mobile: currentHotel.mobile,
          email: currentHotel.email,
          website: currentHotel.website || '',
          currency: currentHotel.currency || '₹',
          checkInTime: currentHotel.check_in_time || '12:00 PM',
          checkOutTime: currentHotel.check_out_time || '11:00 AM',
          taxNumber: currentHotel.tax_number || '',
          gstPercent: Number(currentHotel.gst_percent) || 18,
          gstIncluded: currentHotel.gst_included || false,
          invoicePrefix: currentHotel.invoice_prefix || 'INV-',
          currentInvoiceNumber: currentHotel.current_invoice_number || 1001,
          bookingPrefix: currentHotel.booking_prefix || 'BKG-',
          currentBookingNumber: currentHotel.current_booking_number || 1001,
          managerName: currentHotel.manager_name || '',
          managerTitle: currentHotel.manager_title || 'Property Manager',
          adminPassword: currentHotel.admin_password || '',
          wifiId: currentHotel.wifi_id || '',
          wifiPassword: currentHotel.wifi_password || ''
        });

        // 2. Fetch Categories
        const { data: cats } = await supabase.from('room_categories').select('*').eq('hotel_id', currentHotel.id);
        if (cats) {
          setRoomCategories(cats.map(c => ({
            name: c.name,
            totalRooms: c.total_rooms,
            prices: { 'Base Rate': Number(c.base_rate) }
          })));
        }

        // 3. Fetch Rooms
        const { data: rms } = await supabase.from('rooms').select('*').eq('hotel_id', currentHotel.id);
        if (rms) {
          setGlobalRooms(rms.map(r => ({
            id: r.id,
            number: r.number,
            type: r.room_type || '', // Use the new column name 'room_type'
            status: r.status as any,
            guest: r.current_guest || undefined,
            floor: 1
          })));
        }

        // 4. Fetch Bookings
        const { data: bkgs } = await supabase.from('bookings').select('*').eq('hotel_id', currentHotel.id);
        if (bkgs) {
          setGlobalBookings(bkgs.map(b => ({
            id: b.custom_id,
            guestName: b.guest_name,
            mobile: b.mobile,
            dates: `${b.check_in_date} - ${b.check_out_date}`,
            checkInDate: b.check_in_date,
            checkOutDate: b.check_out_date,
            actualCheckInTime: b.actual_check_in_time || undefined,
            actualCheckOutTime: b.actual_check_out_time || undefined,
            roomType: b.room_type || '',
            roomNumber: b.room_number || '',
            amount: Number(b.amount),
            amountPaid: Number(b.amount_paid),
            status: b.status,
            invoiceNumber: b.invoice_number || undefined,
            companyName: b.company_name || undefined,
            customerGst: b.customer_gst || undefined,
            folioId: b.folio_id || undefined,
            idProof: b.id_proof || undefined,
            address: b.address || undefined,
            purpose: b.purpose || undefined
          })));
        }

        // 5. Fetch Inventory & Expenses
        const { data: inv } = await supabase.from('inventory').select('*').eq('hotel_id', currentHotel.id);
        if (inv) setGlobalInventory(inv.map(i => ({ ...i, category: i.category as any })));

        const { data: exps } = await supabase.from('expenses').select('*').eq('hotel_id', currentHotel.id);
        if (exps) setGlobalExpenses(exps.map(e => ({ id: e.id, date: e.date, type: e.type, amount: Number(e.amount), notes: e.notes || '' })));
      }

      setIsLoaded(true);
    };

    fetchInitialData();
  }, []);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (isAuthLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '14px', fontWeight: 600 }}>Initializing Weazy Cloud...</p>
      </div>
      <style jsx>{` @keyframes spin { to { transform: rotate(360deg); } } `}</style>
    </div>
  );

  if (!session) return <Auth onLogin={() => window.location.reload()} />;

  return (
    <div className="app-layout">
      <Sidebar 
        activeView={activeView} 
        onNavigate={setActiveView} 
        onOpenModal={setModalType} 
        hotelName={hotelSettings.name} 
        managerName={hotelSettings.managerName}
        managerTitle={hotelSettings.managerTitle}
        onLogout={async () => {
          await supabase.auth.signOut();
          window.location.reload();
        }}
      />
      
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Topbar onOpenModal={setModalType} hotelName={hotelSettings.name} />
        
        <main className="main-content">
          {activeView === 'dashboard' && (
            <div className="animate-fade-in">
              <StatsGrid rooms={globalRooms} bookings={globalBookings} />
              <TapeChart rooms={globalRooms} bookings={globalBookings} />
              <div className="layout-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  <ArrivalsTable bookings={globalBookings} />
                  <RoomMatrix 
                    rooms={globalRooms} 
                    onUpdateRooms={async (updatedRooms) => {
                      // Find which room changed
                      const changedRoom = updatedRooms.find((r, i) => r.status !== globalRooms[i]?.status);
                      if (changedRoom) {
                        const { error } = await supabase.from('rooms')
                          .update({ status: changedRoom.status })
                          .eq('id', changedRoom.id);
                        
                        if (error) {
                          setToast(`❌ Failed to update room: ${error.message}`);
                          return;
                        }
                      }
                      setGlobalRooms(updatedRooms);
                    }} 
                    adminPassword={hotelSettings.adminPassword} 
                  />
                </div>
                <div>
                  <ActivityFeed bookings={globalBookings} rooms={globalRooms} />
                </div>
              </div>
            </div>
          )}

          {activeView === 'tape-chart' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-main)' }}>Calendar & Availability</h2>
                <div style={{ display: 'flex', gap: 12, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <button className={`btn ${chartTab === 'availability' ? 'primary' : ''}`} onClick={() => setChartTab('availability')} style={{ border: 'none', background: chartTab === 'availability' ? 'var(--accent-primary)' : 'transparent' }}>📅 Availability Matrix</button>
                  <button className={`btn ${chartTab === 'tape' ? 'primary' : ''}`} onClick={() => setChartTab('tape')} style={{ border: 'none', background: chartTab === 'tape' ? 'var(--accent-primary)' : 'transparent' }}>▦ Tape Chart</button>
                </div>
              </div>
              
              {chartTab === 'availability' && <AvailabilityCalendar categories={roomCategories} rooms={globalRooms} bookings={globalBookings} />}
              {chartTab === 'tape' && <TapeChart rooms={globalRooms} bookings={globalBookings} />}
            </div>
          )}

          {activeView === 'housekeeping' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <StatsGrid />
              <RoomMatrix rooms={globalRooms} onUpdateRooms={setGlobalRooms} adminPassword={hotelSettings.adminPassword} />
            </div>
          )}

          {activeView === 'guests' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {!selectedGuestHistory ? (() => {
                // Compute Guest Database
                const guestMap: Record<string, {
                  mobile: string;
                  name: string;
                  totalVisits: number;
                  totalSpend: number;
                  firstVisit: string;
                  lastVisit: string;
                }> = {};

                globalBookings.forEach(b => {
                  if (b.status !== 'CHECKED_OUT') return;
                  if (!b.mobile) return; // Skip if no mobile attached
                  
                  const cIn = new Date(b.checkInDate).getTime();
                  const cOut = new Date(b.checkOutDate).getTime();
                  
                  if (!guestMap[b.mobile]) {
                    guestMap[b.mobile] = {
                      mobile: b.mobile,
                      name: b.guestName,
                      totalVisits: 1,
                      totalSpend: b.amount,
                      firstVisit: b.checkInDate,
                      lastVisit: b.checkOutDate
                    };
                  } else {
                    const g = guestMap[b.mobile];
                    g.totalVisits += 1;
                    g.totalSpend += b.amount;
                    if (cIn < new Date(g.firstVisit).getTime()) g.firstVisit = b.checkInDate;
                    if (cOut > new Date(g.lastVisit).getTime()) {
                      g.lastVisit = b.checkOutDate;
                      g.name = b.guestName; // Update to most recent name
                    }
                  }
                });

                const guests = Object.values(guestMap).sort((a, b) => b.totalVisits - a.totalVisits);
                const filteredGuests = guests.filter(g => {
                  const s = guestSearch.toLowerCase();
                  return g.name.toLowerCase().includes(s) || (g.mobile && g.mobile.includes(s));
                });

                return (
                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="card-title">Guest CRM & Profiles</span>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: 14 }}>🔍</span>
                        <input 
                          type="text" 
                          placeholder="Search Guest Name or Mobile..." 
                          value={guestSearch}
                          onChange={(e) => setGuestSearch(e.target.value)}
                          style={{ padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: 13, width: 260 }}
                        />
                      </div>
                    </div>
                    <div style={{ padding: '24px' }}>
                      {guests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No checked-out guest history found yet. Guest profiles are generated automatically after a guest completes their stay.
                        </div>
                      ) : filteredGuests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No guests found matching "<strong>{guestSearch}</strong>"
                        </div>
                      ) : (
                        <table className="modern-table">
                          <thead>
                            <tr>
                              <th>Guest Name</th>
                              <th>Mobile Number</th>
                              <th>Avg. Spend (₹)</th>
                              <th>Total Visits</th>
                              <th>First Visit</th>
                              <th>Last Visit</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGuests.map((g) => (
                              <tr key={g.mobile}>
                                <td style={{ fontWeight: 600 }}>{g.name}</td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{g.mobile}</td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>₹{Math.round(g.totalSpend / g.totalVisits)}</td>
                                <td>{g.totalVisits}</td>
                                <td>{new Date(g.firstVisit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td>{new Date(g.lastVisit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td>
                                  <button className="btn primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setSelectedGuestHistory(g.mobile)}>
                                    View History
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })() : (() => {
                const mobile = selectedGuestHistory;
                const history = globalBookings.filter(b => b.mobile === mobile && b.status === 'CHECKED_OUT').sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime());
                const guestName = history[0]?.guestName || 'Guest';

                return (
                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <button className="btn" style={{ padding: '6px 12px' }} onClick={() => setSelectedGuestHistory(null)}>← Back</button>
                      <div>
                        <span className="card-title">{guestName}'s Stay History</span>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>Mobile: {mobile}</div>
                      </div>
                    </div>
                    <div style={{ padding: '24px' }}>
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Booking ID</th>
                            <th>Dates</th>
                            <th>Room Info</th>
                            <th>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map(b => (
                            <tr key={b.id}>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{b.id}</td>
                              <td>
                                <div>{new Date(b.checkInDate).toLocaleDateString('en-IN')} - {new Date(b.checkOutDate).toLocaleDateString('en-IN')}</div>
                              </td>
                              <td>{b.roomType} (Room {b.roomNumber})</td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>₹{b.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeView === 'billing' && (
            <div className="animate-fade-in" style={{ display: 'flex', gap: '32px' }}>
              <div className="card" style={{ flex: 1, height: 'fit-content' }}>
                <div className="card-header">
                  <span className="card-title">In-House Guests (Folios)</span>
                </div>
                <div style={{ padding: '16px' }}>
                   {(() => {
                    const folios: Record<string, BookingData[]> = {};
                    globalBookings.forEach(b => {
                      if (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') {
                        const key = b.folioId || `${b.guestName}|${b.mobile}`;
                        if (!folios[key]) folios[key] = [];
                        folios[key].push(b);
                      }
                    });

                    return Object.entries(folios).map(([fId, guestBkgs]) => {
                      const base = guestBkgs[0];
                      const roomLabels = guestBkgs.map(b => b.roomNumber || b.roomType).join(', ');
                      return (
                        <div 
                          key={fId} 
                          onClick={() => setSelectedBillingBkg(fId)}
                          style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 8, cursor: 'pointer', background: selectedBillingBkg === fId ? 'var(--bg-elevated)' : 'transparent' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{base.guestName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Folio: {fId}</div>
                            </div>
                            <span style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{guestBkgs.length} Rooms</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Rooms: {roomLabels}</div>
                        </div>
                      );
                    });
                  })()}
                  {globalBookings.filter(b => b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT').length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No active folios found.</div>
                  )}
                </div>
              </div>

              <div style={{ flex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {selectedBillingBkg ? (() => {
                  const bkgs = globalBookings.filter(b => (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') && (b.folioId === selectedBillingBkg || `${b.guestName}|${b.mobile}` === selectedBillingBkg));
                  if (bkgs.length === 0) return null;
                  
                  const baseBkg = bkgs[0]; 
                  const gName = baseBkg.guestName;
                  const gMob = baseBkg.mobile;
                  const hasActiveCheckins = bkgs.some(b => b.status === 'CHECKED_IN');
                  const highestInvoiceNum = Math.max(...bkgs.map(b => b.invoiceNumber || 0));

                  let aggregateTotal = 0;
                  let aggregateBase = 0;
                  let aggregateTax = 0;

                  const lineItems = bkgs.map(bkg => {
                    const start = new Date(bkg.checkInDate).getTime();
                    const end = new Date(bkg.checkOutDate).getTime();
                    const nights = Math.max(1, Math.round((end - start) / 86400000));
                    
                    let baseAmount = bkg.amount;
                    let tax = 0;
                    let total = 0;
                    
                    if (hotelSettings.gstIncluded) {
                      total = bkg.amount;
                      baseAmount = total / (1 + (hotelSettings.gstPercent / 100));
                      tax = total - baseAmount;
                    } else {
                      baseAmount = bkg.amount;
                      tax = baseAmount * (hotelSettings.gstPercent / 100);
                      total = baseAmount + tax;
                    }

                    aggregateTotal += total;
                    aggregateBase += baseAmount;
                    aggregateTax += tax;

                    return { bkg, nights, baseAmount, tax, total };
                  });

                  return (
                    <>
                      <div className="print-hide" style={{ width: '210mm', display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 16 }}>
                         {(() => {
                          const baseCheckIn = new Date(baseBkg.checkInDate).getTime();
                          const rangeMs = 5 * 24 * 60 * 60 * 1000;

                          const otherActiveBkgs = globalBookings.filter(b => {
                            if (b.status !== 'CHECKED_IN' && b.status !== 'CHECKED_OUT') return false;
                            if (bkgs.some(existing => existing.id === b.id)) return false;
                            
                            const bCheckIn = new Date(b.checkInDate).getTime();
                            const isSameMobile = b.mobile === gMob;
                            const isWithinRange = Math.abs(bCheckIn - baseCheckIn) <= rangeMs;
                            
                            return isSameMobile && isWithinRange;
                          });
                          if (otherActiveBkgs.length === 0) return null;
                          return (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>Link Room:</span>
                              <select id="merge-bkg-select" style={{ padding: '6px', borderRadius: 6, fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}>
                                {otherActiveBkgs.map(b => (
                                  <option key={b.id} value={b.id}>Room {b.roomNumber || b.roomType} ({b.guestName})</option>
                                ))}
                              </select>
                              <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                                const bId = (document.getElementById('merge-bkg-select') as HTMLSelectElement).value;
                                setGlobalBookings(prev => prev.map(b => b.id === bId ? { ...b, folioId: selectedBillingBkg } : b));
                                setToast('🔗 Room merged into folio successfully!');
                              }}>Add</button>
                            </div>
                          );
                        })()}
                        {hasActiveCheckins && (
                          <button 
                            className="btn" 
                            style={{ background: 'var(--status-ooo-bg)', color: 'var(--status-ooo-fg)', borderColor: 'transparent' }} 
                            onClick={() => {
                              handleCheckout(baseBkg.id);
                            }}
                          >
                            🚪 Check-out Guest ({bkgs.filter(b => b.status === 'CHECKED_IN').length} Rooms)
                          </button>
                        )}
                        <button className="btn primary" onClick={() => window.print()}>🖨️ Print / Download PDF</button>
                      </div>
                      
                      <div className="a4-preview print-container">
                        <div style={{ borderBottom: '2px solid #eee', paddingBottom: 24, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h1 style={{ margin: 0, fontSize: 28, color: '#111', fontFamily: 'Inter, sans-serif', letterSpacing: '-1px' }}>{hotelSettings.name.toUpperCase()}</h1>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                              {hotelSettings.location}<br/>
                              {hotelSettings.email} | Ph: {hotelSettings.mobile}
                              {hotelSettings.taxNumber && <><br/><strong>GSTIN: {hotelSettings.taxNumber}</strong></>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <h2 style={{ margin: 0, fontSize: 24, color: '#111', fontFamily: 'Inter, sans-serif' }}>INVOICE</h2>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>Date: {new Date().toLocaleDateString('en-IN')}<br/>Invoice #: {highestInvoiceNum > 0 ? `${hotelSettings.invoicePrefix}${highestInvoiceNum}` : `DRAFT-${baseBkg.id.split('-')[1]}`}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '1px' }}>Bill To</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{gName}</div>
                            {baseBkg.companyName && <div style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>{baseBkg.companyName}</div>}
                            {baseBkg.customerGst && <div style={{ fontSize: 14, color: '#444' }}>GSTIN: {baseBkg.customerGst}</div>}
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>Master Ref: {baseBkg.id}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '1px' }}>Stay Summary</div>
                            <div style={{ fontSize: 14, color: '#444' }}>Total Rooms: {bkgs.length}</div>
                            <div style={{ fontSize: 14, color: '#444' }}>Check-in: {new Date(baseBkg.checkInDate).toLocaleDateString('en-IN')}</div>
                            <div style={{ fontSize: 14, color: '#444' }}>Check-out: {new Date(baseBkg.checkOutDate).toLocaleDateString('en-IN')}</div>
                          </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #111' }}>
                              <th style={{ textAlign: 'left', padding: '12px 0', fontSize: 14, color: '#111', fontWeight: 600 }}>Description</th>
                              <th style={{ textAlign: 'center', padding: '12px 0', fontSize: 14, color: '#111', fontWeight: 600 }}>Qty</th>
                              <th style={{ textAlign: 'right', padding: '12px 0', fontSize: 14, color: '#111', fontWeight: 600 }}>Rate (₹)</th>
                              <th style={{ textAlign: 'right', padding: '12px 0', fontSize: 14, color: '#111', fontWeight: 600 }}>Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '16px 0', fontSize: 14, color: '#333' }}>
                                  Room {item.bkg.roomNumber} - {item.bkg.roomType}
                                </td>
                                <td style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, color: '#333' }}>{item.nights} Nights</td>
                                <td style={{ textAlign: 'right', padding: '16px 0', fontSize: 14, color: '#333' }}>{(item.baseAmount / item.nights).toFixed(2)}</td>
                                <td style={{ textAlign: 'right', padding: '16px 0', fontSize: 14, color: '#333' }}>{item.baseAmount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <div style={{ width: 300 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#444' }}>
                              <span>Subtotal</span>
                              <span>₹{aggregateBase.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#444' }}>
                              <span>CGST ({hotelSettings.gstPercent / 2}%)</span>
                              <span>₹{(aggregateTax / 2).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#444' }}>
                              <span>SGST ({hotelSettings.gstPercent / 2}%)</span>
                              <span>₹{(aggregateTax / 2).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '2px solid #111', fontSize: 18, fontWeight: 700, color: '#111' }}>
                              <span>Total Amount</span>
                              <span>₹{aggregateTotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: 'var(--status-clean-fg)' }}>
                              <span>Amount Paid</span>
                              <span>₹{(bkgs.reduce((sum, b) => sum + (b.amountPaid || 0), 0)).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: aggregateTotal - bkgs.reduce((sum, b) => sum + (b.amountPaid || 0), 0) > 0 ? 'var(--status-ooo-fg)' : 'var(--status-clean-fg)' }}>
                              <span>Balance Due</span>
                              <span>₹{(aggregateTotal - bkgs.reduce((sum, b) => sum + (b.amountPaid || 0), 0)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="print-hide" style={{ marginTop: 32, padding: 24, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                          <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Record Payment</h3>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Amount to Pay (₹)</div>
                              <input type="number" id="pay-amount" placeholder="Enter amount" defaultValue={(aggregateTotal - bkgs.reduce((sum, b) => sum + (b.amountPaid || 0), 0)).toFixed(2)} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                            </div>
                            <button className="btn primary" style={{ height: 42 }} onClick={() => {
                              const payAmt = parseFloat((document.getElementById('pay-amount') as HTMLInputElement)?.value || '0');
                              if (payAmt <= 0) return setToast('❌ Please enter a valid payment amount.');
                              
                              let remainingPay = payAmt;
                              const updatedBookings = globalBookings.map(b => {
                                const isInThisFolio = (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') && (b.folioId === selectedBillingBkg || `${b.guestName}|${b.mobile}` === selectedBillingBkg);
                                if (isInThisFolio && remainingPay > 0) {
                                  const totalForThisRoom = hotelSettings.gstIncluded ? b.amount : b.amount * (1 + (hotelSettings.gstPercent / 100));
                                  const currentPaid = b.amountPaid || 0;
                                  const dueForThisRoom = totalForThisRoom - currentPaid;
                                  
                                  const paymentForThisRoom = Math.min(remainingPay, dueForThisRoom);
                                  remainingPay -= paymentForThisRoom;
                                  
                                  const newPaid = currentPaid + paymentForThisRoom;
                                  const newStatus = newPaid >= totalForThisRoom ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');
                                  
                                  return { ...b, amountPaid: newPaid, paymentStatus: newStatus as any };
                                }
                                return b;
                              });
                              
                              setGlobalBookings(updatedBookings);
                              setToast(`✅ Recorded payment of ₹${payAmt}. Remaining balance: ₹${(aggregateTotal - bkgs.reduce((sum, b) => sum + (b.amountPaid || 0), 0) - payAmt).toFixed(2)}`);
                            }}>Confirm Payment</button>
                          </div>
                        </div>

                        <div style={{ marginTop: 80, borderTop: '1px solid #eee', paddingTop: 24, fontSize: 12, color: '#888', textAlign: 'center' }}>
                          This is a computer generated invoice and does not require a physical signature.<br/>
                          Thank you for staying with {hotelSettings.name}!
                        </div>
                      </div>
                    </>
                  );
                })() : (
                  <div className="card" style={{ width: '100%' }}>
                    <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Select an in-house guest from the list to view and print their invoice.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'bookings' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">Saved Bookings</span>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: 14 }}>🔍</span>
                    <input 
                      type="text" 
                      placeholder="Search Name, ID or Mobile..." 
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      style={{ padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: 13, width: 260 }}
                    />
                  </div>
                </div>
                <div style={{ padding: '24px' }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>S.No.</th>
                        <th>Booking ID</th>
                        <th>Guest</th>
                        <th>Dates</th>
                        <th>Room Type & Number</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...globalBookings].filter(b => {
                        const s = bookingSearch.toLowerCase();
                        return b.guestName.toLowerCase().includes(s) || 
                               b.id.toLowerCase().includes(s) || 
                               (b.mobile && b.mobile.includes(s));
                      }).reverse().map((b, idx) => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', color: 'var(--accent-primary)', textDecoration: 'underline' }} onClick={() => { setSelectedDetailBkg(b.id); setModalType('booking-detail'); }}>{b.id}</td>
                          <td style={{ fontWeight: 600 }}>{b.guestName}</td>
                          <td>
                            <div>{b.dates}</div>
                            {b.actualCheckInTime && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>In: {b.actualCheckInTime}</div>}
                            {b.actualCheckOutTime && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Out: {b.actualCheckOutTime}</div>}
                          </td>
                          <td>
                            {b.roomType}
                            {b.roomNumber && <span style={{ marginLeft: 8, padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 11 }}>#{b.roomNumber}</span>}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>₹{b.amount}</td>
                          <td>
                            <span className={`status-pill status-${b.status === 'CONFIRMED' ? 'CLEAN' : b.status === 'CHECKED_IN' ? 'INSPECTED' : 'DIRTY'}`}>{b.status}</span>
                            {b.status === 'CONFIRMED' && (
                              <>
                                <button 
                                  onClick={() => { setCheckinBkgId(b.id); setModalType('checkin'); }} 
                                  style={{ marginLeft: 12, padding: '4px 8px', fontSize: 11, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Check In
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (!window.confirm(`Delete booking ${b.id} for ${b.guestName}? This cannot be undone.`)) return;
                                    const { error } = await supabase.from('bookings').delete().eq('custom_id', b.id).eq('hotel_id', hotelId);
                                    if (error) return setToast(`❌ Delete Failed: ${error.message}`);
                                    setGlobalBookings(prev => prev.filter(bk => bk.id !== b.id));
                                    setToast(`🗑️ Booking ${b.id} deleted permanently.`);
                                  }}
                                  style={{ marginLeft: 6, padding: '4px 8px', fontSize: 11, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {b.status === 'CHECKED_IN' && (
                              <button 
                                onClick={() => handleCheckout(b.id)} 
                                style={{ marginLeft: 12, padding: '4px 8px', fontSize: 11, background: 'var(--status-ooo-bg)', color: 'var(--status-ooo-fg)', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Check Out
                              </button>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span className={`status-pill ${b.paymentStatus === 'PAID' ? 'status-CLEAN' : b.paymentStatus === 'PARTIAL' ? 'status-INSPECTED' : 'status-DIRTY'}`} style={{ fontSize: 10 }}>
                                {b.paymentStatus || 'UNPAID'}
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                Paid: ₹{b.amountPaid || 0}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'expenses' && (
            <div className="animate-fade-in print-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-main)' }}>Expense Management</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn" onClick={() => setModalType('add-expense-type')}>+ New Expense Type</button>
                  <button className="btn primary" onClick={() => setModalType('record-expense')}>💸 Record Expense</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header print-hide" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span className="card-title" style={{ flex: 1 }}>Expense Records</span>
                  <input type="date" value={expenseFilterStart} onChange={e => setExpenseFilterStart(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input type="date" value={expenseFilterEnd} onChange={e => setExpenseFilterEnd(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  <button className="btn" onClick={() => {
                    setExpenseFilterStart('');
                    setExpenseFilterEnd('');
                  }}>Clear</button>
                  <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 8px' }} />
                  <button className="btn" onClick={() => window.print()}>🖨️ Print</button>
                  <button className="btn primary" onClick={() => {
                    const headers = ['Date', 'Type', 'Amount (INR)', 'Notes'];
                    let filtered = globalExpenses;
                    if (expenseFilterStart) filtered = filtered.filter(e => new Date(e.date) >= new Date(expenseFilterStart));
                    if (expenseFilterEnd) filtered = filtered.filter(e => new Date(e.date) <= new Date(expenseFilterEnd));
                    const rows = filtered.map(e => [e.date, e.type, e.amount, `"${e.notes.replace(/"/g, '""')}"`].join(','));
                    const csv = [headers.join(','), ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `weazy_expenses_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>📥 Download CSV</button>
                </div>
                <div style={{ padding: 24 }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Expense Type</th>
                        <th>Explanation / Notes</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let filtered = [...globalExpenses];
                        if (expenseFilterStart) filtered = filtered.filter(e => new Date(e.date) >= new Date(expenseFilterStart));
                        if (expenseFilterEnd) filtered = filtered.filter(e => new Date(e.date) <= new Date(expenseFilterEnd));
                        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        
                        let totalAmount = 0;

                        const rows = filtered.map(e => {
                          totalAmount += e.amount;
                          return (
                            <tr key={e.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{new Date(e.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                              <td style={{ fontWeight: 600 }}>{e.type}</td>
                              <td>{e.notes}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--status-dirty-fg)' }}>-₹{e.amount.toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        });

                        return (
                          <>
                            {rows}
                            {filtered.length === 0 && (
                              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No expenses recorded in this date range.</td></tr>
                            )}
                            {filtered.length > 0 && (
                              <tr style={{ background: 'var(--bg-elevated)' }}>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Total Period Expenses</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--status-dirty-fg)' }}>-₹{totalAmount.toLocaleString('en-IN')}</td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'reports' && (
            <ReportsModule 
              bookings={globalBookings} 
              rooms={globalRooms} 
              settings={hotelSettings} 
              categories={roomCategories} 
            />
          )}

          {activeView === 'room-setup' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">Room Categories</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn primary" onClick={() => setModalType('add-category')}>+ Add Category</button>
                  </div>
                </div>
                <div style={{ padding: '24px' }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Category Name</th>
                        <th>Total Rooms Configured</th>
                        <th>Meal Plan Pricing (₹)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomCategories.map((cat, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{cat.name}</td>
                          <td>
                            <input 
                              type="number" 
                              min="1"
                              value={cat.totalRooms} 
                              onChange={(e) => {
                                const newTotal = parseInt(e.target.value) || 0;
                                setRoomCategories(prev => prev.map(c => c.name === cat.name ? { ...c, totalRooms: newTotal } : c));
                              }}
                              style={{ width: 80, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}
                            />
                          </td>
                          <td>
                            {Object.entries(cat.prices).map(([plan, price]) => (
                              <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', width: 140, marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{plan}:</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>₹{price}</span>
                              </div>
                            ))}
                          </td>
                          <td>
                            <button 
                              className="btn" 
                              style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', padding: '6px 12px', fontSize: 12 }}
                              onClick={async () => {
                                if (!window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) return;
                                const { error } = await supabase.from('room_categories').delete().eq('hotel_id', hotelId).eq('name', cat.name);
                                if (error) return setToast(`❌ Delete Failed: ${error.message}`);
                                setRoomCategories(prev => prev.filter(c => c.name !== cat.name));
                                setToast(`🗑️ Category '${cat.name}' deleted permanently.`);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">Individual Rooms</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn primary" onClick={() => setModalType('add-room')}>+ Add Room</button>
                  </div>
                </div>
                <div style={{ padding: '24px' }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Room Number</th>
                        <th>Category</th>
                        <th>Floor</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalRooms.map((room) => (
                        <tr key={room.id}>
                          <td style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{room.number}</td>
                          <td>{room.type}</td>
                          <td>{room.floor}</td>
                          <td><span className={`status-pill status-${room.status}`}>{room.status}</span></td>
                          <td>
                            <button 
                              className="btn" 
                              style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', padding: '6px 12px', fontSize: 12 }}
                              onClick={async () => {
                                if (!window.confirm(`Delete Room ${room.number}?`)) return;
                                const { error } = await supabase.from('rooms').delete().eq('hotel_id', hotelId).eq('number', room.number);
                                if (error) return setToast(`❌ Delete Failed: ${error.message}`);
                                setGlobalRooms(prev => prev.filter(r => r.id !== room.id));
                                setToast(`🗑️ Room ${room.number} deleted permanently.`);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'inventory' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-main)' }}>Stock & Inventory Management</h2>
                <div style={{ display: 'flex', gap: 12, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <button className={`btn ${invTab === 'items' ? 'primary' : ''}`} onClick={() => setInvTab('items')} style={{ border: 'none', background: invTab === 'items' ? 'var(--accent-primary)' : 'transparent' }}>📦 Items</button>
                  <button className={`btn ${invTab === 'vendors' ? 'primary' : ''}`} onClick={() => setInvTab('vendors')} style={{ border: 'none', background: invTab === 'vendors' ? 'var(--accent-primary)' : 'transparent' }}>🚚 Vendors</button>
                  <button className={`btn ${invTab === 'transactions' ? 'primary' : ''}`} onClick={() => setInvTab('transactions')} style={{ border: 'none', background: invTab === 'transactions' ? 'var(--accent-primary)' : 'transparent' }}>🔄 Transactions</button>
                </div>
              </div>

              {invTab === 'items' && (
                <div className="card animate-fade-in">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="card-title">Inventory Database</span>
                    <button className="btn primary" onClick={() => setModalType('add-inv-item')}>+ Add Item</button>
                  </div>
                  <div style={{ padding: 24 }}>
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>UOM</th>
                          <th style={{ textAlign: 'center' }}>Current Stock</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalInventory.map(i => (
                          <tr key={i.id}>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{i.sku}</td>
                            <td style={{ fontWeight: 600 }}>{i.name}</td>
                            <td>{i.category}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{i.uom}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{i.currentStock}</td>
                            <td>
                              {i.currentStock <= i.minStockLevel ? (
                                <span className="status-pill status-DIRTY">LOW STOCK (Par: {i.minStockLevel})</span>
                              ) : (
                                <span className="status-pill status-CLEAN">HEALTHY</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {globalInventory.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No inventory items added yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invTab === 'vendors' && (
                <div className="card animate-fade-in">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="card-title">Vendor Directory</span>
                    <button className="btn primary" onClick={() => setModalType('add-vendor')}>+ Add Vendor</button>
                  </div>
                  <div style={{ padding: 24 }}>
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Vendor Name</th>
                          <th>Contact Info</th>
                          <th>Tax ID / GSTIN</th>
                          <th>Lead Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalVendors.map(v => (
                          <tr key={v.id}>
                            <td style={{ fontWeight: 600 }}>{v.name}</td>
                            <td>{v.contactInfo}</td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{v.taxId}</td>
                            <td>{v.leadTimeDays} Days</td>
                          </tr>
                        ))}
                        {globalVendors.length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No vendors added yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invTab === 'transactions' && (
                <div className="card animate-fade-in">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="card-title">Stock Ledger</span>
                    <button className="btn primary" onClick={() => setModalType('record-inv-transaction')}>🔄 Record Transaction</button>
                  </div>
                  <div style={{ padding: 24 }}>
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Item</th>
                          <th>Type</th>
                          <th>Quantity</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalInvTransactions.map(t => {
                          const item = globalInventory.find(i => i.id === t.itemId);
                          return (
                            <tr key={t.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{t.date}</td>
                              <td style={{ fontWeight: 600 }}>{item?.name || t.itemId}</td>
                              <td>
                                <span className={`status-pill ${t.type === 'Stock In' ? 'status-CLEAN' : t.type === 'Stock Out' ? 'status-DIRTY' : 'status-INSPECTED'}`}>
                                  {t.type}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                                {t.type === 'Stock In' ? '+' : '-'}{t.quantity} {item?.uom}
                              </td>
                              <td style={{ color: 'var(--text-muted)' }}>{t.notes}</td>
                            </tr>
                          );
                        })}
                        {globalInvTransactions.length === 0 && (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No transactions recorded yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeView === 'settings' && (
            <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', height: 'calc(100vh - 180px)' }}>
              {/* Settings Internal Sidebar */}
              <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', paddingLeft: '12px', letterSpacing: '1px' }}>SETTINGS CATEGORIES</div>
                {[
                  { id: 'general', label: 'General Info', icon: '🏢' },
                  { id: 'operational', label: 'Operations', icon: '⏰' },
                  { id: 'financial', label: 'Financials', icon: '💰' },
                  { id: 'security', label: 'Security', icon: '🔒' }
                ].map(tab => (
                  <div
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id as any)}
                    style={{
                      padding: '14px 18px', borderRadius: '12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '14px',
                      background: settingsTab === tab.id ? 'var(--grad-primary)' : 'transparent',
                      color: settingsTab === tab.id ? 'white' : 'var(--text-main)',
                      fontWeight: 600, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: settingsTab === tab.id ? 'var(--shadow-glow)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                ))}
                
                <div style={{ marginTop: 'auto', padding: '16px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>SYSTEM STATUS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                    All Modules Active
                  </div>
                </div>
              </div>

              {/* Settings Content Area */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {settingsTab === 'general' && (
                  <div className="card animate-fade-in" style={{ border: 'none', background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))' }}>
                    <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '24px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>General Property Information</h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Manage your hotel identity and contact details.</p>
                    </div>
                    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div className="form-group">
                          <label className="form-label">Property Name</label>
                          <input type="text" id="set-name" defaultValue={hotelSettings.name} className="form-input" placeholder="e.g. Grand Meridian Resort" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Official Website</label>
                          <input type="text" id="set-web" defaultValue={hotelSettings.website} className="form-input" placeholder="www.yourhotel.com" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Support Email</label>
                          <input type="email" id="set-email" defaultValue={hotelSettings.email} className="form-input" placeholder="help@hotel.com" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Contact Number</label>
                          <input type="text" id="set-mob" defaultValue={hotelSettings.mobile} className="form-input" placeholder="+91 00000 00000" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Complete Address</label>
                        <textarea id="set-loc" defaultValue={hotelSettings.location} className="form-input" style={{ height: '80px', resize: 'none' }} placeholder="Building, Street, City, State, ZIP"></textarea>
                      </div>

                      <div style={{ marginTop: 12, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-main)' }}>👤 Manager Profiles</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                          <div className="form-group">
                            <label className="form-label">Front Desk Manager Name</label>
                            <input type="text" id="set-manager-name" defaultValue={hotelSettings.managerName} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Professional Title</label>
                            <input type="text" id="set-manager-title" defaultValue={hotelSettings.managerTitle} className="form-input" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'operational' && (
                  <div className="card animate-fade-in">
                    <div className="card-header" style={{ padding: '24px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Operational Policies</h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Define stay timings and daily operation rules.</p>
                    </div>
                    <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌤️</div>
                        <label className="form-label">Check-in Time</label>
                        <input type="text" id="set-in-time" defaultValue={hotelSettings.checkInTime} className="form-input" style={{ fontSize: '18px', fontWeight: 600 }} />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Standard time guests can access rooms.</p>
                      </div>
                      <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌙</div>
                        <label className="form-label">Check-out Time</label>
                        <input type="text" id="set-out-time" defaultValue={hotelSettings.checkOutTime} className="form-input" style={{ fontSize: '18px', fontWeight: 600 }} />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Standard time for room vacations.</p>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'financial' && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card">
                      <div className="card-header" style={{ padding: '24px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Currency & Tax Configuration</h2>
                      </div>
                      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div className="form-group">
                          <label className="form-label">System Currency</label>
                          <input type="text" id="set-curr" defaultValue={hotelSettings.currency} className="form-input" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">GSTIN / Tax ID</label>
                          <input type="text" id="set-tax-num" defaultValue={hotelSettings.taxNumber} className="form-input" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">WiFi Network Name (SSID)</label>
                          <input type="text" id="set-wifi-id" defaultValue={hotelSettings.wifiId} className="form-input" placeholder="e.g. Weazy_Guest_WiFi" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">WiFi Password</label>
                          <input type="text" id="set-wifi-pwd" defaultValue={hotelSettings.wifiPassword} className="form-input" placeholder="••••••••" />
                        </div>
                        <div style={{ gridColumn: 'span 2', padding: '20px', borderRadius: '16px', border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <input type="checkbox" id="set-inc" defaultChecked={hotelSettings.gstIncluded} style={{ width: '20px', height: '20px', accentColor: 'var(--grad-primary)' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>Inclusive GST Pricing</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enable this if your room rates already include tax.</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600 }}>Rate:</span>
                            <input type="number" id="set-gst" defaultValue={hotelSettings.gstPercent} style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} />
                            <span style={{ fontWeight: 600 }}>%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header" style={{ padding: '24px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Numbering Series</h2>
                      </div>
                      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '16px' }}>
                          <div style={{ fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>📄 Invoice Prefix & Start</div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" id="set-inv-pre" defaultValue={hotelSettings.invoicePrefix} className="form-input" style={{ width: '80px' }} />
                            <input type="number" id="set-inv-num" defaultValue={hotelSettings.currentInvoiceNumber} className="form-input" />
                          </div>
                        </div>
                        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '16px' }}>
                          <div style={{ fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>🎫 Booking Prefix & Start</div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" id="set-bkg-pre" defaultValue={hotelSettings.bookingPrefix} className="form-input" style={{ width: '80px' }} />
                            <input type="number" id="set-bkg-num" defaultValue={hotelSettings.currentBookingNumber} className="form-input" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'security' && (
                  <div className="card animate-fade-in" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div className="card-header" style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>Security & Access Control</h2>
                    </div>
                    
                    <div className="card">
                      <div className="card-header" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Guest Self-Service Portal</h2>
                        <span className="status-pill status-INSPECTED">Live Features</span>
                      </div>
                      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                        {!hotelId ? (
                          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                            <div style={{ fontWeight: 600 }}>Initializing your property data...</div>
                            <div style={{ fontSize: '12px', marginTop: '8px' }}>This may take a few seconds on first load.</div>
                          </div>
                        ) : (
                          <>
                            <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: '24px', textAlign: 'center' }}>
                              <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px' }}>📱 Guest Reservation QR</div>
                              <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', boxShadow: 'var(--shadow-sm)', marginBottom: '16px' }}>
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://${typeof window !== 'undefined' ? window.location.host : 'pms-psi-one.vercel.app'}/guest?hotelId=${hotelId}&type=reservation`)}`} 
                                  alt="Reservation QR" 
                                  style={{ width: '150px', height: '150px' }}
                                  onLoad={() => console.log('QR Loaded')}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const p = (e.target as HTMLElement).parentElement;
                                    if(p) p.innerHTML = '<div style="font-size:11px;padding:20px;color:red">Image Blocked.<br/>Link Ready below.</div>';
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginBottom: '12px', wordBreak: 'break-all', opacity: 0.7 }}>
                                {`https://${typeof window !== 'undefined' ? window.location.host : ''}/guest?hotelId=${hotelId}&type=reservation`}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Guests can scan this to make a <strong>fast reservation</strong>.
                              </div>
                              <button className="btn" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }} onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(`https://${window.location.host}/guest?hotelId=${hotelId}&type=reservation`)}`)}>Download QR</button>
                            </div>

                            <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: '24px', textAlign: 'center' }}>
                              <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px' }}>🔑 Guest Self Check-in QR</div>
                              <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', boxShadow: 'var(--shadow-sm)', marginBottom: '16px' }}>
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://${typeof window !== 'undefined' ? window.location.host : 'pms-psi-one.vercel.app'}/guest?hotelId=${hotelId}&type=checkin`)}`} 
                                  alt="Check-in QR" 
                                  style={{ width: '150px', height: '150px' }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const p = (e.target as HTMLElement).parentElement;
                                    if(p) p.innerHTML = '<div style="font-size:11px;padding:20px;color:red">Image Blocked.<br/>Link Ready below.</div>';
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginBottom: '12px', wordBreak: 'break-all', opacity: 0.7 }}>
                                {`https://${typeof window !== 'undefined' ? window.location.host : ''}/guest?hotelId=${hotelId}&type=checkin`}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                For guests with existing bookings to <strong>self check-in</strong>.
                              </div>
                              <button className="btn" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }} onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(`https://${window.location.host}/guest?hotelId=${hotelId}&type=checkin`)}`)}>Download QR</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '32px' }}>
                      <div className="form-group" style={{ maxWidth: '400px' }}>
                        <label className="form-label">Master Admin Password</label>
                        <input type="text" id="set-pwd" defaultValue={hotelSettings.adminPassword} className="form-input" placeholder="Enter Master Password" />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>Required for sensitive operations like Night Audit or editing room categories.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fixed Action Bar at Bottom of Content */}
                <div style={{ 
                  marginTop: 'auto', padding: '24px', borderTop: '1px solid var(--border-subtle)', 
                  display: 'flex', justifyContent: 'flex-end', gap: '16px', background: 'var(--bg-surface)',
                  position: 'sticky', bottom: 0, zIndex: 10
                }}>
                  <button className="btn" style={{ padding: '12px 24px' }} onClick={() => setActiveView('dashboard')}>Discard Changes</button>
                  <button className="btn primary" style={{ padding: '12px 40px', fontWeight: 700 }} onClick={async () => {
                    const name = (document.getElementById('set-name') as HTMLInputElement)?.value || hotelSettings.name;
                    const web = (document.getElementById('set-web') as HTMLInputElement)?.value || hotelSettings.website;
                    const email = (document.getElementById('set-email') as HTMLInputElement)?.value || hotelSettings.email;
                    const mob = (document.getElementById('set-mob') as HTMLInputElement)?.value || hotelSettings.mobile;
                    const loc = (document.getElementById('set-loc') as HTMLTextAreaElement)?.value || hotelSettings.location;
                    const inTime = (document.getElementById('set-in-time') as HTMLInputElement)?.value || hotelSettings.checkInTime;
                    const outTime = (document.getElementById('set-out-time') as HTMLInputElement)?.value || hotelSettings.checkOutTime;
                    const curr = (document.getElementById('set-curr') as HTMLInputElement)?.value || hotelSettings.currency;
                    const taxNum = (document.getElementById('set-tax-num') as HTMLInputElement)?.value || hotelSettings.taxNumber;
                    const invPre = (document.getElementById('set-inv-pre') as HTMLInputElement)?.value || hotelSettings.invoicePrefix;
                    const invNum = parseInt((document.getElementById('set-inv-num') as HTMLInputElement)?.value || String(hotelSettings.currentInvoiceNumber));
                    const bkgPre = (document.getElementById('set-bkg-pre') as HTMLInputElement)?.value || hotelSettings.bookingPrefix;
                    const bkgNum = parseInt((document.getElementById('set-bkg-num') as HTMLInputElement)?.value || String(hotelSettings.currentBookingNumber));
                    const wId = (document.getElementById('set-wifi-id') as HTMLInputElement)?.value || hotelSettings.wifiId;
                    const wPwd = (document.getElementById('set-wifi-pwd') as HTMLInputElement)?.value || hotelSettings.wifiPassword;
                    const gst = parseInt((document.getElementById('set-gst') as HTMLInputElement)?.value || String(hotelSettings.gstPercent));
                    const inc = (document.getElementById('set-inc') as HTMLInputElement)?.checked;
                    const pwd = (document.getElementById('set-pwd') as HTMLInputElement)?.value || hotelSettings.adminPassword;
                    const mName = (document.getElementById('set-manager-name') as HTMLInputElement)?.value || hotelSettings.managerName;
                    const mTitle = (document.getElementById('set-manager-title') as HTMLInputElement)?.value || hotelSettings.managerTitle;

                    if (!hotelId) return setToast('❌ Error: No property loaded. Please refresh.');

                    // Supabase Update
                    const { error } = await supabase.from('hotels').update({
                      name, website: web, email, mobile: mob, location: loc,
                      check_in_time: inTime, check_out_time: outTime,
                      currency: curr, tax_number: taxNum, 
                      invoice_prefix: invPre, current_invoice_number: invNum,
                      booking_prefix: bkgPre, current_booking_number: bkgNum,
                      wifi_id: wId, wifi_password: wPwd,
                      admin_password: pwd,
                      gst_percent: gst, gst_included: inc,
                      manager_name: mName, manager_title: mTitle
                    }).eq('id', hotelId);

                    if (error) return setToast(`❌ Settings Save Failed: ${error.message}`);

                    setHotelSettings({
                      name, location: loc, mobile: mob, email, website: web,
                      currency: curr, checkInTime: inTime, checkOutTime: outTime,
                      taxNumber: taxNum, gstPercent: gst, gstIncluded: inc,
                      invoicePrefix: invPre, currentInvoiceNumber: invNum,
                      bookingPrefix: bkgPre, currentBookingNumber: bkgNum,
                      wifiId: wId, wifiPassword: wPwd,
                      managerName: mName, managerTitle: mTitle,
                      adminPassword: pwd
                    });
                    setToast('✨ Configuration updated successfully in the cloud!');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>Update Property Settings</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {modalType && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-slide-up" style={{ width: modalType === 'booking-detail' ? 560 : 400, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="card-header">
              <span className="card-title">
                {modalType === 'reservation' && 'New Reservation'}
                {modalType === 'checkin' && 'Quick Check-in'}
                {modalType === 'audit' && 'Night Audit'}
                {modalType === 'pos' && 'POS Integration'}
                {modalType === 'add-category' && 'Add Room Category'}
                {modalType === 'add-room' && 'Add Individual Room'}
                {modalType === 'add-expense-type' && 'New Expense Type'}
                {modalType === 'record-expense' && 'Record Expense'}
                {modalType === 'add-inv-item' && 'New Inventory Item'}
                {modalType === 'add-vendor' && 'New Vendor'}
                {modalType === 'record-inv-transaction' && 'Record Stock Transaction'}
                {modalType === 'booking-detail' && 'Booking Details'}
              </span>
              <button 
                onClick={() => { closeModals(); setCheckinBkgId(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {modalType === 'add-room' && (
                <>
                  <input type="text" id="room-number" placeholder="Room Number (e.g. 101)" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  <input type="number" id="room-floor" placeholder="Floor (e.g. 1)" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  
                  <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>Room Category</div>
                  <select id="room-category" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                    {roomCategories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const num = (document.getElementById('room-number') as HTMLInputElement)?.value;
                    const floor = parseInt((document.getElementById('room-floor') as HTMLInputElement)?.value || '1');
                    const cat = (document.getElementById('room-category') as HTMLSelectElement)?.value;

                    if (!num) return setToast('❌ Room number is required.');

                    const categoryData = roomCategories.find(c => c.name === cat);
                    if (categoryData) {
                      const currentRoomCount = globalRooms.filter(r => r.type === cat).length;
                      if (currentRoomCount >= categoryData.totalRooms) {
                        return setToast(`❌ Cannot add room! The ${cat} category is limited to ${categoryData.totalRooms} total rooms. You must increase the category limit first.`);
                      }
                    }

                    if (globalRooms.find(r => r.number === num)) {
                      return setToast(`❌ Room ${num} already exists in the system.`);
                    }

                    // Supabase Insert
                    const { error } = await supabase.from('rooms').insert({
                      hotel_id: hotelId,
                      number: num,
                      room_type: cat, // Now properly saving the category!
                      status: 'CLEAN'
                    });

                    if (error) return setToast(`❌ Room Save Failed: ${error.message}`);

                    setGlobalRooms(prev => [
                      ...prev,
                      { id: `r-${Date.now()}`, number: num, type: cat, status: 'CLEAN', floor }
                    ]);
                    
                    setToast(`✅ Room ${num} added to ${cat}!`);
                    closeModals();
                  }}>Save Room</button>
                </>
              )}
              {modalType === 'add-category' && (
                <>
                  <input type="text" id="cat-name" placeholder="Category Name (e.g. Presidential Suite)" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  <input type="number" id="cat-rooms" min="1" placeholder="Number of Rooms" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  
                  <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>Meal Plan Pricing (₹)</div>
                  {['EP (Room Only)', 'CP (Breakfast)', 'MAP (Half Board)', 'AP (Full Board)'].map(plan => {
                    const code = plan.split(' ')[0];
                    return (
                      <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="checkbox" id={`cat-meal-${code}`} style={{ width: 16, height: 16 }} />
                        <label htmlFor={`cat-meal-${code}`} style={{ flex: 1, fontSize: 14 }}>{plan}</label>
                        <input type="number" id={`cat-price-${code}`} placeholder="Price" style={{ width: 100, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                      </div>
                    );
                  })}

                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const name = (document.getElementById('cat-name') as HTMLInputElement)?.value;
                    const roomsStr = (document.getElementById('cat-rooms') as HTMLInputElement)?.value;
                    const rooms = parseInt(roomsStr || '0');

                    if (!name) return setToast('❌ Category Name is required.');
                    if (rooms <= 0) return setToast('❌ Number of rooms must be greater than 0.');
                    
                    const prices: Record<string, number> = {};
                    ['EP', 'CP', 'MAP', 'AP'].forEach(code => {
                      const isChecked = (document.getElementById(`cat-meal-${code}`) as HTMLInputElement)?.checked;
                      const priceVal = parseInt((document.getElementById(`cat-price-${code}`) as HTMLInputElement)?.value || '0');
                      if (isChecked && priceVal > 0) {
                        prices[code] = priceVal;
                      }
                    });

                    if (Object.keys(prices).length === 0) {
                      setToast('❌ Please select at least one meal plan with a valid price.');
                      return;
                    }

                    // Supabase Insert
                    const { error } = await supabase.from('room_categories').insert({
                      hotel_id: hotelId,
                      name,
                      total_rooms: rooms,
                      base_rate: Object.values(prices)[0] // For now we use the first price as base
                    });

                    if (error) return setToast(`❌ Category Save Failed: ${error.message}`);

                    setRoomCategories(prev => [...prev, { name, totalRooms: rooms, prices }]);
                    setToast(`✅ Room Category '${name}' added successfully!`);
                    closeModals();
                  }}>Save Category</button>
                </>
              )}
              {modalType === 'reservation' && (
                <>
                  <input type="text" id="res-name" placeholder="Guest Full Name" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  <input type="text" id="res-mobile" placeholder="Mobile Number" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginTop: 8 }} />
                  
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <input type="text" id="res-company" placeholder="Company Name (Optional)" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    <input type="text" id="res-gst" placeholder="Customer GSTIN (Optional)" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Check-in</div>
                      <input type="date" value={resCheckIn} onChange={e => setResCheckIn(e.target.value)} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Check-out</div>
                      <input type="date" value={resCheckOut} onChange={e => setResCheckOut(e.target.value)} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>Rooms to Book</span>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setResRoomRows(prev => [...prev, Date.now() + Math.random()])}>+ Add Room</button>
                    </div>
                    
                    {resRoomRows.map((rowId, index) => (
                      <div key={rowId} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 2 }}>
                          {index === 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Room Category</div>}
                          <select 
                            id={`res-category-${rowId}`} 
                            value={resCategorySelections[rowId as number] || ''}
                            onChange={(e) => setResCategorySelections(prev => ({ ...prev, [rowId as number]: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}
                          >
                            <option value="">{resCheckIn && resCheckOut ? '-- Select Category --' : '-- Select Dates First --'}</option>
                            {getAvailableCategories().filter(c => c.available > 0).map(c => (
                              <option key={c.name} value={c.name}>{c.name} ({c.available} Left)</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          {index === 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Qty</div>}
                          <select id={`res-qty-${rowId}`} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                            {(() => {
                              const selectedCatName = resCategorySelections[rowId as number];
                              const cat = getAvailableCategories().find(c => c.name === selectedCatName);
                              const max = cat ? cat.available : 0;
                              if (max === 0) return <option value="0">0</option>;
                              const opts: React.ReactNode[] = [];
                              for (let i = 1; i <= max; i++) {
                                opts.push(<option key={i} value={i}>{i}</option>);
                              }
                              return opts;
                            })()}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          {index === 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Total Amt (₹)</div>}
                          <input type="number" id={`res-amount-${rowId}`} placeholder="Amount" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                        </div>
                        {resRoomRows.length > 1 && (
                          <button 
                            style={{ padding: '8px 12px', background: 'var(--status-ooo-bg)', color: 'var(--status-ooo-fg)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => setResRoomRows(prev => prev.filter(id => id !== rowId))}
                          >✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const name = (document.getElementById('res-name') as HTMLInputElement)?.value;
                    const mob = (document.getElementById('res-mobile') as HTMLInputElement)?.value;
                    const company = (document.getElementById('res-company') as HTMLInputElement)?.value || '';
                    const gst = (document.getElementById('res-gst') as HTMLInputElement)?.value || '';

                    if (!name) return setToast('❌ Guest Name is required.');
                    if (!mob) return setToast('❌ Mobile Number is required for profile tracking.');
                    if (!resCheckIn || !resCheckOut) return setToast('❌ Please select valid dates.');

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const selectedCheckIn = new Date(resCheckIn);
                    selectedCheckIn.setHours(0, 0, 0, 0);

                    if (selectedCheckIn < today) {
                      return setToast('❌ Cannot create reservation for a past date.');
                    }

                    const dbBookings: any[] = [];
                    let hasError = false;
                    let nextBookingNum = hotelSettings.currentBookingNumber;
                    const masterFolioId = `FOL-${Math.floor(Math.random() * 90000) + 10000}`;

                    resRoomRows.forEach(rowId => {
                      const rType = (document.getElementById(`res-category-${rowId}`) as HTMLSelectElement)?.value;
                      const qty = parseInt((document.getElementById(`res-qty-${rowId}`) as HTMLSelectElement)?.value || '1');
                      const amount = parseInt((document.getElementById(`res-amount-${rowId}`) as HTMLInputElement)?.value || '0');
                      
                      if (!rType) {
                        hasError = true;
                      } else {
                        const amountPerRoom = qty > 0 ? Math.round(amount / qty) : 0;
                        for (let i = 0; i < qty; i++) {
                          dbBookings.push({
                            hotel_id: hotelId,
                            custom_id: `${hotelSettings.bookingPrefix}${nextBookingNum++}`,
                            guest_name: name,
                            mobile: mob,
                            company_name: company,
                            customer_gst: gst,
                            check_in_date: resCheckIn,
                            check_out_date: resCheckOut,
                            room_type: rType,
                            room_number: '',
                            amount: amountPerRoom,
                            amount_paid: 0,
                            payment_status: 'UNPAID',
                            status: 'CONFIRMED',
                            folio_id: masterFolioId
                          });
                        }
                      }
                    });

                    if (hasError || dbBookings.length === 0) return setToast('❌ Please select a valid category for all rooms.');

                    // Safety Check: Availability
                    const grouped: Record<string, number> = {};
                    dbBookings.forEach(b => {
                      grouped[b.room_type] = (grouped[b.room_type] || 0) + 1;
                    });
                    
                    const availableCats = getAvailableCategories();
                    for (const [cName, reqCount] of Object.entries(grouped)) {
                      const avail = availableCats.find(c => c.name === cName)?.available || 0;
                      if (reqCount > avail) {
                        return setToast(`❌ Sorry, only ${avail} ${cName} rooms are available for these dates.`);
                      }
                    }

                    // Supabase Insert
                    const { error: bError } = await supabase.from('bookings').insert(dbBookings);
                    if (bError) return setToast(`❌ Cloud Save Failed: ${bError.message}`);

                    // Update Sequence
                    if (hotelId) {
                      await supabase.from('hotels').update({ current_booking_number: nextBookingNum }).eq('id', hotelId);
                    }

                    setGlobalBookings(prev => [...dbBookings.map(b => ({
                      id: b.custom_id,
                      guestName: b.guest_name,
                      mobile: b.mobile,
                      dates: `${b.check_in_date} - ${b.check_out_date}`,
                      checkInDate: b.check_in_date,
                      checkOutDate: b.check_out_date,
                      roomType: b.room_type,
                      roomNumber: b.room_number,
                      amount: b.amount,
                      amountPaid: b.amount_paid,
                      status: b.status,
                      folioId: b.folio_id,
                      companyName: b.company_name,
                      customerGst: b.customer_gst
                    })), ...prev]);

                    setHotelSettings(prev => ({ ...prev, currentBookingNumber: nextBookingNum }));
                    setToast(`✅ Confirmed ${dbBookings.length} rooms for ${name}`);
                    closeModals();
                    setResCheckIn('');
                    setResCheckOut('');
                    setResRoomRows([1]);
                  }}>Create Reservation</button>
                </>
              )}
              {modalType === 'checkin' && (() => {
                const checkinBkg = globalBookings.find(b => b.id === checkinBkgId);

                return (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Select Booking</div>
                  <select id="checkin-bkg" value={checkinBkgId} onChange={(e) => setCheckinBkgId(e.target.value)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                    <option value="">-- Select Confirmed Reservation --</option>
                    {globalBookings.filter(b => b.status === 'CONFIRMED').map(b => (
                      <option key={b.id} value={b.id}>{b.id} - {b.guestName} ({b.roomType})</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <input type="text" id="checkin-mobile" defaultValue={checkinBkg?.mobile || ''} placeholder="Mobile Number" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="text" id="checkin-idproof" placeholder="ID Proof (Aadhar/Passport)" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    </div>
                  </div>

                  <input type="text" id="checkin-address" placeholder="Residential Address" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginTop: 8 }} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <input type="text" id="checkin-purpose" placeholder="Purpose of Visit" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="number" id="checkin-advance" placeholder="Advance Payment (₹)" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    </div>
                  </div>

                  {/* Guest Companions Section */}
                  <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>👥 Guest Details</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Total Guests:</label>
                        <input type="number" id="checkin-total-guests" min="1" max="10" defaultValue="1" style={{ width: 60, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', textAlign: 'center' }}
                          onChange={(e) => {
                            const count = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                            const container = document.getElementById('guest-rows-container');
                            if (!container) return;
                            container.innerHTML = '';
                            for (let i = 0; i < count; i++) {
                              const row = document.createElement('div');
                              row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1.5fr 2fr;gap:8px;margin-bottom:8px;align-items:center;';
                              row.innerHTML = `
                                <input type="text" class="guest-name" placeholder="Guest ${i + 1} Name" style="padding:8px 10px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);font-size:12px" />
                                <select class="guest-gender" style="padding:8px 6px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);font-size:12px">
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                </select>
                                <select class="guest-id-type" style="padding:8px 6px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);font-size:12px">
                                  <option value="Aadhar">Aadhar</option>
                                  <option value="Passport">Passport</option>
                                  <option value="Driving License">DL</option>
                                  <option value="Voter ID">Voter ID</option>
                                  <option value="PAN">PAN</option>
                                </select>
                                <input type="text" class="guest-id-num" placeholder="ID Number" style="padding:8px 10px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);font-size:12px" />
                              `;
                              container.appendChild(row);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 2fr', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Name</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gender</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Type</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Number</div>
                    </div>
                    <div id="guest-rows-container">
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 2fr', gap: 8, marginBottom: 8 }}>
                        <input type="text" className="guest-name" placeholder="Guest 1 Name" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: 12 }} />
                        <select className="guest-gender" style={{ padding: '8px 6px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: 12 }}>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                        <select className="guest-id-type" style={{ padding: '8px 6px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: 12 }}>
                          <option value="Aadhar">Aadhar</option>
                          <option value="Passport">Passport</option>
                          <option value="Driving License">DL</option>
                          <option value="Voter ID">Voter ID</option>
                          <option value="PAN">PAN</option>
                        </select>
                        <input type="text" className="guest-id-num" placeholder="ID Number" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: 12 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>Assign Physical Room</div>
                  <select id="checkin-room" style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                    <option value="">{checkinBkg ? `-- Select Available ${checkinBkg.roomType} --` : '-- Select Available Room --'}</option>
                    {/* First priority: Rooms of the same category */}
                    {globalRooms.filter(r => r.status !== 'OCCUPIED' && r.status !== 'OOO' && (checkinBkg && r.type === checkinBkg.roomType)).map(r => (
                      <option key={r.id} value={`${r.type}|${r.number}`} style={{ fontWeight: 700 }}>[Recommended] Room {r.number} - {r.status}</option>
                    ))}
                    {/* Second priority: All other available rooms */}
                    {globalRooms.filter(r => r.status !== 'OCCUPIED' && r.status !== 'OOO' && (!checkinBkg || r.type !== checkinBkg.roomType)).map(r => (
                      <option key={r.id} value={`${r.type}|${r.number}`}>Room {r.number} ({r.type}) - {r.status}</option>
                    ))}
                  </select>

                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const bkgId = checkinBkgId || (document.getElementById('checkin-bkg') as HTMLSelectElement)?.value;
                    const roomVal = (document.getElementById('checkin-room') as HTMLSelectElement)?.value;

                    if (!bkgId) return setToast('❌ Please select a valid booking.');

                    const booking = globalBookings.find(b => b.id === bkgId);
                    if (!booking) return;

                    let rType = booking.roomType;
                    let rNum = booking.roomNumber;

                    if (roomVal) {
                      const parts = roomVal.split('|');
                      rType = parts[0];
                      rNum = parts[1];
                    }

                    if (!rNum) return setToast('❌ You must assign a room to check-in.');

                    const guestName = booking?.guestName || 'Guest';
                    const timestamp = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
                    const mob = (document.getElementById('checkin-mobile') as HTMLInputElement)?.value || booking.mobile;
                    const idp = (document.getElementById('checkin-idproof') as HTMLInputElement)?.value;
                    const addr = (document.getElementById('checkin-address') as HTMLInputElement)?.value;
                    const purp = (document.getElementById('checkin-purpose') as HTMLInputElement)?.value;
                    const advance = parseFloat((document.getElementById('checkin-advance') as HTMLInputElement)?.value || '0');
                    const totalGuests = parseInt((document.getElementById('checkin-total-guests') as HTMLInputElement)?.value || '1');

                    // Collect guest companion details
                    const guestNames = document.querySelectorAll('.guest-name') as NodeListOf<HTMLInputElement>;
                    const guestGenders = document.querySelectorAll('.guest-gender') as NodeListOf<HTMLSelectElement>;
                    const guestIdTypes = document.querySelectorAll('.guest-id-type') as NodeListOf<HTMLSelectElement>;
                    const guestIdNums = document.querySelectorAll('.guest-id-num') as NodeListOf<HTMLInputElement>;
                    const guestsInfo = Array.from(guestNames).map((_, i) => ({
                      name: guestNames[i]?.value || '',
                      gender: guestGenders[i]?.value || 'Male',
                      idType: guestIdTypes[i]?.value || 'Aadhar',
                      idNumber: guestIdNums[i]?.value || ''
                    })).filter(g => g.name);

                    if (!mob) return setToast('❌ Mobile Number is required.');

                    // Calculate payment status
                    const totalForThisRoom = hotelSettings.gstIncluded ? booking.amount : booking.amount * (1 + (hotelSettings.gstPercent / 100));
                    const newPaid = (booking.amountPaid || 0) + advance;
                    const newPayStatus = newPaid >= totalForThisRoom ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

                    // Supabase Updates
                    const { error: bError } = await supabase.from('bookings')
                      .update({ 
                        status: 'CHECKED_IN', 
                        actual_check_in_time: timestamp,
                        room_number: rNum,
                        mobile: mob,
                        id_proof: idp,
                        address: addr,
                        purpose: purp,
                        amount_paid: newPaid,
                        payment_status: newPayStatus,
                        total_guests: totalGuests,
                        guests_info: guestsInfo
                      })
                      .eq('custom_id', bkgId)
                      .eq('hotel_id', hotelId);

                    if (bError) return setToast(`❌ Check-in Failed: ${bError.message}`);

                    await supabase.from('rooms').update({ status: 'OCCUPIED', current_guest: guestName }).eq('number', rNum).eq('hotel_id', hotelId);

                    // Update Local State
                    setGlobalBookings(prev => prev.map(b => b.id === bkgId ? { 
                      ...b, 
                      status: 'CHECKED_IN', 
                      roomType: rType, 
                      roomNumber: rNum, 
                      actualCheckInTime: timestamp, 
                      mobile: mob, 
                      idProof: idp, 
                      address: addr, 
                      purpose: purp,
                      amountPaid: newPaid,
                      paymentStatus: newPayStatus as any
                    } : b));

                    // Update Room
                    setGlobalRooms(prev => prev.map(r => r.number === rNum ? { ...r, status: 'OCCUPIED', guest: guestName } : r));

                    setToast(`✅ ${guestName} (${totalGuests} guests) successfully checked into Room ${rNum}.`);
                    closeModals();
                    setCheckinBkgId('');
                  }}>Complete Check-in</button>
                </>
                );
              })()}
              {modalType === 'audit' && (
                <>
                  <div style={{ padding: 16, background: 'var(--status-ooo-bg)', color: 'var(--status-ooo-fg)', borderRadius: 8, fontSize: 13 }}>
                    Warning: Running the Night Audit will close the business day and post all pending room charges.
                  </div>
                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, background: 'var(--status-dirty-fg)' }} onClick={() => {
                    setToast(`✅ Night Audit completed successfully. Business day closed.`);
                    closeModals();
                  }}>Run Audit</button>
                </>
              )}
              {modalType === 'pos' && (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>This module is currently being provisioned.</div>
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setModalType(null)}>Close</button>
                </>
              )}
              {modalType === 'add-inv-item' && (
                <>
                  <input type="text" id="inv-name" placeholder="Item Name (e.g. Milk)" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginBottom: 8 }} />
                  <input type="text" id="inv-sku" placeholder="SKU / Internal Code" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginBottom: 8 }} />
                  
                  <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                    <select id="inv-cat" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                      <option value="Perishable">Perishable</option>
                      <option value="Non-Perishable">Non-Perishable</option>
                      <option value="Amenities">Amenities</option>
                      <option value="Linens">Linens</option>
                      <option value="Other">Other</option>
                    </select>
                    <input type="text" id="inv-uom" placeholder="UOM (e.g. L, kg, Pcs)" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <input type="number" id="inv-stock" placeholder="Initial Stock" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    <input type="number" id="inv-min" placeholder="Min (Par Level)" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  </div>

                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const name = (document.getElementById('inv-name') as HTMLInputElement).value;
                    const sku = (document.getElementById('inv-sku') as HTMLInputElement).value;
                    const cat = (document.getElementById('inv-cat') as HTMLSelectElement).value as any;
                    const uom = (document.getElementById('inv-uom') as HTMLInputElement).value;
                    const stock = parseInt((document.getElementById('inv-stock') as HTMLInputElement).value || '0');
                    const min = parseInt((document.getElementById('inv-min') as HTMLInputElement).value || '0');

                    if (!name || !sku || !uom) return setToast('❌ Name, SKU, and UOM are required');

                    const newItem = {
                      hotel_id: hotelId,
                      name, sku, category: cat, uom, 
                      current_stock: stock, 
                      min_stock_level: min 
                    };

                    const { data, error } = await supabase.from('inventory').insert([newItem]).select();
                    if (error) return setToast(`❌ Failed to save inventory: ${error.message}`);

                    const savedItem = data[0];
                    setGlobalInventory(prev => [...prev, { 
                      id: savedItem.id, 
                      name: savedItem.name, 
                      sku: savedItem.sku, 
                      category: savedItem.category, 
                      uom: savedItem.uom, 
                      currentStock: savedItem.current_stock, 
                      minStockLevel: savedItem.min_stock_level 
                    }]);
                    setToast(`✅ Item ${name} added to cloud inventory.`);
                    closeModals();
                  }}>Save Item</button>
                </>
              )}
              {modalType === 'add-vendor' && (
                <>
                  <input type="text" id="vnd-name" placeholder="Vendor Name" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginBottom: 8 }} />
                  <input type="text" id="vnd-contact" placeholder="Contact Info (Phone/Email)" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 16 }}>
                    <input type="text" id="vnd-tax" placeholder="Tax ID / GSTIN" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                    <input type="number" id="vnd-lead" placeholder="Lead Time (Days)" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  </div>
                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => {
                    const name = (document.getElementById('vnd-name') as HTMLInputElement).value;
                    const contact = (document.getElementById('vnd-contact') as HTMLInputElement).value;
                    const tax = (document.getElementById('vnd-tax') as HTMLInputElement).value;
                    const lead = parseInt((document.getElementById('vnd-lead') as HTMLInputElement).value || '0');

                    if (!name) return setToast('❌ Vendor Name is required');

                    setGlobalVendors(prev => [...prev, { id: `VND-${Math.floor(Math.random() * 9000)}`, name, contactInfo: contact, taxId: tax, leadTimeDays: lead }]);
                    setToast(`✅ Vendor ${name} added.`);
                    closeModals();
                  }}>Save Vendor</button>
                </>
              )}
              {modalType === 'record-inv-transaction' && (
                <>
                  <select id="txn-item" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', marginBottom: 8 }}>
                    <option value="">-- Select Inventory Item --</option>
                    {globalInventory.map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name} (Stock: {i.currentStock} {i.uom})</option>)}
                  </select>
                  
                  <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                    <select id="txn-type" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                      <option value="Stock In">Stock In (Purchase)</option>
                      <option value="Stock Out">Stock Out (Usage/Sales)</option>
                      <option value="Transfer">Transfer</option>
                    </select>
                    <input type="number" id="txn-qty" placeholder="Quantity" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  </div>
                  <textarea id="txn-notes" placeholder="Notes (e.g. Vendor PO, Department)" rows={3} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', resize: 'none' }} />
                  
                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const itemId = (document.getElementById('txn-item') as HTMLSelectElement).value;
                    const type = (document.getElementById('txn-type') as HTMLSelectElement).value as 'Stock In' | 'Stock Out' | 'Transfer';
                    const qty = parseInt((document.getElementById('txn-qty') as HTMLInputElement).value || '0');
                    const notes = (document.getElementById('txn-notes') as HTMLTextAreaElement).value;

                    if (!itemId || qty <= 0) return setToast('❌ Item and positive Quantity are required');

                    const item = globalInventory.find(i => i.id === itemId);
                    if (!item) return;

                    let newStock = item.currentStock;
                    if (type === 'Stock In') newStock += qty;
                    if (type === 'Stock Out' || type === 'Transfer') newStock -= qty;

                    if (newStock < 0) return setToast('❌ Insufficient stock for this transaction');

                    // Supabase Updates
                    // 1. Log Transaction
                    const { error: tError } = await supabase.from('inventory_transactions').insert({
                      hotel_id: hotelId,
                      item_id: itemId,
                      type,
                      quantity: qty,
                      notes
                    });
                    if (tError) return setToast(`❌ Transaction Logging Failed: ${tError.message}`);

                    // 2. Update Stock
                    await supabase.from('inventory').update({ current_stock: newStock }).eq('id', itemId);

                    setGlobalInventory(prev => prev.map(i => i.id === itemId ? { ...i, currentStock: newStock } : i));
                    setGlobalInvTransactions(prev => [{ 
                      id: `TXN-${Math.floor(Math.random()*90000)}`, 
                      date: new Date().toISOString().split('T')[0], 
                      itemId, type, quantity: qty, notes 
                    }, ...prev]);
                    
                    setToast(`✅ Recorded ${type} of ${qty} ${item.uom} for ${item.name}`);
                    closeModals();
                  }}>Record Transaction</button>
                </>
              )}
              {modalType === 'add-expense-type' && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>New Expense Category Name</div>
                  <input type="text" id="exp-new-type" placeholder="e.g. Plumber Repair" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => {
                    const t = (document.getElementById('exp-new-type') as HTMLInputElement).value;
                    if (!t) return setToast('❌ Type cannot be empty');
                    setGlobalExpenseTypes(prev => [...prev, t]);
                    setToast(`✅ Added expense type: ${t}`);
                    setModalType('record-expense');
                  }}>Save Type</button>
                </>
              )}
              {modalType === 'record-expense' && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Date</div>
                  <input type="date" id="exp-date" defaultValue={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Expense Category</div>
                  <select id="exp-type" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                    {globalExpenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Amount (₹)</div>
                  <input type="number" id="exp-amt" placeholder="e.g. 1500" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                  
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Explanation / Notes</div>
                  <textarea id="exp-notes" placeholder="Detailed explanation for this expense..." rows={3} style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)', resize: 'none' }} />
                  
                  <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                    const date = (document.getElementById('exp-date') as HTMLInputElement).value;
                    const type = (document.getElementById('exp-type') as HTMLSelectElement).value;
                    const amount = parseInt((document.getElementById('exp-amt') as HTMLInputElement).value || '0');
                    const notes = (document.getElementById('exp-notes') as HTMLTextAreaElement).value;

                    if (!date || amount <= 0) return setToast('❌ Valid Date and Amount > 0 required');

                    // Supabase Insert
                    const { error } = await supabase.from('expenses').insert({
                      hotel_id: hotelId,
                      date,
                      type,
                      amount,
                      notes
                    });

                    if (error) return setToast(`❌ Failed to record expense: ${error.message}`);

                    setGlobalExpenses(prev => [{ id: `EXP-${Math.floor(Math.random()*90000)}`, date, type, amount, notes }, ...prev]);
                    setToast('✅ Expense recorded successfully in cloud');
                    closeModals();
                  }}>Record Expense</button>
                </>
              )}
              {modalType === 'booking-detail' && (() => {
                const bkg = globalBookings.find(b => b.id === selectedDetailBkg);
                if (!bkg) return <p>Booking not found.</p>;
                const isLocked = bkg.status === 'CHECKED_OUT';
                const inputStyle: any = { width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: isLocked ? 'var(--bg-surface)' : 'var(--bg-elevated)', color: isLocked ? 'var(--text-muted)' : 'var(--text-main)', fontSize: 13, cursor: isLocked ? 'not-allowed' : 'text' };
                const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{bkg.guestName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Booking: {bkg.id}</div>
                      </div>
                      <span className={`status-pill status-${bkg.status === 'CONFIRMED' ? 'CLEAN' : bkg.status === 'CHECKED_IN' ? 'INSPECTED' : 'DIRTY'}`}>{bkg.status}</span>
                    </div>

                    {isLocked && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#991b1b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🔒 This booking is checked-out. Details are read-only.
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Guest Name</label>
                        <input type="text" id="detail-name" defaultValue={bkg.guestName} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Mobile</label>
                        <input type="tel" id="detail-mobile" defaultValue={bkg.mobile || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>ID Proof (Aadhar/Passport)</label>
                        <input type="text" id="detail-idproof" defaultValue={bkg.idProof || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Address</label>
                        <input type="text" id="detail-address" defaultValue={bkg.address || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Purpose of Visit</label>
                        <input type="text" id="detail-purpose" defaultValue={bkg.purpose || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Room Type</label>
                        <input type="text" id="detail-roomtype" defaultValue={bkg.roomType} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Room Number</label>
                        <input type="text" id="detail-roomnum" defaultValue={bkg.roomNumber || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Amount (₹)</label>
                        <input type="number" id="detail-amount" defaultValue={bkg.amount} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Check-in Date</label>
                        <input type="date" id="detail-checkin" defaultValue={bkg.checkInDate} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Check-out Date</label>
                        <input type="date" id="detail-checkout" defaultValue={bkg.checkOutDate} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Company Name</label>
                        <input type="text" id="detail-company" defaultValue={bkg.companyName || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                      <div>
                        <label style={labelStyle}>Customer GSTIN</label>
                        <input type="text" id="detail-gst" defaultValue={bkg.customerGst || ''} style={inputStyle} disabled={isLocked} />
                      </div>
                    </div>

                    {bkg.actualCheckInTime && (
                      <div style={{ marginTop: 12, padding: 10, background: 'rgba(79, 70, 229, 0.05)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        🕐 Checked-in: {bkg.actualCheckInTime}
                        {bkg.actualCheckOutTime && <span style={{ marginLeft: 16 }}>🕐 Checked-out: {bkg.actualCheckOutTime}</span>}
                      </div>
                    )}

                    {!isLocked && (
                      <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={async () => {
                        const name = (document.getElementById('detail-name') as HTMLInputElement).value;
                        const mob = (document.getElementById('detail-mobile') as HTMLInputElement).value;
                        const idp = (document.getElementById('detail-idproof') as HTMLInputElement).value;
                        const addr = (document.getElementById('detail-address') as HTMLInputElement).value;
                        const purp = (document.getElementById('detail-purpose') as HTMLInputElement).value;
                        const rType = (document.getElementById('detail-roomtype') as HTMLInputElement).value;
                        const rNum = (document.getElementById('detail-roomnum') as HTMLInputElement).value;
                        const amt = parseFloat((document.getElementById('detail-amount') as HTMLInputElement).value);
                        const ci = (document.getElementById('detail-checkin') as HTMLInputElement).value;
                        const co = (document.getElementById('detail-checkout') as HTMLInputElement).value;
                        const comp = (document.getElementById('detail-company') as HTMLInputElement).value;
                        const gst = (document.getElementById('detail-gst') as HTMLInputElement).value;

                        const { error } = await supabase.from('bookings').update({
                          guest_name: name,
                          mobile: mob,
                          id_proof: idp,
                          address: addr,
                          purpose: purp,
                          room_type: rType,
                          room_number: rNum,
                          amount: amt,
                          check_in_date: ci,
                          check_out_date: co,
                          company_name: comp,
                          customer_gst: gst
                        }).eq('custom_id', bkg.id).eq('hotel_id', hotelId);

                        if (error) return setToast(`❌ Update Failed: ${error.message}`);

                        setGlobalBookings(prev => prev.map(b => b.id === bkg.id ? {
                          ...b,
                          guestName: name, mobile: mob, idProof: idp, address: addr, purpose: purp,
                          roomType: rType, roomNumber: rNum, amount: amt,
                          checkInDate: ci, checkOutDate: co, dates: `${ci} - ${co}`,
                          companyName: comp, customerGst: gst
                        } : b));
                        setToast('✅ Booking updated successfully!');
                        closeModals();
                      }}>💾 Save Changes</button>
                    )}
                  </>
                );
              })()}
              {modalType === 'checkout-details' && (() => {
                const bkg = globalBookings.find(b => b.id === checkoutBkgId);
                if (!bkg) return null;
                return (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Confirm billing details for:</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>{bkg.guestName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Room {bkg.roomNumber || bkg.roomType} | Master Ref: {bkg.id}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Company Name (For GST)</div>
                        <input 
                          type="text" 
                          id="out-company" 
                          defaultValue={bkg.companyName || ''} 
                          placeholder="Enter Company Name" 
                          style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} 
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Customer GSTIN</div>
                        <input 
                          type="text" 
                          id="out-gst" 
                          defaultValue={bkg.customerGst || ''} 
                          placeholder="e.g. 07AAAAA0000A1Z5" 
                          style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} 
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 24, padding: '12px', background: 'rgba(79, 70, 229, 0.05)', borderRadius: 8, border: '1px solid rgba(79, 70, 229, 0.1)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 500 }}>
                      💡 Updating these details will reflect on the final invoice and tax reports.
                    </div>

                    <button 
                      className="btn primary" 
                      style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} 
                      onClick={() => {
                        const company = (document.getElementById('out-company') as HTMLInputElement).value;
                        const gst = (document.getElementById('out-gst') as HTMLInputElement).value;
                        finishCheckout(bkg.id, company, gst);
                      }}
                    >
                      🚪 Complete Check-out & Generate Invoice
                    </button>
                  </>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="animate-slide-up" style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
          background: 'var(--bg-surface)', padding: '16px 24px', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)', border: '1px solid var(--status-clean-fg)',
          color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12
        }}>
          {toast}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
      )}
    </div>
  );
}

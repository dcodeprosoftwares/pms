// ─── Tenant ──────────────────────────────────────────────────────────────────
export type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: SubscriptionTier;
  apiKeyHash: string;
  cognitoGroup: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Rooms ───────────────────────────────────────────────────────────────────
export type RoomStatus = 'CLEAN' | 'DIRTY' | 'OOO' | 'INSPECTED' | 'OCCUPIED';
export type RoomType = 'STANDARD' | 'DELUXE' | 'SUITE' | 'FAMILY' | 'PRESIDENTIAL';

export interface Room {
  id: string;
  tenantId: string;
  roomNumber: string;
  roomType: RoomType;
  floor: number;
  status: RoomStatus;
  ratePerNight: number;
  maxOccupancy: number;
  isActive: boolean;
}

// ─── Guests ───────────────────────────────────────────────────────────────────
export type IdDocType = 'AADHAAR' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';

export interface Guest {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone: string;
  idDocType: IdDocType;
  idDocNumber: string;
  idDocS3Key?: string;
  nationality?: string;
  address?: string;
  createdAt: string;
}

// ─── Reservations ─────────────────────────────────────────────────────────────
export type ReservationStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ReservationSource =
  | 'WALK_IN'
  | 'PHONE'
  | 'OTA_BOOKING'
  | 'WEBSITE'
  | 'AGENT';

export interface Reservation {
  id: string;
  tenantId: string;
  guestId: string;
  roomId: string;
  checkIn: string;       // ISO date string
  checkOut: string;      // ISO date string
  status: ReservationStatus;
  source: ReservationSource;
  adults: number;
  children: number;
  specialRequests?: string;
  folioId?: string;
  createdAt: string;
}

// ─── Folio / Billing ──────────────────────────────────────────────────────────
export type FolioStatus = 'OPEN' | 'CLOSED' | 'SETTLED';
export type ChargeType =
  | 'ROOM_RATE'
  | 'POS_RESTAURANT'
  | 'POS_BAR'
  | 'MINIBAR'
  | 'LAUNDRY'
  | 'SPA'
  | 'PHONE'
  | 'MISCELLANEOUS'
  | 'DISCOUNT'
  | 'TAX';

export interface FolioItem {
  id: string;
  folioId: string;
  chargeType: ChargeType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  source: 'MANUAL' | 'POS' | 'SYSTEM';
  posReceiptRef?: string;
  posOutletId?: string;
  postedAt: string;
  postedBy?: string;
}

export interface Folio {
  id: string;
  tenantId: string;
  reservationId: string;
  status: FolioStatus;
  items: FolioItem[];
  totalAmount: number;
  settledAmount: number;
  balanceDue: number;
  createdAt: string;
  closedAt?: string;
}

// ─── POS Integration (Post-to-Room) ──────────────────────────────────────────
export interface PosReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category?: string;
}

export interface PosPostToRoomRequest {
  tenantId: string;
  roomNumber: string;
  receipt: {
    outletId: string;
    outletName: string;
    receiptNumber: string;
    items: PosReceiptItem[];
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    timestamp: string;
    cashierName?: string;
    tableNumber?: string;
  };
}

export interface PosPostToRoomResponse {
  success: boolean;
  folioItemId: string;
  guestName: string;
  roomNumber: string;
  amountPosted: number;
  folioBalance: number;
  message: string;
}

// ─── Night Audit ──────────────────────────────────────────────────────────────
export type NightAuditStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';

export interface NightAuditReport {
  id: string;
  tenantId: string;
  auditDate: string;
  status: NightAuditStatus;
  reportS3Key?: string;
  totalRoomRevenue: number;
  totalPosRevenue: number;
  totalGstCollected: number;
  totalRevenue: number;
  occupiedRooms: number;
  checkins: number;
  checkouts: number;
  completedAt?: string;
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────
export interface HousekeepingTask {
  id: string;
  tenantId: string;
  roomId: string;
  roomNumber: string;
  taskType: 'CHECKOUT_CLEAN' | 'STAY_OVER_CLEAN' | 'TURNDOWN' | 'INSPECTION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE';
  assignedTo?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── JWT Claims ───────────────────────────────────────────────────────────────
export interface PmsClaims {
  sub: string;            // Cognito User ID
  email: string;
  'custom:tenant_id': string;
  'custom:role': PmsRole;
  'cognito:groups': string[];
}

export type PmsRole =
  | 'SUPER_ADMIN'
  | 'HOTEL_ADMIN'
  | 'FRONT_DESK'
  | 'HOUSEKEEPING'
  | 'MANAGER'
  | 'POS_SERVICE';        // For Weazy Billing API key auth

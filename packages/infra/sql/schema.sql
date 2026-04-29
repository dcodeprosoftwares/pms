-- ════════════════════════════════════════════════════════════════
--  WEAZY PMS — Aurora PostgreSQL Schema
--  Includes: Row-Level Security (RLS) for multi-tenant isolation
-- ════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tenants ────────────────────────────────────────────────────
CREATE TABLE tenants (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              VARCHAR(255) NOT NULL,
    slug              VARCHAR(100) NOT NULL UNIQUE,
    tier              VARCHAR(20)  NOT NULL DEFAULT 'starter'
                         CHECK (tier IN ('starter', 'growth', 'enterprise')),
    api_key_hash      VARCHAR(255),
    cognito_group     VARCHAR(255),
    admin_email       VARCHAR(255) NOT NULL,
    max_rooms         INTEGER NOT NULL DEFAULT 30,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Rooms ──────────────────────────────────────────────────────
CREATE TABLE rooms (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    room_number       VARCHAR(10) NOT NULL,
    room_type         VARCHAR(30) NOT NULL DEFAULT 'STANDARD'
                         CHECK (room_type IN ('STANDARD','DELUXE','SUITE','FAMILY','PRESIDENTIAL')),
    floor             INTEGER NOT NULL DEFAULT 1,
    rate_per_night    NUMERIC(10,2) NOT NULL,
    max_occupancy     INTEGER NOT NULL DEFAULT 2,
    amenities         JSONB,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, room_number)
);

-- ─── Guests ─────────────────────────────────────────────────────
CREATE TABLE guests (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    name              VARCHAR(255) NOT NULL,
    email             VARCHAR(255),
    phone             VARCHAR(20) NOT NULL,
    id_doc_type       VARCHAR(30)
                         CHECK (id_doc_type IN ('AADHAAR','PASSPORT','DRIVING_LICENSE','VOTER_ID')),
    id_doc_number     VARCHAR(50),
    id_doc_s3_key     TEXT,
    nationality       VARCHAR(100) DEFAULT 'Indian',
    address           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Reservations ───────────────────────────────────────────────
CREATE TABLE reservations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    guest_id          UUID NOT NULL REFERENCES guests(id),
    room_id           UUID NOT NULL REFERENCES rooms(id),
    folio_id          UUID,  -- FK added after folios table
    check_in          DATE NOT NULL,
    check_out         DATE NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
                         CHECK (status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW')),
    source            VARCHAR(20) NOT NULL DEFAULT 'WALK_IN'
                         CHECK (source IN ('WALK_IN','PHONE','OTA_BOOKING','WEBSITE','AGENT')),
    adults            INTEGER NOT NULL DEFAULT 1,
    children          INTEGER NOT NULL DEFAULT 0,
    special_requests  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- ─── Folios ─────────────────────────────────────────────────────
CREATE TABLE folios (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    reservation_id    UUID NOT NULL REFERENCES reservations(id),
    status            VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                         CHECK (status IN ('OPEN','CLOSED','SETTLED')),
    total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    settled_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance_due       NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - settled_amount) STORED,
    payment_mode      VARCHAR(30),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at         TIMESTAMPTZ
);

-- Add folio FK back to reservations
ALTER TABLE reservations ADD CONSTRAINT fk_reservation_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id);

-- ─── Folio Items ────────────────────────────────────────────────
CREATE TABLE folio_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio_id          UUID NOT NULL REFERENCES folios(id),
    charge_type       VARCHAR(30) NOT NULL
                         CHECK (charge_type IN (
                           'ROOM_RATE','POS_RESTAURANT','POS_BAR',
                           'MINIBAR','LAUNDRY','SPA','PHONE','MISCELLANEOUS',
                           'DISCOUNT','TAX'
                         )),
    description       TEXT NOT NULL,
    quantity          NUMERIC(8,2) NOT NULL DEFAULT 1,
    unit_price        NUMERIC(10,2) NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,
    cgst              NUMERIC(10,2) NOT NULL DEFAULT 0,
    sgst              NUMERIC(10,2) NOT NULL DEFAULT 0,
    igst              NUMERIC(10,2) NOT NULL DEFAULT 0,
    source            VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                         CHECK (source IN ('MANUAL','POS','SYSTEM')),
    pos_receipt_ref   VARCHAR(100),
    pos_outlet_id     VARCHAR(100),
    posted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_by         VARCHAR(255)
);

-- ─── POS Transactions (Weazy Billing integration log) ───────────
CREATE TABLE pos_transactions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    folio_id          UUID NOT NULL REFERENCES folios(id),
    folio_item_id     UUID NOT NULL REFERENCES folio_items(id),
    outlet_id         VARCHAR(100) NOT NULL,
    outlet_name       VARCHAR(255) NOT NULL,
    receipt_number    VARCHAR(100) NOT NULL,
    subtotal          NUMERIC(12,2) NOT NULL,
    cgst              NUMERIC(10,2) NOT NULL DEFAULT 0,
    sgst              NUMERIC(10,2) NOT NULL DEFAULT 0,
    igst              NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(12,2) NOT NULL,
    transaction_at    TIMESTAMPTZ NOT NULL,
    posted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Night Audits ────────────────────────────────────────────────
CREATE TABLE night_audits (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    audit_date          DATE NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETE','FAILED')),
    report_s3_key       TEXT,
    total_room_revenue  NUMERIC(14,2) DEFAULT 0,
    total_pos_revenue   NUMERIC(14,2) DEFAULT 0,
    total_gst_collected NUMERIC(14,2) DEFAULT 0,
    total_revenue       NUMERIC(14,2) DEFAULT 0,
    occupied_rooms      INTEGER DEFAULT 0,
    checkins            INTEGER DEFAULT 0,
    checkouts           INTEGER DEFAULT 0,
    completed_at        TIMESTAMPTZ,
    UNIQUE (tenant_id, audit_date)
);

-- ═══════════════════════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_rooms_tenant      ON rooms(tenant_id);
CREATE INDEX idx_guests_tenant     ON guests(tenant_id);
CREATE INDEX idx_guests_phone      ON guests(tenant_id, phone);
CREATE INDEX idx_reservations_tenant ON reservations(tenant_id);
CREATE INDEX idx_reservations_room ON reservations(tenant_id, room_id, status);
CREATE INDEX idx_reservations_dates ON reservations(tenant_id, check_in, check_out);
CREATE INDEX idx_folios_tenant     ON folios(tenant_id, reservation_id);
CREATE INDEX idx_folio_items_folio ON folio_items(folio_id);
CREATE INDEX idx_pos_txns_tenant   ON pos_transactions(tenant_id, transaction_at);
CREATE INDEX idx_night_audits      ON night_audits(tenant_id, audit_date);

-- ═══════════════════════════════════════════════════════════════
--  ROW-LEVEL SECURITY (Multi-Tenant Isolation)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_audits   ENABLE ROW LEVEL SECURITY;

-- RLS Policies: each table filtered by app.current_tenant_id session variable
CREATE POLICY tenant_isolation ON rooms
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON guests
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON reservations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON folios
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON pos_transactions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON night_audits
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- folio_items: isolated via parent folio's tenant_id
CREATE POLICY tenant_isolation ON folio_items
    USING (
        folio_id IN (
            SELECT id FROM folios
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- ═══════════════════════════════════════════════════════════════
--  TRIGGERS: updated_at auto-update
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rooms_updated_at    BEFORE UPDATE ON rooms    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_guests_updated_at   BEFORE UPDATE ON guests   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_res_updated_at      BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenants_updated_at  BEFORE UPDATE ON tenants  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

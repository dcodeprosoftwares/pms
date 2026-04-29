import { EventBridgeEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { getDbPool, setTenantContext, NightAuditReport } from '@weazy-pms/shared';

const ses = new SESClient({ region: process.env.AWS_REGION });
const s3  = new S3Client({ region: process.env.AWS_REGION });

/**
 * Night Audit Lambda
 * Triggered by EventBridge cron: cron(59 23 * * ? *)   [11:59 PM daily]
 *
 * Steps per tenant:
 * 1. Post daily room charges to all CHECKED_IN folios
 * 2. Reconcile POS transactions
 * 3. Generate HORECA revenue summary
 * 4. Save report to S3 and email hotel management
 * 5. Mark audit as COMPLETE in DB
 */
export const handler = async (
  event: EventBridgeEvent<'night-audit-trigger', { tenantId?: string }>
): Promise<void> => {
  const pool = getDbPool();
  const auditDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`[NightAudit] Starting audit for date: ${auditDate}`);

  // Get all active tenants (or single tenant if triggered manually)
  const tenantFilter = event.detail?.tenantId;
  const tenantsResult = await pool.query<{ id: string; name: string; admin_email: string }>(
    `SELECT id, name, admin_email FROM tenants WHERE is_active = true ${tenantFilter ? 'AND id = $1' : ''}`,
    tenantFilter ? [tenantFilter] : []
  );

  const tenants = tenantsResult.rows;
  console.log(`[NightAudit] Processing ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    const auditId = uuidv4();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await setTenantContext(client, tenant.id);

      // 1. Insert audit record with IN_PROGRESS status
      await client.query(
        `INSERT INTO night_audits (id, tenant_id, audit_date, status) VALUES ($1, $2, $3, 'IN_PROGRESS')`,
        [auditId, tenant.id, auditDate]
      );

      // 2. Post daily room charges for all checked-in reservations
      const checkedInResult = await client.query<{
        reservation_id: string;
        folio_id: string;
        room_number: string;
        rate_per_night: number;
      }>(
        `
        SELECT r.id AS reservation_id, r.folio_id, rm.room_number, rm.rate_per_night
        FROM reservations r
        JOIN rooms rm ON rm.id = r.room_id
        WHERE r.tenant_id = $1
          AND r.status = 'CHECKED_IN'
          AND r.folio_id IS NOT NULL
        `,
        [tenant.id]
      );

      let totalRoomRevenue = 0;
      for (const res of checkedInResult.rows) {
        const rate = res.rate_per_night;
        const cgst = rate * 0.06; // 12% GST split
        const sgst = rate * 0.06;
        totalRoomRevenue += rate;

        await client.query(
          `
          INSERT INTO folio_items (
            id, folio_id, charge_type, description, quantity,
            unit_price, amount, cgst, sgst, igst,
            source, posted_at
          ) VALUES ($1, $2, 'ROOM_RATE', $3, 1, $4, $4, $5, $6, 0, 'SYSTEM', NOW())
          `,
          [
            uuidv4(),
            res.folio_id,
            `Room Rate — ${res.room_number} (${auditDate})`,
            rate,
            cgst,
            sgst,
          ]
        );

        // Update folio total
        await client.query(
          `UPDATE folios
           SET total_amount = total_amount + $1,
               balance_due  = balance_due  + $1
           WHERE id = $2`,
          [rate, res.folio_id]
        );
      }

      // 3. Aggregate POS revenue for today
      const posResult = await client.query<{
        total_pos: number;
        total_cgst: number;
        total_sgst: number;
      }>(
        `
        SELECT
          COALESCE(SUM(total), 0)   AS total_pos,
          COALESCE(SUM(cgst), 0)    AS total_cgst,
          COALESCE(SUM(sgst), 0)    AS total_sgst
        FROM pos_transactions
        WHERE tenant_id = $1
          AND DATE(transaction_at) = $2
        `,
        [tenant.id, auditDate]
      );

      const totalPosRevenue   = Number(posResult.rows[0]?.total_pos ?? 0);
      const totalGst          = Number(posResult.rows[0]?.total_cgst ?? 0) +
                                Number(posResult.rows[0]?.total_sgst ?? 0);
      const totalRevenue      = totalRoomRevenue + totalPosRevenue;

      // 4. Count occupancy stats
      const statsResult = await client.query<{
        occupied: string;
        checkins: string;
        checkouts: string;
      }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'CHECKED_IN')         AS occupied,
          COUNT(*) FILTER (WHERE DATE(updated_at) = $2 AND status = 'CHECKED_IN')  AS checkins,
          COUNT(*) FILTER (WHERE DATE(updated_at) = $2 AND status = 'CHECKED_OUT') AS checkouts
        FROM reservations WHERE tenant_id = $1
        `,
        [tenant.id, auditDate]
      );

      const stats = statsResult.rows[0];

      // 5. Generate report content
      const report = generateReportText({
        tenantName: tenant.name,
        auditDate,
        totalRoomRevenue,
        totalPosRevenue,
        totalGst,
        totalRevenue,
        occupiedRooms: Number(stats?.occupied ?? 0),
        checkins: Number(stats?.checkins ?? 0),
        checkouts: Number(stats?.checkouts ?? 0),
      });

      // 6. Upload report to S3
      const reportKey = `night-audit/${tenant.id}/${auditDate}/report.txt`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.REPORTS_BUCKET!,
        Key: reportKey,
        Body: report,
        ContentType: 'text/plain',
      }));

      // 7. Update audit record as COMPLETE
      await client.query(
        `
        UPDATE night_audits
        SET status             = 'COMPLETE',
            report_s3_key      = $1,
            total_room_revenue = $2,
            total_pos_revenue  = $3,
            total_gst_collected= $4,
            total_revenue      = $5,
            occupied_rooms     = $6,
            checkins           = $7,
            checkouts          = $8,
            completed_at       = NOW()
        WHERE id = $9
        `,
        [
          reportKey,
          totalRoomRevenue,
          totalPosRevenue,
          totalGst,
          totalRevenue,
          Number(stats?.occupied ?? 0),
          Number(stats?.checkins ?? 0),
          Number(stats?.checkouts ?? 0),
          auditId,
        ]
      );

      await client.query('COMMIT');

      // 8. Email report to hotel admin
      await ses.send(new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL!,
        Destination: { ToAddresses: [tenant.admin_email] },
        Message: {
          Subject: { Data: `Night Audit Report — ${tenant.name} — ${auditDate}` },
          Body: { Text: { Data: report } },
        },
      }));

      console.log(`[NightAudit] ✅ Completed for tenant: ${tenant.name} | Revenue: ₹${totalRevenue}`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      await pool.query(
        `UPDATE night_audits SET status = 'FAILED' WHERE id = $1`,
        [auditId]
      );
      console.error(`[NightAudit] ❌ Failed for tenant ${tenant.name}:`, err.message);
    } finally {
      client.release();
    }
  }

  console.log('[NightAudit] All tenants processed.');
};

// ─── Report Generator ──────────────────────────────────────────────────────────
function generateReportText(data: {
  tenantName: string;
  auditDate: string;
  totalRoomRevenue: number;
  totalPosRevenue: number;
  totalGst: number;
  totalRevenue: number;
  occupiedRooms: number;
  checkins: number;
  checkouts: number;
}): string {
  const fmt = (n: number) => `₹${n.toFixed(2).padStart(12)}`;
  return `
╔══════════════════════════════════════════════════════╗
║           NIGHT AUDIT REPORT — WEAZY PMS            ║
╚══════════════════════════════════════════════════════╝

Property  : ${data.tenantName}
Date      : ${data.auditDate}
Generated : ${new Date().toISOString()}

─────────────────── OCCUPANCY ───────────────────────
  Occupied Rooms    : ${data.occupiedRooms}
  Check-Ins Today   : ${data.checkins}
  Check-Outs Today  : ${data.checkouts}

─────────────────── REVENUE SUMMARY ─────────────────
  Room Revenue      :${fmt(data.totalRoomRevenue)}
  POS/Restaurant    :${fmt(data.totalPosRevenue)}
                     ─────────────
  Gross Revenue     :${fmt(data.totalRevenue)}
  GST Collected     :${fmt(data.totalGst)}
                     ─────────────
  Net Revenue       :${fmt(data.totalRevenue - data.totalGst)}

─────────────────── HORECA BREAKDOWN ────────────────
  Hotel Revenue     :${fmt(data.totalRoomRevenue)}
  Restaurant (POS)  :${fmt(data.totalPosRevenue)}
  Total HORECA      :${fmt(data.totalRevenue)}

Powered by Weazy PMS + Weazy Billing Integration
`.trim();
}

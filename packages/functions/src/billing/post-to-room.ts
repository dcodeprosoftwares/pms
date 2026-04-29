import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  extractAuthContext,
  requireRole,
  response,
  withTransaction,
  setTenantContext,
  PosPostToRoomRequest,
  PosPostToRoomResponse,
} from '@weazy-pms/shared';

// ─── Validation Schema ────────────────────────────────────────────────────────
const PosItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  category: z.string().optional(),
});

const PostToRoomSchema = z.object({
  tenantId: z.string().uuid(),
  roomNumber: z.string().min(1).max(10),
  receipt: z.object({
    outletId: z.string(),
    outletName: z.string(),
    receiptNumber: z.string(),
    items: z.array(PosItemSchema).min(1),
    subtotal: z.number().nonnegative(),
    cgst: z.number().nonnegative(),
    sgst: z.number().nonnegative(),
    igst: z.number().nonnegative(),
    total: z.number().positive(),
    timestamp: z.string().datetime(),
    cashierName: z.string().optional(),
    tableNumber: z.string().optional(),
  }),
});

// ─── Handler ──────────────────────────────────────────────────────────────────
/**
 * POST /v1/pos/post-to-room
 *
 * Secure endpoint for Weazy Billing POS to:
 * 1. Verify an active guest is in the specified room
 * 2. Post the finalized restaurant receipt to the hotel folio
 *
 * Auth: API Key (validated by API Gateway Usage Plan)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[PostToRoom] Received request');

  try {
    // 1. Authenticate — only POS_SERVICE role allowed
    const auth = extractAuthContext(event);
    requireRole(auth, ['POS_SERVICE', 'SUPER_ADMIN']);

    // 2. Parse & validate request body
    if (!event.body) {
      return response.error('Request body is required', 400);
    }

    const rawBody = JSON.parse(event.body) as PosPostToRoomRequest;
    const parsed = PostToRoomSchema.safeParse(rawBody);

    if (!parsed.success) {
      return response.error(`Validation error: ${parsed.error.message}`, 422);
    }

    const { tenantId, roomNumber, receipt } = parsed.data;

    // 3. Execute within a transaction
    const result = await withTransaction<PosPostToRoomResponse>(async (client) => {
      // Set RLS tenant context
      await setTenantContext(client, tenantId);

      // 4. Find active reservation for this room
      const reservationQuery = await client.query<{
        reservation_id: string;
        folio_id: string;
        guest_id: string;
        guest_name: string;
        check_out: string;
      }>(
        `
        SELECT
          r.id            AS reservation_id,
          r.folio_id,
          r.guest_id,
          g.name          AS guest_name,
          r.check_out
        FROM reservations r
        JOIN rooms rm       ON rm.id = r.room_id
        JOIN guests g       ON g.id  = r.guest_id
        WHERE rm.room_number = $1
          AND rm.tenant_id   = $2
          AND r.tenant_id    = $2
          AND r.status       = 'CHECKED_IN'
        LIMIT 1
        `,
        [roomNumber, tenantId]
      );

      if (reservationQuery.rows.length === 0) {
        throw new Error(
          `No active checked-in guest found in room ${roomNumber}`
        );
      }

      const { folio_id: folioId, guest_name: guestName } =
        reservationQuery.rows[0];

      if (!folioId) {
        throw new Error(`No open folio found for room ${roomNumber}`);
      }

      // 5. Verify folio is open
      const folioCheck = await client.query<{ status: string; total_amount: number }>(
        `SELECT status, total_amount FROM folios WHERE id = $1 AND tenant_id = $2`,
        [folioId, tenantId]
      );

      if (folioCheck.rows[0]?.status !== 'OPEN') {
        throw new Error(`Folio for room ${roomNumber} is not open`);
      }

      const currentTotal = folioCheck.rows[0].total_amount;

      // 6. Insert folio line item for POS receipt
      const folioItemId = uuidv4();
      const itemDescription = `${receipt.outletName} — ${receipt.receiptNumber} (${receipt.items.length} items)`;

      await client.query(
        `
        INSERT INTO folio_items (
          id, folio_id, charge_type, description, quantity,
          unit_price, amount, cgst, sgst, igst,
          source, pos_receipt_ref, pos_outlet_id, posted_at
        ) VALUES (
          $1, $2, 'POS_RESTAURANT', $3, 1,
          $4, $4, $5, $6, $7,
          'POS', $8, $9, $10
        )
        `,
        [
          folioItemId,
          folioId,
          itemDescription,
          receipt.total,
          receipt.cgst,
          receipt.sgst,
          receipt.igst,
          receipt.receiptNumber,
          receipt.outletId,
          receipt.timestamp,
        ]
      );

      // 7. Update folio total
      const newTotal = currentTotal + receipt.total;
      await client.query(
        `UPDATE folios SET total_amount = $1, balance_due = $1 - settled_amount WHERE id = $2`,
        [newTotal, folioId]
      );

      // 8. Log POS transaction for night audit reconciliation
      await client.query(
        `
        INSERT INTO pos_transactions (
          id, tenant_id, folio_id, folio_item_id,
          outlet_id, outlet_name, receipt_number,
          subtotal, cgst, sgst, igst, total,
          transaction_at, posted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        `,
        [
          uuidv4(),
          tenantId,
          folioId,
          folioItemId,
          receipt.outletId,
          receipt.outletName,
          receipt.receiptNumber,
          receipt.subtotal,
          receipt.cgst,
          receipt.sgst,
          receipt.igst,
          receipt.total,
          receipt.timestamp,
        ]
      );

      console.log(
        `[PostToRoom] Posted ₹${receipt.total} from ${receipt.outletName} to room ${roomNumber} (folio: ${folioId})`
      );

      return {
        success: true,
        folioItemId,
        guestName,
        roomNumber,
        amountPosted: receipt.total,
        folioBalance: newTotal,
        message: `₹${receipt.total.toFixed(2)} posted to ${guestName}'s folio (Room ${roomNumber})`,
      };
    });

    return response.ok<PosPostToRoomResponse>(result, 201);
  } catch (err: any) {
    const isClientError =
      err.message.includes('No active') ||
      err.message.includes('not open') ||
      err.message.includes('Validation') ||
      err.message.includes('Access denied');

    console.error('[PostToRoom] Error:', err.message);

    return response.error(
      err.message,
      isClientError ? 400 : 500
    );
  }
};

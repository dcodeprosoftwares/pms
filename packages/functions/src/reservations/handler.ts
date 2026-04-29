import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  extractAuthContext,
  requireRole,
  response,
  withTransaction,
  setTenantContext,
} from '@weazy-pms/shared';
import { getDynamoClient, TABLES } from '@weazy-pms/shared';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const CreateReservationSchema = z.object({
  guestId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(10),
  children: z.number().int().min(0).max(10).default(0),
  source: z.enum(['WALK_IN', 'PHONE', 'OTA_BOOKING', 'WEBSITE', 'AGENT']),
  specialRequests: z.string().optional(),
});

const CheckInSchema = z.object({
  idDocType: z.enum(['AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID']),
  idDocNumber: z.string().min(6).max(20),
  idDocS3Key: z.string().optional(),
});

// ─── Create Reservation ───────────────────────────────────────────────────────
export const createReservation = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    requireRole(auth, ['SUPER_ADMIN', 'HOTEL_ADMIN', 'FRONT_DESK', 'MANAGER']);

    const body = JSON.parse(event.body || '{}');
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) return response.error(parsed.error.message, 422);

    const { guestId, roomId, checkIn, checkOut, adults, children, source, specialRequests } = parsed.data;

    const reservation = await withTransaction(async (client) => {
      await setTenantContext(client, auth.tenantId);

      // Check room availability
      const conflict = await client.query(
        `SELECT id FROM reservations
         WHERE room_id = $1
           AND tenant_id = $2
           AND status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW')
           AND NOT (check_out <= $3 OR check_in >= $4)`,
        [roomId, auth.tenantId, checkIn, checkOut]
      );

      if (conflict.rows.length > 0) {
        throw new Error('Room is not available for the selected dates');
      }

      const id = uuidv4();
      const folioId = uuidv4();

      // Create the folio first
      await client.query(
        `INSERT INTO folios (id, tenant_id, reservation_id, status, total_amount, settled_amount, balance_due)
         VALUES ($1, $2, $3, 'OPEN', 0, 0, 0)`,
        [folioId, auth.tenantId, id]
      );

      // Create reservation
      await client.query(
        `INSERT INTO reservations (id, tenant_id, guest_id, room_id, check_in, check_out,
          status, source, adults, children, special_requests, folio_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, $8, $9, $10, $11, NOW())`,
        [id, auth.tenantId, guestId, roomId, checkIn, checkOut, source, adults, children, specialRequests, folioId]
      );

      const result = await client.query(
        `SELECT r.*, g.name as guest_name, rm.room_number
         FROM reservations r
         JOIN guests g ON g.id = r.guest_id
         JOIN rooms rm ON rm.id = r.room_id
         WHERE r.id = $1`,
        [id]
      );

      return result.rows[0];
    });

    return response.ok(reservation, 201);
  } catch (err: any) {
    console.error('[createReservation]', err.message);
    return response.error(err.message, err.message.includes('not available') ? 409 : 500);
  }
};

// ─── Check In ─────────────────────────────────────────────────────────────────
export const checkIn = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    requireRole(auth, ['SUPER_ADMIN', 'HOTEL_ADMIN', 'FRONT_DESK', 'MANAGER']);

    const reservationId = event.pathParameters?.reservationId;
    if (!reservationId) return response.error('reservationId is required', 400);

    const body = JSON.parse(event.body || '{}');
    const parsed = CheckInSchema.safeParse(body);
    if (!parsed.success) return response.error(parsed.error.message, 422);

    const dynamo = getDynamoClient();

    const reservation = await withTransaction(async (client) => {
      await setTenantContext(client, auth.tenantId);

      // Verify reservation exists and is confirmed
      const res = await client.query(
        `SELECT r.*, rm.room_number, rm.id as room_id FROM reservations r
         JOIN rooms rm ON rm.id = r.room_id
         WHERE r.id = $1 AND r.tenant_id = $2 AND r.status = 'CONFIRMED'`,
        [reservationId, auth.tenantId]
      );

      if (res.rows.length === 0) {
        throw new Error('Reservation not found or not in CONFIRMED status');
      }

      const { room_id, room_number } = res.rows[0];

      // Update reservation to CHECKED_IN
      await client.query(
        `UPDATE reservations SET status = 'CHECKED_IN', updated_at = NOW() WHERE id = $1`,
        [reservationId]
      );

      // Update guest ID doc info
      await client.query(
        `UPDATE guests SET id_doc_type = $1, id_doc_number = $2, id_doc_s3_key = $3
         WHERE id = (SELECT guest_id FROM reservations WHERE id = $4)`,
        [parsed.data.idDocType, parsed.data.idDocNumber, parsed.data.idDocS3Key, reservationId]
      );

      // Update DynamoDB room status to OCCUPIED
      await dynamo.send(new PutCommand({
        TableName: TABLES.ROOM_STATUS,
        Item: {
          pk: `TENANT#${auth.tenantId}`,
          sk: `ROOM#${room_id}`,
          roomNumber: room_number,
          status: 'OCCUPIED',
          reservationId,
          tenantId: auth.tenantId,
          updatedAt: new Date().toISOString(),
        },
      }));

      return res.rows[0];
    });

    return response.ok({ message: 'Check-in successful', reservation });
  } catch (err: any) {
    console.error('[checkIn]', err.message);
    return response.error(err.message, 400);
  }
};

// ─── Check Out ────────────────────────────────────────────────────────────────
export const checkOut = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    requireRole(auth, ['SUPER_ADMIN', 'HOTEL_ADMIN', 'FRONT_DESK', 'MANAGER']);

    const reservationId = event.pathParameters?.reservationId;
    if (!reservationId) return response.error('reservationId is required', 400);

    const dynamo = getDynamoClient();

    const result = await withTransaction(async (client) => {
      await setTenantContext(client, auth.tenantId);

      const res = await client.query(
        `SELECT r.folio_id, rm.id as room_id, rm.room_number, fo.balance_due
         FROM reservations r
         JOIN rooms rm ON rm.id = r.room_id
         JOIN folios fo ON fo.id = r.folio_id
         WHERE r.id = $1 AND r.tenant_id = $2 AND r.status = 'CHECKED_IN'`,
        [reservationId, auth.tenantId]
      );

      if (res.rows.length === 0) {
        throw new Error('Reservation not found or guest not checked in');
      }

      const { folio_id, room_id, room_number, balance_due } = res.rows[0];

      // Update reservation
      await client.query(
        `UPDATE reservations SET status = 'CHECKED_OUT', updated_at = NOW() WHERE id = $1`,
        [reservationId]
      );

      // Close folio
      await client.query(
        `UPDATE folios SET status = 'CLOSED', closed_at = NOW() WHERE id = $1`,
        [folio_id]
      );

      // Update DynamoDB room status to DIRTY (triggers housekeeping)
      await dynamo.send(new PutCommand({
        TableName: TABLES.ROOM_STATUS,
        Item: {
          pk: `TENANT#${auth.tenantId}`,
          sk: `ROOM#${room_id}`,
          roomNumber: room_number,
          status: 'DIRTY',
          reservationId: null,
          tenantId: auth.tenantId,
          updatedAt: new Date().toISOString(),
        },
      }));

      // Also create housekeeping task
      await dynamo.send(new PutCommand({
        TableName: TABLES.HK_TASKS,
        Item: {
          pk: `TENANT#${auth.tenantId}`,
          sk: `TASK#${uuidv4()}`,
          roomId: room_id,
          roomNumber: room_number,
          taskType: 'CHECKOUT_CLEAN',
          status: 'PENDING',
          priority: 'HIGH',
          tenantId: auth.tenantId,
          createdAt: new Date().toISOString(),
        },
      }));

      return { folioId: folio_id, balanceDue: balance_due, roomNumber: room_number };
    });

    return response.ok({
      message: 'Check-out successful. Housekeeping task created.',
      ...result,
    });
  } catch (err: any) {
    console.error('[checkOut]', err.message);
    return response.error(err.message, 400);
  }
};

// ─── Tape Chart ───────────────────────────────────────────────────────────────
export const getTapeChart = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    requireRole(auth, ['SUPER_ADMIN', 'HOTEL_ADMIN', 'FRONT_DESK', 'MANAGER']);

    const startDate = event.queryStringParameters?.startDate || new Date().toISOString().split('T')[0];
    const days = parseInt(event.queryStringParameters?.days || '14');

    const pool = (await import('@weazy-pms/shared')).getDbPool();
    const client = await pool.connect();

    try {
      await setTenantContext(client, auth.tenantId);

      const rooms = await client.query(
        `SELECT id, room_number, room_type, floor, rate_per_night FROM rooms
         WHERE tenant_id = $1 AND is_active = true ORDER BY room_number`,
        [auth.tenantId]
      );

      const reservations = await client.query(
        `SELECT r.id, r.room_id, r.check_in, r.check_out, r.status,
                g.name as guest_name, g.phone
         FROM reservations r
         JOIN guests g ON g.id = r.guest_id
         WHERE r.tenant_id = $1
           AND r.status NOT IN ('CANCELLED', 'NO_SHOW')
           AND r.check_in < ($2::date + $3 * INTERVAL '1 day')
           AND r.check_out > $2::date`,
        [auth.tenantId, startDate, days]
      );

      return response.ok({
        startDate,
        days,
        rooms: rooms.rows,
        reservations: reservations.rows,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[getTapeChart]', err.message);
    return response.error(err.message, 500);
  }
};

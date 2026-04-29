import { APIGatewayProxyEvent } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { PmsClaims, PmsRole } from '../types';

export interface AuthContext {
  userId: string;
  email: string;
  tenantId: string;
  role: PmsRole;
  isApiKey: boolean;
}

/**
 * Extracts and validates auth context from Lambda event.
 * Supports both Cognito JWT (for dashboard users) and
 * API Key auth (for Weazy Billing POS integration).
 */
export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  // 1. Check for POS API Key auth (X-API-Key header)
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (apiKey) {
    // API key is pre-validated by API Gateway Usage Plan
    // Tenant ID must be in the request body for API key auth
    const body = event.body ? JSON.parse(event.body) : {};
    return {
      userId: 'pos-service',
      email: 'pos@weazy-billing.internal',
      tenantId: body.tenantId,
      role: 'POS_SERVICE',
      isApiKey: true,
    };
  }

  // 2. Cognito JWT auth
  const authHeader = event.headers['Authorization'] || event.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  // In production, verify against Cognito public keys (JWKS)
  // For Lambda@Edge / API Gateway, Cognito authorizer handles this
  const claims = jwt.decode(token) as PmsClaims;

  if (!claims) throw new Error('Invalid JWT token');

  const tenantId = claims['custom:tenant_id'];
  const role = claims['custom:role'] as PmsRole;

  if (!tenantId) throw new Error('Missing tenant_id in token claims');

  return {
    userId: claims.sub,
    email: claims.email,
    tenantId,
    role,
    isApiKey: false,
  };
}

/**
 * Role-based access control guard.
 */
export function requireRole(
  ctx: AuthContext,
  allowedRoles: PmsRole[]
): void {
  if (!allowedRoles.includes(ctx.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
}

/**
 * Standard Lambda response helpers.
 */
export const response = {
  ok: <T>(data: T, statusCode = 200) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
    },
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
  }),

  error: (message: string, statusCode = 400) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    }),
  }),
};

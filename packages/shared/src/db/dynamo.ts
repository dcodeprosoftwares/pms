import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let ddbClient: DynamoDBDocumentClient | null = null;

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!ddbClient) {
    const base = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
    ddbClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return ddbClient;
}

// Table name constants (injected via environment)
export const TABLES = {
  ROOM_STATUS: process.env.DYNAMO_ROOM_STATUS_TABLE || 'weazy-pms-room-status',
  SESSIONS:    process.env.DYNAMO_SESSIONS_TABLE    || 'weazy-pms-sessions',
  HK_TASKS:    process.env.DYNAMO_HK_TASKS_TABLE    || 'weazy-pms-hk-tasks',
} as const;

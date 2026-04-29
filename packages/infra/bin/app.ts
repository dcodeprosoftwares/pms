import * as cdk from 'aws-cdk-lib';
import { DatabaseStack }  from './stacks/database-stack';
import { AuthStack }      from './stacks/auth-stack';
import { ApiStack }       from './stacks/api-stack';
import { EventsStack }    from './stacks/events-stack';
import { StorageStack }   from './stacks/storage-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  process.env.CDK_DEFAULT_REGION || 'ap-south-1',
};

const stage = app.node.tryGetContext('env') || 'dev';
const prefix = `WeazyPMS-${stage}`;

// ─── Storage (S3) ─────────────────────────────────────────────────────────────
const storageStack = new StorageStack(app, `${prefix}-Storage`, { env });

// ─── Database (Aurora + DynamoDB) ────────────────────────────────────────────
const dbStack = new DatabaseStack(app, `${prefix}-Database`, { env });

// ─── Auth (Cognito) ───────────────────────────────────────────────────────────
const authStack = new AuthStack(app, `${prefix}-Auth`, { env });

// ─── API (Lambda + API Gateway) ───────────────────────────────────────────────
const apiStack = new ApiStack(app, `${prefix}-Api`, {
  env,
  vpc:          dbStack.vpc,
  auroraCluster: dbStack.auroraCluster,
  roomStatusTable: dbStack.roomStatusTable,
  sessionsTable:   dbStack.sessionsTable,
  hkTasksTable:    dbStack.hkTasksTable,
  userPool:        authStack.userPool,
  guestDocsBucket: storageStack.guestDocsBucket,
  reportsBucket:   storageStack.reportsBucket,
});

// ─── Events (EventBridge + SQS) ──────────────────────────────────────────────
new EventsStack(app, `${prefix}-Events`, {
  env,
  nightAuditFn: apiStack.nightAuditFn,
});

cdk.Tags.of(app).add('Project', 'WeazyPMS');
cdk.Tags.of(app).add('Stage', stage);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

import * as cdk  from 'aws-cdk-lib';
import * as ec2   from 'aws-cdk-lib/aws-ec2';
import * as rds   from 'aws-cdk-lib/aws-rds';
import * as dynamo from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly auroraCluster: rds.DatabaseCluster;
  public readonly roomStatusTable: dynamo.Table;
  public readonly sessionsTable: dynamo.Table;
  public readonly hkTasksTable: dynamo.Table;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ─── VPC ───────────────────────────────────────────────────────────
    this.vpc = new ec2.Vpc(this, 'PmsVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public',   subnetType: ec2.SubnetType.PUBLIC,            cidrMask: 24 },
        { name: 'Private',  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED,  cidrMask: 24 },
      ],
    });

    // ─── Aurora Serverless v2 (PostgreSQL) ─────────────────────────────
    const dbSg = new ec2.SecurityGroup(this, 'AuroraSg', {
      vpc: this.vpc,
      description: 'Aurora Serverless SG',
      allowAllOutbound: false,
    });

    const dbSecret = new rds.DatabaseSecret(this, 'AuroraSecret', {
      username: 'pms_admin',
      secretName: 'weazy-pms/aurora-credentials',
    });

    this.auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      defaultDatabaseName: 'weazypms',
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 8,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: [
        rds.ClusterInstance.serverlessV2('reader', { scaleWithWriter: true }),
      ],
      enableDataApi: true,
      storageEncrypted: true,
      deletionProtection: true,
      backup: { retention: cdk.Duration.days(7) },
    });

    // ─── DynamoDB — Room Status (real-time) ────────────────────────────
    this.roomStatusTable = new dynamo.Table(this, 'RoomStatusTable', {
      tableName: 'weazy-pms-room-status',
      partitionKey: { name: 'pk', type: dynamo.AttributeType.STRING },
      sortKey:      { name: 'sk', type: dynamo.AttributeType.STRING },
      billingMode:  dynamo.BillingMode.PAY_PER_REQUEST,
      encryption:   dynamo.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
    });

    // ─── DynamoDB — Sessions ───────────────────────────────────────────
    this.sessionsTable = new dynamo.Table(this, 'SessionsTable', {
      tableName: 'weazy-pms-sessions',
      partitionKey: { name: 'pk', type: dynamo.AttributeType.STRING },
      sortKey:      { name: 'sk', type: dynamo.AttributeType.STRING },
      billingMode:  dynamo.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
    });

    // ─── DynamoDB — Housekeeping Tasks ────────────────────────────────
    this.hkTasksTable = new dynamo.Table(this, 'HkTasksTable', {
      tableName: 'weazy-pms-hk-tasks',
      partitionKey: { name: 'pk', type: dynamo.AttributeType.STRING },
      sortKey:      { name: 'sk', type: dynamo.AttributeType.STRING },
      billingMode:  dynamo.BillingMode.PAY_PER_REQUEST,
      stream:       dynamo.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for status-based queries
    this.hkTasksTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'pk',     type: dynamo.AttributeType.STRING },
      sortKey:      { name: 'status', type: dynamo.AttributeType.STRING },
    });

    // ─── Outputs ───────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AuroraEndpoint', {
      value: this.auroraCluster.clusterEndpoint.hostname,
      exportName: 'WeazyPMS-AuroraEndpoint',
    });

    new cdk.CfnOutput(this, 'RoomStatusTableName', {
      value: this.roomStatusTable.tableName,
    });
  }
}

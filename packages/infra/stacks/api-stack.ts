import * as cdk      from 'aws-cdk-lib';
import * as lambda    from 'aws-cdk-lib/aws-lambda';
import * as apigw     from 'aws-cdk-lib/aws-apigateway';
import * as cognito   from 'aws-cdk-lib/aws-cognito';
import * as ec2       from 'aws-cdk-lib/aws-ec2';
import * as rds       from 'aws-cdk-lib/aws-rds';
import * as dynamo    from 'aws-cdk-lib/aws-dynamodb';
import * as s3        from 'aws-cdk-lib/aws-s3';
import * as iam       from 'aws-cdk-lib/aws-iam';
import * as logs      from 'aws-cdk-lib/aws-logs';
import { Construct }  from 'constructs';
import * as path      from 'path';

interface ApiStackProps extends cdk.StackProps {
  vpc:              ec2.Vpc;
  auroraCluster:    rds.DatabaseCluster;
  roomStatusTable:  dynamo.Table;
  sessionsTable:    dynamo.Table;
  hkTasksTable:     dynamo.Table;
  userPool:         cognito.UserPool;
  guestDocsBucket:  s3.Bucket;
  reportsBucket:    s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly nightAuditFn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      vpc, auroraCluster, roomStatusTable, sessionsTable,
      hkTasksTable, userPool, guestDocsBucket, reportsBucket,
    } = props;

    // ─── Lambda Security Group ─────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc,
      description: 'Lambda to Aurora SG',
    });
    auroraCluster.connections.allowFrom(lambdaSg, ec2.Port.tcp(5432));

    // ─── Shared Lambda Environment ────────────────────────────────────
    const sharedEnv: Record<string, string> = {
      DB_HOST:                   auroraCluster.clusterEndpoint.hostname,
      DB_PORT:                   '5432',
      DB_NAME:                   'weazypms',
      DB_USER:                   'pms_admin',
      DYNAMO_ROOM_STATUS_TABLE:  roomStatusTable.tableName,
      DYNAMO_SESSIONS_TABLE:     sessionsTable.tableName,
      DYNAMO_HK_TASKS_TABLE:     hkTasksTable.tableName,
      GUEST_DOCS_BUCKET:         guestDocsBucket.bucketName,
      REPORTS_BUCKET:            reportsBucket.bucketName,
      COGNITO_USER_POOL_ID:      userPool.userPoolId,
      NODE_OPTIONS:              '--enable-source-maps',
      AWS_REGION:                this.region,
    };

    // ─── Lambda Factory ────────────────────────────────────────────────
    const makeFn = (
      name: string,
      handler: string,
      extraEnv?: Record<string, string>
    ): lambda.Function => {
      const fn = new lambda.Function(this, name, {
        functionName: `weazy-pms-${name.toLowerCase()}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler,
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../functions/dist')
        ),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [lambdaSg],
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment: { ...sharedEnv, ...extraEnv },
        logRetention: logs.RetentionDays.ONE_MONTH,
        tracing: lambda.Tracing.ACTIVE,
      });

      // Grant DB secret read
      auroraCluster.secret?.grantRead(fn);

      // Grant DynamoDB access
      roomStatusTable.grantReadWriteData(fn);
      sessionsTable.grantReadWriteData(fn);
      hkTasksTable.grantReadWriteData(fn);

      return fn;
    };

    // ─── Lambda Functions ─────────────────────────────────────────────
    const reservationsFn = makeFn('Reservations', 'reservations/handler.getTapeChart');
    const createResFn    = makeFn('CreateReservation', 'reservations/handler.createReservation');
    const checkInFn      = makeFn('CheckIn',    'reservations/handler.checkIn');
    const checkOutFn     = makeFn('CheckOut',   'reservations/handler.checkOut');
    const postToRoomFn   = makeFn('PostToRoom', 'billing/post-to-room.handler');
    const folioFn        = makeFn('Folio',      'billing/folio.handler');

    this.nightAuditFn = makeFn('NightAudit', 'billing/night-audit.handler', {
      SES_FROM_EMAIL: 'noreply@weazypms.com',
    });

    const hkFn = makeFn('Housekeeping', 'housekeeping/handler.handler');

    // Grant S3 access
    guestDocsBucket.grantReadWrite(checkInFn);
    reportsBucket.grantReadWrite(this.nightAuditFn);

    // Grant SES for night audit emails
    this.nightAuditFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // ─── API Gateway ──────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const api = new apigw.RestApi(this, 'PmsApi', {
      restApiName: 'weazy-pms-api',
      description: 'Weazy PMS — Hotel Property Management System API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
      },
      deployOptions: {
        stageName: 'v1',
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        accessLogDestination: new apigw.LogGroupLogDestination(logGroup),
        tracingEnabled: true,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 500,
      },
    });

    // Cognito Authorizer
    const cognitoAuth = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuth', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
    });

    const authOpts: apigw.MethodOptions = {
      authorizer: cognitoAuth,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    // API Key Usage Plan (for Weazy Billing POS)
    const posApiKey = api.addApiKey('PosApiKey', {
      apiKeyName: 'weazy-billing-pos-key',
      description: 'API key for Weazy Billing POS Post-to-Room integration',
    });
    const usagePlan = api.addUsagePlan('PosUsagePlan', {
      name: 'POS Integration Plan',
      throttle: { rateLimit: 200, burstLimit: 100 },
      quota: { limit: 100000, period: apigw.Period.MONTH },
    });
    usagePlan.addApiKey(posApiKey);

    // ─── Routes ────────────────────────────────────────────────────────

    // /reservations
    const reservations = api.root.addResource('reservations');
    reservations.addMethod('GET',  new apigw.LambdaIntegration(reservationsFn), authOpts);
    reservations.addMethod('POST', new apigw.LambdaIntegration(createResFn),    authOpts);

    // /reservations/tape-chart
    const tapeChart = reservations.addResource('tape-chart');
    tapeChart.addMethod('GET', new apigw.LambdaIntegration(reservationsFn), authOpts);

    // /checkin/:reservationId
    const checkin = api.root.addResource('checkin').addResource('{reservationId}');
    checkin.addMethod('POST', new apigw.LambdaIntegration(checkInFn), authOpts);

    // /checkout/:reservationId
    const checkout = api.root.addResource('checkout').addResource('{reservationId}');
    checkout.addMethod('POST', new apigw.LambdaIntegration(checkOutFn), authOpts);

    // /folio/:reservationId
    const folio = api.root.addResource('folio').addResource('{reservationId}');
    folio.addMethod('GET',  new apigw.LambdaIntegration(folioFn), authOpts);
    folio.addMethod('POST', new apigw.LambdaIntegration(folioFn), authOpts);

    // /housekeeping
    const hk = api.root.addResource('housekeeping');
    hk.addResource('status').addMethod('POST', new apigw.LambdaIntegration(hkFn), authOpts);
    hk.addResource('tasks').addMethod('GET',   new apigw.LambdaIntegration(hkFn), authOpts);

    // /pos/post-to-room (API Key auth — for Weazy Billing)
    const pos = api.root.addResource('pos');
    const postToRoom = pos.addResource('post-to-room');
    postToRoom.addMethod('POST', new apigw.LambdaIntegration(postToRoomFn), {
      apiKeyRequired: true,   // API Gateway validates key
      authorizationType: apigw.AuthorizationType.NONE,
    });
    usagePlan.addApiStage({ stage: api.deploymentStage });

    // ─── Outputs ─────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: 'WeazyPMS-ApiUrl',
    });
    new cdk.CfnOutput(this, 'PostToRoomEndpoint', {
      value: `${api.url}pos/post-to-room`,
      description: 'Endpoint for Weazy Billing POS integration',
    });
  }
}

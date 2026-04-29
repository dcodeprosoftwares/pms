import * as cdk       from 'aws-cdk-lib';
import * as events     from 'aws-cdk-lib/aws-events';
import * as targets    from 'aws-cdk-lib/aws-events-targets';
import * as sqs        from 'aws-cdk-lib/aws-sqs';
import * as lambda     from 'aws-cdk-lib/aws-lambda';
import * as lambdaEvt  from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct }   from 'constructs';

interface EventsStackProps extends cdk.StackProps {
  nightAuditFn: lambda.Function;
}

export class EventsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { nightAuditFn } = props;

    // ─── Night Audit DLQ ─────────────────────────────────────────────
    const auditDlq = new sqs.Queue(this, 'NightAuditDlq', {
      queueName: 'weazy-pms-night-audit-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // ─── Night Audit Queue ────────────────────────────────────────────
    const auditQueue = new sqs.Queue(this, 'NightAuditQueue', {
      queueName: 'weazy-pms-night-audit',
      visibilityTimeout: cdk.Duration.minutes(10),
      deadLetterQueue: { queue: auditDlq, maxReceiveCount: 3 },
    });

    // ─── EventBridge Rule: Cron 11:59 PM IST (18:29 UTC) daily ───────
    const nightAuditRule = new events.Rule(this, 'NightAuditRule', {
      ruleName: 'weazy-pms-night-audit-trigger',
      description: 'Triggers Night Audit Lambda at 11:59 PM IST daily',
      schedule: events.Schedule.cron({
        minute: '29',
        hour: '18',     // 18:29 UTC = 23:59 IST
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // Route EventBridge → SQS → Lambda (for retry resilience)
    nightAuditRule.addTarget(new targets.SqsQueue(auditQueue));
    nightAuditFn.addEventSource(new lambdaEvt.SqsEventSource(auditQueue, {
      batchSize: 1,
      maxConcurrency: 10,
    }));

    // ─── Housekeeping Status Change Queue ─────────────────────────────
    const hkQueue = new sqs.Queue(this, 'HkStatusQueue', {
      queueName: 'weazy-pms-hk-status-updates',
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'HkDlq', { queueName: 'weazy-pms-hk-dlq' }),
        maxReceiveCount: 3,
      },
    });

    // ─── EventBus for internal PMS events ────────────────────────────
    const pmsBus = new events.EventBus(this, 'PmsEventBus', {
      eventBusName: 'weazy-pms-events',
    });

    // Archive all events for 30 days (for replay / debugging)
    pmsBus.archive('PmsEventArchive', {
      archiveName: 'weazy-pms-event-archive',
      description: 'Archive of all PMS events',
      retention: cdk.Duration.days(30),
      eventPattern: { source: ['weazy.pms'] },
    });

    new cdk.CfnOutput(this, 'PmsEventBusArn', {
      value: pmsBus.eventBusArn,
      exportName: 'WeazyPMS-EventBusArn',
    });
    new cdk.CfnOutput(this, 'HkQueueUrl', {
      value: hkQueue.queueUrl,
    });
  }
}

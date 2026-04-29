import * as cdk      from 'aws-cdk-lib';
import * as s3        from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins   from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct }  from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly guestDocsBucket: s3.Bucket;
  public readonly reportsBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ─── Guest ID Documents Bucket (private, pre-signed URLs only) ────
    this.guestDocsBucket = new s3.Bucket(this, 'GuestDocsBucket', {
      bucketName: `weazy-pms-guest-docs-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [{
        id: 'expire-old-docs',
        expiration: cdk.Duration.days(2555), // 7 years retention
        noncurrentVersionExpiration: cdk.Duration.days(90),
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── Night Audit Reports Bucket ───────────────────────────────────
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `weazy-pms-reports-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        id: 'archive-old-reports',
        transitions: [{
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(90),
        }],
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── Frontend Hosting Bucket (CloudFront) ─────────────────────────
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `weazy-pms-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    const distribution = new cloudfront.Distribution(this, 'FrontendCdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          this.frontendBucket,
          { originAccessControl: oac }
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      exportName: 'WeazyPMS-CloudFrontUrl',
    });
    new cdk.CfnOutput(this, 'GuestDocsBucketName', {
      value: this.guestDocsBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'ReportsBucketName', {
      value: this.reportsBucket.bucketName,
    });
  }
}

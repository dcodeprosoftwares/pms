import * as cdk     from 'aws-cdk-lib';
import * as cognito  from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ─── Cognito User Pool ────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'PmsUserPool', {
      userPoolName: 'weazy-pms-users',
      selfSignUpEnabled: false,           // Admin creates users only
      signInAliases: {
        email: true,
        username: false,
        phone: false,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: false }),
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── App Client ───────────────────────────────────────────────────
    this.userPoolClient = this.userPool.addClient('PmsWebClient', {
      userPoolClientName: 'weazy-pms-web',
      authFlows: {
        userSrp: true,
        userPassword: false,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // ─── Groups (Roles) ───────────────────────────────────────────────
    const groups = ['SUPER_ADMIN', 'HOTEL_ADMIN', 'FRONT_DESK', 'HOUSEKEEPING', 'MANAGER'];
    groups.forEach((groupName) => {
      new cognito.CfnUserPoolGroup(this, `Group${groupName}`, {
        userPoolId: this.userPool.userPoolId,
        groupName,
        description: `${groupName} role for Weazy PMS`,
      });
    });

    // ─── Outputs ──────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'WeazyPMS-UserPoolId',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'WeazyPMS-UserPoolClientId',
    });
  }
}

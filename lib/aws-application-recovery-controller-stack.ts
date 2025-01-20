import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { createGlobalAuroraCluster, createAuroraCluster } from './aurora-stack';
import { createSQSQueue } from './sqs-lambda-api';
import { VPC_EAST, VPC_WEST } from './common-vars';

export class AwsApplicationRecoveryControllerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const region = props?.env?.region!;
    const vpcConfig = region === 'us-east-1' ? VPC_EAST : VPC_WEST;

    const vpc = ec2.Vpc.fromVpcAttributes(this, `Vpc-${region}`, {
      vpcId: vpcConfig.vpcId,
      availabilityZones: vpcConfig.availabilityZones,
      privateSubnetIds: vpcConfig.privateSubnets,
    });

    // S3 Bucket
    const bucket = new s3.Bucket(this, `AppBucket-${region}`, {
      bucketName: `le-arc-app-ss-dev-${region.replace(/-/g, '')}-s3`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // SQS Queue for processing messages
    const mainQueue = createSQSQueue(this, region);

    // Create a security group for Lambda to access Aurora DB
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, `LambdaSG-${region}`, {
      vpc,
    });

    const auroraSecurityGroup = new ec2.SecurityGroup(this, `AuroraSG-${region}`, {
      vpc
    });

    auroraSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to access Aurora'
    );

    const apiHandlerLambdaRole = new iam.Role(this, `ApiHandlerLambdaRole-${region}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSDataFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });
    
    // Add SQS send permission
    apiHandlerLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [mainQueue.queueArn], // Replace with your actual queue ARN
      })
    );

    // Lambda function to process SQS messages and write to Aurora
    const processorLambda = new lambda.Function(this, `MessageProcessor-${region}`, {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'processor.handler',
      environment: {
        QUEUE_URL: mainQueue.queueUrl,
        DB_CLUSTER_ARN: `arn:aws:rds:${region}:${cdk.Stack.of(this).account}:cluster/le-arc-app-global-db`,
        DB_SECRET_ARN: `arn:aws:secretsmanager:${region}:${cdk.Stack.of(this).account}:secret:le-arc-app-db-secret`,
      },
      vpc: vpc,
      vpcSubnets: { 
        subnets: (region === 'us-east-1' ? VPC_EAST.lambdaSubnets : VPC_WEST.lambdaSubnets).map((id, index) =>
          ec2.Subnet.fromSubnetId(this, `Subnet-${id}-${index}`, id)
        ),
      },
      securityGroups: [lambdaSecurityGroup],
      role: apiHandlerLambdaRole,
    });    

    mainQueue.grantConsumeMessages(processorLambda);

    // Attach SQS event source to the Lambda processor
    processorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(mainQueue, {
        batchSize: 5,
      })
    );

    // Aurora Cluster
    let globalClusterIdentifier: string | undefined;
    if (region === 'us-east-1') {
      const globalCluster = createGlobalAuroraCluster(this, region);
      globalClusterIdentifier = globalCluster.globalClusterIdentifier;
    } else {
      globalClusterIdentifier = 'le-arc-app-global-db';
    }
    createAuroraCluster(this, region, region === 'us-east-1' ? VPC_EAST.privateSubnets : VPC_WEST.privateSubnets, "le-arc-app-global-db", auroraSecurityGroup.securityGroupId);

    // API Gateway for POST operation
    const postApiLambda = new lambda.Function(this, `ApiHandler-${region}`, {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'api.handler',
      environment: {
        QUEUE_URL: mainQueue.queueUrl,
      },
      vpc: vpc,
      vpcSubnets: { 
        subnets: (region === 'us-east-1' ? VPC_EAST.lambdaSubnets : VPC_WEST.lambdaSubnets).map(id =>
          ec2.Subnet.fromSubnetId(this, `Subnet-${id}`, id)
        ),
      },
      securityGroups: [lambdaSecurityGroup],
      role: apiHandlerLambdaRole,
    });

    // API Gateway Integration
    const api = new apigateway.RestApi(this, `AppApi-${region}`, {
      deployOptions: { stageName: 'prod' },
    });

    const items = api.root.addResource('items');
    items.addMethod('POST', new apigateway.LambdaIntegration(postApiLambda));
    items.addMethod(
      'GET',
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "message": "You are in ${region}"
              }`,
            },
          },
        ],
        requestTemplates: { 'application/json': '{"statusCode": 200}' },
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseModels: {
              'application/json': apigateway.Model.EMPTY_MODEL,
            },
          },
        ],
      }
    );
  }
}
  
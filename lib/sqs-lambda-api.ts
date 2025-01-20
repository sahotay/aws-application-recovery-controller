import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export function createSQSQueue(stack: cdk.Stack, region: string) {
  const dlq = new sqs.Queue(stack, `DLQ-${region}`, {
    queueName: `arc-app-ss-dev-${region}-dlq`,
  });

  return new sqs.Queue(stack, `MainQueue-${region}`, {
    queueName: `arc-app-ss-dev-${region}-q`,
    deadLetterQueue: { maxReceiveCount: 5, queue: dlq },
  });
}

export function createLambdaFunction(stack: cdk.Stack, queue: sqs.Queue, region: string) {
  const lambdaFunction = new lambda.Function(stack, `Lambda-${region}`, {
    functionName: `arc-app-ss-dev-${region}-lambda`,
    runtime: lambda.Runtime.NODEJS_18_X,
    code: lambda.Code.fromInline(`
      exports.handler = async (event) => ({
        statusCode: 200,
        body: JSON.stringify({ message: "Hello from Lambda!" }),
      });
    `),
    handler: 'index.handler',
    environment: {
      QUEUE_URL: queue.queueUrl,
    },
  });

  queue.grantSendMessages(lambdaFunction);
  return lambdaFunction;
}

export function createApiGateway(stack: cdk.Stack, lambdaFunction: lambda.IFunction, region: string) {
  const api = new apigateway.RestApi(stack, `API-${region}`, {
    restApiName: `arc-sample-app-${region}`,
  });

  const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);
  const items = api.root.addResource('items');
  items.addMethod('GET', lambdaIntegration);
  items.addMethod('POST', lambdaIntegration);
}

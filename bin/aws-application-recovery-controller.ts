#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsApplicationRecoveryControllerStack } from '../lib/aws-application-recovery-controller-stack';

const app = new cdk.App();

const regions = ['us-east-1', 'us-west-2'];
regions.forEach(region => {
  new AwsApplicationRecoveryControllerStack(app, `ArcAppStack-${region}`, { env: { region } });
});

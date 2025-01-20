import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export function createGlobalAuroraCluster(stack: cdk.Stack, region: string) {
  const globalCluster = new rds.CfnGlobalCluster(stack, 'AuroraGlobalCluster', {
    globalClusterIdentifier: 'le-arc-app-global-db',
    engine: 'aurora-postgresql',
  });

  return globalCluster;
}

export function createAuroraCluster(stack: cdk.Stack, region: string, subnetIds: string[], globalClusterIdentifier: string, auroraSecurityGroup: string) {
  console.log('Using Subnet IDs:', subnetIds);

  if (subnetIds.length === 0) {
    throw new Error('No private subnets found.');
  }
  const isPrimaryRegion = region === 'us-east-1';
  
  const dbCluster = new rds.CfnDBCluster(stack, `AuroraCluster${region}`, {
    engine: 'aurora-postgresql',
    globalClusterIdentifier: globalClusterIdentifier,
    dbClusterIdentifier: `le-arc-app-${region}`,
    dbSubnetGroupName: createDbSubnetGroup(stack, `${region}DbSubnetGroup`, subnetIds),
    masterUsername: isPrimaryRegion ? 'rahul' : undefined,
    masterUserPassword: isPrimaryRegion ? 'password' : undefined,
    serverlessV2ScalingConfiguration: {
      minCapacity: 2,
      maxCapacity: 4,
    },
    vpcSecurityGroupIds: [auroraSecurityGroup],
  });

  const auroraV2Instance = new rds.CfnDBInstance(stack, `AuroraInstance${region}`, {
    dbClusterIdentifier: dbCluster.ref,
    engine: "aurora-postgresql",
    dbInstanceClass: "db.serverless",
  });

  const dbSecret = new secretsmanager.Secret(stack, 'AuroraDBCredentials', {
    secretName: 'aurora-db-credentials',
    generateSecretString: {
      secretStringTemplate: JSON.stringify({
        username: 'rahul',
      }),
      generateStringKey: 'password',
      passwordLength: 16,
    },
  });

  return dbCluster;
}

function createDbSubnetGroup(stack: cdk.Stack, id: string, subnetIds: string[]) {
  const subnetGroup = new rds.CfnDBSubnetGroup(stack, id, {
    dbSubnetGroupName: `${id}-group`,
    subnetIds: subnetIds,
    dbSubnetGroupDescription: 'Aurora Subnet Group',
  });
  return subnetGroup.dbSubnetGroupName!;
}

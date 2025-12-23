import * as aws from '@pulumi/aws';

export function createDynamoDBTable() {
  return new aws.dynamodb.Table('transactions', {
    name: 'transactions',
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'transaction_id',
    attributes: [{
      name: 'transaction_id',
      type: 'S'
    }],
    pointInTimeRecovery: {
      enabled: true
    },
    serverSideEncryption: {
      enabled: true
    },
    tags: {
      Environment: 'dev',
      ManagedBy: 'Pulumi'
    }
  });
}


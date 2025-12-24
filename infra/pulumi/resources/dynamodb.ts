import * as aws from '@pulumi/aws';

class TransactionsDynamoDb {
  transactionsTable: aws.dynamodb.Table;

  constructor(stack: string) {
    this.transactionsTable = new aws.dynamodb.Table(
      `transactions-${stack}`,
      {
        name: `transactions-${stack}`,
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
          Name: `transactions-${stack}`,
          Environment: stack,
          ManagedBy: 'Pulumi'
        }
      }
    );
  }
}

export default TransactionsDynamoDb;

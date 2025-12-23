# WFG Webhook Service

A serverless backend service that receives transaction webhooks, acknowledges them immediately, and processes transactions reliably in the background with idempotency guarantees.

## Architecture

The service consists of two Lambda functions:

- **API Lambda**: Handles HTTP requests via API Gateway, validates transactions, stores them in DynamoDB, and triggers background processing using asynchronous Lambda invocation.
- **Worker Lambda**: Processes transactions asynchronously with a 30-second delay and updates transaction status to PROCESSED.

### Key Features

- ✅ **Immediate Acknowledgment**: API responds with 202 Accepted in < 500ms
- ✅ **Idempotency**: DynamoDB conditional writes prevent duplicate transactions
- ✅ **Async Processing**: Worker Lambda processes transactions independently without blocking
- ✅ **Scalability**: Each webhook triggers an independent worker Lambda invocation

## Technology Stack

- **Runtime**: Node.js 18.x (TypeScript)
- **Compute**: AWS Lambda
- **API**: AWS API Gateway HTTP API
- **Database**: AWS DynamoDB
- **Infrastructure**: Pulumi (TypeScript)

## Project Structure

```
wfg-webhook-service/
├── services/
│   ├── api/
│   │   ├── handler.ts          # API Lambda handler
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── worker/
│       ├── handler.ts           # Worker Lambda handler
│       ├── package.json
│       └── tsconfig.json
├── infra/
│   └── pulumi/
│       ├── index.ts             # Main Pulumi entry point
│       ├── dynamodb.ts          # DynamoDB table
│       ├── iam.ts               # IAM roles and policies
│       ├── api-lambda.ts        # API Lambda infrastructure
│       ├── worker-lambda.ts     # Worker Lambda infrastructure
│       ├── api-gateway.ts       # API Gateway configuration
│       └── Pulumi.yaml
├── shared/
│   └── types.ts                 # Shared TypeScript types
└── README.md
```

## Prerequisites

1. **Node.js** 18+ installed
2. **AWS CLI** configured with credentials
3. **Pulumi CLI** installed (`npm install -g @pulumi/pulumi`)
4. **AWS Account** with appropriate permissions

## Getting Started

### 1. Install Dependencies

```bash
# Install API Lambda dependencies
cd services/api
npm install
npm run build

# Install Worker Lambda dependencies
cd ../worker
npm install
npm run build

# Install Infrastructure dependencies
cd ../../infra/pulumi
npm install
```

### 2. Configure Pulumi Stack

```bash
cd infra/pulumi

# Login to Pulumi (first time only)
pulumi login

# Create/select stack
pulumi stack init wfg-dev
# or
pulumi stack select wfg-dev

# Configure AWS region (if needed)
pulumi config set aws:region us-east-1
```

### 3. Deploy Infrastructure

```bash
# Preview changes
pulumi preview

# Deploy
pulumi up

# Note the API Gateway URL from output (apiUrl)
```

After deployment, you'll see output like:
```
Outputs:
  apiUrl: "https://<api-id>.execute-api.us-east-1.amazonaws.com"
  tableName: "transactions"
```

## API Endpoints

### 1. Health Check

**Endpoint**: `GET /`

**Response** (200 OK):
```json
{
  "status": "HEALTHY",
  "current_time": "2024-01-15T10:30:00.000Z"
}
```

**Example**:
```bash
curl https://<api-gateway-url>/
```

### 2. Webhook Endpoint

**Endpoint**: `POST /v1/webhooks/transactions`

**Request Body**:
```json
{
  "transaction_id": "txn_abc123def456",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR"
}
```

**Response**: HTTP 202 Accepted (empty body)

**Example**:
```bash
curl -X POST https://<api-gateway-url>/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test_001",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": 1500,
    "currency": "INR"
  }'
```

### 3. Transaction Status

**Endpoint**: `GET /v1/transactions/{transaction_id}`

**Response** (200 OK):
```json
{
  "transaction_id": "txn_abc123def456",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR",
  "status": "PROCESSED",
  "created_at": "2024-01-15T10:30:00.000Z",
  "processed_at": "2024-01-15T10:30:30.000Z"
}
```

**Example**:
```bash
curl https://<api-gateway-url>/v1/transactions/txn_test_001
```

## Testing

### Test Scenarios

#### 1. Single Transaction Flow

```bash
# 1. Submit webhook
curl -X POST https://<api-gateway-url>/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test_001",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": 1500,
    "currency": "INR"
  }'

# 2. Check status immediately (should be PROCESSING)
curl https://<api-gateway-url>/v1/transactions/txn_test_001

# 3. Wait 35 seconds, then check again (should be PROCESSED)
sleep 35
curl https://<api-gateway-url>/v1/transactions/txn_test_001
```

#### 2. Idempotency Test

```bash
# Send the same webhook multiple times
for i in {1..5}; do
  curl -X POST https://<api-gateway-url>/v1/webhooks/transactions \
    -H "Content-Type: application/json" \
    -d '{
      "transaction_id": "txn_idempotent_test",
      "source_account": "acc_user_789",
      "destination_account": "acc_merchant_456",
      "amount": 1500,
      "currency": "INR"
    }'
done

# Check DynamoDB - should have only ONE record
curl https://<api-gateway-url>/v1/transactions/txn_idempotent_test
```

All 5 requests should return 202 Accepted, but only one transaction record should exist in DynamoDB.

## How Idempotency Works

Idempotency is implemented using DynamoDB conditional writes:

1. **API Lambda** attempts to insert transaction with `ConditionExpression: 'attribute_not_exists(transaction_id)'`
2. If transaction already exists, DynamoDB returns `ConditionalCheckFailedException`
3. API Lambda still returns 202 Accepted (idempotent behavior)
4. Worker Lambda is only invoked if the transaction is newly created

This ensures:
- ✅ Duplicate webhooks don't create duplicate records
- ✅ Duplicate webhooks don't trigger duplicate processing
- ✅ System remains consistent under retries

## Architecture Decisions

### Why Direct Async Lambda Invocation?

The API Lambda triggers background processing using asynchronous Lambda invocation (`InvocationType: 'Event'`), allowing each transaction to be processed independently without blocking or queue-based ordering constraints.

**Benefits**:
- Simple architecture with minimal infrastructure
- Natural scalability (100 webhooks = 100 parallel workers)
- No queue overhead or visibility timeout tuning
- Idempotency handled at the database level

## Cleanup

To tear down all resources:

```bash
cd infra/pulumi
pulumi destroy
```

## License

[Add your license here]

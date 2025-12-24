# WFG Webhook Service

A production-ready serverless backend service that receives transaction webhooks, acknowledges them immediately, and processes transactions reliably in the background with idempotency guarantees. This service simulates real-world payment webhook handling (e.g., Razorpay, Stripe).

## Architecture

The service consists of two Lambda functions:

- **API Lambda**: Handles HTTP requests via API Gateway, validates transactions, stores them in DynamoDB immediately, and triggers background processing using asynchronous Lambda invocation.
- **Worker Lambda**: Processes transactions asynchronously with a 30-second delay and updates transaction status to PROCESSED.

### Key Features

- ✅ **Immediate Acknowledgment**: API responds with 202 Accepted in < 500ms
- ✅ **Idempotency**: DynamoDB conditional writes prevent duplicate transactions
- ✅ **Async Processing**: Worker Lambda processes transactions independently without blocking
- ✅ **Scalability**: Each webhook triggers an independent worker Lambda invocation
- ✅ **Structured Logging**: Winston-based JSON logging with request ID tracing
- ✅ **End-to-End Tracing**: Request IDs passed from API to Worker for complete request correlation
- ✅ **Clean Architecture**: Handler-based routing, service layer separation, and utility modules

## Technology Stack

- **Runtime**: Node.js 20.x (TypeScript)
- **Compute**: AWS Lambda
- **API**: AWS API Gateway HTTP API
- **Database**: AWS DynamoDB
- **Infrastructure**: Pulumi (TypeScript)
- **Logging**: Winston (structured JSON logging)

## Project Structure

```
wfg-webhook-service/
├── services/
│   ├── api/
│   │   ├── handlers/              # Route handlers (organized by domain)
│   │   │   ├── health-check.handler.ts
│   │   │   ├── webhook.handler.ts
│   │   │   ├── transaction-status.handler.ts
│   │   │   └── handler-map.ts     # Centralized route configuration
│   │   ├── services/              # Business logic layer
│   │   │   └── transaction.service.ts
│   │   ├── utils/                 # Shared utilities
│   │   │   ├── logger.ts          # Winston-based structured logging
│   │   │   ├── enums.ts           # HTTP codes, error codes, log event types
│   │   │   ├── errors.ts          # Custom error classes
│   │   │   ├── response.ts        # API Gateway response helpers
│   │   │   ├── context-builder.ts # Lambda context builder
│   │   │   └── index.ts           # Utility exports
│   │   ├── main.ts                # Main entry point with routing
│   │   ├── handler.ts             # Backward compatibility export
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── worker/
│       ├── utils/
│       │   ├── logger.ts          # Worker-specific logger
│       │   └── enums.ts           # Worker log event types
│       ├── handler.ts             # Worker handler with logging
│       ├── package.json
│       └── tsconfig.json
├── infra/
│   └── pulumi/
│       ├── index.ts               # Main Pulumi entry point
│       ├── resources/
│       │   ├── dynamodb.ts        # DynamoDB table
│       │   ├── iam.ts             # IAM roles and policies
│       │   ├── api-lambda.ts      # API Lambda infrastructure
│       │   ├── worker-lambda.ts   # Worker Lambda infrastructure
│       │   └── api-gateway.ts     # API Gateway configuration
│       └── Pulumi.yaml
├── shared/
│   └── types.ts                   # Shared TypeScript types
├── README.md
└── API_DOCUMENTATION.md
```

## Prerequisites

1. **Node.js** 20+ installed
2. **AWS CLI** configured with credentials
3. **Pulumi CLI** installed (`npm install -g @pulumi/pulumi`)
4. **AWS Account** with appropriate permissions

> **Note**: This project uses personal AWS and Pulumi accounts for development and deployment. These accounts are not shared and should be replaced with your own accounts when deploying this service.

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
  tableName: "transactions-wfg-dev"
  apiLambdaName: "api-lambda-wfg-dev"
  workerLambdaName: "worker-lambda-wfg-dev"
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

For detailed API documentation with all request/response examples, error codes, and testing scenarios, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## Testing

### Test Scenarios

#### 1. Single Transaction Flow

```bash
# Set your API URL
export API_URL="https://<api-gateway-url>"

# 1. Submit webhook
curl -X POST $API_URL/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test_001",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": 1500,
    "currency": "INR"
  }'

# 2. Check status immediately (should be PROCESSING)
curl $API_URL/v1/transactions/txn_test_001

# 3. Wait 35 seconds, then check again (should be PROCESSED)
sleep 35
curl $API_URL/v1/transactions/txn_test_001
```

#### 2. Idempotency Test

```bash
# Send the same webhook multiple times
for i in {1..5}; do
  curl -X POST $API_URL/v1/webhooks/transactions \
    -H "Content-Type: application/json" \
    -d '{
      "transaction_id": "txn_idempotent_test",
      "source_account": "acc_user_789",
      "destination_account": "acc_merchant_456",
      "amount": 1500,
      "currency": "INR"
    }'
  echo ""
done

# Check DynamoDB - should have only ONE record
curl $API_URL/v1/transactions/txn_idempotent_test
```

**Expected Behavior:**
- All 5 requests return `202 Accepted`
- Only **one** transaction record exists in the database
- Only **one** background processing job is triggered
- Querying the transaction shows a single record

#### 3. Error Handling Test

```bash
# Test missing required field
curl -X POST $API_URL/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test",
    "source_account": "acc_user_789"
  }'
# Expected: 400 Bad Request with error details

# Test invalid amount
curl -X POST $API_URL/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": -100,
    "currency": "INR"
  }'
# Expected: 400 Bad Request

# Test non-existent transaction
curl $API_URL/v1/transactions/txn_nonexistent
# Expected: 404 Not Found
```

## How Idempotency Works

Idempotency is implemented using DynamoDB conditional writes:

1. **API Lambda** attempts to insert transaction with `ConditionExpression: 'attribute_not_exists(transaction_id)'`
2. The write happens **immediately** (not after 30 seconds) - typically within 50-100ms
3. If transaction already exists, DynamoDB returns `ConditionalCheckFailedException`
4. API Lambda still returns 202 Accepted (idempotent behavior)
5. Worker Lambda is only invoked if the transaction is newly created

**Timeline:**
- `Time 0ms`: Webhook arrives → API writes to DynamoDB (PROCESSING) → Returns 202
- `Time 100ms`: Worker Lambda invoked (async)
- `Time 50ms`: Duplicate webhook arrives → Tries to write → Fails (already exists) → Returns 202
- `Time 30100ms`: Worker updates status to PROCESSED

This ensures:
- ✅ Duplicate webhooks don't create duplicate records
- ✅ Duplicate webhooks don't trigger duplicate processing
- ✅ System remains consistent under retries
- ✅ Idempotency check happens at write time, not after processing

## Technical Choices

### Why Direct Async Lambda Invocation?

The API Lambda triggers background processing using asynchronous Lambda invocation (`InvocationType: 'Event'`), allowing each transaction to be processed independently without blocking or queue-based ordering constraints.

**Benefits:**
- **Simplicity**: Minimal infrastructure, no queue management
- **Natural Scalability**: 100 webhooks = 100 parallel workers, no head-of-line blocking
- **No Queue Overhead**: No visibility timeout tuning, retry semantics, or dead-letter queues
- **Idempotency at DB Level**: DynamoDB conditional writes handle idempotency, not the queue

**Why Not SQS?**
- No ordering requirement (each transaction is independent)
- No rate limiting requirement
- No batch processing requirement
- No downstream backpressure requirement
- SQS would add unnecessary complexity for this use case

### Why DynamoDB?

- **Fast Writes**: Sub-10ms latency for conditional writes
- **Built-in Idempotency**: Conditional expressions provide atomic idempotency checks
- **Serverless**: No connection pooling, scales automatically
- **Simple Schema**: Single table with transaction_id as primary key
- **Cost-Effective**: Pay-per-request pricing model

### Why Structured Logging (Winston)?

- **Observability**: JSON logs enable easy parsing and filtering in CloudWatch
- **Request Tracing**: Request IDs enable end-to-end request correlation
- **Production-Ready**: Standard logging format for production systems
- **Debugging**: Structured logs make debugging easier with contextual information

### Why Handler-Based Architecture?

- **Separation of Concerns**: Each handler focuses on a single endpoint
- **Maintainability**: Easy to locate and modify code for specific endpoints
- **Testability**: Handlers can be tested independently
- **Scalability**: Easy to add new endpoints following the same pattern
- **Service Layer**: Business logic separated from HTTP handling

### Why TypeScript?

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Autocomplete and refactoring support
- **Shared Types**: Type definitions shared between API and Worker
- **Modern JavaScript**: ES6+ features with type checking

## Monitoring and Logging

### CloudWatch Logs

All Lambda functions log structured JSON to CloudWatch:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Received webhook request",
  "action": "RECEIVED_WEBHOOK_REQUEST",
  "context": {
    "requestId": "abc-123-def-456",
    "transaction_id": "txn_test_001"
  }
}
```

### Request Tracing

Each request is assigned a unique `requestId` that:
- Is generated in the API Lambda
- Is passed to the Worker Lambda in the invocation payload
- Appears in all logs for both API and Worker
- Enables end-to-end request correlation

### Log Event Types

The service uses enum-based log event types for consistent tracking:
- `RECEIVED_WEBHOOK_REQUEST`
- `WEBHOOK_PROCESSED_SUCCESS`
- `ERROR_WEBHOOK_REQUEST`
- `RECEIVED_WORKER_PROCESSING_REQUEST`
- `WORKER_PROCESSING_COMPLETED`
- And more...

## Error Response Format

All error responses follow a consistent flat structure:

```json
{
  "code": "BAD_REQUEST",
  "message": "Missing required fields"
}
```

**Error Codes:**
- `BAD_REQUEST`: Invalid input or missing required fields
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Cleanup

To tear down all resources:

```bash
cd infra/pulumi
pulumi destroy
```

This will remove:
- API Gateway
- API Lambda function
- Worker Lambda function
- DynamoDB table
- IAM roles and policies

# WFG Webhook Service - API Documentation

## Base URL

```
https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com
```

---

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /`

**Description:** Returns service health status and current timestamp.

**Request:**
```bash
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/
```

**Response (200 OK):**
```json
{
  "status": "HEALTHY",
  "current_time": "2024-12-23T23:58:33.435Z"
}
```

**Response Fields:**
- `status` (string): Always returns "HEALTHY"
- `current_time` (string): ISO-8601 timestamp of the current server time

---

### 2. Webhook - Submit Transaction

**Endpoint:** `POST /v1/webhooks/transactions`

**Description:** Submits a transaction webhook. Returns 202 Accepted immediately and processes the transaction asynchronously in the background (takes ~30 seconds).

**Request:**
```bash
curl -X POST https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_abc123def456",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": 1500,
    "currency": "INR"
  }'
```

**Request Payload:**
```json
{
  "transaction_id": "txn_abc123def456",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR"
}
```

**Field Requirements:**
- `transaction_id` (string, required): Unique transaction identifier. Used for idempotency.
- `source_account` (string, required): Source account identifier
- `destination_account` (string, required): Destination account identifier
- `amount` (number, required): Positive number representing transaction amount
- `currency` (string, required): Currency code (e.g., "INR", "USD", "EUR")

**Response (202 Accepted):**
```
(Empty body)
```

**Error Responses:**

All error responses follow a consistent flat structure:

**400 Bad Request - Missing Required Fields:**
```json
{
  "code": "BAD_REQUEST",
  "message": "Missing required fields"
}
```

**400 Bad Request - Invalid Amount:**
```json
{
  "code": "BAD_REQUEST",
  "message": "Amount must be a positive number"
}
```

**400 Bad Request - Invalid JSON:**
```json
{
  "code": "BAD_REQUEST",
  "message": "Invalid JSON in request body"
}
```

**400 Bad Request - No Body:**
```json
{
  "code": "BAD_REQUEST",
  "message": "Request body is required"
}
```

**500 Internal Server Error:**
```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Failed to process webhook"
}
```

**Important Notes:**
- ✅ **Idempotent**: Duplicate `transaction_id` values return 202 Accepted without creating duplicate records
- ✅ **Fast Response**: Returns immediately (< 500ms) without waiting for processing
- ✅ **Async Processing**: Transaction is processed in the background (~30 seconds)
- ✅ **No Duplicate Processing**: Same transaction ID will not trigger duplicate background processing

---

### 3. Get Transaction Status

**Endpoint:** `GET /v1/transactions/{transaction_id}`

**Description:** Retrieves the current status and details of a transaction.

**Request:**
```bash
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/transactions/txn_abc123def456
```

**Path Parameters:**
- `transaction_id` (string, required): The transaction ID to query

**Response (200 OK):**
```json
{
  "transaction_id": "txn_abc123def456",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR",
  "status": "PROCESSED",
  "created_at": "2024-12-23T23:58:33.435Z",
  "processed_at": "2024-12-23T23:59:03.435Z"
}
```

**Response Fields:**
- `transaction_id` (string): Original transaction ID
- `source_account` (string): Source account identifier
- `destination_account` (string): Destination account identifier
- `amount` (number): Transaction amount
- `currency` (string): Currency code
- `status` (string): Current processing status - either "PROCESSING" or "PROCESSED"
- `created_at` (string): ISO-8601 timestamp when transaction was created
- `processed_at` (string | null): ISO-8601 timestamp when processing completed (null if still processing)

**Status Values:**
- `PROCESSING`: Transaction is being processed (initial state after submission)
- `PROCESSED`: Transaction processing completed (~30 seconds after submission)

**Error Responses:**

All error responses follow a consistent flat structure:

**400 Bad Request - Missing Transaction ID:**
```json
{
  "code": "BAD_REQUEST",
  "message": "Transaction ID is required"
}
```

**404 Not Found:**
```json
{
  "code": "NOT_FOUND",
  "message": "Transaction not found"
}
```

**500 Internal Server Error:**
```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Failed to retrieve transaction"
}
```

---

## Example Usage Flow

### Complete Transaction Lifecycle

#### Step 1: Submit Transaction
```bash
curl -X POST https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test_001",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": 1500,
    "currency": "INR"
  }'
```

**Response:** `202 Accepted` (empty body)

#### Step 2: Check Status Immediately
```bash
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/transactions/txn_test_001
```

**Response:**
```json
{
  "transaction_id": "txn_test_001",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR",
  "status": "PROCESSING",
  "created_at": "2024-12-23T23:58:33.435Z",
  "processed_at": null
}
```

#### Step 3: Check Status After 30+ Seconds
```bash
sleep 35
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/transactions/txn_test_001
```

**Response:**
```json
{
  "transaction_id": "txn_test_001",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR",
  "status": "PROCESSED",
  "created_at": "2024-12-23T23:58:33.435Z",
  "processed_at": "2024-12-23T23:59:03.435Z"
}
```

---

## Idempotency Testing

### Test Duplicate Webhook Submissions

Send the same webhook multiple times:

```bash
for i in {1..5}; do
  curl -X POST https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/webhooks/transactions \
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
```

**Expected Behavior:**
- All 5 requests return `202 Accepted`
- Only **one** transaction record exists in the database
- Only **one** background processing job is triggered
- Querying the transaction shows a single record

**Verify:**
```bash
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/transactions/txn_idempotent_test
```

---

## Sample Payloads

### Valid Transaction Payloads

**Indian Rupees:**
```json
{
  "transaction_id": "txn_inr_001",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR"
}
```

**US Dollars:**
```json
{
  "transaction_id": "txn_usd_001",
  "source_account": "acc_user_123",
  "destination_account": "acc_merchant_789",
  "amount": 99.99,
  "currency": "USD"
}
```

**Euro:**
```json
{
  "transaction_id": "txn_eur_001",
  "source_account": "acc_user_456",
  "destination_account": "acc_merchant_123",
  "amount": 250.50,
  "currency": "EUR"
}
```

**Large Amount:**
```json
{
  "transaction_id": "txn_large_001",
  "source_account": "acc_user_999",
  "destination_account": "acc_merchant_888",
  "amount": 1000000,
  "currency": "INR"
}
```

---

## Error Scenarios

### Invalid Payload Examples

**Missing Required Field:**
```json
{
  "transaction_id": "txn_test",
  "source_account": "acc_user_789",
  "amount": 1500,
  "currency": "INR"
}
// Missing: destination_account
// Response: 400 Bad Request
{
  "code": "BAD_REQUEST",
  "message": "Missing required fields"
}
```

**Invalid Amount (Negative):**
```json
{
  "transaction_id": "txn_test",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": -100,
  "currency": "INR"
}
// Response: 400 Bad Request
{
  "code": "BAD_REQUEST",
  "message": "Amount must be a positive number"
}
```

**Invalid Amount (Zero):**
```json
{
  "transaction_id": "txn_test",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 0,
  "currency": "INR"
}
// Response: 400 Bad Request
{
  "code": "BAD_REQUEST",
  "message": "Amount must be a positive number"
}
```

**Invalid Amount (String):**
```json
{
  "transaction_id": "txn_test",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": "1500",
  "currency": "INR"
}
// Response: 400 Bad Request
{
  "code": "BAD_REQUEST",
  "message": "Amount must be a positive number"
}
```

**Invalid JSON:**
```bash
curl -X POST https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{ invalid json }'
# Response: 400 Bad Request
{
  "code": "BAD_REQUEST",
  "message": "Invalid JSON in request body"
}
```

**Missing Transaction ID in Path:**
```bash
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/transactions/
# Response: 400 Bad Request
{
  "code": "BAD_REQUEST",
  "message": "Transaction ID is required"
}
```

**Non-existent Transaction:**
```bash
curl https://ov3mzeghwa.execute-api.us-east-1.amazonaws.com/v1/transactions/txn_nonexistent
# Response: 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Transaction not found"
}
```

---

## Response Headers

All responses include:
- `Content-Type: application/json`

---

## Rate Limits

Currently, no rate limits are enforced. However, the service is designed to handle high throughput with:
- Immediate acknowledgment (< 500ms)
- Asynchronous background processing
- Idempotent webhook handling

---

## Notes

1. **Idempotency**: The service uses DynamoDB conditional writes to ensure idempotency. Duplicate `transaction_id` values will not create duplicate records or trigger duplicate processing.

2. **Processing Time**: Background processing takes approximately 30 seconds. The transaction status will change from `PROCESSING` to `PROCESSED` after this time.

3. **Immediate Response**: The webhook endpoint returns `202 Accepted` immediately without waiting for processing to complete.

4. **Status Polling**: Use the transaction status endpoint to check if processing has completed. Poll every few seconds until `status` becomes `PROCESSED`.

5. **Error Handling**: All errors return appropriate HTTP status codes with a consistent flat JSON structure (`code` and `message` fields) for easy debugging.

6. **Request Tracing**: Each request is assigned a unique `requestId` that is passed from the API Lambda to the Worker Lambda, enabling end-to-end request tracing across both services.


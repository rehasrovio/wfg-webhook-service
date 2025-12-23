// Transaction request from webhook
export interface TransactionRequest {
  transaction_id: string;
  source_account: string;
  destination_account: string;
  amount: number;
  currency: string;
}

// Transaction record in DynamoDB
export interface TransactionRecord extends TransactionRequest {
  status: 'PROCESSING' | 'PROCESSED';
  created_at: string;      // ISO-8601 timestamp
  processed_at: string | null;  // ISO-8601 timestamp or null
}

// API Response types
export interface HealthCheckResponse {
  status: 'HEALTHY';
  current_time: string;
}

export interface TransactionStatusResponse extends TransactionRecord {}


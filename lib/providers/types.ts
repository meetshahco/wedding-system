export type SendingMethod = "mock" | "whatsapp_cloud" | "manual";

export interface SendMessageParams {
  weddingId: string;
  guestId: string;
  phone: string;
  templateKey?: string;
  language?: string;
  body: string;
  variables?: Record<string, string | number>;
  inviteUrl?: string;
}

export interface SendMessageResult {
  success: boolean;
  externalMessageId?: string;
  status: "sent" | "delivered" | "failed";
  errorMessage?: string;
  retryable?: boolean;
}

export interface MessageProvider {
  name: string;
  send(params: SendMessageParams): Promise<SendMessageResult>;
  checkDeliveryStatus?(externalMessageId: string): Promise<"sent" | "delivered" | "read" | "failed">;
}


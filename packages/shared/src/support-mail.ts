export type SupportMailAttachmentSummary = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type SupportMailAddress = {
  address: string;
  name?: string;
};

export type SupportMailMessage = {
  id: string;
  providerMessageId: string;
  from: SupportMailAddress;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  receivedAt: string;
  storedAt: string;
  readAt?: string;
  sizeBytes: number;
  attachments: SupportMailAttachmentSummary[];
};

export type SupportMailMessageSummary = Omit<SupportMailMessage, "text"> & {
  preview: string;
};

export type SupportMailboxListResponse = {
  enabled: boolean;
  address: string;
  retentionDays: number;
  totalCount: number;
  unreadCount: number;
  messages: SupportMailMessageSummary[];
};

export type SupportMailInboundPayload = {
  version: 1;
  provider: "cloudflare";
  providerMessageId: string;
  envelopeFrom: string;
  envelopeTo: string;
  fromAddress: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  text: string;
  receivedAt: string;
  sizeBytes: number;
  attachments: SupportMailAttachmentSummary[];
};

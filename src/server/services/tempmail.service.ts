import { TRPCError } from '@trpc/server';
import { ConfigService } from './config.service';

// ─── Interfaces matching Go backend JSON responses ───────────────

export interface TempMailbox {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  domainId: string;
  tenantId: string;
  expiresAt: string;
  createdAt: string;
  status: string;
}

export interface TempMessage {
  id: string;
  from: string;
  subject: string;
  spamScore: number;
  isSpam: boolean;
  quarantineAction: string;
  hasHtml: boolean;
  receivedAt: string;
  expiresAt: string;
}

export interface TempMessageDetail {
  id: string;
  mailboxId: string;
  from: string;
  to: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  spamScore: number;
  quarantineAction: string;
  attachments: Array<{ id: string; filename: string; contentType: string; sizeBytes: number }>;
  receivedAt: string;
  expiresAt: string;
}

export interface TempDomain {
  id: string;
  domainName: string;
  status: string;
  isPublic: boolean;
  nodeId?: string;
  nodeName?: string;
  createdAt: string;
}

/** Returned by GET /v1/domains/:id — includes extra node/tenant detail */
export interface TempDomainDetail extends TempDomain {
  tenantId?: string;
  nodeIp?: string;
  mailboxCount: number;
  updatedAt: string;
}

/** Returned by POST /v1/domains — includes DNS instructions */
export interface TempDomainCreateResult {
  domain: TempDomain;
  dns: Array<{ type: string; name: string; value: string; priority?: number; proxy: boolean; note: string }>;
  nodeIp: string;
  reactivated?: boolean;
}

/** Returned by DELETE /v1/domains/:id */
export interface TempDomainDeleteResult {
  status: string;
  id: string;
  domain: string;
  mailboxesDeactivated: number;
}

/** Returned by GET /v1/domains/:id/verify-dns */
export interface TempDnsVerifyResult {
  domainId: string;
  domainName: string;
  allValid: boolean;
  records: Array<{ type: string; name?: string; expected: string; actual: string; valid: boolean; priority?: number }>;
}

/** Returned by GET /v1/attachment/:id */
export interface TempAttachmentDownload {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  expiresIn: number;
}

// ─── Service ────────────────────────────────────────────────────

export const TempMailService = {
  async getConfig() {
    const apiUrl = await ConfigService.get('tempmail.api_url');
    const apiKey = await ConfigService.get('tempmail.api_key');
    
    if (!apiUrl) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'TempMail API URL is not configured. Configure via Admin → Settings.',
      });
    }
    
    return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey: apiKey ?? null };
  },

  async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { apiUrl, apiKey } = await this.getConfig();
    
    const headers = new Headers(options.headers);
    if (apiKey) {
      headers.set('X-API-Key', apiKey);
    }
    if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5000ms strict timeout for resilience

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle normal errors
      if (!response.ok) {
        let errorMsg = `API Error ${response.status}`;
        try {
          const body = await response.json();
          errorMsg = body.error?.message || body.error || errorMsg;
        } catch {
          // ignore parsing error if body is not json
        }
        
        throw new TRPCError({
          code: response.status === 401 ? 'UNAUTHORIZED' : 
                response.status === 404 ? 'NOT_FOUND' : 
                response.status === 429 ? 'TOO_MANY_REQUESTS' : 'INTERNAL_SERVER_ERROR',
          message: errorMsg,
        });
      }

      return (await response.json()) as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.name === 'AbortError' ? 'Timeout connecting to mail server' : `Mail server connection failed: ${error.message}`,
      });
    }
  },

  // ─── Mailbox Endpoints ──────────────────────────────────────

  /** POST /v1/mailbox/create */
  async createMailbox(localPart?: string, domainId?: string, tenantId: string = 'anonymous', ttlHours: number = 24): Promise<TempMailbox> {
    const body: any = { tenantId, ttlHours };
    if (localPart) body.localPart = localPart;
    if (domainId) body.domainId = domainId;

    return this._fetch<TempMailbox>('/v1/mailbox/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** GET /v1/mailbox/:id */
  async getMailbox(mailboxId: string): Promise<TempMailbox & { messageCount: number }> {
    return this._fetch<TempMailbox & { messageCount: number }>(`/v1/mailbox/${mailboxId}`);
  },

  /** GET /v1/mailbox/:id/messages */
  async listMessages(mailboxId: string): Promise<{ mailboxId: string; count: number; messages: TempMessage[] }> {
    return this._fetch<{ mailboxId: string; count: number; messages: TempMessage[] }>(`/v1/mailbox/${mailboxId}/messages`);
  },

  /**
   * PATCH /v1/mailbox/:id — extend TTL and/or change status
   * @param ttlHours — optional, extends expiry by N hours from now
   * @param status — optional, 'ACTIVE' or 'PAUSED'
   */
  async patchMailbox(
    mailboxId: string,
    options: { ttlHours?: number; status?: 'ACTIVE' | 'PAUSED' }
  ): Promise<{ id: string; address: string; status: string; expiresAt: string }> {
    return this._fetch(`/v1/mailbox/${mailboxId}`, {
      method: 'PATCH',
      body: JSON.stringify(options),
    });
  },

  /**
   * @deprecated Use patchMailbox instead — kept for backward compatibility
   */
  async renewMailbox(mailboxId: string, ttlHours: number): Promise<TempMailbox> {
    return this._fetch<TempMailbox>(`/v1/mailbox/${mailboxId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ttlHours }),
    });
  },

  /** DELETE /v1/mailbox/:id */
  async deleteMailbox(mailboxId: string): Promise<{ status: string; id: string }> {
    return this._fetch<{ status: string; id: string }>(`/v1/mailbox/${mailboxId}`, {
      method: 'DELETE',
    });
  },

  /** GET /v1/mailbox/count */
  async getMailboxCount(tenantId?: string): Promise<{ total: number; active: number; expired: number }> {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this._fetch<{ total: number; active: number; expired: number }>(`/v1/mailbox/count${query}`);
  },

  // ─── Message Endpoints ──────────────────────────────────────

  /** GET /v1/message/:id */
  async getMessage(messageId: string): Promise<TempMessageDetail> {
    return this._fetch<TempMessageDetail>(`/v1/message/${messageId}`);
  },

  /** DELETE /v1/message/:id */
  async deleteMessage(messageId: string): Promise<{ status: string; id: string }> {
    return this._fetch<{ status: string; id: string }>(`/v1/message/${messageId}`, {
      method: 'DELETE',
    });
  },

  /** GET /v1/attachment/:id — generates presigned download URL (valid 15 min) */
  async getAttachmentUrl(attachmentId: string): Promise<TempAttachmentDownload> {
    return this._fetch<TempAttachmentDownload>(`/v1/attachment/${attachmentId}`);
  },

  // ─── Domain Endpoints ───────────────────────────────────────

  /** GET /v1/domains — list with optional search, status filter, pagination */
  async listDomains(options?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ count: number; domains: TempDomain[] }> {
    const params = new URLSearchParams();
    if (options?.search) params.set('search', options.search);
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const qs = params.toString();
    return this._fetch<{ count: number; domains: TempDomain[] }>(`/v1/domains${qs ? `?${qs}` : ''}`);
  },

  /** GET /v1/domains/:id — detailed domain info */
  async getDomain(domainId: string): Promise<TempDomainDetail> {
    return this._fetch<TempDomainDetail>(`/v1/domains/${domainId}`);
  },

  /**
   * POST /v1/domains — register a new domain
   * Go API determines isPublic by whether tenantId is null:
   *   - tenantId = null → isPublic = true (system domain)
   *   - tenantId = 'xxx' → isPublic = false (private/custom domain)
   */
  async addDomain(domainName: string, tenantId?: string, nodeId?: string): Promise<TempDomainCreateResult> {
    const body: Record<string, unknown> = { domainName };
    if (tenantId) body.tenantId = tenantId;
    if (nodeId) body.nodeId = nodeId;
    return this._fetch<TempDomainCreateResult>('/v1/domains', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * PUT /v1/domains/:id — update domain settings
   * Go API accepts nodeId and status
   */
  async updateDomain(domainId: string, data: { nodeId?: string; status?: string }): Promise<TempDomain> {
    return this._fetch<TempDomain>(`/v1/domains/${domainId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /** DELETE /v1/domains/:id — soft-delete domain + deactivates all mailboxes */
  async removeDomain(domainId: string): Promise<TempDomainDeleteResult> {
    return this._fetch<TempDomainDeleteResult>(`/v1/domains/${domainId}`, {
      method: 'DELETE',
    });
  },

  /**
   * GET /v1/domains/:id/verify-dns — real-time DNS verification
   * Checks MX record and A record for mail.<domain>
   */
  async verifyDomainDns(domainId: string): Promise<TempDnsVerifyResult> {
    return this._fetch<TempDnsVerifyResult>(`/v1/domains/${domainId}/verify-dns`);
  },
};

import { TRPCError } from '@trpc/server';
import { ConfigService } from './config.service';

export interface TempMailbox {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  domainId: string;
  expiresAt: string;
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
  isPublic: boolean;
}

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

  async createMailbox(localPart?: string, domainId?: string, tenantId: string = 'anonymous', ttlHours: number = 24): Promise<TempMailbox> {
    const body: any = { tenantId, ttlHours };
    if (localPart) body.localPart = localPart;
    if (domainId) body.domainId = domainId;

    return this._fetch<TempMailbox>('/v1/mailbox/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getMailbox(mailboxId: string): Promise<TempMailbox & { messageCount: number }> {
    return this._fetch<TempMailbox & { messageCount: number }>(`/v1/mailbox/${mailboxId}`);
  },

  async listMessages(mailboxId: string): Promise<{ mailboxId: string; count: number; messages: TempMessage[] }> {
    return this._fetch<{ mailboxId: string; count: number; messages: TempMessage[] }>(`/v1/mailbox/${mailboxId}/messages`);
  },

  async getMessage(messageId: string): Promise<TempMessageDetail> {
    return this._fetch<TempMessageDetail>(`/v1/message/${messageId}`);
  },

  async getAttachmentUrl(attachmentId: string): Promise<{ id: string; downloadUrl: string; expiresIn: number }> {
    return this._fetch<{ id: string; downloadUrl: string; expiresIn: number }>(`/v1/attachment/${attachmentId}`);
  },

  async renewMailbox(mailboxId: string, ttlHours: number): Promise<TempMailbox> {
    return this._fetch<TempMailbox>(`/v1/mailbox/${mailboxId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ttlHours }),
    });
  },

  async deleteMailbox(mailboxId: string): Promise<{ status: string; id: string }> {
    return this._fetch<{ status: string; id: string }>(`/v1/mailbox/${mailboxId}`, {
      method: 'DELETE',
    });
  },

  async deleteMessage(messageId: string): Promise<{ status: string; id: string }> {
    return this._fetch<{ status: string; id: string }>(`/v1/message/${messageId}`, {
      method: 'DELETE',
    });
  },

  async getMailboxCount(tenantId?: string): Promise<{ total: number; active: number; expired: number }> {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this._fetch<{ total: number; active: number; expired: number }>(`/v1/mailbox/count${query}`);
  },

  async listDomains(): Promise<{ count: number; domains: TempDomain[] }> {
    return this._fetch<{ count: number; domains: TempDomain[] }>('/v1/domains');
  }
};

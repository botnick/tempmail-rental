import { getRedis } from './redis';
import { logger } from './logger';

export interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
}

/** Max concurrent SSE connections per mailbox to prevent resource exhaustion */
const MAX_CLIENTS_PER_MAILBOX = 10;

class TempMailSSEHub {
  private clients: Map<string, Set<SSEClient>> = new Map();
  private subscriber: ReturnType<typeof getRedis> | null = null;
  private isListening = false;
  private readonly KEEPALIVE_INTERVAL = 25000;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startKeepAlive();
  }

  /** Lazily create Redis subscriber on first use */
  private getSubscriber() {
    if (!this.subscriber) {
      try {
        this.subscriber = getRedis().duplicate();
        this.setupRedisSubscriber();
      } catch (err) {
        logger.error('Failed to create Redis SSE subscriber', { error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
    return this.subscriber;
  }

  private setupRedisSubscriber() {
    const sub = this.subscriber!;
    sub.on('message', (channel, message) => {
      if (channel === 'tempmail:events') {
        try {
          const event = JSON.parse(message);
          // Only broadcast to clients connected to this specific mailbox
          this.broadcastToMailbox(event.mailboxId, event);
        } catch (e) {
          logger.error('Failed to parse SSE event from Redis', { error: e instanceof Error ? e : new Error(String(e)) });
        }
      }
    });

    sub.on('error', (err) => {
      logger.error('Redis SSE Subscriber error', { error: err });
    });
  }

  private startKeepAlive() {
    this.keepAliveTimer = setInterval(() => {
      const deadClients: Array<{ mailboxId: string; client: SSEClient }> = [];

      for (const [mailboxId, clientSet] of this.clients.entries()) {
        for (const client of clientSet) {
          try {
            const payload = `event: keepalive\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`;
            client.controller.enqueue(new TextEncoder().encode(payload));
          } catch {
            // Client is dead — mark for cleanup
            deadClients.push({ mailboxId, client });
          }
        }
      }

      // Purge stale clients detected during keepalive
      for (const { mailboxId, client } of deadClients) {
        this.removeClient(mailboxId, client);
        try { client.controller.close(); } catch {}
        logger.info(`Purged stale SSE client ${client.id} from mailbox ${mailboxId}`);
      }
    }, this.KEEPALIVE_INTERVAL);
  }

  private sendEvent(client: SSEClient, event: string, data: unknown) {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.controller.enqueue(new TextEncoder().encode(payload));
    } catch (e) {
      logger.error('Failed to send SSE event, closing client', { error: e instanceof Error ? e : new Error(String(e)), clientId: client.id });
      try { client.controller.close(); } catch {}
    }
  }

  /** Get current client count for a specific mailbox */
  public getClientCount(mailboxId: string): number {
    return this.clients.get(mailboxId)?.size ?? 0;
  }

  /** Check if a new client can be added (enforces per-mailbox limit) */
  public canAcceptClient(mailboxId: string): boolean {
    return this.getClientCount(mailboxId) < MAX_CLIENTS_PER_MAILBOX;
  }

  public addClient(mailboxId: string, client: SSEClient) {
    if (!this.canAcceptClient(mailboxId)) {
      logger.warn(`SSE connection limit reached for mailbox ${mailboxId} (max: ${MAX_CLIENTS_PER_MAILBOX})`);
      throw new Error('Too many connections to this mailbox');
    }

    if (!this.clients.has(mailboxId)) {
      this.clients.set(mailboxId, new Set());
    }
    this.clients.get(mailboxId)!.add(client);

    // Start listening to Redis if this is the first client ever
    if (!this.isListening) {
      const sub = this.getSubscriber();
      sub?.subscribe('tempmail:events').catch(e => {
        logger.error('Failed to subscribe to Redis tempmail:events', { error: e });
      });
      this.isListening = true;
    }

    logger.info(`SSE Client ${client.id} connected to mailbox ${mailboxId} (total: ${this.getClientCount(mailboxId)})`);
  }

  public removeClient(mailboxId: string, client: SSEClient) {
    const clientSet = this.clients.get(mailboxId);
    if (clientSet) {
      clientSet.delete(client);
      if (clientSet.size === 0) {
        this.clients.delete(mailboxId);
      }
      logger.info(`SSE Client ${client.id} disconnected from mailbox ${mailboxId}`);
    }
  }

  private broadcastToMailbox(mailboxId: string, eventData: unknown) {
    const clientSet = this.clients.get(mailboxId);
    if (clientSet) {
      for (const client of clientSet) {
        this.sendEvent(client, 'message', eventData);
      }
    }
  }

  /**
   * Called by Webhook Endpoint. Publishes to Redis so all instances receive it.
   */
  public async publishEvent(mailboxId: string, eventData: Record<string, unknown>) {
    const payload = JSON.stringify({ mailboxId, ...eventData });
    await getRedis().publish('tempmail:events', payload);
  }

  /** Graceful shutdown — clear intervals */
  public shutdown() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}

// Singleton
export const sseHub = new TempMailSSEHub();

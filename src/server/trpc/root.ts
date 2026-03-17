import { router } from './trpc';
import { authRouter } from './routers/auth';
import { mailboxRouter } from './routers/mailbox';
import { domainRouter } from './routers/domain';
import { billingRouter } from './routers/billing';
import { planRouter } from './routers/plan';
import { healthRouter } from './routers/health';
import { adminRouter } from './routers/admin';
import { contentRouter } from './routers/content';
import { tempmailRouter } from './routers/tempmail';
import { aliasRouter } from './routers/alias';
import { notificationRouter } from './routers/notification';
import { apiKeyRouter } from './routers/apiKey';

export const appRouter = router({
  auth: authRouter,
  mailbox: mailboxRouter,
  domain: domainRouter,
  billing: billingRouter,
  plan: planRouter,
  health: healthRouter,
  admin: adminRouter,
  content: contentRouter,
  tempmail: tempmailRouter,
  alias: aliasRouter,
  notification: notificationRouter,
  apiKey: apiKeyRouter,
});

export type AppRouter = typeof appRouter;


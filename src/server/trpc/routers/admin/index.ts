import { router } from '../../trpc';
import { adminDashboardRouter } from './dashboard';
import { adminUserRouter } from './user';
import { adminMailboxRouter } from './mailbox';
import { adminSecurityRouter } from './security';
import { adminFeatureFlagRouter } from './featureFlag';
import { adminCmsRouter } from './cms';
import { adminAuditRouter } from './audit';
import { adminSeoRouter } from './seo';
import { adminDomainRouter } from './domain';
import { adminPlanRouter } from './plan';
import { adminBillingRouter } from './billing';
import { adminRbacRouter } from './rbac';
import { supportNotesRouter } from './supportNotes';

export const adminRouter = router({
  dashboard: adminDashboardRouter,
  user: adminUserRouter,
  mailbox: adminMailboxRouter,
  security: adminSecurityRouter,
  featureFlag: adminFeatureFlagRouter,
  cms: adminCmsRouter,
  audit: adminAuditRouter,
  seo: adminSeoRouter,
  domain: adminDomainRouter,
  plan: adminPlanRouter,
  billing: adminBillingRouter,
  rbac: adminRbacRouter,
  supportNotes: supportNotesRouter,
});


// prisma/seed/cms-data.ts — CMS, SEO, FAQ, Glossary seed data

export const CONTENT_PAGES = [
  {
    slug: 'features', locale: 'en', type: 'feature', status: 'published', title: 'Features - Secure Temporary Email',
    metaDescription: 'Discover TempMail features: instant disposable email, custom domains, API access, and enterprise security.',
    indexable: true, schemaType: 'WebPage',
    blocks: [
      { type: 'hero', order: 0, content: { heading: 'Powerful Features for Every Need', subheading: 'From quick signups to enterprise workflows.', cta: 'Get Started Free' } },
      { type: 'feature', order: 1, content: { title: 'Instant Disposable Emails', description: 'Create temporary email addresses in seconds. No registration required for basic use.', icon: 'zap' } },
      { type: 'feature', order: 2, content: { title: 'Custom Domains', description: 'Use your own domain for temporary emails. Perfect for dev and QA teams.', icon: 'globe' } },
      { type: 'feature', order: 3, content: { title: 'Enterprise Security', description: 'Argon2id hashing, encrypted sessions, full audit trail, and granular RBAC.', icon: 'shield' } },
    ],
  },
  {
    slug: 'features', locale: 'th', type: 'feature', status: 'published', title: 'ฟีเจอร์ - อีเมลชั่วคราวปลอดภัย',
    metaDescription: 'สำรวจฟีเจอร์ TempMail: อีเมลชั่วคราวทันที, โดเมนกำหนดเอง, API access และความปลอดภัยระดับองค์กร',
    indexable: true, schemaType: 'WebPage',
    blocks: [
      { type: 'hero', order: 0, content: { heading: 'ฟีเจอร์ทรงพลังสำหรับทุกความต้องการ', subheading: 'ตั้งแต่สมัครสมาชิกจนถึงระบบองค์กร', cta: 'เริ่มต้นฟรี' } },
      { type: 'feature', order: 1, content: { title: 'อีเมลชั่วคราวทันที', description: 'สร้างอีเมลชั่วคราวในไม่กี่วินาที ไม่ต้องลงทะเบียน', icon: 'zap' } },
      { type: 'feature', order: 2, content: { title: 'โดเมนกำหนดเอง', description: 'ใช้โดเมนของคุณเองสำหรับอีเมลชั่วคราว เหมาะสำหรับทีมพัฒนา', icon: 'globe' } },
    ],
  },
  {
    slug: 'about', locale: 'en', type: 'page', status: 'published', title: 'About TempMail',
    metaDescription: 'Learn about TempMail — the secure, privacy-first temporary email service.',
    indexable: true, schemaType: 'AboutPage',
    blocks: [
      { type: 'hero', order: 0, content: { heading: 'Privacy-First Email', subheading: 'Built by developers, for developers.' } },
      { type: 'summary', order: 1, content: { text: 'TempMail was created to solve inbox pollution and privacy concerns when signing up for online services.' } },
    ],
  },
  {
    slug: 'blog/disposable-email-guide', locale: 'en', type: 'blog', status: 'published',
    title: 'The Complete Guide to Disposable Email Addresses (2026)',
    metaDescription: 'Everything about disposable email: what they are, how to use them, and why they matter.',
    indexable: true, schemaType: 'Article',
    blocks: [
      { type: 'hero', order: 0, content: { heading: 'The Complete Guide to Disposable Email', date: '2026-01-15', readTime: '8 min' } },
      { type: 'summary', order: 1, content: { text: 'Disposable email addresses are temporary, anonymous emails that automatically expire after a set period.' } },
    ],
  },
  {
    slug: 'about', locale: 'th', type: 'page', status: 'published', title: 'เกี่ยวกับ TempMail',
    metaDescription: 'เรียนรู้เกี่ยวกับ TempMail — บริการอีเมลชั่วคราวที่ปลอดภัยและเน้นความเป็นส่วนตัว',
    indexable: true, schemaType: 'AboutPage',
    blocks: [
      { type: 'hero', order: 0, content: { heading: 'อีเมลที่เน้นความเป็นส่วนตัว', subheading: 'สร้างโดยนักพัฒนา เพื่อนักพัฒนา' } },
    ],
  },
];

export const FAQ_ITEMS = [
  { question: 'What is a temporary email address?', answer: 'A temporary email address is a disposable email that you can use for a short period. It helps protect your real email from spam, phishing, and unwanted newsletters when signing up for online services.', locale: 'en', category: 'general', order: 0 },
  { question: 'How long do TempMail addresses last?', answer: 'Free accounts have addresses that last 24 hours. Starter plans extend this to 7 days, Pro to 30 days, and Enterprise up to 1 year. You can also extend your mailbox TTL manually.', locale: 'en', category: 'general', order: 1 },
  { question: 'Is TempMail free to use?', answer: 'Yes! TempMail offers a generous free tier with up to 3 mailboxes and 24-hour retention. For more features, check our paid plans.', locale: 'en', category: 'pricing', order: 2 },
  { question: 'Can I use my own domain?', answer: 'Absolutely! Pro and Enterprise plans support custom domains. Add your domain, verify via DNS TXT record, and start receiving emails.', locale: 'en', category: 'features', order: 3 },
  { question: 'Is my data secure?', answer: 'We use Argon2id password hashing, SHA-256 session tokens with rotation, and mandatory audit logging for all admin actions. We never sell or share your data.', locale: 'en', category: 'security', order: 4 },
  { question: 'Can I receive attachments?', answer: 'Yes! Free plan supports up to 5MB, Pro up to 50MB, and Enterprise up to 100MB per message. All attachments are scanned for malware.', locale: 'en', category: 'features', order: 5 },
  { question: 'What payment methods do you accept?', answer: 'We accept credit/debit cards via Stripe and Paddle for international payments. You can also top up your wallet for pay-as-you-go usage.', locale: 'en', category: 'pricing', order: 6 },
  { question: 'How do I delete my account?', answer: 'Delete your account from Settings. All data including mailboxes, messages, and billing history will be permanently removed within 30 days.', locale: 'en', category: 'general', order: 7 },
  // Thai
  { question: 'อีเมลชั่วคราวคืออะไร?', answer: 'อีเมลชั่วคราวคืออีเมลที่ใช้แล้วทิ้งได้ ช่วยปกป้องอีเมลจริงจากสแปม ฟิชชิ่ง และจดหมายข่าวที่ไม่ต้องการ', locale: 'th', category: 'general', order: 0 },
  { question: 'อีเมล TempMail ใช้ได้นานแค่ไหน?', answer: 'บัญชีฟรีใช้ได้ 24 ชั่วโมง Starter 7 วัน Pro 30 วัน Enterprise สูงสุด 1 ปี สามารถต่ออายุได้ด้วยตนเอง', locale: 'th', category: 'general', order: 1 },
  { question: 'TempMail ใช้ฟรีได้ไหม?', answer: 'ได้เลย! แพลนฟรีให้ mailbox สูงสุด 3 กล่อง พร้อมอายุ 24 ชั่วโมง หากต้องการเพิ่ม ดูแพลนพรีเมียม', locale: 'th', category: 'pricing', order: 2 },
  { question: 'ใช้โดเมนของตัวเองได้ไหม?', answer: 'ได้! แพลน Pro และ Enterprise รองรับโดเมนกำหนดเอง เพิ่มโดเมน ยืนยัน DNS TXT record แล้วรับอีเมลได้ทันที', locale: 'th', category: 'features', order: 3 },
  { question: 'ข้อมูลของฉันปลอดภัยไหม?', answer: 'เราใช้ Argon2id, SHA-256 token hashing พร้อม rotation และ audit log ทุกการกระทำของแอดมิน เราไม่ขายหรือแชร์ข้อมูล', locale: 'th', category: 'security', order: 4 },
  { question: 'รับไฟล์แนบได้ไหม?', answer: 'ได้! แพลนฟรีรองรับ 5MB, Pro 50MB, Enterprise 100MB ต่อข้อความ ไฟล์แนบทั้งหมดถูกสแกนมัลแวร์', locale: 'th', category: 'features', order: 5 },
  { question: 'รับชำระเงินด้วยวิธีอะไรบ้าง?', answer: 'รับบัตรเครดิต/เดบิตผ่าน Stripe, Paddle สำหรับต่างประเทศ และเติมเงินกระเป๋าสตางค์', locale: 'th', category: 'pricing', order: 6 },
  { question: 'ลบบัญชีได้อย่างไร?', answer: 'ลบบัญชีได้ที่หน้า Settings ข้อมูลทั้งหมดจะถูกลบถาวรภายใน 30 วัน', locale: 'th', category: 'general', order: 7 },
];

export const GLOSSARY_TERMS = [
  { term: 'Disposable Email', slug: 'disposable-email', locale: 'en', definition: 'A temporary email address that expires automatically, used to protect privacy.', description: 'Disposable email addresses (DEAs) are short-lived email accounts for one-time or temporary use, protecting primary inboxes from spam.' },
  { term: 'Catch-All Domain', slug: 'catch-all-domain', locale: 'en', definition: 'A domain that receives all emails sent to any address on that domain.', description: 'Accepts emails to any address @domain.com, even if the address hasn\'t been created.' },
  { term: 'MX Record', slug: 'mx-record', locale: 'en', definition: 'DNS record specifying the mail server for a domain.', description: 'MX records tell other servers where to deliver email for your domain.' },
  { term: 'SPF', slug: 'spf', locale: 'en', definition: 'Sender Policy Framework — prevents sender address forgery.', description: 'SPF specifies which servers can send email on behalf of a domain.' },
  { term: 'DKIM', slug: 'dkim', locale: 'en', definition: 'DomainKeys Identified Mail — verifies email authenticity via digital signatures.', description: 'DKIM adds cryptographic signatures to verify emails haven\'t been tampered with.' },
  { term: 'อีเมลชั่วคราว', slug: 'disposable-email', locale: 'th', definition: 'ที่อยู่อีเมลที่หมดอายุอัตโนมัติ ใช้ปกป้องความเป็นส่วนตัว', description: 'อีเมลชั่วคราวเป็นบัญชีอีเมลรองสำหรับใช้ครั้งเดียว ช่วยหลีกเลี่ยงสแปม' },
  { term: 'Catch-All โดเมน', slug: 'catch-all-domain', locale: 'th', definition: 'โดเมนที่รับอีเมลทั้งหมดที่ส่งไปยังที่อยู่ใดก็ได้บนโดเมน', description: 'รับอีเมลที่อยู่ใดก็ได้ @yourdomain.com แม้ยังไม่ได้สร้าง' },
];

export const ANSWER_BLOCKS = [
  { question: 'What is TempMail?', answerText: 'TempMail is a secure temporary email service that creates disposable addresses instantly. It protects your real email from spam while you sign up for services, receive OTPs, or test applications.', locale: 'en', intent: 'definition', status: 'published' },
  { question: 'How does temporary email work?', answerText: 'Temporary email creates a short-lived address on a shared or custom domain. Emails are stored temporarily and automatically deleted after the retention period (24h to 1 year).', locale: 'en', intent: 'task', status: 'published' },
  { question: 'Is disposable email safe?', answerText: 'Yes, when from a reputable provider. TempMail uses Argon2id hashing, encrypted session tokens with rotation, and maintains a full audit trail.', locale: 'en', intent: 'definition', status: 'published' },
  { question: 'TempMail คืออะไร?', answerText: 'TempMail เป็นบริการอีเมลชั่วคราวที่ปลอดภัย สร้างที่อยู่อีเมลใช้แล้วทิ้งได้ทันที ปกป้องอีเมลจริงจากสแปมและฟิชชิ่ง', locale: 'th', intent: 'definition', status: 'published' },
  { question: 'อีเมลชั่วคราวทำงานอย่างไร?', answerText: 'สร้างที่อยู่อีเมลอายุสั้นบนโดเมนที่ใช้ร่วมกัน อีเมลถูกเก็บชั่วคราวและลบอัตโนมัติหลังหมดอายุ (24 ชม. ถึง 1 ปี)', locale: 'th', intent: 'task', status: 'published' },
];

export const KEYWORD_CLUSTERS = [
  { name: 'disposable email', locale: 'en', keywords: ['disposable email','temp email','throwaway email','temporary email address','burner email','fake email for signup'] },
  { name: 'email privacy', locale: 'en', keywords: ['email privacy','protect email address','anonymous email','private email','hide email'] },
  { name: 'developer tools', locale: 'en', keywords: ['test email','email testing tool','QA email','staging email','dev email'] },
  { name: 'อีเมลชั่วคราว', locale: 'th', keywords: ['อีเมลชั่วคราว','อีเมลใช้แล้วทิ้ง','อีเมลปลอม','สร้างอีเมลชั่วคราว','อีเมลฟรีชั่วคราว'] },
  { name: 'ความเป็นส่วนตัว', locale: 'th', keywords: ['ปกป้องอีเมล','อีเมลนิรนาม','ไม่ต้องใช้อีเมลจริง','ความเป็นส่วนตัวออนไลน์'] },
];

export const INTENT_CLUSTERS = [
  { name: 'informational', description: 'Users seeking to understand temp email' },
  { name: 'commercial', description: 'Users comparing services or evaluating pricing' },
  { name: 'transactional', description: 'Users ready to create a temp email now' },
  { name: 'navigational', description: 'Users looking for specific pages or features' },
  { name: 'trust', description: 'Users evaluating security and reliability' },
];

export const INTERNAL_LINK_MODULES = [
  { name: 'Footer Links EN', locale: 'en', links: [
    { href: '/en/features', label: 'Features', title: 'Explore TempMail Features' },
    { href: '/en/pricing', label: 'Pricing', title: 'View Plans and Pricing' },
    { href: '/en/privacy', label: 'Privacy Policy', title: 'Read Privacy Policy' },
    { href: '/en/terms', label: 'Terms of Service', title: 'Read Terms' },
    { href: '/en/contact', label: 'Contact Us', title: 'Get in Touch' },
  ]},
  { name: 'Footer Links TH', locale: 'th', links: [
    { href: '/th/features', label: 'ฟีเจอร์', title: 'สำรวจฟีเจอร์' },
    { href: '/th/pricing', label: 'ราคา', title: 'ดูแพลนและราคา' },
    { href: '/th/privacy', label: 'นโยบายความเป็นส่วนตัว', title: 'อ่านนโยบาย' },
    { href: '/th/terms', label: 'ข้อกำหนดการใช้งาน', title: 'อ่านข้อกำหนด' },
    { href: '/th/contact', label: 'ติดต่อเรา', title: 'ติดต่อ' },
  ]},
  { name: 'Blog Sidebar', locale: 'en', links: [
    { href: '/en/blog/disposable-email-guide', label: 'Disposable Email Guide', title: 'Complete guide' },
    { href: '/en/features', label: 'All Features', title: 'See all features' },
  ]},
];

export const REDIRECTS = [
  { sourcePath: '/temp-mail', destinationPath: '/th', isPermanent: true, description: 'Legacy homepage → default locale' },
  { sourcePath: '/signup', destinationPath: '/th/register', isPermanent: true, description: 'Old signup URL' },
  { sourcePath: '/plans', destinationPath: '/th/pricing', isPermanent: true, description: 'Old pricing URL' },
  { sourcePath: '/help', destinationPath: '/th/contact', isPermanent: false, description: 'Help → contact' },
  { sourcePath: '/blog', destinationPath: '/en/blog/disposable-email-guide', isPermanent: false, description: 'Blog index' },
];

export const STRUCTURED_DATA = [
  { schemaType: 'Organization', isGlobal: true, locale: 'en', payload: { '@context': 'https://schema.org', '@type': 'Organization', name: 'TempMail', url: 'https://tempmail.dev', logo: 'https://tempmail.dev/logo.png' }},
  { schemaType: 'WebSite', isGlobal: true, locale: 'en', payload: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'TempMail', url: 'https://tempmail.dev' }},
  { schemaType: 'FAQPage', isGlobal: false, locale: 'en', pageSlug: 'features', payload: { '@context': 'https://schema.org', '@type': 'FAQPage' }},
  { schemaType: 'SoftwareApplication', isGlobal: false, locale: 'en', pageSlug: 'features', payload: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'TempMail', applicationCategory: 'WebApplication', offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' }}},
];

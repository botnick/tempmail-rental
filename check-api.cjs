const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const apiUrlRow = await prisma.systemConfig.findFirst({ where: { key: 'tempmail.api_url' } });
  const apiKeyRow = await prisma.systemConfig.findFirst({ where: { key: 'tempmail.api_key' } });
  
  const apiUrl = apiUrlRow?.value?.replace(/\/$/, '');
  const apiKey = apiKeyRow?.value;
  
  console.log('API URL:', apiUrl);
  console.log('API Key:', apiKey ? apiKey.substring(0, 8) + '...' : 'not set');
  
  if (!apiUrl) { console.log('No API URL!'); return; }
  
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;
  
  // Get domains
  const domainsRes = await fetch(`${apiUrl}/v1/domains`, { headers });
  const domainsData = await domainsRes.json();
  console.log('\n=== DOMAINS ===');
  console.log(JSON.stringify(domainsData, null, 2));
  
  // Get first mailbox from DB with messages
  const mailbox = await prisma.mailbox.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  
  if (!mailbox) { console.log('No active mailbox'); return; }
  
  const meta = mailbox.metadata;
  const externalId = meta?.externalId;
  console.log('\nMailbox:', mailbox.address, 'externalId:', externalId);
  
  if (!externalId) { console.log('No externalId'); return; }
  
  const msgRes = await fetch(`${apiUrl}/v1/mailbox/${externalId}/messages`, { headers });
  const msgData = await msgRes.json();
  console.log('\nMessages count:', msgData.count);
  
  if (msgData.messages?.length > 0) {
    const msg = msgData.messages[0];
    console.log('\nMessage list item keys:', Object.keys(msg));
    console.log('Message list item:', JSON.stringify(msg, null, 2));
    
    const detailRes = await fetch(`${apiUrl}/v1/message/${msg.id}`, { headers });
    const detail = await detailRes.json();
    console.log('\n=== MESSAGE DETAIL ===');
    console.log('Detail keys:', Object.keys(detail));
    console.log('from:', detail.from);
    console.log('to:', detail.to);
    console.log('sender:', detail.sender);
    console.log('recipient:', detail.recipient);
    // Print first 500 chars
    const str = JSON.stringify(detail, null, 2);
    console.log('Detail (first 500):', str.substring(0, 500));
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });

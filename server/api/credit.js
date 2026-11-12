// ═══════════════════════════════════════════════════════════════════════════
// Backlog — Vercel Serverless Webhook Handler  (Production-ready)
// File: server/api/credit.js  → Vercel routes this to /api/credit
//
// Receives webhook POSTs from Monnify or Paystack when a customer
// sends a bank transfer to the seller's virtual account.
//
// STORAGE: Uses Vercel KV (Redis) for persistence across serverless restarts.
//          Falls back to in-memory Map in local dev (vercel dev).
//
// ENV VARS — set in Vercel Dashboard → Project → Settings → Environment Variables:
//   MONNIFY_SECRET_KEY   = your Monnify API Secret Key
//   PAYSTACK_SECRET_KEY  = your Paystack Secret Key (sk_live_xxx)
//   KV_REST_API_URL      = auto-set when you add Vercel KV storage
//   KV_REST_API_TOKEN    = auto-set when you add Vercel KV storage
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

// ── Storage: Vercel KV (production) or in-memory Map (local dev) ──
let kv = null;
const memStore = new Map(); // fallback for local dev

async function initKV() {
  if (kv) return kv;
  try {
    // Vercel KV is auto-available when you add it in the dashboard
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  } catch {
    kv = null; // local dev — use memStore
  }
  return kv;
}

async function storeCredit(ref, credit) {
  const store = await initKV();
  if (store) {
    await store.hset('backlog_credits', { [ref]: JSON.stringify(credit) });
  } else {
    memStore.set(ref, credit);
  }
}

async function getCredits(since = 0) {
  const store = await initKV();
  if (store) {
    const all = await store.hgetall('backlog_credits') || {};
    return Object.values(all)
      .map(v => typeof v === 'string' ? JSON.parse(v) : v)
      .filter(c => (c._receivedAt || 0) > since);
  } else {
    return [...memStore.values()].filter(c => (c._receivedAt || 0) > since);
  }
}

async function hasCredit(ref) {
  const store = await initKV();
  if (store) {
    const val = await store.hget('backlog_credits', ref);
    return val !== null;
  }
  return memStore.has(ref);
}

// ── Main Handler ──
export default async function handler(req, res) {
  // CORS — allow your GitHub Pages / custom domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-business-id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/credits?since=timestamp — polled by the frontend every 15s ──
  if (req.method === 'GET') {
    const since = parseInt(req.query.since) || 0;
    const result = await getCredits(since);
    return res.status(200).json({ credits: result, serverTime: Date.now() });
  }

  // ── POST /api/credit — called by Monnify or Paystack webhook ──
  if (req.method === 'POST') {
    const provider = detectProvider(req);

    // Verify webhook signature (security — rejects fake requests)
    const verified = provider === 'monnify'
      ? verifyMonnify(req)
      : verifyPaystack(req);

    if (!verified) {
      console.warn('[Backlog] Webhook signature INVALID — rejected');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const credit = provider === 'monnify'
      ? parseMonnifyPayload(req.body)
      : parsePaystackPayload(req.body);

    if (!credit) {
      console.warn('[Backlog] Unrecognised payload from', provider);
      return res.status(400).json({ error: 'Unrecognised payload' });
    }

    // Idempotency: skip duplicates (same transaction ref arriving twice)
    if (await hasCredit(credit.transactionRef)) {
      return res.status(200).json({ status: 'duplicate', ref: credit.transactionRef });
    }

    credit._receivedAt = Date.now();
    await storeCredit(credit.transactionRef, credit);

    console.log(`[Backlog] ✅ Credit: ₦${credit.amount} from ${credit.senderName} ref=${credit.transactionRef}`);
    return res.status(200).json({ status: 'ok', ref: credit.transactionRef });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Provider Detection ──
function detectProvider(req) {
  if (req.headers['monnify-signature']) return 'monnify';
  if (req.headers['x-paystack-signature']) return 'paystack';
  if (req.body?.eventData?.product?.reference) return 'monnify';
  return 'paystack';
}

// ── Monnify Signature Verification ──
function verifyMonnify(req) {
  const secret = process.env.MONNIFY_SECRET_KEY;
  if (!secret) return true; // skip in local dev
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return hash === req.headers['monnify-signature'];
}

// ── Paystack Signature Verification ──
function verifyPaystack(req) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return true;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return hash === req.headers['x-paystack-signature'];
}

// ── Monnify Payload Parser ──
// Monnify webhook: event = "SUCCESSFUL_TRANSACTION"
function parseMonnifyPayload(body) {
  try {
    if (body.event !== 'SUCCESSFUL_TRANSACTION') return null;
    const d = body.eventData;
    const source = d.paymentSourceInformation?.[0] || {};
    return {
      transactionRef: d.transactionReference,
      amount: parseFloat(d.amountPaid),
      senderName: source.accountName || d.customer?.name || 'Unknown',
      senderBank: source.bankCode || '',
      senderAccount: source.accountNumber || '',
      narration: d.narration || '',
      paidOn: d.paidOn || new Date().toISOString()
    };
  } catch { return null; }
}

// ── Paystack Payload Parser ──
// Paystack webhook: event = "charge.success" or "transfer.success"
function parsePaystackPayload(body) {
  try {
    if (body.event !== 'charge.success' && body.event !== 'transfer.success') return null;
    const d = body.data;
    return {
      transactionRef: d.reference,
      amount: parseFloat(d.amount) / 100, // Paystack sends kobo
      senderName: d.customer?.name || d.metadata?.sender_name || 'Unknown',
      senderBank: d.authorization?.bank || '',
      senderAccount: d.authorization?.last4 ? `****${d.authorization.last4}` : '',
      narration: d.metadata?.narration || '',
      paidOn: d.paid_at || new Date().toISOString()
    };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// Backlog — Vercel Serverless Webhook Handler
// Route: /api/credit  (this file must live at repo-root/api/credit.js)
//
// HOW IT WORKS:
//   POST /api/credit  ← Monnify calls this when a customer pays
//   GET  /api/credits ← Backlog app polls this every 15s to get new transfers
//
// STORAGE: Upstash Redis (connected via Vercel dashboard → Storage)
//   Env vars set automatically by Vercel when you connect Upstash:
//     UPSTASH_REDIS_REST_URL
//     UPSTASH_REDIS_REST_TOKEN
//
// ENV VARS to add manually in Vercel → Settings → Environment Variables:
//   MONNIFY_SECRET_KEY  = your Monnify API Secret Key
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { Redis } from '@upstash/redis';

// ── Redis client ──
// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// These are set automatically when you connect Upstash in Vercel dashboard.
let redis = null;
function getRedis() {
  if (!redis) {
    try {
      redis = Redis.fromEnv();
    } catch (e) {
      console.warn('[Backlog] Redis not available:', e.message);
    }
  }
  return redis;
}

// In-memory fallback for local development (vercel dev without Redis)
const memStore = new Map();

// ── Storage helpers ──
const REDIS_KEY = 'backlog:credits'; // hash key — each field is a transactionRef

async function storeCredit(ref, credit) {
  const r = getRedis();
  if (r) {
    // hset stores field:value in the hash. We JSON-stringify the credit object.
    await r.hset(REDIS_KEY, { [ref]: JSON.stringify(credit) });
  } else {
    memStore.set(ref, credit);
  }
}

async function getCredits(since = 0) {
  const r = getRedis();
  if (r) {
    const all = await r.hgetall(REDIS_KEY) || {};
    return Object.values(all)
      .map(v => (typeof v === 'string' ? JSON.parse(v) : v))
      .filter(c => (c._receivedAt || 0) > since)
      .sort((a, b) => b._receivedAt - a._receivedAt);
  }
  return [...memStore.values()]
    .filter(c => (c._receivedAt || 0) > since)
    .sort((a, b) => b._receivedAt - a._receivedAt);
}

async function creditExists(ref) {
  const r = getRedis();
  if (r) {
    // hexists returns 1 if field exists, 0 if not
    const exists = await r.hexists(REDIS_KEY, ref);
    return exists === 1;
  }
  return memStore.has(ref);
}

// ── Main handler ──
export default async function handler(req, res) {
  // CORS — allow any origin (the frontend is on GitHub Pages)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-business-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Health check ──
  if (req.method === 'GET' && req.url?.includes('/api/health')) {
    return res.status(200).json({ status: 'ok', time: Date.now() });
  }

  // ── GET /api/credits?since=TIMESTAMP ──
  // The Backlog frontend polls this every 15 seconds.
  // Returns all credits received after the given timestamp.
  if (req.method === 'GET') {
    try {
      const since = parseInt(req.query?.since) || 0;
      const credits = await getCredits(since);
      return res.status(200).json({ credits, serverTime: Date.now() });
    } catch (err) {
      console.error('[Backlog] GET error:', err);
      return res.status(500).json({ error: 'Internal error', credits: [] });
    }
  }

  // ── POST /api/credit ──
  // Called by Monnify's webhook system when a customer transfers money.
  if (req.method === 'POST') {
    try {
      // 1. Verify the request is genuinely from Monnify
      const isValid = verifyMonnify(req);
      if (!isValid) {
        console.warn('[Backlog] ❌ Invalid Monnify signature — rejected');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // 2. Parse the Monnify payload into our standard credit format
      const credit = parseMonnifyPayload(req.body);
      if (!credit) {
        // Monnify sends many event types — only SUCCESSFUL_TRANSACTION matters
        // Return 200 for other events so Monnify stops retrying them
        return res.status(200).json({ status: 'ignored' });
      }

      // 3. Idempotency — if we've already stored this transaction ref, skip it
      //    (Monnify can send the same webhook up to 5 times on failure)
      if (await creditExists(credit.transactionRef)) {
        console.log('[Backlog] Duplicate webhook — ref:', credit.transactionRef);
        return res.status(200).json({ status: 'duplicate', ref: credit.transactionRef });
      }

      // 4. Store it persistently in Redis
      credit._receivedAt = Date.now();
      await storeCredit(credit.transactionRef, credit);

      console.log(`[Backlog] ✅ Payment received: ₦${credit.amount} from ${credit.senderName} (${credit.transactionRef})`);

      // 5. Acknowledge to Monnify — MUST return 200 quickly or Monnify retries
      return res.status(200).json({ status: 'ok', ref: credit.transactionRef });

    } catch (err) {
      console.error('[Backlog] POST error:', err);
      // Still return 200 to prevent Monnify from retrying indefinitely
      return res.status(200).json({ status: 'error', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Monnify Webhook Signature Verification ──
//
// Monnify computes: HMAC-SHA512(requestBody, apiSecretKey)
// and sends it in the header: "monnify-signature"
// We recompute and compare. If they match, it's genuinely from Monnify.
// If MONNIFY_SECRET_KEY is not set (local dev), we skip verification.
//
// Official Monnify docs: https://developers.monnify.com/api/#webhook
function verifyMonnify(req) {
  const secret = process.env.MONNIFY_SECRET_KEY;
  if (!secret) {
    console.warn('[Backlog] MONNIFY_SECRET_KEY not set — skipping signature check (dev mode)');
    return true;
  }

  const receivedHash = req.headers['monnify-signature'];
  if (!receivedHash) {
    console.warn('[Backlog] No monnify-signature header found');
    return false;
  }

  const computedHash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return computedHash === receivedHash;
}

// ── Monnify Payload Parser ──
//
// Monnify webhook shape (SUCCESSFUL_TRANSACTION):
// {
//   "event": "SUCCESSFUL_TRANSACTION",
//   "eventData": {
//     "transactionReference": "MNFY|xxx",
//     "amountPaid": 5000,
//     "paidOn": "2024-01-01 12:00:00",
//     "narration": "Transfer from Emeka",
//     "paymentSourceInformation": [
//       { "accountName": "EMEKA OKOYE", "bankCode": "058", "accountNumber": "0123456789" }
//     ],
//     "customer": { "name": "Emeka Okoye", "email": "emeka@example.com" }
//   }
// }
function parseMonnifyPayload(body) {
  try {
    // Only process successful payment events
    if (body?.event !== 'SUCCESSFUL_TRANSACTION') return null;

    const d = body.eventData;
    if (!d) return null;

    // Validate required fields
    if (!d.transactionReference || !d.amountPaid) return null;

    const source = (d.paymentSourceInformation || [])[0] || {};

    return {
      transactionRef: d.transactionReference,
      amount: parseFloat(d.amountPaid),
      senderName: source.accountName || d.customer?.name || 'Unknown Sender',
      senderBank: source.bankCode || '',
      senderAccount: source.accountNumber || '',
      narration: d.narration || '',
      paidOn: d.paidOn || new Date().toISOString(),
      provider: 'monnify'
    };
  } catch (e) {
    console.error('[Backlog] Error parsing Monnify payload:', e);
    return null;
  }
}

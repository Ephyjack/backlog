// ═══════════════════════════════════════════════════════════════════════════
// Backlog — Vercel Serverless Webhook Handler
// File: /api/credit.js  (Vercel auto-routes this to POST /api/credit)
//
// This file receives webhook POSTs from Monnify or Paystack when a customer
// sends a bank transfer to the seller's virtual account.
//
// DEPLOY:
//   1. npm install  (from /server folder)
//   2. vercel deploy
//   3. Copy the deployment URL → paste into your Backlog app as BACKLOG_API_URL
//   4. Paste the same URL + /api/credit into Monnify or Paystack webhook settings
//
// ENV VARS to set in Vercel dashboard:
//   MONNIFY_SECRET_KEY   = your Monnify API secret
//   PAYSTACK_SECRET_KEY  = your Paystack secret key
//   WEBHOOK_SECRET       = any random string you choose (matches Monnify hash)
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

// ── In-memory store (replace with Supabase/Vercel KV in production) ──
// For production, use: import { kv } from '@vercel/kv';
const credits = new Map(); // keyed by transactionRef

export default async function handler(req, res) {
  // CORS headers (allow your GitHub Pages domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-business-id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/credits?since=timestamp — polled by the frontend ──
  if (req.method === 'GET') {
    const since = parseInt(req.query.since) || 0;
    const result = [...credits.values()].filter(c => c._receivedAt > since);
    return res.status(200).json({ credits: result });
  }

  // ── POST /api/credit — called by Monnify or Paystack webhook ──
  if (req.method === 'POST') {
    const provider = detectProvider(req);

    // Verify signature
    const verified = provider === 'monnify'
      ? verifyMonnify(req)
      : verifyPaystack(req);

    if (!verified) {
      console.warn('[Backlog] Webhook signature invalid');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const credit = provider === 'monnify'
      ? parseMonnifyPayload(req.body)
      : parsePaystackPayload(req.body);

    if (!credit) return res.status(400).json({ error: 'Unrecognised payload' });

    // Idempotency: skip duplicates
    if (credits.has(credit.transactionRef)) {
      return res.status(200).json({ status: 'duplicate', ref: credit.transactionRef });
    }

    credit._receivedAt = Date.now();
    credits.set(credit.transactionRef, credit);

    console.log(`[Backlog] Credit received: ₦${credit.amount} from ${credit.senderName} (${credit.transactionRef})`);
    return res.status(200).json({ status: 'ok', ref: credit.transactionRef });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Provider Detection ──
function detectProvider(req) {
  if (req.headers['monnify-signature']) return 'monnify';
  if (req.headers['x-paystack-signature']) return 'paystack';
  // Fallback: check body shape
  if (req.body?.eventData?.product?.reference) return 'monnify';
  return 'paystack';
}

// ── Monnify Signature Verification ──
function verifyMonnify(req) {
  const secret = process.env.MONNIFY_SECRET_KEY;
  if (!secret) return true; // skip in dev
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
// Monnify sends: event: "SUCCESSFUL_TRANSACTION", eventData: { amountPaid, paymentSourceInformation, ... }
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
// Paystack sends: event: "charge.success", data: { amount (kobo), authorization, customer, ... }
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


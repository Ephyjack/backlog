// ═══════════════════════════════════════════════════════════════════════════
// Backlog — Virtual Account UI & Webhook Bridge
// Option A: Monnify reserved accounts / Paystack dedicated virtual accounts
//
// Flow:
//   1. Seller sets up once → gets a fixed account number (Monnify/Paystack)
//   2. Seller prints it / shows QR code to every customer
//   3. Customer sends transfer → Monnify/Paystack webhook → your server
//   4. Your server posts to: POST /api/credit  (see /server/webhook.js)
//   5. This file polls /api/credits every 15s and ingests new ones
//   6. Credits appear in the reconciliation queue with smart match suggestions
// ═══════════════════════════════════════════════════════════════════════════

// ── Config ──
// BACKLOG_API_URL controls the backend connection:
//   - Empty string (''): same-origin mode — API is on the same Vercel domain as the app
//   - Full URL: cross-origin mode — API is on a different domain
//   - null/undefined: demo mode — no real API, use simulateIncomingTransfer()
const _rawApiUrl = window.BACKLOG_API_URL;
const BACKLOG_API_URL = (_rawApiUrl === '' || _rawApiUrl) ? _rawApiUrl : null;
const IS_LIVE = BACKLOG_API_URL !== null; // true when backend is configured
const POLL_INTERVAL_MS = 15000; // 15 seconds

let _pollTimer = null;
let _lastPollAt = null;

// ── Virtual Account Setup UI ──

function renderVirtualAccountSetup() {
  const va = getVirtualAccount(appData);
  const container = document.getElementById('virtual-account-section');
  if (!container) return;

  if (va && va.isActive) {
    container.innerHTML = buildAccountDisplay(va);
  } else {
    container.innerHTML = buildAccountSetupForm();
  }
}

function buildAccountDisplay(va) {
  const qrData = `${va.bankName}\n${va.accountNumber}\n${va.accountName}`;
  return `
    <div class="card card-glow" style="border-color: var(--primary);">
      <div class="card-header">
        <div class="card-title">🏦 Your Business Payment Account</div>
        <span class="badge badge-green">Active</span>
      </div>
      <div style="display:flex; gap:24px; align-items:flex-start; flex-wrap:wrap; margin-top:12px;">
        <div style="flex:1; min-width:200px;">
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:4px;">Bank</div>
          <div style="font-size:18px; font-weight:700;">${va.bankName}</div>
          <div style="font-size:13px; color:var(--text-muted); margin-top:12px; margin-bottom:4px;">Account Number</div>
          <div style="font-size:28px; font-weight:800; color:var(--primary); letter-spacing:2px; font-family:'JetBrains Mono',monospace;">${va.accountNumber}</div>
          <div style="font-size:13px; color:var(--text-muted); margin-top:12px; margin-bottom:4px;">Account Name</div>
          <div style="font-size:16px; font-weight:600;">${va.accountName}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">Provider: ${va.provider || 'Monnify'}</div>
        </div>
        <div id="va-qr-wrap" style="text-align:center;">
          <canvas id="va-qrcode" width="140" height="140" style="border-radius:8px; border:2px solid var(--primary);"></canvas>
          <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">Scan to pay</div>
        </div>
      </div>
      <div class="divider"></div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="copyAccountNumber('${va.accountNumber}')">📋 Copy Number</button>
        <button class="btn btn-secondary btn-sm" onclick="shareAccountDetails()">📤 Share Details</button>
        <button class="btn btn-ghost btn-sm" onclick="printPaymentSlip()">🖨️ Print Slip</button>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto; color:var(--danger);" onclick="confirmDisableVirtualAccount()">Unlink Account</button>
      </div>
    </div>
    <div class="alert alert-info" style="margin-top:16px;">
      <div class="alert-icon">💡</div>
      <div class="alert-content">
        <div class="alert-title">How it works</div>
        <div class="alert-desc">Give every customer this account number. When they transfer money, it appears automatically in your Bank Sync queue below — no manual entry needed. You then tap the product it was for to complete the record.</div>
      </div>
    </div>`;
}

function buildAccountSetupForm() {
  return `
    <div class="card" style="border:2px dashed var(--border);">
      <div style="text-align:center; padding:16px 0;">
        <div style="font-size:48px; margin-bottom:12px;">🏦</div>
        <div style="font-size:18px; font-weight:700; margin-bottom:8px;">Link a Payment Account</div>
        <div style="font-size:14px; color:var(--text-muted); max-width:420px; margin:0 auto 20px;">
          Get one fixed account number your customers always pay into.
          Every transfer is automatically captured — no manual entry needed.
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Provider</label>
          <select class="form-input" id="va-provider" onchange="onVAProviderChange()">
            <option value="monnify">Monnify (Recommended)</option>
            <option value="paystack">Paystack</option>
            <option value="manual">I already have an account — enter manually</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Bank Name</label>
          <select class="form-input" id="va-bank">
            <option value="Wema Bank">Wema Bank (Monnify default)</option>
            <option value="GTBank">GTBank</option>
            <option value="Access Bank">Access Bank</option>
            <option value="Zenith Bank">Zenith Bank</option>
            <option value="First Bank">First Bank</option>
            <option value="UBA">UBA</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Account Number</label>
          <input class="form-input" id="va-account-number" placeholder="10-digit account number" maxlength="10" inputmode="numeric" />
        </div>
        <div class="form-group">
          <label class="form-label">Account Name</label>
          <input class="form-input" id="va-account-name" placeholder="As registered with your provider" value="${appData.business?.name || ''}" />
        </div>
      </div>
      <div id="va-api-section" style="display:none;">
        <div class="divider"></div>
        <div class="form-group">
          <label class="form-label">API Secret Key <span style="color:var(--text-muted); font-weight:400;">(stored locally, never shared)</span></label>
          <input class="form-input" id="va-api-key" type="password" placeholder="sk_live_xxxx or monnify_secret_xxxx" />
        </div>
        <div class="form-group">
          <label class="form-label">Webhook Receiver URL</label>
          <input class="form-input" id="va-webhook-url" placeholder="https://your-app.vercel.app/api/credit" readonly
            value="${BACKLOG_API_URL ? BACKLOG_API_URL + '/api/credit' : 'Deploy backend first — see README'}" />
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Paste this URL into your Monnify/Paystack webhook settings dashboard.</div>
        </div>
      </div>
      <div class="divider"></div>
      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="renderVirtualAccountSetup()">Cancel</button>
        <button class="btn btn-primary" onclick="saveVirtualAccountSetup()">🔗 Link Account</button>
      </div>
    </div>
    <div class="alert alert-warning" style="margin-top:16px;">
      <div class="alert-icon">ℹ️</div>
      <div class="alert-content">
        <div class="alert-title">Don't have a Monnify account yet?</div>
        <div class="alert-desc">Sign up free at <a href="https://monnify.com" target="_blank" style="color:var(--primary);">monnify.com</a>. Create a reserved account under your business name. Copy the account number here. For automatic webhook alerts, also deploy the Backlog backend (one-click on Vercel — see README).</div>
      </div>
    </div>`;
}

function onVAProviderChange() {
  const provider = document.getElementById('va-provider')?.value;
  const apiSection = document.getElementById('va-api-section');
  if (apiSection) {
    apiSection.style.display = (provider !== 'manual') ? 'block' : 'none';
  }
}

function saveVirtualAccountSetup() {
  const accountNumber = document.getElementById('va-account-number')?.value?.trim();
  const accountName = document.getElementById('va-account-name')?.value?.trim();
  const bankName = document.getElementById('va-bank')?.value;
  const provider = document.getElementById('va-provider')?.value;
  const apiKey = document.getElementById('va-api-key')?.value?.trim();

  if (!accountNumber || accountNumber.length < 10) {
    showToast('Please enter a valid 10-digit account number', 'warning'); return;
  }
  if (!accountName) {
    showToast('Please enter the account name', 'warning'); return;
  }

  setVirtualAccount(appData, { accountNumber, accountName, bankName, provider, apiKey });
  renderVirtualAccountSetup();
  generateVAQRCode();
  startVirtualAccountPolling();
  showToast('✅ Payment account linked! Share this number with your customers.', 'success');
}

function confirmDisableVirtualAccount() {
  if (confirm('Unlink this account? Your transaction history will be kept, but new transfers will no longer be tracked automatically.')) {
    disableVirtualAccount(appData);
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    renderVirtualAccountSetup();
    showToast('Account unlinked.', 'info');
  }
}

// ── QR Code Generation (pure canvas — no external library needed) ──

function generateVAQRCode() {
  // Uses the built-in QR module if available, otherwise shows account text
  const va = getVirtualAccount(appData);
  if (!va) return;
  setTimeout(() => {
    const canvas = document.getElementById('va-qrcode');
    if (!canvas) return;
    // If QRious or similar is loaded:
    if (window.QRious) {
      new QRious({
        element: canvas,
        value: `Bank: ${va.bankName}\nAcct: ${va.accountNumber}\nName: ${va.accountName}`,
        size: 140,
        backgroundAlpha: 1,
        foreground: '#00D97E',
        background: '#0F0F1E',
        level: 'M'
      });
    } else {
      // Fallback: draw account number as text on canvas
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, 140, 140);
      ctx.fillStyle = '#00D97E';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(va.bankName, 70, 40);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(va.accountNumber, 70, 70);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#AAAACC';
      ctx.fillText(va.accountName, 70, 95);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#666688';
      ctx.fillText('(QR: add QRious.js)', 70, 120);
    }
  }, 100);
}

function copyAccountNumber(number) {
  navigator.clipboard?.writeText(number).then(() => {
    showToast('✅ Account number copied!', 'success');
  }).catch(() => {
    showToast(`Account: ${number}`, 'info');
  });
}

function shareAccountDetails() {
  const va = getVirtualAccount(appData);
  if (!va) return;
  const text = `Pay ${appData.business?.name || 'us'} via bank transfer:\nBank: ${va.bankName}\nAccount: ${va.accountNumber}\nName: ${va.accountName}`;
  if (navigator.share) {
    navigator.share({ title: 'Payment Details', text });
  } else {
    navigator.clipboard?.writeText(text);
    showToast('Payment details copied to clipboard!', 'success');
  }
}

function printPaymentSlip() {
  const va = getVirtualAccount(appData);
  if (!va) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
      h1 { font-size: 28px; margin-bottom: 4px; }
      .biz { font-size: 16px; color: #666; margin-bottom: 32px; }
      .label { font-size: 13px; color: #999; margin-top: 20px; }
      .value { font-size: 22px; font-weight: bold; margin-top: 4px; }
      .acct { font-size: 36px; font-weight: 900; letter-spacing: 4px; color: #00875A; margin-top: 4px; }
      .footer { margin-top: 48px; font-size: 12px; color: #ccc; }
      @media print { button { display: none; } }
    </style></head><body>
    <div style="border: 3px solid #00875A; border-radius: 12px; padding: 32px; max-width: 400px; margin: 0 auto;">
      <h1>💰 Pay Here</h1>
      <div class="biz">${appData.business?.name || 'Business Payment'}</div>
      <div class="label">Bank</div>
      <div class="value">${va.bankName}</div>
      <div class="label">Account Number</div>
      <div class="acct">${va.accountNumber}</div>
      <div class="label">Account Name</div>
      <div class="value">${va.accountName}</div>
    </div>
    <div class="footer">Generated by Backlog · Every sale. Every insight. Every business.</div>
    <br><button onclick="window.print()">🖨️ Print</button>
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

// ── Webhook Polling Bridge ──
// Polls your backend every 15s for new credits pushed by Monnify webhook

function startVirtualAccountPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  const va = getVirtualAccount(appData);
  if (!va || !va.isActive) return;
  if (!IS_LIVE) {
    console.info('[Backlog] No backend configured — running in demo mode. Use simulateIncomingTransfer().');
    return;
  }
  _pollTimer = setInterval(pollForNewCredits, POLL_INTERVAL_MS);
  pollForNewCredits(); // immediate first poll
}

async function pollForNewCredits() {
  if (!navigator.onLine) return;
  const va = getVirtualAccount(appData);
  if (!va || !va.isActive || !IS_LIVE) return;

  try {
    const since = _lastPollAt || (Date.now() - 3600000); // last hour on first poll
    // Build URL: empty BACKLOG_API_URL = same origin, otherwise prefix with the URL
    const base = BACKLOG_API_URL || '';
    const url = `${base}/api/credits?since=${since}`;
    const res = await fetch(url, {
      headers: { 'x-business-id': appData.business?.id || '' }
    });
    if (!res.ok) {
      console.warn('[Backlog] Poll returned', res.status);
      return;
    }

    const { credits = [] } = await res.json();
    _lastPollAt = Date.now();

    let newCount = 0;
    for (const credit of credits) {
      const result = ingestVirtualAccountCredit(appData, credit);
      if (result.success) newCount++;
    }

    if (newCount > 0) {
      saveData(appData);
      updateReconcileBadge();
      showToast(`📲 ${newCount} new transfer${newCount > 1 ? 's' : ''} received!`, 'success');
      if (typeof renderReconcile === 'function' && currentView === 'reconcile') {
        renderReconcile();
      }
    }
  } catch (err) {
    console.warn('[Backlog] Poll failed:', err.message);
  }
}

// ── Demo simulation (fires when no real API is configured) ──
// Simulates a webhook credit arriving — useful for demos and offline testing

function simulateIncomingTransfer(overrides = {}) {
  const senders = [
    { name: 'Emeka Okoye', bank: 'GTBank' },
    { name: 'Aisha Mohammed', bank: 'Zenith Bank' },
    { name: 'Tunde Adekunle', bank: 'Access Bank' },
    { name: 'Chioma Eze', bank: 'First Bank' },
    { name: 'Musa Ibrahim', bank: 'UBA' }
  ];
  const sender = senders[Math.floor(Math.random() * senders.length)];
  const amounts = [1200, 2400, 4500, 7500, 8000, 15000, 32000];
  const amount = overrides.amount || amounts[Math.floor(Math.random() * amounts.length)];

  const credit = {
    transactionRef: 'DEMO_' + Date.now(),
    amount,
    senderName: overrides.senderName || sender.name,
    senderBank: overrides.senderBank || sender.bank,
    senderAccount: '0' + Math.floor(Math.random() * 9000000000 + 1000000000),
    narration: overrides.narration || 'TRF from ' + sender.name,
    paidOn: new Date().toISOString()
  };

  const result = ingestVirtualAccountCredit(appData, credit);
  if (result.success) {
    saveData(appData);
    updateReconcileBadge();
    showToast(`📲 Transfer: ₦${amount.toLocaleString()} from ${credit.senderName}`, 'success');
    if (typeof renderReconcile === 'function' && currentView === 'reconcile') {
      renderReconcile();
    }
  }
  return result;
}


// ═══════════════════════════════════════════════════
// Backlog — Data Storage Layer (LocalStorage)
// ═══════════════════════════════════════════════════

const DB_KEY = 'backlog_data';

const defaultData = {
  business: null,
  products: [],
  sales: [],
  unreconciledTransfers: [],
  assignedTransactions: [],
  reconciledTransactions: [],
  bankAccounts: [],
  settings: {
    currency: 'NGN',
    lowStockThreshold: 10,
    taxRate: 0,
    bankAutoSync: true,
    bankSyncInterval: 30000
  }
};

// ── Data Migration ── ensures older saved data gets new fields
function migrateData(data) {
  if (!data.unreconciledTransfers) data.unreconciledTransfers = [];
  if (!data.assignedTransactions) data.assignedTransactions = [];
  if (!data.reconciledTransactions) data.reconciledTransactions = [];
  if (!data.bankAccounts) data.bankAccounts = [];
  if (!data.settings) data.settings = { ...defaultData.settings };
  if (data.settings.bankAutoSync === undefined) data.settings.bankAutoSync = true;
  if (data.settings.bankSyncInterval === undefined) data.settings.bankSyncInterval = 30000;
  // New feature fields
  if (!data.expenses) data.expenses = [];
  if (!data.debts) data.debts = [];
  if (!data.restocks) data.restocks = [];
  if (!data.creditWallets) data.creditWallets = [];
  if (!data.paymentLedger) data.paymentLedger = []; // unified payment history
  return data;
}

// Demo business data
const demoData = {
  business: {
    id: 'biz_demo',
    name: 'Chukwuemeka Stores',
    type: 'supermarket',
    typeLabel: 'Supermarket',
    state: 'Akwa Ibom',
    owner: 'Emeka Okoye',
    phone: '08012345678',
    address: '14 Ikot Ekpene Road, Uyo',
    createdAt: new Date().toISOString()
  },
  products: [
    { id: 'p1', name: 'Indomie Noodles', category: 'Food', price: 120, stock: 280, unit: 'pack', emoji: '🍜', minStock: 50, costPrice: 85 },
    { id: 'p2', name: 'Peak Milk (Tin)', category: 'Dairy', price: 1800, stock: 45, unit: 'tin', emoji: '🥛', minStock: 20, costPrice: 1400 },
    { id: 'p3', name: 'Golden Morn', category: 'Food', price: 850, stock: 12, unit: 'pack', emoji: '🌾', minStock: 20, costPrice: 650 },
    { id: 'p4', name: 'Chicken (1kg)', category: 'Protein', price: 4500, stock: 38, unit: 'kg', emoji: '🍗', minStock: 10, costPrice: 3800 },
    { id: 'p5', name: 'Garri (50kg bag)', category: 'Grains', price: 32000, stock: 8, unit: 'bag', emoji: '🌽', minStock: 5, costPrice: 26000 },
    { id: 'p6', name: 'Semovita', category: 'Food', price: 1200, stock: 62, unit: 'pack', emoji: '🌾', minStock: 15, costPrice: 950 },
    { id: 'p7', name: 'Groundnut Oil (5L)', category: 'Cooking', price: 7500, stock: 22, unit: 'bottle', emoji: '🫙', minStock: 10, costPrice: 6200 },
    { id: 'p8', name: 'Bournvita', category: 'Beverages', price: 2400, stock: 5, unit: 'tin', emoji: '☕', minStock: 15, costPrice: 1900 },
    { id: 'p9', name: 'Rice (50kg bag)', category: 'Grains', price: 78000, stock: 15, unit: 'bag', emoji: '🍚', minStock: 5, costPrice: 68000 },
    { id: 'p10', name: 'Tomato Paste', category: 'Condiments', price: 350, stock: 145, unit: 'tin', emoji: '🍅', minStock: 30, costPrice: 250 },
    { id: 'p11', name: 'Suya Spice', category: 'Spices', price: 200, stock: 3, unit: 'pack', emoji: '🌶️', minStock: 10, costPrice: 120 },
    { id: 'p12', name: 'Eva Water (1.5L)', category: 'Beverages', price: 400, stock: 96, unit: 'bottle', emoji: '💧', minStock: 24, costPrice: 280 },
  ],
  sales: generateDemoSales(),
  unreconciledTransfers: [
    { id: 'tx_1', senderName: 'Emeka Okon', amount: 8000, bank: 'GTBank', timestamp: Date.now() - 1800000, date: new Date(Date.now() - 1800000).toISOString() },
    { id: 'tx_2', senderName: 'Aisha Bello', amount: 3200, bank: 'Zenith Bank', timestamp: Date.now() - 7200000, date: new Date(Date.now() - 7200000).toISOString() },
    { id: 'tx_3', senderName: 'Tunde Folawiyo', amount: 15400, bank: 'Access Bank', timestamp: Date.now() - 14400000, date: new Date(Date.now() - 14400000).toISOString() }
  ],
  assignedTransactions: [
    { 
      id: 'tx_4', 
      senderName: 'Fatima Hassan', 
      amount: 12000, 
      bank: 'GTBank', 
      timestamp: Date.now() - 86400000, 
      date: new Date(Date.now() - 86400000).toISOString(),
      assignedProducts: [
        { productId: 'p1', quantity: 50, unitPrice: 120 },
        { productId: 'p2', quantity: 2, unitPrice: 1800 }
      ],
      reconciliationNotes: 'Customer order for resale',
      assignedAt: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  reconciledTransactions: [
    {
      id: 'tx_5',
      senderName: 'Ibrahim Usman',
      amount: 9200,
      bank: 'Access Bank',
      timestamp: Date.now() - 172800000,
      date: new Date(Date.now() - 172800000).toISOString(),
      assignedProducts: [
        { productId: 'p10', quantity: 24, unitPrice: 350 },
        { productId: 'p3', quantity: 0, unitPrice: 850 }
      ],
      reconciliationNotes: 'Weekly stock purchase',
      assignedAt: new Date(Date.now() - 172800000).toISOString(),
      reconciledAt: new Date(Date.now() - 172800000).toISOString()
    }
  ],
  bankAccounts: [
    {
      id: 'bank_1',
      bankName: 'GTBank',
      accountNumber: '0234567890',
      accountNumberFull: '0234567890',
      accountHolder: 'Chukwuemeka Stores',
      currency: 'NGN',
      isLinked: true,
      lastSync: new Date().toISOString(),
      apiKey: 'key_demo_gtbank_12345',
      createdAt: new Date(Date.now() - 2592000000).toISOString()
    }
  ],
  settings: { currency: 'NGN', lowStockThreshold: 10, taxRate: 7.5, bankAutoSync: true, bankSyncInterval: 30000 }
};

function generateDemoSales() {
  const sales = [];
  const productIds = ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p12'];
  const payTypes = ['cash','transfer','pos','pos','cash','cash','transfer'];
  const now = Date.now();

  // Generate 90 days of sales
  for (let day = 89; day >= 0; day--) {
    const salesPerDay = Math.floor(Math.random() * 18) + 5;
    for (let s = 0; s < salesPerDay; s++) {
      const pid = productIds[Math.floor(Math.random() * productIds.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      const prices = {'p1':120,'p2':1800,'p3':850,'p4':4500,'p5':32000,'p6':1200,'p7':7500,'p8':2400,'p9':78000,'p10':350,'p11':200,'p12':400};
      const ts = now - (day * 86400000) - (Math.random() * 86400000);
      sales.push({
        id: `s_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
        productId: pid,
        quantity: qty,
        unitPrice: prices[pid] || 500,
        amount: (prices[pid] || 500) * qty,
        paymentType: payTypes[Math.floor(Math.random() * payTypes.length)],
        timestamp: ts,
        date: new Date(ts).toISOString()
      });
    }
  }
  return sales.sort((a,b) => b.timestamp - a.timestamp);
}

// ── Storage API ──

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...defaultData };
    const parsed = JSON.parse(raw);
    return migrateData(parsed);
  } catch(e) {
    return { ...defaultData };
  }
}

function saveData(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch(e) {
    console.error('Save failed:', e);
    return false;
  }
}

function loadDemoData() {
  saveData(demoData);
  return demoData;
}

function clearData() {
  localStorage.removeItem(DB_KEY);
}

// ── Data Queries ──

function getProducts(data) {
  return data.products || [];
}

function getProductById(data, id) {
  return data.products.find(p => p.id === id);
}

function addProduct(data, product) {
  const newProduct = {
    ...product,
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
    createdAt: new Date().toISOString()
  };
  data.products.push(newProduct);
  saveData(data);
  return newProduct;
}

function updateProduct(data, id, updates) {
  const idx = data.products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  data.products[idx] = { ...data.products[idx], ...updates };
  saveData(data);
  return data.products[idx];
}

function deleteProduct(data, id) {
  data.products = data.products.filter(p => p.id !== id);
  saveData(data);
}

function recordSale(data, saleObj) {
  const product = getProductById(data, saleObj.productId);
  if (!product) return { success: false, error: 'Product not found' };
  if (product.stock < saleObj.quantity) {
    return { success: false, error: `Insufficient stock. Available: ${product.stock}` };
  }

  updateProduct(data, saleObj.productId, { stock: product.stock - saleObj.quantity });

  const sale = {
    id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
    ...saleObj,
    unitPrice: product.price,
    amount: product.price * saleObj.quantity,
    timestamp: Date.now(),
    date: new Date().toISOString()
  };
  data.sales.unshift(sale);
  saveData(data);
  return { success: true, sale };
}

// ── Reconciliation Engine ──

function getUnreconciledTransfers(data) {
  return data.unreconciledTransfers || [];
}

function reconcileTransfer(data, txId, matchedItems) {
  const txIdx = data.unreconciledTransfers.findIndex(t => t.id === txId);
  if (txIdx === -1) return { success: false, error: 'Bank transfer alert not found' };
  const tx = data.unreconciledTransfers[txIdx];

  for (const item of matchedItems) {
    const product = getProductById(data, item.productId);
    if (!product) return { success: false, error: `Product not found: ${item.productId}` };
    if (product.stock < item.quantity) {
      return { success: false, error: `Insufficient stock for ${product.name}. Available: ${product.stock}` };
    }
  }

  const salesRecorded = [];
  for (const item of matchedItems) {
    const product = getProductById(data, item.productId);
    updateProduct(data, item.productId, { stock: product.stock - item.quantity });

    const sale = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.price,
      amount: product.price * item.quantity,
      paymentType: 'transfer',
      note: `Reconciled transfer from ${tx.senderName} (${tx.bank})`,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    data.sales.unshift(sale);
    salesRecorded.push(sale);
  }

  data.unreconciledTransfers.splice(txIdx, 1);
  saveData(data);
  return { success: true, sales: salesRecorded };
}

// ── Analytics ──

function getSalesInRange(data, daysBack) {
  const cutoff = Date.now() - (daysBack * 86400000);
  return data.sales.filter(s => s.timestamp >= cutoff);
}

function getTodaySales(data) {
  const today = new Date();
  today.setHours(0,0,0,0);
  return data.sales.filter(s => s.timestamp >= today.getTime());
}

function getRevenue(sales) {
  return sales.reduce((sum, s) => sum + s.amount, 0);
}

function getTopProducts(data, n = 5, daysBack = 30) {
  const sales = getSalesInRange(data, daysBack);
  const totals = {};
  sales.forEach(s => {
    totals[s.productId] = (totals[s.productId] || 0) + s.amount;
  });
  return Object.entries(totals)
    .sort((a,b) => b[1] - a[1])
    .slice(0, n)
    .map(([pid, revenue]) => ({
      product: getProductById(data, pid),
      revenue
    }))
    .filter(x => x.product);
}

function getLowStockProducts(data) {
  return data.products.filter(p => p.stock <= (p.minStock || data.settings.lowStockThreshold));
}

// ── Revenue helpers ──

function getReconciledRevenue(data) {
  // Sum all reconciled bank transfer amounts
  return (data.reconciledTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
}

function getTotalRevenue(data) {
  // Sales recorded + reconciled transfers (no double-counting: reconciled transfers create sales records)
  return data.sales.reduce((sum, s) => sum + (s.amount || 0), 0);
}

function getDailySalesChart(data, days = 30) {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const daySales = data.sales.filter(s => s.timestamp >= d.getTime() && s.timestamp < nextD.getTime());
    result.push({
      label: d.toLocaleDateString('en-NG', { month:'short', day:'numeric' }),
      revenue: getRevenue(daySales),
      count: daySales.length
    });
  }
  return result;
}

// ── Formatting ──

function formatNGN(amount) {
  if (amount >= 1000000) return '₦' + (amount/1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '₦' + (amount/1000).toFixed(1) + 'K';
  return '₦' + amount.toLocaleString('en-NG');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateTime(ts) {
  return formatDate(ts) + ' ' + formatTime(ts);
}

// ═══════════════════════════════════════════════════
// OFFLINE SYNC & REAL-TIME UPDATES
// ═══════════════════════════════════════════════════

// ── Sync State Management ──
let syncState = {
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncTime: null,
  pendingChanges: [],
  syncErrors: []
};

// ── Network Status Monitoring ──
function initNetworkMonitoring() {
  window.addEventListener('online', () => {
    syncState.isOnline = true;
    updateSyncStatus();
    triggerAutoSync();
  });

  window.addEventListener('offline', () => {
    syncState.isOnline = false;
    updateSyncStatus();
  });
}

function updateSyncStatus() {
  const dot = document.querySelector('.sync-dot');
  if (!dot) return;

  if (syncState.isSyncing) {
    dot.classList.remove('offline');
    dot.classList.add('syncing');
  } else if (syncState.isOnline) {
    dot.classList.remove('offline', 'syncing');
  } else {
    dot.classList.add('offline');
  }
}

// ── Offline Transaction Queue ──
const SYNC_QUEUE_KEY = 'backlog_sync_queue';

function getOfflineSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function addToSyncQueue(operation) {
  const queue = getOfflineSyncQueue();
  queue.push({
    ...operation,
    timestamp: Date.now(),
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2,5)}`
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  syncState.pendingChanges = [];
}

// ── Smart Sync Logic ──
function triggerAutoSync() {
  if (!syncState.isOnline || syncState.isSyncing) return;

  syncState.isSyncing = true;
  updateSyncStatus();

  setTimeout(() => {
    performSync();
  }, 500);
}

async function performSync() {
  try {
    const queue = getOfflineSyncQueue();
    if (queue.length === 0) {
      syncState.isSyncing = false;
      updateSyncStatus();
      return;
    }

    // Process sync queue
    for (const op of queue) {
      try {
        switch (op.type) {
          case 'sale':
            // Merge offline sale with current data
            appData.sales.push(op.data);
            break;
          case 'bank_reconciliation':
            // Merge bank reconciliation
            if (!appData.reconciledTransactions) appData.reconciledTransactions = [];
            appData.reconciledTransactions.push(op.data);
            break;
          case 'product_update':
            // Merge product updates
            const product = getProductById(appData, op.data.id);
            if (product) {
              Object.assign(product, op.data);
            }
            break;
        }
      } catch (e) {
        syncState.syncErrors.push({
          operation: op,
          error: e.message,
          timestamp: Date.now()
        });
      }
    }

    // Save merged data
    saveData(appData);
    clearSyncQueue();

    syncState.lastSyncTime = new Date().toISOString();
    syncState.isSyncing = false;
    updateSyncStatus();

    // Trigger UI refresh
    if (window.appData && window.updateReconcileBadge) {
      updateReconcileBadge();
      updateLowStockBadge();
      if (currentView === 'reconcile') {
        renderReconcile();
      } else if (currentView === 'dashboard') {
        renderDashboard();
      }
    }

    showToast('✅ All offline changes synced!', 'success');
  } catch (e) {
    console.error('Sync failed:', e);
    syncState.syncErrors.push({
      error: e.message,
      timestamp: Date.now()
    });
    syncState.isSyncing = false;
    updateSyncStatus();
    showToast('⚠️ Sync encountered an error. Will retry...', 'warning');
  }
}

// ── Real-time Updates ──
function watchProductChanges(callback) {
  // Simple polling-based change detection
  let lastSnapshot = JSON.stringify(appData.products);

  setInterval(() => {
    const currentSnapshot = JSON.stringify(appData.products);
    if (currentSnapshot !== lastSnapshot) {
      callback(appData.products);
      lastSnapshot = currentSnapshot;
    }
  }, 5000);
}

function watchTransactionChanges(callback) {
  let lastCount = (appData.unreconciledTransfers || []).length +
                  (appData.assignedTransactions || []).length +
                  (appData.reconciledTransactions || []).length;

  setInterval(() => {
    const currentCount = (appData.unreconciledTransfers || []).length +
                         (appData.assignedTransactions || []).length +
                         (appData.reconciledTransactions || []).length;

    if (currentCount !== lastCount) {
      callback({
        pending: appData.unreconciledTransfers || [],
        assigned: appData.assignedTransactions || [],
        reconciled: appData.reconciledTransactions || []
      });
      lastCount = currentCount;
    }
  }, 3000);
}

// ── Periodic Bank Sync ──
function startBankSyncPolling() {
  if (!appData.settings.bankAutoSync) return;

  const interval = appData.settings.bankSyncInterval || 30000;

  setInterval(() => {
    if (!syncState.isOnline) return;

    const accounts = getBankAccounts ? getBankAccounts(appData) : [];
    accounts.forEach(account => {
      if (pollBankTransactions) {
        pollBankTransactions(appData, account.id);
      }
    });
  }, interval);
}

// ── Export Pending Changes Summary ──
function getSyncSummary() {
  const queue = getOfflineSyncQueue();
  return {
    isOnline: syncState.isOnline,
    isSyncing: syncState.isSyncing,
    pendingOperations: queue.length,
    lastSyncTime: syncState.lastSyncTime,
    syncErrors: syncState.syncErrors.length,
    recentErrors: syncState.syncErrors.slice(-3)
  };
}

function getStockColor(stock, minStock) {
  const min = minStock || 10;
  if (stock <= 0) return 'red';
  if (stock <= min) return 'red';
  if (stock <= min * 2) return 'yellow';
  return 'green';
}

function getStockPercent(stock, maxStock) {
  const max = maxStock || Math.max(stock * 1.5, 100);
  return Math.min(100, (stock / max) * 100);
}

function getCategorySales(data, daysBack = 30) {
  const sales = getSalesInRange(data, daysBack);
  const cats = {};
  sales.forEach(s => {
    const p = getProductById(data, s.productId);
    if (!p) return;
    const cat = p.category || 'Other';
    cats[cat] = (cats[cat] || 0) + s.amount;
  });
  return Object.entries(cats).sort((a,b) => b[1]-a[1]);
}

function getPaymentMethodBreakdown(data, daysBack = 30) {
  const sales = getSalesInRange(data, daysBack);
  const methods = { cash: 0, pos: 0, transfer: 0, credit: 0 };
  sales.forEach(s => {
    const m = s.paymentType || 'cash';
    methods[m] = (methods[m] || 0) + s.amount;
  });
  return methods;
}


// ═══════════════════════════════════════════════════
// TIME-RANGE UTILITIES
// ═══════════════════════════════════════════════════

/**
 * Returns sales from the last N hours.
 * hours = 0 means "all time"
 */
function getSalesByPeriod(data, hours) {
  if (!hours || hours === 0) return data.sales || [];
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  return (data.sales || []).filter(s => (s.timestamp || 0) >= cutoff);
}

function getSalesPeriodLabel(hours) {
  if (!hours || hours === 0) return 'All Time';
  if (hours === 1) return 'Last Hour';
  if (hours === 24) return 'Today';
  if (hours === 48) return 'Last 2 Days';
  if (hours === 72) return 'Last 3 Days';
  if (hours === 168) return 'Last 7 Days';
  if (hours === 720) return 'Last 30 Days';
  if (hours === 2160) return 'Last 3 Months';
  if (hours === 8760) return 'Last Year';
  return `Last ${hours}h`;
}

/**
 * Group sales by product and sum quantities + revenue.
 * Returns sorted by total revenue descending.
 */
function getProductSalesSummary(sales, products) {
  const map = {};
  (sales || []).forEach(s => {
    if (!s.productId) return;
    if (!map[s.productId]) {
      const p = products.find(pr => pr.id === s.productId);
      map[s.productId] = {
        productId: s.productId,
        name: p?.name || 'Unknown',
        emoji: p?.emoji || '📦',
        unit: p?.unit || 'unit',
        totalQty: 0,
        totalRevenue: 0,
        transactions: []
      };
    }
    map[s.productId].totalQty += (s.quantity || 1);
    map[s.productId].totalRevenue += (s.amount || 0);
    map[s.productId].transactions.push(s);
  });
  return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Returns hourly breakdown for today (for 1H chart).
 */
function getHourlySales(data) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }));
  (data.sales || []).filter(s => s.timestamp >= startOfDay).forEach(s => {
    const h = new Date(s.timestamp).getHours();
    hourly[h].revenue += s.amount || 0;
    hourly[h].count++;
  });
  return hourly;
}

// ═══════════════════════════════════════════════════
// CREDIT WALLET
// ═══════════════════════════════════════════════════

function getCreditWallet(data, senderName) {
  if (!data.creditWallets) data.creditWallets = [];
  return data.creditWallets.find(w => w.senderName === senderName) || null;
}

function getCreditWalletBalance(data, senderName) {
  const w = getCreditWallet(data, senderName);
  return w ? w.balance : 0;
}

function upsertCreditWallet(data, senderName, deltaAmount, reason) {
  if (!data.creditWallets) data.creditWallets = [];
  let w = data.creditWallets.find(w => w.senderName === senderName);
  if (!w) {
    w = { id: 'cw_' + Date.now(), senderName, balance: 0, lastUpdated: Date.now(), history: [] };
    data.creditWallets.push(w);
  }
  w.balance = Math.round((w.balance + deltaAmount) * 100) / 100;
  w.lastUpdated = Date.now();
  w.history = w.history || [];
  w.history.unshift({ amount: deltaAmount, reason, timestamp: Date.now() });
  if (w.history.length > 50) w.history = w.history.slice(0, 50);
  return w;
}

// ═══════════════════════════════════════════════════
// PAYMENT LEDGER (unified payment history)
// ═══════════════════════════════════════════════════

/**
 * Add a unified payment history entry — appears in History view.
 * type: 'sale' | 'debt-repayment' | 'credit-wallet' | 'bank-reconcile'
 */
function addPaymentLedgerEntry(data, entry) {
  if (!data.paymentLedger) data.paymentLedger = [];
  data.paymentLedger.unshift({
    id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
    timestamp: Date.now(),
    ...entry
  });
}

// ═══════════════════════════════════════════════════
// OFFLINE QUEUE
// ═══════════════════════════════════════════════════

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem('backlog_offline_queue') || '[]'); } catch { return []; }
}

function addToOfflineQueue(action) {
  const q = getOfflineQueue();
  q.push({ ...action, queuedAt: Date.now() });
  localStorage.setItem('backlog_offline_queue', JSON.stringify(q));
}

function clearOfflineQueue() {
  localStorage.removeItem('backlog_offline_queue');
}

function flushOfflineQueue() {
  const q = getOfflineQueue();
  if (q.length === 0) return;
  // In a real app, replay queued API calls here.
  // For now, just clear the queue since all data is local.
  console.log(`[Backlog] Flushing ${q.length} queued offline actions`);
  clearOfflineQueue();
}

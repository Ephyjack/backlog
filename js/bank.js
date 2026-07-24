// ═══════════════════════════════════════════════════════════════════════════════
// Backlog — Bank Integration Engine
// Real-time transaction tracking, reconciliation, and account management
// ═══════════════════════════════════════════════════════════════════════════════

// ── Constants ──
const BANK_API_POLL_INTERVAL = 30000; // 30 seconds
const RECONCILIATION_STATUSES = {
  PENDING: 'pending',      // Unassigned to products
  ASSIGNED: 'assigned',    // Assigned but not confirmed
  RECONCILED: 'reconciled' // Confirmed and synced to inventory
};

// ── Bank Account Management ──

function getBankAccounts(data) {
  return data.bankAccounts || [];
}

function addBankAccount(data, account) {
  if (!data.bankAccounts) data.bankAccounts = [];
  
  const newAccount = {
    id: `bank_${Date.now()}`,
    bankName: account.bankName,
    accountNumber: account.accountNumber.slice(-4),
    accountNumberFull: account.accountNumber, // Store full for API calls
    accountHolder: account.accountHolder,
    currency: 'NGN',
    isLinked: true,
    lastSync: null,
    apiKey: account.apiKey || '', // Placeholder for real API keys
    createdAt: new Date().toISOString(),
    ...account
  };

  data.bankAccounts.push(newAccount);
  return newAccount;
}

function removeBankAccount(data, accountId) {
  data.bankAccounts = (data.bankAccounts || []).filter(a => a.id !== accountId);
}

// ── Manual Transaction Entry ──
// Used when user is offline or wants to log a transfer manually

function addManualTransaction(data, txData) {
  if (!data.unreconciledTransfers) data.unreconciledTransfers = [];
  const tx = {
    id: `manual_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
    senderName: txData.senderName || 'Unknown Sender',
    amount: parseFloat(txData.amount) || 0,
    bank: txData.bank || 'Manual Entry',
    timestamp: txData.timestamp || Date.now(),
    date: txData.date || new Date().toISOString(),
    reference: txData.reference || '',
    isManual: true,
    createdAt: new Date().toISOString()
  };
  data.unreconciledTransfers.push(tx);
  return tx;
}

function editUnreconciledTransaction(data, txId, updates) {
  const tx = (data.unreconciledTransfers || []).find(t => t.id === txId);
  if (!tx) return null;
  Object.assign(tx, {
    senderName: updates.senderName !== undefined ? updates.senderName : tx.senderName,
    amount: updates.amount !== undefined ? parseFloat(updates.amount) : tx.amount,
    bank: updates.bank !== undefined ? updates.bank : tx.bank,
    reference: updates.reference !== undefined ? updates.reference : tx.reference,
    updatedAt: new Date().toISOString()
  });
  return tx;
}

function deleteUnreconciledTransaction(data, txId) {
  const before = (data.unreconciledTransfers || []).length;
  data.unreconciledTransfers = (data.unreconciledTransfers || []).filter(t => t.id !== txId);
  return (data.unreconciledTransfers || []).length < before;
}

// ── Transaction Management ──

function getAllTransactions(data) {
  const all = [];
  
  // Unassigned/pending transactions
  (data.unreconciledTransfers || []).forEach(tx => {
    all.push({
      ...tx,
      status: RECONCILIATION_STATUSES.PENDING,
      assignedProducts: [],
      totalMatched: 0
    });
  });

  // Assigned transactions
  (data.assignedTransactions || []).forEach(tx => {
    all.push({
      ...tx,
      status: RECONCILIATION_STATUSES.ASSIGNED,
      totalMatched: calculateTransactionMatched(tx.assignedProducts)
    });
  });

  // Reconciled transactions (history)
  (data.reconciledTransactions || []).forEach(tx => {
    all.push({
      ...tx,
      status: RECONCILIATION_STATUSES.RECONCILED,
      totalMatched: calculateTransactionMatched(tx.assignedProducts)
    });
  });

  return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function getTransactionsByStatus(data, status) {
  return getAllTransactions(data).filter(tx => tx.status === status);
}

function calculateTransactionMatched(assignedProducts = []) {
  return assignedProducts.reduce((sum, item) => {
    return sum + (item.unitPrice * item.quantity);
  }, 0);
}

// ── Reconciliation Assignment ──

function createAssignedTransaction(data, unreconciledTxId, assignedProducts) {
  if (!data.assignedTransactions) data.assignedTransactions = [];

  const tx = (data.unreconciledTransfers || []).find(t => t.id === unreconciledTxId);
  if (!tx) return null;

  const assignedTx = {
    id: unreconciledTxId,
    senderName: tx.senderName,
    amount: tx.amount,
    bank: tx.bank,
    timestamp: tx.timestamp,
    date: tx.date,
    assignedProducts: assignedProducts,
    reconciliationNotes: '',
    assignedAt: new Date().toISOString(),
    createdAt: tx.createdAt || tx.timestamp
  };

  // Remove from unreconciled
  data.unreconciledTransfers = (data.unreconciledTransfers || []).filter(t => t.id !== unreconciledTxId);

  // Add to assigned
  data.assignedTransactions.push(assignedTx);

  return assignedTx;
}

function moveAssignedToReconciled(data, assignedTxId) {
  if (!data.reconciledTransactions) data.reconciledTransactions = [];

  const tx = (data.assignedTransactions || []).find(t => t.id === assignedTxId);
  if (!tx) return null;

  const reconciledTx = {
    ...tx,
    reconciledAt: new Date().toISOString()
  };

  // Remove from assigned
  data.assignedTransactions = (data.assignedTransactions || []).filter(t => t.id !== assignedTxId);

  // Add to reconciled
  data.reconciledTransactions.push(reconciledTx);

  // Update inventory based on assigned products
  updateInventoryFromReconciliation(data, reconciledTx);

  return reconciledTx;
}

function updateInventoryFromReconciliation(data, reconciledTx) {
  reconciledTx.assignedProducts.forEach(item => {
    const product = data.products.find(p => p.id === item.productId);
    if (product) {
      // Create a synthetic sale record
      const sale = {
        id: `sync_${reconciledTx.id}_${item.productId}`,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.unitPrice * item.quantity,
        paymentType: 'transfer',
        timestamp: reconciledTx.timestamp,
        date: reconciledTx.date,
        reconciliationId: reconciledTx.id,
        isBankReconciled: true
      };

      // Add to sales if not already present
      if (!data.sales.find(s => s.id === sale.id)) {
        data.sales.push(sale);
      }

      // Update stock
      product.stock = Math.max(0, product.stock - item.quantity);
    }
  });
}

function editAssignedTransaction(data, assignedTxId, updatedAssignedProducts, notes = '') {
  const tx = (data.assignedTransactions || []).find(t => t.id === assignedTxId);
  if (!tx) return null;

  tx.assignedProducts = updatedAssignedProducts;
  tx.reconciliationNotes = notes;
  tx.updatedAt = new Date().toISOString();

  return tx;
}

function unreconciledPendingTransaction(data, reconciledTxId) {
  if (!data.unreconciledTransfers) data.unreconciledTransfers = [];

  const tx = (data.reconciledTransactions || []).find(t => t.id === reconciledTxId);
  if (!tx) return null;

  // Revert inventory changes
  revertInventoryFromReconciliation(data, tx);

  // Move back to unreconciled
  const unreconciledTx = {
    id: tx.id,
    senderName: tx.senderName,
    amount: tx.amount,
    bank: tx.bank,
    timestamp: tx.timestamp,
    date: tx.date
  };

  data.unreconciledTransfers.push(unreconciledTx);
  data.reconciledTransactions = (data.reconciledTransactions || []).filter(t => t.id !== reconciledTxId);

  return unreconciledTx;
}

function revertInventoryFromReconciliation(data, reconciledTx) {
  reconciledTx.assignedProducts.forEach(item => {
    const product = data.products.find(p => p.id === item.productId);
    if (product) {
      product.stock += item.quantity;
    }

    // Remove synthetic sale
    data.sales = data.sales.filter(s => s.reconciliationId !== reconciledTx.id);
  });
}

// ── Bank API Integration (Mock) ──
// In production, integrate with real bank APIs (Flutterwave, Paystack, Mono, etc.)

function initiateBankConnection(bankName, accountNumber) {
  // This would typically redirect to OAuth or bank API authentication
  // For now, return a mock API key
  return {
    success: true,
    apiKey: `key_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
    message: `Connected to ${bankName} account ending in ${accountNumber.slice(-4)}`
  };
}

async function fetchBankTransactions(account) {
  // Mock implementation - in production, call real bank APIs
  // Real APIs: Mono.co, Flutterwave Bank Verification, etc.

  return new Promise((resolve) => {
    setTimeout(() => {
      const mockTransactions = generateMockBankTransactions(account);
      resolve(mockTransactions);
    }, 1500);
  });
}

function generateMockBankTransactions(account) {
  // Generate realistic mock transactions
  const senders = [
    'Chinedu Eze', 'Aisha Bello', 'Tunde Folawiyo', 'Fatima Hassan', 'Emeka Okon',
    'Nkechi Okoro', 'Kwame Mensah', 'Amina Adeyemi', 'Chisom Nwankwo', 'Ibrahim Usman'
  ];

  const amounts = [3200, 8000, 15400, 5600, 12000, 4500, 7800, 9200, 6400, 11000];
  const now = Date.now();

  return amounts.slice(0, Math.floor(Math.random() * 4) + 2).map((amount, idx) => ({
    id: `tx_${Date.now()}_${idx}`,
    senderName: senders[Math.floor(Math.random() * senders.length)],
    amount: amount,
    bank: account.bankName || 'GTBank',
    timestamp: now - (Math.random() * 7200000), // Last 2 hours
    date: new Date(now - (Math.random() * 7200000)).toISOString(),
    reference: `REF${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    status: 'completed'
  }));
}

function pollBankTransactions(data, accountId) {
  // Real-time polling for new transactions
  const account = (data.bankAccounts || []).find(a => a.id === accountId);
  if (!account) return;

  fetchBankTransactions(account).then(newTransactions => {
    // Collect all known IDs and references
    const allExisting = [
      ...(data.unreconciledTransfers || []),
      ...(data.assignedTransactions || []),
      ...(data.reconciledTransactions || [])
    ];
    const existingIds = allExisting.map(tx => tx.id);
    const existingRefs = allExisting.map(tx => tx.reference).filter(Boolean);

    const freshTransactions = newTransactions.filter(tx =>
      !existingIds.includes(tx.id) &&
      (!tx.reference || !existingRefs.includes(tx.reference))
    );

    if (freshTransactions.length > 0) {
      if (!data.unreconciledTransfers) data.unreconciledTransfers = [];
      data.unreconciledTransfers.push(...freshTransactions);
      account.lastSync = new Date().toISOString();
      
      // Trigger UI update via callback
      if (window.onNewBankTransactions) {
        window.onNewBankTransactions(freshTransactions.length);
      }
    }
  });
}

// ── Reconciliation Analytics ──

function getReconciliationStats(data) {
  const allTx = getAllTransactions(data);
  const pending = getTransactionsByStatus(data, RECONCILIATION_STATUSES.PENDING);
  const assigned = getTransactionsByStatus(data, RECONCILIATION_STATUSES.ASSIGNED);
  const reconciled = getTransactionsByStatus(data, RECONCILIATION_STATUSES.RECONCILED);

  const pendingAmount = pending.reduce((sum, tx) => sum + tx.amount, 0);
  const assignedAmount = assigned.reduce((sum, tx) => sum + (calculateTransactionMatched(tx.assignedProducts) || 0), 0);
  const reconciledAmount = reconciled.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    totalTransactions: allTx.length,
    pendingCount: pending.length,
    pendingAmount,
    assignedCount: assigned.length,
    assignedAmount,
    reconciledCount: reconciled.length,
    reconciledAmount,
    matchRate: reconciled.length > 0 ? ((reconciled.length / allTx.length) * 100).toFixed(1) : 0
  };
}

function getReconciliationMismatches(data) {
  // Find transactions where matched amount doesn't equal transferred amount
  const assigned = getTransactionsByStatus(data, RECONCILIATION_STATUSES.ASSIGNED);
  
  return assigned.filter(tx => {
    const matched = calculateTransactionMatched(tx.assignedProducts);
    return Math.abs(matched - tx.amount) > 0;
  }).map(tx => ({
    id: tx.id,
    senderName: tx.senderName,
    transferAmount: tx.amount,
    matchedAmount: calculateTransactionMatched(tx.assignedProducts),
    difference: tx.amount - calculateTransactionMatched(tx.assignedProducts),
    assignedProducts: tx.assignedProducts
  }));
}

// ── Sync Management ──

function syncPendingTransactions(data) {
  // Prepare offline transactions for sync when online
  return {
    unreconciledTransfers: data.unreconciledTransfers || [],
    assignedTransactions: data.assignedTransactions || [],
    reconciledTransactions: data.reconciledTransactions || [],
    timestamp: new Date().toISOString()
  };
}

function applyRemoteChanges(data, remoteData) {
  // Merge remote bank data with local data (for multi-device sync)
  if (remoteData.reconciledTransactions) {
    const localReconciledIds = (data.reconciledTransactions || []).map(t => t.id);
    const newReconciled = remoteData.reconciledTransactions.filter(
      t => !localReconciledIds.includes(t.id)
    );
    
    newReconciled.forEach(tx => {
      moveAssignedToReconciled(data, tx.id);
    });
  }

  if (remoteData.bankAccounts) {
    data.bankAccounts = remoteData.bankAccounts;
  }
}

// ── Export Support ──

function generateBankReconciliationReport(data) {
  const stats = getReconciliationStats(data);
  const allTx = getAllTransactions(data);
  const mismatches = getReconciliationMismatches(data);

  return {
    generatedAt: new Date().toISOString(),
    businessName: data.business?.name || 'Business',
    statistics: stats,
    transactions: allTx,
    mismatches: mismatches,
    accounts: getBankAccounts(data)
  };
}

// ── Network & Polling (stubs — extend with real API calls) ──

/**
 * Starts polling all linked bank accounts for new transactions.
 * Runs every BANK_API_POLL_INTERVAL ms while the app is open.
 */
function startBankSyncPolling() {
  // Initial poll on startup
  const accounts = (window.appData?.bankAccounts) || [];
  if (accounts.length > 0 && window.appData) {
    accounts.forEach(acc => pollBankTransactions(window.appData, acc.id));
  }

  // Recurring poll
  setInterval(() => {
    const accs = (window.appData?.bankAccounts) || [];
    if (accs.length > 0 && window.appData) {
      accs.forEach(acc => pollBankTransactions(window.appData, acc.id));
    }
  }, BANK_API_POLL_INTERVAL);
}

/**
 * Monitors online/offline state and shows a status indicator.
 */
function initNetworkMonitoring() {
  function updateStatus(showToastMsg) {
    const dot = document.querySelector('.sync-dot');
    if (dot) {
      dot.className = navigator.onLine ? 'sync-dot online' : 'sync-dot offline';
      dot.title = navigator.onLine ? 'Online — Auto-Sync active' : 'Offline — all changes saved locally';
    }
    if (showToastMsg && typeof showToast === 'function') {
      showToast(showToastMsg.msg, showToastMsg.type, showToastMsg.dur);
    }
  }
  window.addEventListener('online', () => {
    updateStatus({ msg: '📡 Back online! Data synced.', type: 'success', dur: 3000 });
    if (typeof flushOfflineQueue === 'function') flushOfflineQueue();
  });
  window.addEventListener('offline', () => {
    updateStatus({ msg: '📵 Offline — all changes saved locally. Working normally.', type: 'warning', dur: 5000 });
  });
  updateStatus();
}

/**
 * Registers a callback to be called when new bank transactions arrive.
 * @param {Function} callback - called with the array of new transactions
 */
function watchTransactionChanges(callback) {
  // Hook into the existing mock polling callback
  window.onNewBankTransactions = (count) => {
    if (typeof callback === 'function') {
      callback({ count });
    }
  };
}

// ═══════════════════════════════════════════════════
// Backlog — Main Application Controller
// ═══════════════════════════════════════════════════

let appData = null;
let currentView = 'dashboard';
let selectedProductId = null;
let salePaymentType = 'cash';
let saleQuantity = 1;
let charts = {};
let searchQuery = '';

// Reconciliation specific state
let activeTxId = null;
let matchedItems = []; // [{ productId, quantity }]

// ── Boot ──

document.addEventListener('DOMContentLoaded', () => {
  appData = loadData();

  if (!appData.business) {
    showOnboarding();
  } else {
    showApp();
    navigateTo('dashboard');
  }

  startClock();
  setupGlobalListeners();
  
  // Initialize network monitoring and syncing
  initNetworkMonitoring();
  startBankSyncPolling();
  
  // Setup real-time watchers
  watchTransactionChanges((changes) => {
    if (currentView === 'reconcile') {
      renderReconcile();
    }
  });
});

function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

function setupGlobalListeners() {
  // FAB Record Sale button
  document.getElementById('fab-sale')?.addEventListener('click', () => navigateTo('sales'));

  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
      closeSidebar();
    });
  });

  // Hamburger
  document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
    setTimeout(resizeCharts, 100);
  });
}

// ── Navigation ──

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${view}`);
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);

  if (page) page.classList.add('active');
  if (navItem) navItem.classList.add('active');

  // Update topbar
  const titles = {
    dashboard: { title: 'Dashboard', sub: 'Overview of your business today' },
    inventory: { title: 'Inventory', sub: 'Manage your products and stock levels' },
    sales: { title: 'Record a Sale', sub: 'Tap a product, enter quantity, confirm' },
    reconcile: { title: 'Bank Sync', sub: 'Reconcile incoming bank transfers with items sold' },
    analytics: { title: 'Analytics', sub: 'Sales trends and performance charts' },
    insights: { title: 'AI Insights', sub: 'Smart recommendations for your business' },
    export: { title: 'Reports & Export', sub: 'Download Excel, Word, and PDF reports' },
    history: { title: 'Sales History', sub: 'All your recorded transactions' },
    expenses: { title: '💸 Expense Tracker', sub: 'Track operational costs and see real profit' },
    debts: { title: '📒 Debt Ledger', sub: 'Track customer credit and repayments' },
    restock: { title: '🛒 Restock Log', sub: 'Record stock purchases and supplier costs' },
  };

  const t = titles[view] || { title: view, sub: '' };
  const topTitle = document.getElementById('topbar-title');
  const topSub = document.getElementById('topbar-subtitle');
  if (topTitle) topTitle.textContent = t.title;
  if (topSub) topSub.textContent = t.sub;

  // Render view
  const renders = {
    dashboard: renderDashboard,
    inventory: renderInventory,
    sales: renderSales,
    reconcile: renderReconcile,
    analytics: renderAnalytics,
    insights: renderInsights,
    export: renderExport,
    history: renderHistory,
    expenses: renderExpenses,
    debts: renderDebtLedger,
    restock: renderRestock,
  };

  if (renders[view]) renders[view]();

  // Sync bottom nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

function refreshActiveView() {
  updateLowStockBadge();
  updateReconcileBadge();
  navigateTo(currentView);
}

// ── Sidebar ──

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
}

// ── Onboarding ──

let onboardStep = 1;
let onboardBizData = {};

function showOnboarding() {
  document.getElementById('onboard-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
  renderOnboardStep(1);
}

function showApp() {
  document.getElementById('onboard-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  updateSidebarBusiness();
  updateLowStockBadge();
  updateReconcileBadge();
}

function renderOnboardStep(step) {
  onboardStep = step;
  document.querySelectorAll('.onboard-step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < step - 1) el.classList.add('done');
    else if (i === step - 1) el.classList.add('active');
  });

  const container = document.getElementById('onboard-body');
  if (!container) return;

  if (step === 1) {
    container.innerHTML = `
      <div class="onboard-header">
        <div class="onboard-emoji">🏪</div>
        <div class="onboard-title">What type of business?</div>
        <div class="onboard-subtitle">Backlog works for all business types — from hawkers to supermarkets</div>
      </div>
      <div class="business-type-grid">
        ${[
          {type:'supermarket',icon:'🏪',name:'Supermarket'},
          {type:'store',icon:'🛒',name:'Store/Shop'},
          {type:'poultry',icon:'🐔',name:'Poultry/Farm'},
          {type:'market',icon:'🏬',name:'Market Vendor'},
          {type:'restaurant',icon:'🍽️',name:'Restaurant/Food'},
          {type:'wholesale',icon:'📦',name:'Wholesale'},
          {type:'hawker',icon:'🚶',name:'Hawker/Mobile'},
          {type:'pharmacy',icon:'💊',name:'Pharmacy'},
          {type:'other',icon:'🏢',name:'Other Business'},
        ].map(b => `
          <div class="biz-type-card ${onboardBizData.type===b.type?'active':''}" onclick="selectBizType('${b.type}','${b.name}',this)">
            <div class="type-icon">${b.icon}</div>
            <div class="type-name">${b.name}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary w-full" style="margin-top:20px" onclick="nextOnboardStep()">Continue →</button>
      <div style="text-align:center;margin-top:12px">
        <button class="btn btn-ghost btn-sm" onclick="loadDemo()">🎮 Load Demo Data Instead</button>
      </div>`;
  }

  else if (step === 2) {
    container.innerHTML = `
      <div class="onboard-header">
        <div class="onboard-emoji">📝</div>
        <div class="onboard-title">Tell us about your business</div>
        <div class="onboard-subtitle">Just the basics — you can update this later</div>
      </div>
      <div class="form-group">
        <label class="form-label">Business Name *</label>
        <input class="form-input" id="ob-name" placeholder="e.g. Mama Chidi's Store" value="${onboardBizData.name||''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Your Name</label>
          <input class="form-input" id="ob-owner" placeholder="Owner's name" value="${onboardBizData.owner||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input class="form-input" id="ob-phone" placeholder="080xxxxxxxx" value="${onboardBizData.phone||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">State *</label>
          <select class="form-select" id="ob-state">
            ${getNigerianStates().map(s => `<option value="${s}" ${onboardBizData.state===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">City / Town</label>
          <input class="form-input" id="ob-city" placeholder="e.g. Uyo, Aba, Lagos" value="${onboardBizData.city||''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address (Optional)</label>
        <input class="form-input" id="ob-address" placeholder="e.g. 14 Market Road, Uyo" value="${onboardBizData.address||''}" />
      </div>
      <div style="display:flex;gap:12px;margin-top:8px">
        <button class="btn btn-ghost" onclick="renderOnboardStep(1)">← Back</button>
        <button class="btn btn-primary" style="flex:1" onclick="saveOnboardStep2()">Continue →</button>
      </div>`;
  }

  else if (step === 3) {
    container.innerHTML = `
      <div class="onboard-header">
        <div class="onboard-emoji">✅</div>
        <div class="onboard-title">You're all set!</div>
        <div class="onboard-subtitle">Add your first products to start tracking sales instantly</div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="biz-avatar" style="width:48px;height:48px;font-size:20px">${getTypeEmoji(onboardBizData.type)}</div>
          <div>
            <div style="font-weight:700;font-size:16px">${onboardBizData.name}</div>
            <div style="color:var(--text-muted);font-size:13px">${onboardBizData.typeLabel} · ${onboardBizData.state}</div>
          </div>
        </div>
      </div>
      <div class="alert alert-info">
        <div class="alert-icon">💡</div>
        <div class="alert-content">
          <div class="alert-title">Ready to go!</div>
          <div class="alert-desc">Add your first products in the Inventory section. Every time you sell something, Backlog will auto-track it for you.</div>
        </div>
      </div>
      <button class="btn btn-primary w-full btn-lg" style="margin-top:8px" onclick="finishOnboarding()">
        🚀 Enter Backlog Dashboard
      </button>`;
  }
}

function selectBizType(type, label, el) {
  document.querySelectorAll('.biz-type-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  onboardBizData.type = type;
  onboardBizData.typeLabel = label;
}

function nextOnboardStep() {
  if (onboardStep === 1) {
    if (!onboardBizData.type) { showToast('Please select a business type', 'warning'); return; }
    renderOnboardStep(2);
  }
}

function saveOnboardStep2() {
  const name = document.getElementById('ob-name')?.value?.trim();
  if (!name) { showToast('Please enter your business name', 'warning'); return; }
  onboardBizData.name = name;
  onboardBizData.owner = document.getElementById('ob-owner')?.value?.trim() || '';
  onboardBizData.phone = document.getElementById('ob-phone')?.value?.trim() || '';
  onboardBizData.state = document.getElementById('ob-state')?.value || 'Lagos';
  onboardBizData.city = document.getElementById('ob-city')?.value?.trim() || '';
  onboardBizData.address = document.getElementById('ob-address')?.value?.trim() || '';
  renderOnboardStep(3);
}

function finishOnboarding() {
  appData.business = {
    id: 'biz_' + Date.now(),
    ...onboardBizData,
    createdAt: new Date().toISOString()
  };
  saveData(appData);
  showApp();
  navigateTo('inventory');
  showToast('Welcome to Backlog! 🎉 Add your first product below.', 'success');
}

function loadDemo() {
  appData = loadDemoData();
  showApp();
  navigateTo('dashboard');
  showToast('🎮 Demo data loaded! Explore all features.', 'success');
}

// ── Dashboard Render ──

function renderDashboard() {
  const today = getTodaySales(appData);
  const week = getSalesInRange(appData, 7);
  const month = getSalesInRange(appData, 30);
  const lowStock = getLowStockProducts(appData);
  const topProds = getTopProducts(appData, 5, 30);
  const insights = generateInsights(appData);
  const pendingTxs = getUnreconciledTransfers(appData);

  const todayRev = getRevenue(today);
  const weekRev = getRevenue(week);
  const monthRev = getRevenue(month);

  const prevWeekSales = getSalesInRange(appData, 14).filter(s => s.timestamp < Date.now() - 7*86400000);
  const prevWeekRev = getRevenue(prevWeekSales);
  const weekChange = prevWeekRev > 0 ? ((weekRev - prevWeekRev)/prevWeekRev*100).toFixed(0) : 0;

  document.getElementById('page-dashboard').innerHTML = `
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card green">
        <div class="stat-icon green">💰</div>
        <div class="stat-value currency">${formatNGN(todayRev)}</div>
        <div class="stat-label">Today's Revenue</div>
        <div class="stat-change ${today.length > 0 ? 'up' : 'down'}">
          ${today.length > 0 ? '↑' : '—'} ${today.length} sale${today.length!==1?'s':''}
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon purple">📅</div>
        <div class="stat-value currency">${formatNGN(weekRev)}</div>
        <div class="stat-label">This Week</div>
        <div class="stat-change ${weekChange >= 0 ? 'up' : 'down'}">
          ${weekChange >= 0 ? '↑' : '↓'} ${Math.abs(weekChange)}% vs last week
        </div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon orange">📊</div>
        <div class="stat-value currency">${formatNGN(monthRev)}</div>
        <div class="stat-label">This Month</div>
        <div class="stat-change up">↑ ${month.length} transactions</div>
      </div>
      <div class="stat-card ${lowStock.length > 0 ? 'red' : 'green'}">
        <div class="stat-icon ${lowStock.length > 0 ? 'red' : 'green'}">${lowStock.length > 0 ? '⚠️' : '✅'}</div>
        <div class="stat-value">${lowStock.length}</div>
        <div class="stat-label">Low Stock Alerts</div>
        <div class="stat-change ${lowStock.length > 0 ? 'down' : 'up'}">
          ${lowStock.length > 0 ? `${appData.products.length - lowStock.length} products OK` : 'All stocked well'}
        </div>
      </div>
    </div>

    <!-- Quick Actions Row -->
    <div class="quick-actions mb-24">
      <button class="quick-action-btn" onclick="navigateTo('sales')">
        <span class="quick-action-icon">🛍️</span>
        <span class="quick-action-label">New Sale</span>
      </button>
      <button class="quick-action-btn" onclick="navigateTo('reconcile')">
        <span class="quick-action-icon">📲</span>
        <span class="quick-action-label">Bank Sync</span>
      </button>
      <button class="quick-action-btn" onclick="openAddExpenseModal()">
        <span class="quick-action-icon">💸</span>
        <span class="quick-action-label">Expense</span>
      </button>
      <button class="quick-action-btn" onclick="openAddDebtModal()">
        <span class="quick-action-icon">📒</span>
        <span class="quick-action-label">Log Debt</span>
      </button>
    </div>

    <!-- Bank Reconciliation Alert Header -->
    ${pendingTxs.length > 0 ? `
    <div class="alert alert-warning mb-24" style="cursor:pointer;" onclick="navigateTo('reconcile')">
      <div class="alert-icon">📲</div>
      <div class="alert-content">
        <div class="alert-title">${pendingTxs.length} Bank Transfers Pending Reconciliation</div>
        <div class="alert-desc">Customers transferred <strong>${formatNGN(pendingTxs.reduce((sum,t)=>sum+t.amount,0))}</strong> directly to your bank account. Tap here to match these with items sold.</div>
      </div>
    </div>` : ''}

    <!-- AI Insight Banner -->
    ${insights.length > 0 ? `
    <div class="ai-card mb-24">
      <div class="ai-badge">🤖 AI Insight</div>
      <div class="ai-insight-text">${insights[0].icon} <strong>${insights[0].title}:</strong> ${insights[0].message}</div>
      <div class="ai-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('insights')">View All Insights →</button>
        ${insights[0].action ? `<button class="btn btn-ghost btn-sm" onclick="navigateTo('${insights[0].actionView}')">${insights[0].action}</button>` : ''}
      </div>
    </div>` : ''}

    <!-- Charts Row -->
    <div class="grid-2 mb-24">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Revenue (Last 14 Days)</div>
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('analytics')">Full View</button>
        </div>
        <div class="chart-wrap">
          <canvas id="chart-revenue-mini"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Top Products This Month</div>
        </div>
        <div>
          ${topProds.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-desc">No sales data yet</div></div>' :
            topProds.map((x, i) => `
            <div class="rank-item">
              <div class="rank-num ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</div>
              <div class="rank-info">
                <div class="rank-name">${x.product?.emoji || '📦'} ${x.product?.name || 'Unknown'}</div>
                <div class="rank-sub">${x.product?.category || ''} · Stock: ${x.product?.stock}</div>
              </div>
              <div class="rank-value">${formatNGN(x.revenue)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Recent Sales + Low Stock -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Sales</div>
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('history')">View All</button>
        </div>
        ${appData.sales.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🧾</div>
            <div class="empty-state-title">No sales yet</div>
            <div class="empty-state-desc">Tap "Record Sale" to add your first transaction</div>
          </div>` : `
        <table class="data-table">
          <thead><tr><th>Product</th><th>Amount</th><th>Payment</th><th>Time</th></tr></thead>
          <tbody>
            ${appData.sales.slice(0,8).map(s => {
              const p = getProductById(appData, s.productId);
              return `<tr>
                <td><span style="font-weight:600">${p?.emoji||'📦'} ${p?.name||'Unknown'}</span></td>
                <td class="currency" style="color:var(--primary);font-weight:700">${formatNGN(s.amount)}</td>
                <td><span class="badge badge-${s.paymentType==='pos'?'purple':s.paymentType==='transfer'?'green':'orange'}">${s.paymentType||'cash'}</span></td>
                <td class="text-muted text-sm">${formatTime(s.timestamp)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">⚠️ Low Stock Alert</div>
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('inventory')">Manage</button>
        </div>
        ${lowStock.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-title">All stocked up!</div>
            <div class="empty-state-desc">No products are running low right now</div>
          </div>` : `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${lowStock.map(p => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-size:24px">${p.emoji||'📦'}</div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px">${p.name}</div>
                <div class="progress-bar" style="margin-top:6px">
                  <div class="progress-fill ${p.stock<=0?'red':p.stock<=(p.minStock||10)?'red':'yellow'}"
                    style="width:${Math.max(5,getStockPercent(p.stock, (p.minStock||10)*5))}%"></div>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;font-size:16px;color:${p.stock<=0?'var(--danger)':'var(--warning)'}">${p.stock}</div>
                <div class="text-xs text-muted">${p.unit}(s) left</div>
              </div>
            </div>`).join('')}
        </div>`}
      </div>
    </div>`;

  // Render mini chart
  setTimeout(() => renderMiniRevenueChart(), 100);
}

function renderMiniRevenueChart() {
  const canvas = document.getElementById('chart-revenue-mini');
  if (!canvas || !window.Chart) return;
  if (charts['revenue-mini']) { charts['revenue-mini'].destroy(); }

  const days = getDailySalesChart(appData, 14);
  charts['revenue-mini'] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: days.map(d => d.label),
      datasets: [{
        data: days.map(d => d.revenue),
        borderColor: '#00D97E',
        backgroundColor: 'rgba(0,217,126,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00D97E',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => '₦' + ctx.raw.toLocaleString() }
      }},
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888AA', font:{size:10}, maxRotation:0, maxTicksLimit:7 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888AA', font:{size:10}, callback: v => '₦'+Number(v).toLocaleString() } }
      }
    }
  });
}

// ── Inventory Render ──

function renderInventory() {
  const products = appData.products;
  const low = getLowStockProducts(appData);

  document.getElementById('page-inventory').innerHTML = `
    <div class="flex-between mb-24">
      <div>
        <div class="section-title">Products & Inventory</div>
        <div class="section-desc">${products.length} product${products.length!==1?'s':''} · ${low.length} low stock alert${low.length!==1?'s':''}</div>
      </div>
      <div class="flex gap-12">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search products..." id="inv-search" oninput="filterInventory()" />
        </div>
        <button class="btn btn-primary" onclick="openAddProductModal()">+ Add Product</button>
      </div>
    </div>

    ${low.length > 0 ? `
    <div class="alert alert-warning">
      <div class="alert-icon">⚠️</div>
      <div class="alert-content">
        <div class="alert-title">${low.length} product${low.length!==1?'s':''} need restocking</div>
        <div class="alert-desc">${low.map(p=>p.name).join(', ')}</div>
      </div>
    </div>` : ''}

    <div class="product-grid" id="product-grid">
      ${products.length === 0 ? `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">No products yet</div>
          <div class="empty-state-desc">Add your first product to start tracking inventory</div>
          <button class="btn btn-primary" style="margin-top:20px" onclick="openAddProductModal()">+ Add First Product</button>
        </div>` :
      products.map(p => renderProductCard(p)).join('')}
    </div>`;
}

function renderProductCard(p) {
  const color = getStockColor(p.stock, p.minStock);
  const pct = getStockPercent(p.stock, (p.minStock||10) * 5);
  const outOfStock = p.stock <= 0;
  return `
    <div class="product-card">
      <div style="cursor:pointer;display:flex;flex-direction:column;gap:8px;flex:1;" onclick="openEditProductModal('${p.id}')">
        <div class="product-emoji">${p.emoji || '📦'}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">${formatNGN(p.price)}</div>
        <div class="product-stock">${p.stock} ${p.unit}(s) in stock</div>
        <div class="stock-indicator">
          <div class="stock-fill ${color}" style="width:${pct}%"></div>
        </div>
        <span class="badge badge-${color==='green'?'green':color==='yellow'?'yellow':'red'}" style="margin-bottom:4px;">
          ${outOfStock ? 'Out of Stock' : color==='red' ? 'Low Stock' : color==='yellow' ? 'Running Low' : 'In Stock'}
        </span>
      </div>
      <div class="product-card-actions">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openEditProductModal('${p.id}')">✏️ Edit</button>
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="quickSell('${p.id}')" ${outOfStock ? 'disabled style=\"opacity:0.5;cursor:not-allowed;flex:1\"' : ''}>💰 Sell</button>
      </div>
    </div>`;
}
function filterInventory() {
  const q = document.getElementById('inv-search')?.value?.toLowerCase() || '';
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const filtered = appData.products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.category||'').toLowerCase().includes(q)
  );
  grid.innerHTML = filtered.length === 0 ?
    `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No products match "${q}"</div></div>` :
    filtered.map(p => renderProductCard(p)).join('');
}

function openProductMenu(id) {
  openEditProductModal(id);
}

// ── Sales Render ──

function renderSales() {
  selectedProductId = null;
  salePaymentType = 'cash';
  saleQuantity = 1;

  document.getElementById('page-sales').innerHTML = `
    <div class="grid-2" style="gap:24px">
      <!-- Product Selection -->
      <div>
        <div class="section-title">Select Product</div>
        <div class="section-desc">Tap the product that was sold</div>
        <div class="search-bar" style="margin-bottom:16px;max-width:100%">
          <span class="search-icon">🔍</span>
          <input type="text" id="sale-search" placeholder="Search products..." oninput="filterSaleProducts()" />
        </div>
        <div class="product-grid" id="sale-product-grid" style="max-height:65vh;overflow-y:auto">
          ${appData.products.filter(p=>p.stock>0).map(p => `
            <div class="product-card" id="sale-card-${p.id}" onclick="selectSaleProduct('${p.id}')">
              <div class="product-emoji">${p.emoji||'📦'}</div>
              <div class="product-name">${p.name}</div>
              <div class="product-price">${formatNGN(p.price)}</div>
              <div class="product-stock">${p.stock} ${p.unit}(s)</div>
            </div>`).join('')}
          ${appData.products.filter(p=>p.stock<=0).length > 0 ? `
            <div style="grid-column:1/-1;padding:12px 0;border-top:1px solid var(--border);color:var(--text-muted);font-size:13px">
              ${appData.products.filter(p=>p.stock<=0).map(p => `
                <div style="padding:6px 0;display:flex;gap:8px;align-items:center">
                  ${p.emoji||'📦'} ${p.name} <span class="badge badge-red">Out of Stock</span>
                </div>`).join('')}
            </div>` : ''}
        </div>
      </div>

      <!-- Sale Details -->
      <div>
        <div class="section-title">Sale Details</div>
        <div class="section-desc">Complete the transaction</div>

        <div id="sale-detail-panel">
          <div class="empty-state">
            <div class="empty-state-icon">👈</div>
            <div class="empty-state-title">Select a product</div>
            <div class="empty-state-desc">Tap any product on the left to record a sale</div>
          </div>
        </div>
      </div>
    </div>`;
}

function filterSaleProducts() {
  const q = document.getElementById('sale-search')?.value?.toLowerCase() || '';
  const grid = document.getElementById('sale-product-grid');
  if (!grid) return;
  const filtered = appData.products.filter(p =>
    p.stock > 0 && (p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q))
  );
  grid.innerHTML = filtered.length === 0 ?
    `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No products found</div></div>` :
    filtered.map(p => `
      <div class="product-card" id="sale-card-${p.id}" onclick="selectSaleProduct('${p.id}')">
        <div class="product-emoji">${p.emoji||'📦'}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">${formatNGN(p.price)}</div>
        <div class="product-stock">${p.stock} ${p.unit}(s)</div>
      </div>`).join('');
}

function selectSaleProduct(id) {
  selectedProductId = id;
  saleQuantity = 1;

  document.querySelectorAll('#sale-product-grid .product-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`sale-card-${id}`)?.classList.add('selected');

  const p = getProductById(appData, id);
  if (!p) return;

  updateSaleDetailPanel(p);
}

function updateSaleDetailPanel(p) {
  const qty = saleQuantity;
  const total = p.price * qty;
  const panel = document.getElementById('sale-detail-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="card card-glow" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-size:40px">${p.emoji||'📦'}</div>
        <div>
          <div style="font-size:18px;font-weight:700">${p.name}</div>
          <div style="color:var(--text-muted)">${p.category||'General'} · ${p.stock} ${p.unit}(s) in stock</div>
          <div style="font-size:22px;font-weight:800;color:var(--primary);margin-top:4px">${formatNGN(p.price)} <span style="font-size:13px;font-weight:400;color:var(--text-muted)">per ${p.unit}</span></div>
        </div>
      </div>
    </div>

    <!-- Quantity -->
    <div class="form-group">
      <label class="form-label">Quantity</label>
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost" onclick="changeSaleQty(-1,'${p.id}')" style="font-size:20px;padding:8px 16px">−</button>
        <input type="number" id="sale-qty" class="form-input" value="${qty}" min="1" max="${p.stock}"
          style="text-align:center;font-size:20px;font-weight:700;max-width:100px"
          onchange="setSaleQty(this.value,'${p.id}')" />
        <button class="btn btn-ghost" onclick="changeSaleQty(1,'${p.id}')" style="font-size:20px;padding:8px 16px">+</button>
      </div>
    </div>

    <!-- Total -->
    <div class="card" style="background:var(--primary-dim);border-color:rgba(0,217,126,0.3);margin-bottom:20px;text-align:center">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">TOTAL AMOUNT</div>
      <div style="font-size:36px;font-weight:800;color:var(--primary)" id="sale-total">${formatNGN(total)}</div>
    </div>

    <!-- Payment Method -->
    <div class="form-group">
      <label class="form-label">Payment Method</label>
      <div class="payment-methods">
        <button class="payment-btn ${salePaymentType==='cash'?'active':''}" onclick="setSalePayment('cash')">
          <span class="payment-icon">💵</span>Cash
        </button>
        <button class="payment-btn ${salePaymentType==='pos'?'active':''}" onclick="setSalePayment('pos')">
          <span class="payment-icon">💳</span>POS
        </button>
        <button class="payment-btn ${salePaymentType==='transfer'?'active':''}" onclick="setSalePayment('transfer')">
          <span class="payment-icon">📲</span>Transfer
        </button>
      </div>
    </div>

    <!-- Note (optional) -->
    <div class="form-group">
      <label class="form-label">Note (Optional)</label>
      <input class="form-input" id="sale-note" placeholder="e.g. Regular customer, credit, etc." />
    </div>

    <!-- Confirm -->
    <button class="btn btn-primary btn-lg w-full" onclick="confirmSale('${p.id}')">
      ✅ Confirm Sale — ${formatNGN(total)}
    </button>`;
}

function changeSaleQty(delta, productId) {
  saleQuantity = Math.max(1, saleQuantity + delta);
  const p = getProductById(appData, productId);
  if (p && saleQuantity > p.stock) saleQuantity = p.stock;
  document.getElementById('sale-qty')?.value && (document.getElementById('sale-qty').value = saleQuantity);
  if (p) document.getElementById('sale-total').textContent = formatNGN(p.price * saleQuantity);
}

function setSaleQty(val, productId) {
  saleQuantity = Math.max(1, parseInt(val) || 1);
  const p = getProductById(appData, productId);
  if (p && saleQuantity > p.stock) saleQuantity = p.stock;
  if (p) document.getElementById('sale-total').textContent = formatNGN(p.price * saleQuantity);
}

function setSalePayment(method) {
  salePaymentType = method;
  document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.payment-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(method)) b.classList.add('active');
  });
  if (method === 'transfer') {
    showToast('💡 Tip: Make sure the transfer has been confirmed before recording.', 'warning');
  }
}

function confirmSale(productId) {
  const p = getProductById(appData, productId);
  if (!p) return;

  const result = recordSale(appData, {
    productId,
    quantity: saleQuantity,
    paymentType: salePaymentType,
    note: document.getElementById('sale-note')?.value || ''
  });

  if (!result.success) {
    showToast('❌ ' + result.error, 'error');
    return;
  }

  showToast(`✅ Sold ${saleQuantity}x ${p.name} for ${formatNGN(result.sale.amount)}`, 'success');
  refreshActiveView();
  showReceiptModal(result.sale, p);
}

function quickSell(productId) {
  navigateTo('sales');
  setTimeout(() => selectSaleProduct(productId), 100);
}

function showReceiptModal(sale, product) {
  const modal = document.getElementById('modal-receipt');
  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt">
      <div class="receipt-title">Backlog</div>
      <div class="receipt-subtitle">${appData.business?.name}</div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span>${product.name}</span></div>
      <div class="receipt-row"><span>Qty: ${sale.quantity} × ₦${sale.unitPrice?.toLocaleString()}</span><span>₦${sale.amount?.toLocaleString()}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row receipt-total"><span>TOTAL</span><span>₦${sale.amount?.toLocaleString()}</span></div>
      <div class="receipt-row"><span>Payment</span><span>${(sale.paymentType||'CASH').toUpperCase()}</span></div>
      <div class="receipt-row"><span>Date</span><span>${formatDate(sale.timestamp)}</span></div>
      <div class="receipt-row"><span>Time</span><span>${formatTime(sale.timestamp)}</span></div>
      <hr class="receipt-divider">
      <div style="text-align:center;font-size:10px;color:#666">Powered by Backlog</div>
    </div>`;
  // Store for WhatsApp sharing
  window._lastSale = sale;
  window._lastProduct = product;
  openModal('modal-receipt');
}

// ── Bank Sync Reconciliation View ──

function renderReconcile() {
  let reconcileTab = sessionStorage.getItem('reconcile_tab') || 'pending';
  
  const accountsHtml = renderBankAccountsTab();
  const statsHtml = renderReconciliationStats();
  
  const pending = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING);
  const assigned = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.ASSIGNED);
  const reconciled = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.RECONCILED);

  // Pending tab (needs matching)
  let pendingHTML = '';
  if (pending.length === 0) {
    pendingHTML = `
      <div class="card text-center" style="padding: 60px 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">No Pending Transactions</h3>
        <p style="color: var(--text-muted);">All bank transfers have been assigned to products or reconciled.</p>
      </div>
    `;
  } else {
    pendingHTML = `
      <div class="grid-2" style="gap: 24px;">
        <!-- Left: Transaction List -->
        <div>
          <div class="form-label mb-12">Pending Bank Transfers (${pending.length})</div>
          ${pending.map((tx, idx) => `
            <div class="card mb-12" style="border-left: 4px solid var(--warning); transition: all var(--transition);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer;" onclick="selectReconcileTx('${tx.id}')">
                <div>
                  <div style="font-weight:700;">${tx.senderName}${getCreditWalletBalance(appData, tx.senderName) > 0 ? ` <span class="badge badge-green" style="font-size:10px;">🎁 ${formatNGN(getCreditWalletBalance(appData, tx.senderName))} credit</span>` : ''}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${tx.bank} · ${formatDateTime(tx.timestamp)}</div>
                </div>
                <div style="font-size:18px;font-weight:900;color:var(--primary);">${formatNGN(tx.amount)}</div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="selectReconcileTx('${tx.id}')">📦 Match Products</button>
                <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openApplyToDebtModal('${tx.id}')">📒 Apply to Debt</button>
                ${getCreditWalletBalance(appData, tx.senderName) > 0 ? `<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openCreditWalletModal('${tx.id}')">🎁 Use Credit</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Right: Matching Interface -->
        <div>
          <div class="form-label mb-12">Match to Products</div>
          ${!activeTxId || !pending.find(t => t.id === activeTxId) ? `
            <div class="card text-center" style="padding: 40px 20px;">
              <div style="font-size: 40px; margin-bottom: 16px;">👈</div>
              <p style="color: var(--text-muted);">Click a transaction to start matching</p>
            </div>
          ` : (() => {
            const activeTx = pending.find(t => t.id === activeTxId);
            const sum = matchedItems.reduce((acc, item) => {
              const p = getProductById(appData, item.productId);
              return acc + (p ? p.price * item.quantity : 0);
            }, 0);
            const diff = activeTx.amount - sum;

            return `
              <div class="search-bar mb-12">
                <span class="search-icon">🔍</span>
                <input type="text" id="reconcile-search" placeholder="Search products..." oninput="filterReconcileProducts()" />
              </div>

              <div class="product-grid" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">
                ${appData.products.filter(p => {
                  if (p.stock <= 0) return false;
                  const q = document.getElementById('reconcile-search')?.value || '';
                  return !q || p.name.toLowerCase().includes(q.toLowerCase());
                }).map(p => `
                  <div class="product-card" onclick="addReconcileItem('${p.id}')">
                    <div class="product-emoji">${p.emoji || '📦'}</div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-price">${formatNGN(p.price)}</div>
                    <div class="product-stock">${p.stock} stock</div>
                  </div>
                `).join('')}
              </div>

              <div class="card mb-12" style="background: ${diff === 0 ? 'var(--primary-dim)' : diff > 0 ? 'var(--warning-dim)' : 'var(--danger-dim)'}; border: 1px solid ${diff === 0 ? 'var(--primary)' : diff > 0 ? 'var(--warning)' : 'var(--danger)'};">
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Matched Amount</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 20px; font-weight: 900; font-family: monospace;">
                      ${formatNGN(sum)} / ${formatNGN(activeTx.amount)}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                      ${diff === 0 ? '✅ Perfect match!' : diff > 0 ? `₦${diff.toLocaleString()} to go` : `Over by ₦${Math.abs(diff).toLocaleString()}`}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="badge badge-${diff === 0 ? 'green' : diff > 0 ? 'yellow' : 'red'}" style="font-size: 11px; padding: 4px 8px; font-weight: 700;">
                      ${diff === 0 ? 'READY' : 'PENDING'}
                    </div>
                  </div>
                </div>
              </div>

              ${matchedItems.length > 0 ? `
                <div class="card mb-12">
                  <div class="form-label" style="margin-bottom: 12px; font-size: 13px;">Selected (${matchedItems.length})</div>
                  ${matchedItems.map(item => {
                    const p = getProductById(appData, item.productId);
                    if (!p) return '';
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                        <div style="flex: 1;">
                          <div style="font-size: 13px; font-weight: 600;">${p.emoji} ${p.name}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">₦${p.price.toLocaleString()} × <span class="qty-${p.id}">${item.quantity}</span></div>
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center;">
                          <button class="btn btn-ghost btn-sm" onclick="changeReconcileQty('${p.id}', -1)" style="padding: 2px 6px;">−</button>
                          <button class="btn btn-ghost btn-sm" onclick="changeReconcileQty('${p.id}', 1)" style="padding: 2px 6px;">+</button>
                          <button class="btn btn-danger btn-sm" onclick="removeReconcileItem('${p.id}')" style="padding: 2px 6px;">🗑️</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              <div style="display:flex;flex-direction:column;gap:8px;">
                ${matchedItems.length > 0 && diff > 0 ? `
                  <button class="btn btn-secondary btn-lg w-full" style="background:var(--warning);color:#000;border-color:var(--warning);" onclick="openSplitPaymentModal('${activeTx.id}')">
                    💱 Split Payment — Transfer + Cash Balance
                  </button>
                ` : ''}
                <button class="btn btn-primary btn-lg w-full" ${matchedItems.length === 0 ? 'disabled style="opacity: 0.5;"' : ''} onclick="submitReconciliation('${activeTx.id}')">
                  ${diff === 0 ? '✅ Perfect Match — Assign to Inventory' : diff < 0 ? `✅ Assign + Credit ${formatNGN(Math.abs(diff))} to Wallet` : '✓ Assign to Inventory'}
                </button>
              </div>
            `;
          })()}
        </div>
      </div>
    `;
  }

  // Assigned tab (ready to sync)
  let assignedHTML = '';
  if (assigned.length === 0) {
    assignedHTML = `<div class="card text-center" style="padding: 40px; color: var(--text-muted);">No assigned transactions yet</div>`;
  } else {
    assignedHTML = `
      <div class="grid-1">
        ${assigned.map(tx => {
          const matched = calculateTransactionMatched(tx.assignedProducts || []);
          const diff = tx.amount - matched;
          return `
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div>
                  <div style="font-weight: 700; font-size: 16px;">${tx.senderName}</div>
                  <div style="font-size: 12px; color: var(--text-muted);">${tx.bank} • ${formatDateTime(tx.timestamp)}</div>
                </div>
                <div style="font-size: 18px; font-weight: 900; color: var(--primary);">${formatNGN(tx.amount)}</div>
              </div>

              <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; margin-bottom: 12px;">
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Matched: ${formatNGN(matched)}</div>
                ${(tx.assignedProducts || []).map(item => {
                  const p = getProductById(appData, item.productId);
                  if (!p) return '';
                  return `<div style="font-size: 12px; padding: 4px 0;">• ${p.emoji} ${p.name} × ${item.quantity}</div>`;
                }).join('')}
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn btn-ghost btn-sm" onclick="openEditTransactionModal('${tx.id}')" style="flex: 1;">✏️ Edit</button>
                <button class="btn btn-primary btn-sm" onclick="syncTransactionToInventory('${tx.id}')" style="flex: 1;">✓ Sync</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Reconciled tab (history)
  let reconciledHTML = '';
  if (reconciled.length === 0) {
    reconciledHTML = `<div class="card text-center" style="padding: 40px; color: var(--text-muted);">No reconciled transactions yet</div>`;
  } else {
    reconciledHTML = `
      <div class="grid-1">
        ${reconciled.map(tx => {
          const walletBal = getCreditWalletBalance(appData, tx.senderName);
          const itemsTotal = calculateTransactionMatched(tx.assignedProducts || []);
          const overpayAmt = tx.overpayment || 0;
          return `
            <div class="card" style="border-left: 4px solid var(--primary);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div>
                  <div style="font-weight: 700; font-size: 16px;">${tx.senderName}</div>
                  <div style="font-size: 12px; color: var(--text-muted);">${tx.bank} • ${formatDateTime(tx.timestamp)}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span class="badge badge-green" style="font-size: 11px;">✓ Synced</span>
                  <div style="font-size: 16px; font-weight: 900; color: var(--primary);">${formatNGN(tx.amount)}</div>
                </div>
              </div>

              <div style="background: var(--primary-dim); border: 1px solid var(--primary); border-radius: var(--radius); padding: 12px; margin-bottom: ${overpayAmt > 0 ? '8px' : '12px'};">
                ${(tx.assignedProducts || []).map(item => {
                  const p = getProductById(appData, item.productId);
                  if (!p || item.productId === 'DEBT_REPAYMENT') return '';
                  return `<div style="font-size: 12px; padding: 4px 0;">• ${p.emoji} ${p.name} × ${item.quantity} = ${formatNGN(item.unitPrice * item.quantity)}</div>`;
                }).join('')}
                ${itemsTotal > 0 ? `<div style="font-size: 12px; font-weight: 700; padding-top: 6px; border-top: 1px solid rgba(0,217,126,0.3); margin-top: 6px; display: flex; justify-content: space-between;"><span>Goods Total</span><span>${formatNGN(itemsTotal)}</span></div>` : ''}
              </div>

              ${overpayAmt > 0 ? `
              <div style="background: var(--warning-dim); border: 1px solid rgba(255,183,0,0.3); border-radius: var(--radius); padding: 10px 12px; margin-bottom: 12px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: var(--warning); font-weight: 600;">🎁 Overpayment → Wallet Credit</span>
                  <span style="font-weight: 800; color: var(--warning); font-family: monospace;">${formatNGN(overpayAmt)}</span>
                </div>
                ${walletBal > 0 ? `<div style="color: var(--text-muted); margin-top: 4px;">Wallet balance: <strong style="color:var(--primary)">${formatNGN(walletBal)}</strong></div>` : ''}
              </div>` : ''}

              <div style="display: flex; gap: 8px;">
                <button class="btn btn-ghost btn-sm" onclick="unreconciledTransaction('${tx.id}')" style="flex: 1;">↩️ Unreconcile</button>
                ${walletBal > 0 ? `<button class="btn btn-secondary btn-sm" onclick="issueRefund('${tx.senderName}','${tx.id}')" style="flex:1;">💸 Issue Refund</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  document.getElementById('page-reconcile').innerHTML = `
    <div class="section-title">🏦 Bank Sync Center</div>
    <div class="section-desc">Reconcile bank transfers, match inventory, track everything</div>

    ${statsHtml}

    <div style="margin-bottom: 24px;">
      <div class="form-label" style="margin-bottom: 12px;">Connected Accounts</div>
      ${accountsHtml}
    </div>

    <div style="border-bottom: 1px solid var(--border); margin-bottom: 24px;">
      <div style="display: flex; gap: 4px; overflow-x: auto;">
        <button class="btn btn-ghost" onclick="switchReconcileTab('pending')" style="border-bottom: ${reconcileTab === 'pending' ? '2px solid var(--primary)' : 'none'}; border-radius: 0; padding: 12px 16px; font-weight: 600; white-space: nowrap;">
          ⏳ Pending (${pending.length})
        </button>
        <button class="btn btn-ghost" onclick="switchReconcileTab('assigned')" style="border-bottom: ${reconcileTab === 'assigned' ? '2px solid var(--primary)' : 'none'}; border-radius: 0; padding: 12px 16px; font-weight: 600; white-space: nowrap;">
          📋 Assigned (${assigned.length})
        </button>
        <button class="btn btn-ghost" onclick="switchReconcileTab('reconciled')" style="border-bottom: ${reconcileTab === 'reconciled' ? '2px solid var(--primary)' : 'none'}; border-radius: 0; padding: 12px 16px; font-weight: 600; white-space: nowrap;">
          ✓ Reconciled (${reconciled.length})
        </button>
      </div>
    </div>

    ${reconcileTab === 'pending' ? pendingHTML : reconcileTab === 'assigned' ? assignedHTML : reconciledHTML}
  `;
}

function switchReconcileTab(tab) {
  sessionStorage.setItem('reconcile_tab', tab);
  renderReconcile();
}



// ── Split / Partial Payment Reconciliation ──

/**
 * Called when a bank transfer is LESS than the total matched items.
 * Opens the split payment modal so the user can record the cash balance.
 */
function openSplitPaymentModal(txId) {
  const tx = getAllTransactions(appData).find(t => t.id === txId) ||
             getTransactionsByStatus(appData, 'pending').find(t => t.id === txId);
  if (!tx) return;

  const sum = matchedItems.reduce((acc, item) => {
    const p = getProductById(appData, item.productId);
    return acc + (p ? p.price * item.quantity : 0);
  }, 0);

  const cashBalance = sum - tx.amount;
  const modal = document.getElementById('modal-split-payment');
  document.getElementById('split-tx-name').textContent = tx.senderName;
  document.getElementById('split-transfer-amt').textContent = formatNGN(tx.amount);
  document.getElementById('split-total-amt').textContent = formatNGN(sum);
  document.getElementById('split-cash-balance').textContent = formatNGN(Math.abs(cashBalance));
  document.getElementById('split-balance-label').textContent =
    cashBalance > 0 ? 'Cash balance owed by customer:' :
    cashBalance < 0 ? 'Overpayment (excess transfer):' : 'Perfect match!';
  document.getElementById('split-cash-input').value = Math.max(0, cashBalance);
  document.getElementById('split-confirm-btn').onclick = () => submitSplitReconciliation(txId);
  openModal('modal-split-payment');
}

/**
 * Reconciles a transaction that was paid partly via bank transfer and partly via cash.
 * Records a combined sale with paymentType = 'split' and deducts stock.
 */
function submitSplitReconciliation(txId) {
  if (matchedItems.length === 0) {
    showToast('Please select at least one product first', 'warning');
    return;
  }

  const cashPaid = parseFloat(document.getElementById('split-cash-input').value) || 0;
  const activeTx = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === txId);
  if (!activeTx) { showToast('Transaction not found', 'error'); return; }

  const totalSale = activeTx.amount + cashPaid;

  // Build assigned products list
  const assignedProducts = matchedItems.map(item => {
    const p = getProductById(appData, item.productId);
    return { productId: item.productId, quantity: item.quantity, unitPrice: p ? p.price : 0 };
  });

  // Store split payment info on the transaction
  activeTx.splitPayment = {
    transferAmount: activeTx.amount,
    cashAmount: cashPaid,
    totalAmount: totalSale,
    recordedAt: new Date().toISOString()
  };

  // Create assigned transaction
  createAssignedTransaction(appData, txId, assignedProducts);

  matchedItems = [];
  activeTxId = null;
  saveData(appData);
  closeModal('modal-split-payment');
  refreshActiveView();
  showToast(`✅ Split payment recorded! ₦${activeTx.amount.toLocaleString()} transfer + ₦${cashPaid.toLocaleString()} cash.`, 'success');
}



// ── Apply Transfer to Debt Repayment ──

let _applyDebtTxId = null;
let _selectedDebtorId = null;

function openApplyToDebtModal(txId) {
  _applyDebtTxId = txId;
  _selectedDebtorId = null;

  const tx = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === txId);
  if (!tx) { showToast('Transaction not found', 'error'); return; }

  const outstandingDebts = (appData.debts || []).filter(d => d.status === 'outstanding');

  document.getElementById('apply-debt-transfer-info').innerHTML = `
    <div class="credit-wallet-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:16px;">💳 Transfer from ${tx.senderName}</div>
          <div style="font-size:12px;color:var(--text-muted);">${tx.bank} · ${formatDateTime(tx.timestamp)}</div>
        </div>
        <div style="font-size:22px;font-weight:900;color:var(--primary);font-family:monospace;">${formatNGN(tx.amount)}</div>
      </div>
    </div>`;

  if (outstandingDebts.length === 0) {
    document.getElementById('apply-debt-debtor-list').innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="empty-state-icon">📒</div>
        <div class="empty-state-title">No Outstanding Debts</div>
        <div class="empty-state-desc">Record a debt first in the Debt Ledger</div>
      </div>`;
  } else {
    document.getElementById('apply-debt-debtor-list').innerHTML =
      outstandingDebts.map(d => `
        <div class="debtor-select-item" id="debtor-item-${d.id}" onclick="selectDebtorForPayment('${d.id}', ${tx.amount})">
          <div>
            <div style="font-weight:700;">👤 ${d.customerName}</div>
            ${d.phone ? `<div style="font-size:12px;color:var(--text-muted);">📞 ${d.phone}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;color:var(--warning);font-family:monospace;">${formatNGN(d.remainingAmount)}</div>
            <div style="font-size:11px;color:var(--text-muted);">still owed</div>
          </div>
        </div>`).join('');
  }

  document.getElementById('apply-debt-amount-row').style.display = 'none';
  document.getElementById('apply-debt-confirm-btn').disabled = true;
  openModal('modal-apply-to-debt');
}

function selectDebtorForPayment(debtId, txAmount) {
  _selectedDebtorId = debtId;
  const debt = (appData.debts || []).find(d => d.id === debtId);
  if (!debt) return;

  // Highlight selected
  document.querySelectorAll('.debtor-select-item').forEach(el => el.classList.remove('selected'));
  document.getElementById(`debtor-item-${debtId}`)?.classList.add('selected');

  // Show amount row
  const maxApply = Math.min(txAmount, debt.remainingAmount);
  document.getElementById('apply-debt-max').textContent = formatNGN(maxApply);
  document.getElementById('apply-debt-amount').value = maxApply;
  document.getElementById('apply-debt-amount').max = maxApply;
  document.getElementById('apply-debt-amount-row').style.display = 'block';
  document.getElementById('apply-debt-confirm-btn').disabled = false;
}

function submitDebtRepaymentFromTransfer() {
  if (!_applyDebtTxId || !_selectedDebtorId) return;

  const tx = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === _applyDebtTxId);
  const debt = (appData.debts || []).find(d => d.id === _selectedDebtorId);
  if (!tx || !debt) { showToast('Error: transaction or debtor not found', 'error'); return; }

  const applyAmt = parseFloat(document.getElementById('apply-debt-amount').value);
  if (isNaN(applyAmt) || applyAmt <= 0) { showToast('Enter a valid amount', 'warning'); return; }
  if (applyAmt > tx.amount) { showToast('Amount cannot exceed transfer amount', 'warning'); return; }

  // Record debt repayment
  debt.payments = debt.payments || [];
  debt.payments.push({ amount: applyAmt, timestamp: Date.now(), source: 'transfer', txId: tx.id });
  debt.remainingAmount = Math.max(0, debt.remainingAmount - applyAmt);
  if (debt.remainingAmount === 0) debt.status = 'paid';

  // Write to sales history
  appData.sales.push({
    id: 'drep_tx_' + Date.now(),
    type: 'debt-repayment',
    productId: null,
    customerName: debt.customerName,
    debtId: debt.id,
    quantity: 1,
    unitPrice: applyAmt,
    amount: applyAmt,
    paymentType: 'transfer',
    timestamp: Date.now(),
    notes: `Bank transfer debt repayment from ${debt.customerName}`
  });

  // Handle leftover amount (credit wallet)
  const leftover = tx.amount - applyAmt;
  if (leftover > 0) {
    upsertCreditWallet(appData, tx.senderName, leftover, `Overpayment after debt repayment on ${new Date().toLocaleDateString()}`);
  }

  // Move transfer to assigned state
  const assignedProducts = [{ productId: 'DEBT_REPAYMENT', quantity: 1, unitPrice: applyAmt }];
  createAssignedTransaction(appData, _applyDebtTxId, assignedProducts);

  saveData(appData);
  closeModal('modal-apply-to-debt');
  refreshActiveView();

  const msg = leftover > 0
    ? `✅ ${formatNGN(applyAmt)} applied to ${debt.customerName}'s debt. ${formatNGN(leftover)} credit added to their wallet.`
    : `✅ ${formatNGN(applyAmt)} debt repayment from ${debt.customerName} recorded!${debt.remainingAmount === 0 ? ' Debt fully cleared! 🎉' : ''}`;
  showToast(msg, 'success', 6000);

  _applyDebtTxId = null;
  _selectedDebtorId = null;
}

// ── Credit Wallet reconciliation ──

let _creditWalletTxId = null;

function openCreditWalletModal(txId) {
  _creditWalletTxId = txId;
  const tx = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === txId);
  if (!tx) return;

  const wallet = getCreditWallet(appData, tx.senderName);
  const walletBal = wallet ? wallet.balance : 0;
  const effectiveAmount = tx.amount + walletBal;

  document.getElementById('credit-wallet-body').innerHTML = `
    <div class="credit-wallet-card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-weight:700;font-size:15px;">💳 Transfer: ${formatNGN(tx.amount)}</div>
        <div style="color:var(--primary);font-weight:700;">from ${tx.senderName}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="color:var(--text-muted);">Credit Wallet Balance</span>
        <span style="font-weight:800;color:var(--secondary);font-family:monospace;">${formatNGN(walletBal)}</span>
      </div>
      <div style="border-top:1px solid rgba(0,217,126,0.3);padding-top:8px;display:flex;justify-content:space-between;">
        <span style="font-weight:700;">Effective Total Available</span>
        <span style="font-size:20px;font-weight:900;color:var(--primary);font-family:monospace;">${formatNGN(effectiveAmount)}</span>
      </div>
    </div>

    <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
      Select products to match against the effective total (transfer + wallet credit):
    </div>

    ${wallet && wallet.history?.length > 0 ? `
      <details style="margin-bottom:16px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-muted);">📜 Wallet History (${wallet.history.length} entries)</summary>
        <div style="margin-top:8px;font-size:12px;">
          ${wallet.history.slice(0,5).map(h => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-muted);">${new Date(h.timestamp).toLocaleDateString()} · ${h.reason}</span>
              <span style="color:${h.amount >= 0 ? 'var(--primary)' : 'var(--danger)'};font-weight:700;">${h.amount >= 0 ? '+' : ''}${formatNGN(h.amount)}</span>
            </div>`).join('')}
        </div>
      </details>` : ''}

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;font-size:13px;">
      <strong>What happens when you confirm:</strong>
      <ul style="margin-top:8px;color:var(--text-muted);padding-left:16px;line-height:1.8;">
        <li>Matched items will be assigned and synced to inventory</li>
        <li>The wallet credit (${formatNGN(walletBal)}) will be consumed</li>
        <li>Any remaining difference will be added/removed from wallet</li>
      </ul>
    </div>`;

  openModal('modal-credit-wallet');
}

function applyCreditWalletToTransfer() {
  if (!_creditWalletTxId || matchedItems.length === 0) {
    showToast('Please select products first in the reconcile view', 'warning');
    return;
  }

  const tx = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === _creditWalletTxId);
  if (!tx) return;

  const itemTotal = matchedItems.reduce((acc, item) => {
    const p = getProductById(appData, item.productId);
    return acc + (p ? p.price * item.quantity : 0);
  }, 0);

  const walletBal = getCreditWalletBalance(appData, tx.senderName);
  const effectiveAvailable = tx.amount + walletBal;
  const delta = effectiveAvailable - itemTotal; // positive = credit left, negative = still owes

  // Consume from wallet
  if (walletBal > 0) {
    upsertCreditWallet(appData, tx.senderName, -Math.min(walletBal, itemTotal), 'Applied to purchase');
  }
  // Record any remaining difference
  if (delta > 0) {
    upsertCreditWallet(appData, tx.senderName, delta, 'Leftover credit after purchase');
  } else if (delta < 0) {
    upsertCreditWallet(appData, tx.senderName, delta, 'Shortfall — customer owes this amount');
  }

  // Assign transaction
  const assignedProducts = matchedItems.map(item => {
    const p = getProductById(appData, item.productId);
    return { productId: item.productId, quantity: item.quantity, unitPrice: p ? p.price : 0 };
  });
  createAssignedTransaction(appData, _creditWalletTxId, assignedProducts);

  matchedItems = [];
  activeTxId = null;
  _creditWalletTxId = null;
  saveData(appData);
  closeModal('modal-credit-wallet');
  refreshActiveView();
  showToast(`✅ Reconciled using credit wallet. ${delta > 0 ? formatNGN(delta) + ' added back to wallet.' : delta < 0 ? formatNGN(Math.abs(delta)) + ' shortfall recorded.' : 'Perfect match!'}`);
}

function _openRefundFromWalletModal() {
  // Get the sender name from the active credit wallet tx
  const tx = _creditWalletTxId
    ? getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === _creditWalletTxId)
    : null;
  const senderName = tx?.senderName || null;
  closeModal('modal-credit-wallet');
  if (senderName) {
    issueRefund(senderName, _creditWalletTxId);
  } else {
    showToast('Could not identify customer for refund', 'warning');
  }
}

// ── Analytics Render ──

let analyticsPeriodHours = 720; // default 30 days

function setAnalyticsPeriod(hours) {
  analyticsPeriodHours = hours;
  renderAnalytics();
}

function renderAnalytics() {
  const PERIODS = [
    { label:'1H', hours:1 }, { label:'Today', hours:24 }, { label:'2D', hours:48 },
    { label:'7D', hours:168 }, { label:'1M', hours:720 }, { label:'3M', hours:2160 }, { label:'1Y', hours:8760 }
  ];

  const period = Math.ceil(analyticsPeriodHours / 24) || 1;
  const dailyData = analyticsPeriodHours === 1 ? getHourlySales(appData) : getDailySalesChart(appData, period);
  const catData = getCategorySales(appData, period);
  const payData = getPaymentMethodBreakdown(appData, period);
  const topProds = getTopProducts(appData, 8, period);

  const PERIODS_ANALYTICS = [
    { label:'1H', hours:1 }, { label:'Today', hours:24 }, { label:'2D', hours:48 },
    { label:'7D', hours:168 }, { label:'1M', hours:720 }, { label:'3M', hours:2160 }, { label:'1Y', hours:8760 }
  ];
  document.getElementById('page-analytics').innerHTML = `
    <div class="period-filter" style="margin-bottom:16px;">
      ${PERIODS_ANALYTICS.map(p => `<button class="period-btn ${analyticsPeriodHours===p.hours?'active':''}" onclick="setAnalyticsPeriod(${p.hours})">${p.label}</button>`).join('')}
    </div>
    <div class="flex-between mb-24">
      <div>
        <div class="section-title">Analytics</div>
        <div class="section-desc">Last 30 days performance breakdown</div>
      </div>
      <div class="flex gap-12">
        <button class="btn btn-ghost btn-sm" onclick="exportToExcel(appData,'full')">📊 Export Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="exportToWord(appData)">📄 Export Word</button>
      </div>
    </div>

    <!-- Revenue Line Chart -->
    <div class="card mb-24">
      <div class="card-header">
        <div class="card-title">Daily Revenue — Last 30 Days</div>
        <div style="color:var(--primary);font-weight:700;font-family:monospace">${formatNGN(getRevenue(getSalesInRange(appData,30)))}</div>
      </div>
      <div class="chart-wrap" style="height:260px">
        <canvas id="chart-daily-revenue"></canvas>
      </div>
    </div>

    <!-- Category + Payment -->
    <div class="grid-2 mb-24">
      <div class="card">
        <div class="card-header"><div class="card-title">Sales by Category</div></div>
        <div class="chart-wrap" style="height:240px">
          <canvas id="chart-categories"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Payment Methods</div></div>
        <div class="chart-wrap" style="height:240px">
          <canvas id="chart-payments"></canvas>
        </div>
      </div>
    </div>

    <!-- Top Products Bar Chart -->
    <div class="card mb-24">
      <div class="card-header"><div class="card-title">Top Products by Revenue (30 Days)</div></div>
      <div class="chart-wrap" style="height:240px">
        <canvas id="chart-top-products"></canvas>
      </div>
    </div>

    <!-- Nigeria Demand Map -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">🗺️ Nigeria Demand Heatmap</div>
        <span class="badge badge-purple">Demo Data</span>
      </div>
      <div class="text-muted text-sm mb-16">Simulated consumer demand levels across Nigerian states for your product category</div>
      ${renderNigeriaMapSVG()}
      <div class="map-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#00D97E"></div> Very High</div>
        <div class="legend-item"><div class="legend-dot" style="background:#7B61FF"></div> High</div>
        <div class="legend-item"><div class="legend-dot" style="background:#00B8FF"></div> Moderate</div>
        <div class="legend-item"><div class="legend-dot" style="background:#FF6B35"></div> Low</div>
        <div class="legend-item"><div class="legend-dot" style="background:#555570"></div> Very Low</div>
      </div>
    </div>`;

  setTimeout(() => {
    renderDailyRevenueChart(dailyData);
    renderCategoryChart(catData);
    renderPaymentChart(payData);
    renderTopProductsChart(topProds);
  }, 100);
}

function renderDailyRevenueChart(data) {
  const canvas = document.getElementById('chart-daily-revenue');
  if (!canvas || !window.Chart) return;
  if (charts['daily-revenue']) charts['daily-revenue'].destroy();
  charts['daily-revenue'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d=>d.label),
      datasets: [{
        label: 'Revenue',
        data: data.map(d=>d.revenue),
        backgroundColor: data.map(d => d.revenue > 0 ? 'rgba(0,217,126,0.7)' : 'rgba(85,85,112,0.3)'),
        borderColor: data.map(d => d.revenue > 0 ? '#00D97E' : '#555570'),
        borderWidth: 1, borderRadius: 4
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'₦'+ctx.raw.toLocaleString()}}},
      scales:{
        x:{grid:{color:'rgba(255,255,255,0.03)'},ticks:{color:'#8888AA',font:{size:10},maxRotation:0,maxTicksLimit:10}},
        y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#8888AA',font:{size:10},callback:v=>'₦'+Number(v).toLocaleString()}}
      }
    }
  });
}

function renderCategoryChart(data) {
  const canvas = document.getElementById('chart-categories');
  if (!canvas || !window.Chart) return;
  if (charts['categories']) charts['categories'].destroy();
  const colors = ['#00D97E','#7B61FF','#FF6B35','#00B8FF','#FFB700','#FF4757'];
  charts['categories'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.map(d=>d[0]),
      datasets: [{ data: data.map(d=>d[1]), backgroundColor: colors, borderColor: '#161625', borderWidth: 3 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'right',labels:{color:'#E8E8F5',font:{size:12},padding:12}},
        tooltip:{callbacks:{label:ctx=>`₦${ctx.raw.toLocaleString()}`}}}
    }
  });
}

function renderPaymentChart(data) {
  const canvas = document.getElementById('chart-payments');
  if (!canvas || !window.Chart) return;
  if (charts['payments']) charts['payments'].destroy();
  const labels = ['Cash','POS','Transfer','Credit'];
  const values = [data.cash||0, data.pos||0, data.transfer||0, data.credit||0];
  charts['payments'] = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: ['#FF6B35','#7B61FF','#00D97E','#00B8FF'], borderColor:'#161625', borderWidth:3 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'right',labels:{color:'#E8E8F5',font:{size:12},padding:12}},
        tooltip:{callbacks:{label:ctx=>`₦${ctx.raw.toLocaleString()}`}}}
    }
  });
}

function renderTopProductsChart(topProds) {
  const canvas = document.getElementById('chart-top-products');
  if (!canvas || !window.Chart) return;
  if (charts['top-products']) charts['top-products'].destroy();
  charts['top-products'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: topProds.map(x=>x.product?.name||'Unknown'),
      datasets: [{
        label:'Revenue',
        data: topProds.map(x=>x.revenue),
        backgroundColor: 'rgba(123,97,255,0.7)',
        borderColor:'#7B61FF', borderWidth:1, borderRadius:4
      }]
    },
    options: {
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'₦'+ctx.raw.toLocaleString()}}},
      scales:{
        x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#8888AA',font:{size:10},callback:v=>'₦'+Number(v).toLocaleString()}},
        y:{grid:{display:false},ticks:{color:'#E8E8F5',font:{size:12}}}
      }
    }
  });
}

function renderNigeriaMapSVG() {
  const states = Object.entries(nigeriaStateDemand);
  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:8px">
    ${states.map(([name, d]) => `
      <div style="background:${getDemandColor(d.level)}20;border:1px solid ${getDemandColor(d.level)}50;
        border-radius:8px;padding:10px 8px;text-align:center;cursor:pointer;transition:all 0.2s"
        onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"
        title="${name}: ${d.label} demand">
        <div style="font-size:11px;font-weight:600;color:${getDemandColor(d.level)};margin-bottom:2px">${name}</div>
        <div style="font-size:10px;color:var(--text-muted)">${d.label}</div>
        <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">
          ${Array.from({length:5},(_,i)=>`<div style="width:8px;height:8px;border-radius:2px;background:${i<Math.ceil(d.level/2)?getDemandColor(d.level):'var(--border)'}"></div>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Insights Render ──

function renderInsights() {
  const insights = generateInsights(appData);
  document.getElementById('page-insights').innerHTML = `
    <div class="section-title">AI Insights</div>
    <div class="section-desc mb-24">Smart recommendations powered by your sales data</div>

    <div class="ai-card mb-24">
      <div class="ai-badge">🤖 Backlog Intelligence</div>
      <div style="font-size:15px;font-weight:500">Analysing ${appData.sales.length} transactions across ${appData.products.length} products for <strong>${appData.business?.name}</strong>...</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      ${insights.map((ins, i) => `
        <div style="background:${getInsightBgColor(ins.type)};border:1px solid ${getInsightColor(ins.type)}30;
          border-radius:var(--radius-lg);padding:20px;border-left:4px solid ${getInsightColor(ins.type)}">
          <div style="display:flex;align-items:flex-start;gap:16px">
            <div style="font-size:28px;flex-shrink:0">${ins.icon}</div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <div style="font-size:16px;font-weight:700">${ins.title}</div>
                <span class="badge badge-${ins.type==='success'?'green':ins.type==='warning'||ins.type==='danger'||ins.type==='critical'?'red':ins.type==='tip'?'purple':'gray'}">
                  ${ins.type}
                </span>
              </div>
              <div style="font-size:14px;line-height:1.7;color:var(--text)">${ins.message}</div>
              ${ins.action ? `<button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="navigateTo('${ins.actionView}')">${ins.action} →</button>` : ''}
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ── History Render ──

// History period (hours; 0 = all time)
let historyPeriodHours = 24;
let historyTab = 'ledger'; // 'ledger' | 'byproduct'
let historySearch = '';

function renderHistory() {
  const PERIODS = [
    { label:'1H', hours:1 }, { label:'Today', hours:24 }, { label:'2D', hours:48 },
    { label:'3D', hours:72 }, { label:'7D', hours:168 }, { label:'1M', hours:720 },
    { label:'3M', hours:2160 }, { label:'1Y', hours:8760 }, { label:'All', hours:0 }
  ];

  const sales = getSalesByPeriod(appData, historyPeriodHours);
  const filtered = historySearch
    ? sales.filter(s => {
        const p = getProductById(appData, s.productId);
        const name = (p?.name || s.customerName || '').toLowerCase();
        return name.includes(historySearch.toLowerCase()) ||
               (s.notes || '').toLowerCase().includes(historySearch.toLowerCase());
      })
    : sales;

  const EXCLUDED_TYPES = new Set(['debt-repayment', 'credit-wallet', 'refund']);
  const totalRev   = filtered.filter(s => !EXCLUDED_TYPES.has(s.type)).reduce((sum, s) => sum + (s.amount || 0), 0);
  const debtRep    = filtered.filter(s => s.type === 'debt-repayment').reduce((sum, s) => sum + (s.amount || 0), 0);
  const refundAmt  = filtered.filter(s => s.type === 'refund').reduce((sum, s) => sum + (s.amount || 0), 0);
  const creditAmt  = filtered.filter(s => s.type === 'credit-wallet').reduce((sum, s) => sum + (s.amount || 0), 0);
  const netRev     = totalRev - refundAmt;

  document.getElementById('page-history').innerHTML = `
    <div class="flex-between mb-16">
      <div>
        <div class="section-title">🧾 Sales History</div>
        <div class="section-desc">
          ${filtered.length} transactions · ${formatNGN(netRev)} net revenue
          ${debtRep > 0  ? ` · <span style="color:var(--info)">${formatNGN(debtRep)} debt repaid</span>` : ''}
          ${refundAmt > 0 ? ` · <span style="color:var(--danger)">−${formatNGN(refundAmt)} refunded</span>` : ''}
          ${creditAmt > 0 ? ` · <span style="color:var(--warning)">${formatNGN(creditAmt)} to wallets</span>` : ''}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="exportToExcel(appData,'sales')">📊 Export</button>
    </div>

    <!-- Period Filter -->
    <div class="period-filter">
      ${PERIODS.map(p => `
        <button class="period-btn ${historyPeriodHours === p.hours ? 'active' : ''}"
          onclick="setHistoryPeriod(${p.hours})">${p.label}</button>`).join('')}
    </div>

    <!-- Search -->
    <div class="history-search">
      <span>🔍</span>
      <input type="text" placeholder="Search by product or customer..." value="${historySearch}"
        oninput="historySearch=this.value;renderHistory()" />
      ${historySearch ? `<button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;" onclick="historySearch='';renderHistory()">×</button>` : ''}
    </div>

    <!-- View Tabs -->
    <div class="tab-bar" style="margin-bottom:16px;">
      <button class="tab-button ${historyTab==='ledger'?'active':''}" onclick="historyTab='ledger';renderHistory()">📋 Transaction Ledger</button>
      <button class="tab-button ${historyTab==='byproduct'?'active':''}" onclick="historyTab='byproduct';renderHistory()">📦 By Product</button>
    </div>

    ${historyTab === 'ledger' ? renderHistoryLedger(filtered) : renderHistoryByProduct(filtered)}
  `;
}

function setHistoryPeriod(hours) {
  historyPeriodHours = hours;
  renderHistory();
}

function renderHistoryLedger(sales) {
  if (sales.length === 0) return `
    <div class="empty-state">
      <div class="empty-state-icon">🧾</div>
      <div class="empty-state-title">No transactions found</div>
      <div class="empty-state-desc">Try a different time period or search term</div>
    </div>`;

  const rows = sales.slice().reverse().slice(0, 200).map((s, i) => {
    const p = s.productId && s.productId !== 'DEBT_REPAYMENT' ? getProductById(appData, s.productId) : null;
    const type = s.type || 'sale';

    // Determine display properties by type
    let typeLabel = '', typeBadgeColor = 'orange', amountColor = 'var(--primary)', amountPrefix = '';
    let productLabel = '', qtyLabel = '', unitPriceVal = s.unitPrice || s.amount || 0;

    if (type === 'debt-repayment') {
      typeLabel = '📒 Debt Repayment';
      typeBadgeColor = 'blue';
      amountColor = 'var(--info)';
      productLabel = `<span style="color:var(--info);">📒 Debt Repayment</span><div class="text-xs text-muted">${s.customerName || ''}</div>`;
      qtyLabel = '—';
    } else if (type === 'refund') {
      typeLabel = '💸 refund';
      typeBadgeColor = 'red';
      amountColor = 'var(--danger)';
      amountPrefix = '−';
      productLabel = `<span style="color:var(--danger);">💸 Refund Issued</span><div class="text-xs text-muted">${s.customerName || ''}</div>`;
      qtyLabel = '—';
    } else if (type === 'credit-wallet') {
      typeLabel = '🎁 wallet credit';
      typeBadgeColor = 'green';
      amountColor = 'var(--warning)';
      amountPrefix = '+';
      productLabel = `<span style="color:var(--warning);">🎁 Credit to Wallet</span><div class="text-xs text-muted">Overpayment · ${s.customerName || ''}</div>`;
      qtyLabel = '—';
      unitPriceVal = 0;
    } else if (s.isBankReconciled) {
      // Synthetic sale from bank reconciliation sync
      typeLabel = '📲 transfer';
      typeBadgeColor = 'green';
      productLabel = `<strong>${p?.emoji||'📦'} ${p?.name||'Unknown'}</strong>${s.senderName ? `<div class="text-xs text-muted">from ${s.senderName}</div>` : ''}`;
      qtyLabel = `${s.quantity||1} ${p?.unit||'unit'}`;
    } else {
      // Normal sale
      const pm = s.paymentType || 'cash';
      typeLabel = pm === 'pos' ? '💳 pos' : pm === 'transfer' ? '📲 transfer' : '💵 cash';
      typeBadgeColor = pm === 'pos' ? 'purple' : pm === 'transfer' ? 'green' : 'orange';
      productLabel = `<strong>${p?.emoji||'📦'} ${p?.name||s.customerName||'Unknown'}</strong>`;
      qtyLabel = `${s.quantity||1} ${p?.unit||'unit'}`;
    }

    return `<tr>
      <td class="text-muted text-xs">${i+1}</td>
      <td>
        <div style="font-size:13px;">${formatDate(s.timestamp)}</div>
        <div class="text-xs text-muted">${formatTime(s.timestamp)}</div>
      </td>
      <td>${productLabel}</td>
      <td>${qtyLabel}</td>
      <td class="currency">${unitPriceVal > 0 ? '₦' + unitPriceVal.toLocaleString() : '—'}</td>
      <td class="currency" style="font-weight:700;color:${amountColor};">${amountPrefix}₦${(s.amount||0).toLocaleString()}</td>
      <td><span class="badge badge-${typeBadgeColor}">${typeLabel}</span></td>
    </tr>`;
  }).join('');

  return `
    <div class="table-scroll card" style="padding:0;">
      <table class="data-table">
        <thead><tr><th>#</th><th>Date & Time</th><th>Product / Type</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th>Payment</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${sales.length > 200 ? `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px;">Showing 200 of ${sales.length}. Export Excel to see all.</div>` : ''}
    </div>`;
}

function renderHistoryByProduct(sales) {
  // Exclude debt repayments from product grouping
  const prodSales = sales.filter(s => s.productId && s.type !== 'debt-repayment');
  const debtSales = sales.filter(s => s.type === 'debt-repayment');

  const groups = getProductSalesSummary(prodSales, appData.products);

  if (groups.length === 0) return `
    <div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-title">No product sales found</div>
      <div class="empty-state-desc">Try a different time period</div>
    </div>`;

  let html = groups.map(g => `
    <div class="history-group">
      <div class="history-group-header" onclick="toggleHistoryGroup('grp-${g.productId}')">
        <div class="history-group-title">
          <span class="history-group-emoji">${g.emoji}</span>
          <div>
            <div class="history-group-name">${g.name}</div>
            <div class="history-group-sub">${g.totalQty} ${g.unit}(s) sold · ${g.transactions.length} transaction${g.transactions.length!==1?'s':''}</div>
          </div>
        </div>
        <div class="history-group-stats">
          <div class="history-group-total">${formatNGN(g.totalRevenue)}</div>
          <div class="history-group-count">▼ tap to expand</div>
        </div>
      </div>
      <div class="history-group-rows" id="grp-${g.productId}">
        ${g.transactions.slice().reverse().map(s => `
          <div class="history-row">
            <span class="history-row-time">${formatDate(s.timestamp)}<br><span style="font-size:10px;">${formatTime(s.timestamp)}</span></span>
            <span class="history-row-qty">×${s.quantity||1} ${g.unit}</span>
            <span class="badge badge-${s.paymentType==='pos'?'purple':s.paymentType==='transfer'?'green':'orange'}" style="font-size:10px;">${s.paymentType||'cash'}</span>
            <span class="history-row-amount">${formatNGN(s.amount)}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Show debt repayments at the bottom
  if (debtSales.length > 0) {
    const totalDebt = debtSales.reduce((s, d) => s + d.amount, 0);
    html += `
      <div class="history-group" style="border-left:4px solid var(--info);">
        <div class="history-group-header" onclick="toggleHistoryGroup('grp-debts')">
          <div class="history-group-title">
            <span class="history-group-emoji">📒</span>
            <div>
              <div class="history-group-name">Debt Repayments</div>
              <div class="history-group-sub">${debtSales.length} repayment${debtSales.length!==1?'s':''}</div>
            </div>
          </div>
          <div class="history-group-stats">
            <div class="history-group-total" style="color:var(--info);">${formatNGN(totalDebt)}</div>
            <div class="history-group-count">▼ tap to expand</div>
          </div>
        </div>
        <div class="history-group-rows" id="grp-debts">
          ${debtSales.slice().reverse().map(s => `
            <div class="history-row">
              <span class="history-row-time">${formatDate(s.timestamp)}<br><span style="font-size:10px;">${formatTime(s.timestamp)}</span></span>
              <span style="font-size:13px;font-weight:600;">👤 ${s.customerName||'Customer'}</span>
              <span class="badge badge-blue" style="font-size:10px;">${s.paymentType||'cash'}</span>
              <span class="history-row-amount" style="color:var(--info);">${formatNGN(s.amount)}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  return html;
}

function toggleHistoryGroup(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}


// ── Export Render ──

function renderExport() {
  document.getElementById('page-export').innerHTML = `
    <div class="section-title">Reports & Export</div>
    <div class="section-desc mb-24">Download your business data in any format. Works like SolidWorks — real files you can open in Microsoft Office.</div>

    <div class="alert alert-info mb-24">
      <div class="alert-icon">💡</div>
      <div class="alert-content">
        <div class="alert-title">Microsoft Office Integration</div>
        <div class="alert-desc">All exports open directly in Excel and Word. Your data, formatted and ready. The AI Insights sheet is included in every Excel export automatically.</div>
      </div>
    </div>

    <div class="export-options">
      <div class="export-card">
        <div class="export-icon">📊</div>
        <div class="export-name">Full Excel Report</div>
        <div class="export-desc">Complete report with Sales, Inventory, Analytics, and AI Insights tabs. Opens directly in Microsoft Excel.</div>
        <button class="btn btn-primary btn-sm" style="margin-top:16px;width:100%" onclick="exportToExcel(appData,'full')">Download .xlsx</button>
      </div>
      <div class="export-card">
        <div class="export-icon">🧾</div>
        <div class="export-name">Sales Report</div>
        <div class="export-desc">Every transaction with date, product, amount, and payment method. With summary totals at the bottom.</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:16px;width:100%" onclick="exportToExcel(appData,'sales')">Download .xlsx</button>
      </div>
      <div class="export-card">
        <div class="export-icon">📦</div>
        <div class="export-name">Inventory Report</div>
        <div class="export-desc">Full stock list with levels, values, cost prices, and stock status. Great for reordering decisions.</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:16px;width:100%" onclick="exportToExcel(appData,'inventory')">Download .xlsx</button>
      </div>
      <div class="export-card">
        <div class="export-icon">📄</div>
        <div class="export-name">Business Summary (Word)</div>
        <div class="export-desc">Professional narrative summary with revenue stats, top products, low stock alerts, and AI recommendations. Opens in Microsoft Word.</div>
        <button class="btn btn-primary btn-sm" style="margin-top:16px;width:100%;background:var(--secondary)" onclick="exportToWord(appData)">Download .doc</button>
      </div>
      <div class="export-card">
        <div class="export-icon">🖨️</div>
        <div class="export-name">Print Report</div>
        <div class="export-desc">Print-ready summary report. Send to your accountant, bank, or use for monthly review meetings.</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:16px;width:100%" onclick="printReport(appData)">Print / Save PDF</button>
      </div>
      <div class="export-card" style="opacity:0.6;cursor:default">
        <div class="export-icon">🔗</div>
        <div class="export-name">Live Office Link</div>
        <div class="export-desc">Auto-syncing connection — your Excel sheet updates automatically when new sales are recorded. <span class="badge badge-purple" style="margin-top:8px;display:inline-block">Coming Soon</span></div>
        <button class="btn btn-ghost btn-sm" style="margin-top:16px;width:100%" disabled>Connect to Excel</button>
      </div>
    </div>`;
}

// ── Modals ──

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ── Add Product Modal ──

const EMOJIS = ['📦','🍜','🥛','🍗','🌽','🍅','🫙','☕','💧','🌶️','🥤','🍫','🍬','🧴','💊','👕','👟','📱','💡','🧹','🪣','📋','🔧','🪴','🐔','🥚','🐟','🍞','🥩','🧃','🧂','🫚','🥜','🍯'];
let selectedEmoji = '📦';

function openAddProductModal() {
  selectedEmoji = '📦';
  document.getElementById('add-product-form').innerHTML = buildProductForm(null);
  document.querySelector('#modal-add-product .modal-title').textContent = 'Add New Product';
  document.getElementById('save-product-btn').onclick = () => saveProduct();
  const deleteBtn = document.getElementById('delete-product-btn');
  if (deleteBtn) {
    deleteBtn.style.display = 'none';
  }
  openModal('modal-add-product');
}

function openEditProductModal(id) {
  const p = getProductById(appData, id);
  if (!p) return;
  selectedEmoji = p.emoji || '📦';
  document.getElementById('add-product-form').innerHTML = buildProductForm(p);
  document.querySelector('#modal-add-product .modal-title').textContent = 'Edit Product';
  document.getElementById('save-product-btn').onclick = () => saveEditProduct(id);
  const deleteBtn = document.getElementById('delete-product-btn');
  if (deleteBtn) {
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = () => deleteProductConfirm(id);
  }
  openModal('modal-add-product');
}

function buildProductForm(p) {
  return `
    <div class="form-group">
      <label class="form-label">Product Icon</label>
      <div class="emoji-picker-grid">
        ${EMOJIS.map(e => `<button type="button" class="emoji-btn ${e===selectedEmoji?'selected':''}" onclick="selectEmoji('${e}',this)">${e}</button>`).join('')}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input class="form-input" id="prod-name" placeholder="e.g. Indomie Noodles" value="${p?.name||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <input class="form-input" id="prod-cat" placeholder="e.g. Food, Drinks, Electronics" value="${p?.category||''}" list="cat-list" />
        <datalist id="cat-list">
          ${['Food','Beverages','Dairy','Grains','Protein','Cooking','Condiments','Spices','Electronics','Clothing','Household','Other'].map(c=>`<option value="${c}">`).join('')}
        </datalist>
      </div>
    </div>
    <div class="form-row-3">
      <div class="form-group">
        <label class="form-label">Selling Price (₦) *</label>
        <input class="form-input" id="prod-price" type="number" placeholder="0" value="${p?.price||''}" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Cost Price (₦)</label>
        <input class="form-input" id="prod-cost" type="number" placeholder="0" value="${p?.costPrice||''}" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Current Stock *</label>
        <input class="form-input" id="prod-stock" type="number" placeholder="0" value="${p?.stock||''}" min="0" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Unit</label>
        <input class="form-input" id="prod-unit" placeholder="e.g. pack, kg, tin, bottle" value="${p?.unit||'unit'}" list="unit-list" />
        <datalist id="unit-list">
          ${['pack','kg','tin','bottle','bag','box','piece','unit','litre','carton'].map(u=>`<option value="${u}">`).join('')}
        </datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Min. Stock Alert</label>
        <input class="form-input" id="prod-min" type="number" placeholder="10" value="${p?.minStock||10}" min="0" />
      </div>
    </div>`;
}

function selectEmoji(emoji, btn) {
  selectedEmoji = emoji;
  document.querySelectorAll('#add-product-form .emoji-btn').forEach(b => {
    b.classList.remove('selected');
  });
  btn.classList.add('selected');
}

function saveProduct() {
  const name = document.getElementById('prod-name')?.value?.trim();
  const price = parseFloat(document.getElementById('prod-price')?.value);
  const stock = parseInt(document.getElementById('prod-stock')?.value);

  if (!name) { showToast('Please enter a product name', 'warning'); return; }
  if (isNaN(price) || price < 0) { showToast('Please enter a valid price', 'warning'); return; }
  if (isNaN(stock) || stock < 0) { showToast('Please enter a valid stock quantity', 'warning'); return; }

  const product = {
    name,
    category: document.getElementById('prod-cat')?.value?.trim() || 'General',
    price,
    costPrice: parseFloat(document.getElementById('prod-cost')?.value) || null,
    stock,
    unit: document.getElementById('prod-unit')?.value?.trim() || 'unit',
    minStock: parseInt(document.getElementById('prod-min')?.value) || 10,
    emoji: selectedEmoji
  };

  addProduct(appData, product);
  closeModal('modal-add-product');
  refreshActiveView();
  showToast(`✅ ${name} added to inventory!`, 'success');
}

function saveEditProduct(id) {
  const name = document.getElementById('prod-name')?.value?.trim();
  const price = parseFloat(document.getElementById('prod-price')?.value);
  const stock = parseInt(document.getElementById('prod-stock')?.value);
  if (!name || isNaN(price) || isNaN(stock)) { showToast('Please fill in required fields', 'warning'); return; }

  updateProduct(appData, id, {
    name,
    category: document.getElementById('prod-cat')?.value?.trim() || 'General',
    price,
    costPrice: parseFloat(document.getElementById('prod-cost')?.value) || null,
    stock,
    unit: document.getElementById('prod-unit')?.value?.trim() || 'unit',
    minStock: parseInt(document.getElementById('prod-min')?.value) || 10,
    emoji: selectedEmoji
  });

  closeModal('modal-add-product');
  refreshActiveView();
  showToast('✅ Product updated!', 'success');
}

function deleteProductConfirm(id) {
  const p = getProductById(appData, id);
  if (!p) return;
  if (confirm(`Delete "${p.name}"? This cannot be undone.`)) {
    deleteProduct(appData, id);
    closeModal('modal-add-product');
    refreshActiveView();
    showToast(`🗑️ ${p.name} deleted`, 'warning');
  }
}

// ── UI Helpers ──

function updateSidebarBusiness() {
  const biz = appData.business;
  if (!biz) return;
  const nameEl = document.getElementById('sidebar-biz-name');
  const typeEl = document.getElementById('sidebar-biz-type');
  const avatarEl = document.getElementById('sidebar-biz-avatar');
  if (nameEl) nameEl.textContent = biz.name;
  if (typeEl) typeEl.textContent = `${biz.typeLabel} · ${biz.state}`;
  if (avatarEl) avatarEl.textContent = getTypeEmoji(biz.type);
}

function updateLowStockBadge() {
  const low = getLowStockProducts(appData);
  const badge = document.getElementById('low-stock-badge');
  if (badge) {
    if (low.length > 0) { badge.textContent = low.length; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  }
  // Bottom nav badge
  const bb = document.getElementById('bottom-stock-badge');
  if (bb) bb.style.display = low.length > 0 ? 'flex' : 'none';
}

function updateReconcileBadge() {
  const pending = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).length;
  const assigned = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.ASSIGNED).length;
  const total = pending + assigned;
  const badge = document.getElementById('reconcile-badge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
  // Bottom nav badge
  const bb = document.getElementById('bottom-reconcile-badge');
  if (bb) { bb.textContent = total; bb.style.display = total > 0 ? 'flex' : 'none'; }
}

function resizeCharts() {
  Object.values(charts).forEach(c => { try { c.resize(); } catch(e){} });
}

function showToast(message, type = 'success', duration = null) {
  // Smart default durations based on severity
  if (duration === null) {
    duration = type === 'error' ? 0 : type === 'warning' ? 5000 : 3500; // 0 = persistent
  }
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.cursor = 'pointer';
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  };
  toast.onclick = dismiss;
  container.appendChild(toast);
  if (duration > 0) setTimeout(dismiss, duration);
}

function getTypeEmoji(type) {
  const map = { supermarket:'🏪', store:'🛒', poultry:'🐔', market:'🏬', restaurant:'🍽️', wholesale:'📦', hawker:'🚶', pharmacy:'💊', other:'🏢' };
  return map[type] || '🏢';
}

function getNigerianStates() {
  return ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Expense Tracker ──

function renderExpenses() {
  const expenses = appData.expenses || [];
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.timestamp);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);

  document.getElementById('page-expenses').innerHTML = `
    <div class="flex-between mb-24">
      <div>
        <div class="section-title">💸 Expense Tracker</div>
        <div class="section-desc">Track operational costs — rent, salaries, transport, utilities</div>
      </div>
      <button class="btn btn-primary" onclick="openAddExpenseModal()">+ Add Expense</button>
    </div>

    <div class="stats-grid mb-24">
      <div class="stat-card red">
        <div class="stat-icon red">💸</div>
        <div class="stat-value currency">${formatNGN(monthTotal)}</div>
        <div class="stat-label">This Month</div>
        <div class="stat-change">${thisMonth.length} expense${thisMonth.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon orange">📊</div>
        <div class="stat-value currency">${formatNGN(totalExpenses)}</div>
        <div class="stat-label">All Time Expenses</div>
        <div class="stat-change">${expenses.length} total entries</div>
      </div>
    </div>

    <div class="card">
      ${expenses.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💸</div>
          <div class="empty-state-title">No expenses recorded</div>
          <div class="empty-state-desc">Start tracking costs like rent, salaries, and logistics to see your real profit</div>
          <button class="btn btn-primary" style="margin-top:20px" onclick="openAddExpenseModal()">+ Add First Expense</button>
        </div>` : `
      <table class="data-table">
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          ${expenses.slice().reverse().slice(0, 100).map(e => `
            <tr>
              <td class="text-muted text-sm">${formatDate(e.timestamp)}</td>
              <td><span class="badge badge-purple">${e.category}</span></td>
              <td style="font-weight:600">${e.description}</td>
              <td class="currency" style="color:var(--danger);font-weight:700">${formatNGN(e.amount)}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="deleteExpense('${e.id}')">🗑️</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`}
    </div>`;
}

function openAddExpenseModal() {
  const cats = ['Rent', 'Salaries', 'Transport / Logistics', 'Generator / Fuel', 'Utilities', 'Packaging', 'Marketing', 'Equipment', 'Stock Purchase', 'Other'];
  document.getElementById('expense-form-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Category *</label>
      <select class="form-input" id="exp-category">
        ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Description *</label>
      <input class="form-input" id="exp-desc" placeholder="e.g. Monthly rent for shop space" />
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₦) *</label>
      <input class="form-input" id="exp-amount" type="number" placeholder="0" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input class="form-input" id="exp-date" type="date" value="${new Date().toISOString().split('T')[0]}" />
    </div>`;
  openModal('modal-add-expense');
}

function saveExpense() {
  const category = document.getElementById('exp-category')?.value;
  const description = document.getElementById('exp-desc')?.value?.trim();
  const amount = parseFloat(document.getElementById('exp-amount')?.value);
  const dateStr = document.getElementById('exp-date')?.value;

  if (!description) { showToast('Please enter a description', 'warning'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'warning'); return; }

  if (!appData.expenses) appData.expenses = [];
  appData.expenses.push({
    id: 'exp_' + Date.now(),
    category,
    description,
    amount,
    timestamp: dateStr ? new Date(dateStr).getTime() : Date.now()
  });

  saveData(appData);
  closeModal('modal-add-expense');
  renderExpenses();
  showToast(`✅ Expense of ${formatNGN(amount)} recorded`, 'success');
}

function deleteExpense(id) {
  if (!confirm('Delete this expense record?')) return;
  appData.expenses = (appData.expenses || []).filter(e => e.id !== id);
  saveData(appData);
  renderExpenses();
  showToast('Expense deleted', 'info');
}

// ── Customer Debt Ledger ──

function renderDebtLedger() {
  const debts = appData.debts || [];
  const outstanding = debts.filter(d => d.status === 'outstanding');
  const totalOwed = outstanding.reduce((s, d) => s + d.remainingAmount, 0);

  document.getElementById('page-debts').innerHTML = `
    <div class="flex-between mb-24">
      <div>
        <div class="section-title">📒 Customer Debt Ledger</div>
        <div class="section-desc">Track buy-now-pay-later balances for customers</div>
      </div>
      <button class="btn btn-primary" onclick="openAddDebtModal()">+ Record Debt</button>
    </div>

    ${totalOwed > 0 ? `
    <div class="alert alert-warning mb-24">
      <div class="alert-icon">💰</div>
      <div class="alert-content">
        <div class="alert-title">${formatNGN(totalOwed)} owed to you</div>
        <div class="alert-desc">${outstanding.length} customer${outstanding.length !== 1 ? 's' : ''} with outstanding balances</div>
      </div>
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${debts.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📒</div>
          <div class="empty-state-title">No debts recorded</div>
          <div class="empty-state-desc">When a customer buys on credit, record it here to track repayment</div>
          <button class="btn btn-primary" style="margin-top:20px" onclick="openAddDebtModal()">+ Record First Debt</button>
        </div>` :
      debts.slice().reverse().map(d => `
        <div class="card" style="border-left: 4px solid ${d.status === 'paid' ? 'var(--primary)' : 'var(--warning)'};">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
            <div>
              <div style="font-weight:700;font-size:16px;">👤 ${d.customerName}</div>
              <div style="font-size:13px;color:var(--text-muted);">${d.phone ? '📞 ' + d.phone : ''} ${d.note ? '· ' + d.note : ''}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Recorded: ${formatDate(d.timestamp)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:20px;font-weight:900;color:${d.status === 'paid' ? 'var(--primary)' : 'var(--warning)'};">${formatNGN(d.remainingAmount)}</div>
              <div style="font-size:11px;color:var(--text-muted);">of ${formatNGN(d.originalAmount)}</div>
              <span class="badge badge-${d.status === 'paid' ? 'green' : 'yellow'}" style="margin-top:4px;">${d.status === 'paid' ? '✓ Paid' : 'Outstanding'}</span>
            </div>
          </div>
          ${d.status === 'outstanding' ? `
          <div style="display:flex;gap:8px;">
            <input type="number" id="repay-${d.id}" class="form-input" placeholder="Amount paid now..." style="flex:1;height:36px;font-size:13px;" min="1" max="${d.remainingAmount}" />
            <button class="btn btn-primary btn-sm" onclick="recordRepayment('${d.id}')">✓ Record Payment</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteDebt('${d.id}')">🗑️</button>
          </div>` : `
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm" onclick="deleteDebt('${d.id}')">🗑️ Remove</button>
          </div>`}
        </div>`).join('')}
    </div>`;
}

function openAddDebtModal() {
  document.getElementById('debt-form-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Customer Name *</label>
      <input class="form-input" id="debt-name" placeholder="e.g. Mama Ngozi" />
    </div>
    <div class="form-group">
      <label class="form-label">Phone Number</label>
      <input class="form-input" id="debt-phone" placeholder="080xxxxxxxx" />
    </div>
    <div class="form-group">
      <label class="form-label">Amount Owed (₦) *</label>
      <input class="form-input" id="debt-amount" type="number" placeholder="0" min="1" />
    </div>
    <div class="form-group">
      <label class="form-label">Notes (Optional)</label>
      <input class="form-input" id="debt-note" placeholder="e.g. Bought 2 bags of rice on credit" />
    </div>`;
  openModal('modal-add-debt');
}

function saveDebt() {
  const name = document.getElementById('debt-name')?.value?.trim();
  const amount = parseFloat(document.getElementById('debt-amount')?.value);

  if (!name) { showToast('Please enter customer name', 'warning'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'warning'); return; }

  if (!appData.debts) appData.debts = [];
  appData.debts.push({
    id: 'debt_' + Date.now(),
    customerName: name,
    phone: document.getElementById('debt-phone')?.value?.trim() || '',
    note: document.getElementById('debt-note')?.value?.trim() || '',
    originalAmount: amount,
    remainingAmount: amount,
    status: 'outstanding',
    payments: [],
    timestamp: Date.now()
  });

  saveData(appData);
  closeModal('modal-add-debt');
  renderDebtLedger();
  showToast(`📒 Debt of ${formatNGN(amount)} recorded for ${name}`, 'success');
}

function recordRepayment(debtId) {
  const debt = (appData.debts || []).find(d => d.id === debtId);
  if (!debt) return;
  const input = document.getElementById(`repay-${debtId}`);
  const paid = parseFloat(input?.value);
  if (isNaN(paid) || paid <= 0) { showToast('Please enter a valid payment amount', 'warning'); return; }
  if (paid > debt.remainingAmount) { showToast(`Cannot pay more than the ₦${debt.remainingAmount.toLocaleString()} owed`, 'warning'); return; }

  debt.payments = debt.payments || [];
  const repaymentEntry = { amount: paid, timestamp: Date.now(), source: 'cash' };
  debt.payments.push(repaymentEntry);
  debt.remainingAmount = Math.max(0, debt.remainingAmount - paid);
  if (debt.remainingAmount === 0) debt.status = 'paid';

  // Write to payment history so it appears in Sales History + Reports
  appData.sales.push({
    id: 'drep_' + Date.now(),
    type: 'debt-repayment',
    productId: null,
    customerName: debt.customerName,
    debtId: debt.id,
    quantity: 1,
    unitPrice: paid,
    amount: paid,
    paymentType: 'cash',
    timestamp: Date.now(),
    notes: `Debt repayment from ${debt.customerName} (${debt.remainingAmount > 0 ? formatNGN(debt.remainingAmount) + ' still owed' : 'FULLY PAID'})`
  });

  saveData(appData);
  renderDebtLedger();
  showToast(`✅ Payment of ${formatNGN(paid)} recorded. ${debt.remainingAmount > 0 ? formatNGN(debt.remainingAmount) + ' still owed.' : 'Fully paid! 🎉'}`);
}

function deleteDebt(id) {
  if (!confirm('Remove this debt record?')) return;
  appData.debts = (appData.debts || []).filter(d => d.id !== id);
  saveData(appData);
  renderDebtLedger();
  showToast('Debt record removed', 'info');
}

// ── Restock / Purchase Logger ──

function renderRestock() {
  const restocks = appData.restocks || [];

  document.getElementById('page-restock').innerHTML = `
    <div class="flex-between mb-24">
      <div>
        <div class="section-title">🛒 Restock Log</div>
        <div class="section-desc">Record stock purchases to track your real costs and profit</div>
      </div>
      <button class="btn btn-primary" onclick="openAddRestockModal()">+ Log Purchase</button>
    </div>

    <div class="card">
      ${restocks.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <div class="empty-state-title">No restock entries yet</div>
          <div class="empty-state-desc">Log every batch of stock you buy so Backlog can calculate your real profit margin</div>
          <button class="btn btn-primary" style="margin-top:20px" onclick="openAddRestockModal()">+ Log First Purchase</button>
        </div>` : `
      <table class="data-table">
        <thead><tr><th>Date</th><th>Product</th><th>Qty Bought</th><th>Unit Cost</th><th>Total Cost</th><th>Supplier</th></tr></thead>
        <tbody>
          ${restocks.slice().reverse().slice(0, 100).map(r => {
            const p = getProductById(appData, r.productId);
            return `<tr>
              <td class="text-muted text-sm">${formatDate(r.timestamp)}</td>
              <td><strong>${p?.emoji || '📦'} ${p?.name || r.productName || 'Unknown'}</strong></td>
              <td>${r.quantity} ${p?.unit || 'unit'}(s)</td>
              <td class="currency">₦${(r.unitCost || 0).toLocaleString()}</td>
              <td class="currency" style="font-weight:700;color:var(--warning);">₦${(r.totalCost || 0).toLocaleString()}</td>
              <td class="text-muted text-sm">${r.supplier || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`}
    </div>`;
}

function openAddRestockModal() {
  document.getElementById('restock-form-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Product *</label>
      <select class="form-input" id="restock-product" onchange="updateRestockTotal()">
        <option value="">Select product...</option>
        ${appData.products.map(p => `<option value="${p.id}">${p.emoji || '📦'} ${p.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Quantity Bought *</label>
        <input class="form-input" id="restock-qty" type="number" placeholder="0" min="1" oninput="updateRestockTotal()" />
      </div>
      <div class="form-group">
        <label class="form-label">Unit Cost Price (₦) *</label>
        <input class="form-input" id="restock-cost" type="number" placeholder="0" min="0" oninput="updateRestockTotal()" />
      </div>
    </div>
    <div class="card" style="background:var(--primary-dim);border-color:rgba(0,217,126,0.3);text-align:center;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-muted);">TOTAL PURCHASE COST</div>
      <div id="restock-total" style="font-size:28px;font-weight:800;color:var(--primary);">₦0</div>
    </div>
    <div class="form-group">
      <label class="form-label">Supplier (Optional)</label>
      <input class="form-input" id="restock-supplier" placeholder="e.g. Alaba Market, Kano Distributor" />
    </div>
    <div class="form-group">
      <label class="form-label">Update Stock Level?</label>
      <select class="form-input" id="restock-update-stock">
        <option value="yes">✅ Yes — add to current stock count</option>
        <option value="no">No — log cost only, I'll update stock manually</option>
      </select>
    </div>`;
  openModal('modal-add-restock');
}

function updateRestockTotal() {
  const qty = parseFloat(document.getElementById('restock-qty')?.value) || 0;
  const cost = parseFloat(document.getElementById('restock-cost')?.value) || 0;
  const el = document.getElementById('restock-total');
  if (el) el.textContent = formatNGN(qty * cost);
}

function saveRestock() {
  const productId = document.getElementById('restock-product')?.value;
  const qty = parseInt(document.getElementById('restock-qty')?.value);
  const unitCost = parseFloat(document.getElementById('restock-cost')?.value);

  if (!productId) { showToast('Please select a product', 'warning'); return; }
  if (isNaN(qty) || qty <= 0) { showToast('Please enter a valid quantity', 'warning'); return; }
  if (isNaN(unitCost) || unitCost < 0) { showToast('Please enter a valid unit cost', 'warning'); return; }

  const p = getProductById(appData, productId);
  const updateStock = document.getElementById('restock-update-stock')?.value === 'yes';

  if (!appData.restocks) appData.restocks = [];
  appData.restocks.push({
    id: 'rst_' + Date.now(),
    productId,
    productName: p?.name || '',
    quantity: qty,
    unitCost,
    totalCost: qty * unitCost,
    supplier: document.getElementById('restock-supplier')?.value?.trim() || '',
    timestamp: Date.now()
  });

  if (updateStock && p) {
    updateProduct(appData, productId, { ...p, stock: p.stock + qty });
  }

  saveData(appData);
  closeModal('modal-add-restock');
  renderRestock();
  updateLowStockBadge();
  showToast(`✅ Restock of ${qty}x ${p?.name || 'product'} logged (₦${(qty * unitCost).toLocaleString()} cost)${updateStock ? ' · Stock updated' : ''}`, 'success');
}

// ── WhatsApp Receipt ──

function shareReceiptWhatsApp(sale, product) {
  const biz = appData.business;
  const msg = encodeURIComponent(
    `🧾 *Receipt from ${biz?.name || 'Backlog'}*
` +
    `─────────────────
` +
    `📦 *${product?.name}*
` +
    `Qty: ${sale.quantity} × ₦${(sale.unitPrice || 0).toLocaleString()}
` +
    `💰 *Total: ₦${sale.amount.toLocaleString()}*
` +
    `💳 Payment: ${(sale.paymentType || 'Cash').toUpperCase()}
` +
    `📅 ${formatDate(sale.timestamp)} at ${formatTime(sale.timestamp)}
` +
    `─────────────────
` +
    `Powered by Backlog`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

// ── Daily Closing Summary ──

function showDailyClosingSummary() {
  const today = getTodaySales(appData);
  const cash = today.filter(s => s.paymentType === 'cash' || !s.paymentType).reduce((s, sale) => s + sale.amount, 0);
  const pos = today.filter(s => s.paymentType === 'pos').reduce((s, sale) => s + sale.amount, 0);
  const transfer = today.filter(s => s.paymentType === 'transfer').reduce((s, sale) => s + sale.amount, 0);
  const total = cash + pos + transfer;
  const expenses = (appData.expenses || []).filter(e => {
    const d = new Date(e.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  document.getElementById('daily-close-body').innerHTML = `
    <div style="padding:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:8px;">📊</div>
        <div style="font-size:18px;font-weight:700;">End of Day Summary</div>
        <div style="color:var(--text-muted);font-size:13px;">${new Date().toLocaleDateString('en-NG', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>

      <div class="stats-grid" style="margin-bottom:20px;">
        <div class="stat-card green">
          <div class="stat-value currency">${formatNGN(cash)}</div>
          <div class="stat-label">💵 Cash</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value currency">${formatNGN(pos)}</div>
          <div class="stat-label">💳 POS</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value currency">${formatNGN(transfer)}</div>
          <div class="stat-label">📲 Transfer</div>
        </div>
      </div>

      <div class="card" style="background:var(--primary-dim);border-color:rgba(0,217,126,0.3);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;">Total Revenue Today</div>
          <div style="font-size:24px;font-weight:900;color:var(--primary);font-family:monospace;">${formatNGN(total)}</div>
        </div>
      </div>

      ${todayExpenses > 0 ? `
      <div class="card" style="background:var(--danger-dim);border-color:rgba(255,71,87,0.3);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;">Today's Expenses</div>
          <div style="font-size:20px;font-weight:900;color:var(--danger);font-family:monospace;">${formatNGN(todayExpenses)}</div>
        </div>
      </div>
      <div class="card" style="background:var(--card);border-color:var(--border);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;">Net Cash Flow</div>
          <div style="font-size:20px;font-weight:900;color:${total - todayExpenses >= 0 ? 'var(--primary)' : 'var(--danger)'};font-family:monospace;">${formatNGN(total - todayExpenses)}</div>
        </div>
      </div>` : ''}

      <div style="color:var(--text-muted);font-size:13px;text-align:center;">${today.length} sale${today.length !== 1 ? 's' : ''} recorded today</div>
    </div>`;
  openModal('modal-daily-close');
}


// ═══════════════════════════════════════════════════════════════════════════════
// BANK INTEGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Bank Setup & Connection ──

function openBankSetup() {
  openModal('modal-bank-setup');
}

function saveBankAccount() {
  const bankName = document.getElementById('bank-select').value;
  const accountNumber = document.getElementById('bank-account-number').value;
  const accountHolder = document.getElementById('bank-account-holder').value;

  if (!bankName || !accountNumber || !accountHolder) {
    showToast('Please fill in all bank account details', 'warning');
    return;
  }

  if (accountNumber.length !== 10 || isNaN(accountNumber)) {
    showToast('Account number must be 10 digits', 'warning');
    return;
  }

  const result = initiateBankConnection(bankName, accountNumber);
  if (result.success) {
    const account = addBankAccount(appData, {
      bankName,
      accountNumber,
      accountHolder,
      apiKey: result.apiKey
    });

    saveData(appData);
    showToast(`✅ ${bankName} account linked successfully!`, 'success');
    
    // Clear form
    document.getElementById('bank-select').value = '';
    document.getElementById('bank-account-number').value = '';
    document.getElementById('bank-account-holder').value = '';

    closeModal('modal-bank-setup');
    
    // Trigger initial fetch
    pollBankTransactions(appData, account.id);
    updateReconcileBadge();
  }
}

function removeBankAccountConfirm(accountId) {
  const account = getBankAccounts(appData).find(a => a.id === accountId);
  if (!account) return;

  if (confirm(`Remove ${account.bankName} account ending in ${account.accountNumber}?`)) {
    removeBankAccount(appData, accountId);
    saveData(appData);
    showToast('Account removed', 'info');
    renderReconcile();
  }
}

// ── Reconciliation Management ──

function getUnreconciledTransfers(data) {
  return getTransactionsByStatus(data, RECONCILIATION_STATUSES.PENDING);
}

function selectReconcileTx(txId) {
  activeTxId = txId;
  matchedItems = [];
  renderReconcile();
}

function addReconcileItem(productId) {
  const p = getProductById(appData, productId);
  if (!p) return;

  const existing = matchedItems.find(m => m.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    matchedItems.push({ productId, quantity: 1 });
  }

  renderReconcile();
}

function changeReconcileQty(productId, delta) {
  const item = matchedItems.find(m => m.productId === productId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    renderReconcile();
  }
}

function removeReconcileItem(productId) {
  matchedItems = matchedItems.filter(m => m.productId !== productId);
  renderReconcile();
}

function filterReconcileProducts() {
  searchQuery = document.getElementById('reconcile-search')?.value || '';
  renderReconcile();
}

function submitReconciliation(txId) {
  if (matchedItems.length === 0) {
    showToast('Please select at least one product', 'warning');
    return;
  }

  const activeTx = getTransactionsByStatus(appData, RECONCILIATION_STATUSES.PENDING).find(t => t.id === txId);
  if (!activeTx) return;

  // Calculate item total vs transfer amount
  const itemTotal = matchedItems.reduce((acc, item) => {
    const p = getProductById(appData, item.productId);
    return acc + (p ? p.price * item.quantity : 0);
  }, 0);

  const overpayment = activeTx.amount - itemTotal; // positive = customer overpaid

  // Convert matched items to assigned products with prices
  const assignedProducts = matchedItems.map(item => {
    const p = getProductById(appData, item.productId);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: p ? p.price : 0
    };
  });

  // Create assigned transaction — tag with overpayment if any
  const assignedTx = createAssignedTransaction(appData, txId, assignedProducts);

  if (overpayment > 0 && assignedTx) {
    // Auto-credit the overpayment to the sender's wallet
    upsertCreditWallet(
      appData,
      activeTx.senderName,
      overpayment,
      `Overpayment: paid ${formatNGN(activeTx.amount)} for ${formatNGN(itemTotal)} of goods`
    );

    // Push a credit-wallet ledger entry so it appears in Sales History
    appData.sales.push({
      id: 'cw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'credit-wallet',
      customerName: activeTx.senderName,
      amount: overpayment,
      paymentType: 'transfer',
      timestamp: activeTx.timestamp || Date.now(),
      notes: `${activeTx.senderName} overpaid by ${formatNGN(overpayment)} — credited to wallet`
    });

    // Tag assigned transaction for display in reconciled tab
    assignedTx.overpayment = overpayment;
    assignedTx.itemTotal = itemTotal;
    assignedTx.reconciliationNotes =
      `Paid ${formatNGN(activeTx.amount)} for ${formatNGN(itemTotal)} goods. ${formatNGN(overpayment)} credited to wallet.`;
  }

  matchedItems = [];
  activeTxId = null;

  saveData(appData);
  refreshActiveView();

  if (overpayment > 0) {
    showToast(
      `✅ Assigned! ${activeTx.senderName} overpaid by ${formatNGN(overpayment)} — added to their credit wallet.`,
      'success', 6000
    );
  } else if (overpayment < 0) {
    // Underpaid — note it
    showToast(
      `✅ Assigned! Transfer is ${formatNGN(Math.abs(overpayment))} short of goods total. Use Split Payment to record cash portion.`,
      'warning', 6000
    );
  } else {
    showToast('✅ Perfect match — transaction assigned! Sync to update inventory.', 'success');
  }
}

function openEditTransactionModal(txId) {
  const tx = getAllTransactions(appData).find(t => t.id === txId);
  if (!tx) return;

  const body = document.getElementById('edit-transaction-body');
  body.innerHTML = `
    <div style="padding: 24px;">
      <div class="card mb-16" style="background: var(--primary-dim); border: 1px solid var(--primary); border-radius: var(--radius);">
        <div style="font-size: 13px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Transaction Details</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 16px;">${tx.senderName}</div>
            <div style="font-size: 13px; color: var(--text-muted);">${tx.bank} • ${formatDateTime(tx.timestamp)}</div>
          </div>
          <div style="font-size: 24px; font-weight: 900; color: var(--primary); font-family: monospace;">${formatNGN(tx.amount)}</div>
        </div>
      </div>

      <div class="form-label" style="margin-top: 20px; margin-bottom: 12px;">Assigned Products</div>
      <div id="edit-products-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 300px; overflow-y: auto;">
        ${(tx.assignedProducts || []).map((item, idx) => {
          const p = getProductById(appData, item.productId);
          if (!p) return '';
          return `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);">
              <div style="flex: 1;">
                <div style="font-weight: 600;">${p.emoji} ${p.name}</div>
                <div style="font-size: 12px; color: var(--text-muted);">₦${item.unitPrice.toLocaleString()} × <span id="qty-${idx}">${item.quantity}</span> = ₦${(item.unitPrice * item.quantity).toLocaleString()}</div>
              </div>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-ghost btn-sm" onclick="changeEditQty(${idx}, -1)" style="padding: 4px 8px;">−</button>
                <button class="btn btn-ghost btn-sm" onclick="changeEditQty(${idx}, 1)" style="padding: 4px 8px;">+</button>
                <button class="btn btn-danger btn-sm" onclick="removeEditProduct(${idx})">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="form-group" style="margin-top: 20px;">
        <label class="form-label">Reconciliation Notes (Optional)</label>
        <textarea id="edit-notes" class="form-input" placeholder="e.g., Wholesale order, customer return..." style="height: 100px; resize: none; font-family: inherit;">${tx.reconciliationNotes || ''}</textarea>
      </div>

      <div style="background: var(--warning-dim); border: 1px solid var(--warning); border-radius: var(--radius); padding: 16px; margin-top: 16px;">
        <div style="font-size: 13px; color: var(--text);">
          Total Matched: <strong>${formatNGN(calculateTransactionMatched(tx.assignedProducts || []))}</strong> / ${formatNGN(tx.amount)}
          <span style="float: right; ${Math.abs((calculateTransactionMatched(tx.assignedProducts || []) - tx.amount)) === 0 ? 'color: var(--primary)' : 'color: var(--warning)'}">
            ${Math.abs((calculateTransactionMatched(tx.assignedProducts || []) - tx.amount)) === 0 ? '✅ Matched' : '⚠️ Mismatch'}
          </span>
        </div>
      </div>
    </div>
  `;

  openModal('modal-edit-transaction');
}

function changeEditQty(idx, delta) {
  const tx = (appData.assignedTransactions || []).find(t => t.id === activeTxId);
  if (tx && tx.assignedProducts[idx]) {
    tx.assignedProducts[idx].quantity = Math.max(1, tx.assignedProducts[idx].quantity + delta);
    openEditTransactionModal(activeTxId);
  }
}

function removeEditProduct(idx) {
  const tx = (appData.assignedTransactions || []).find(t => t.id === activeTxId);
  if (tx) {
    tx.assignedProducts.splice(idx, 1);
    openEditTransactionModal(activeTxId);
  }
}

function saveTransactionEdit() {
  const tx = (appData.assignedTransactions || []).find(t => t.id === activeTxId);
  if (!tx) return;

  const notes = document.getElementById('edit-notes')?.value || '';
  editAssignedTransaction(appData, activeTxId, tx.assignedProducts, notes);

  saveData(appData);
  showToast('✅ Changes saved', 'success');
  closeModal('modal-edit-transaction');
  refreshActiveView();
}

function syncTransactionToInventory(txId) {
  const tx = (appData.assignedTransactions || []).find(t => t.id === txId);
  if (!tx) return;

  moveAssignedToReconciled(appData, txId);
  saveData(appData);
  showToast('✅ Transaction synced! Inventory updated.', 'success');
  refreshActiveView();
}

function unreconciledTransaction(txId) {
  const tx = (appData.reconciledTransactions || []).find(t => t.id === txId);
  if (!tx) return;

  if (confirm('This will revert the inventory changes from this transaction. Continue?')) {
    unreconciledPendingTransaction(appData, txId);
    saveData(appData);
    showToast('Transaction moved back to pending', 'info');
    refreshActiveView();
  }
}

// ── Refund Flow ──

/**
 * Opens the refund modal for a customer who has a credit wallet balance.
 * @param {string} senderName - Customer name matching the credit wallet
 * @param {string} txId - Optional: originating transaction id (for context)
 */
function issueRefund(senderName, txId) {
  const wallet = getCreditWallet(appData, senderName);
  const maxRefund = wallet ? Math.max(0, wallet.balance) : 0;

  const body = document.getElementById('refund-body');
  body.innerHTML = `
    <div style="padding: 24px;">
      <div class="credit-wallet-card" style="margin-bottom: 20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-weight:700;font-size:16px;">👤 ${senderName}</div>
          ${maxRefund > 0 ? `<span class="badge badge-green">🎁 Wallet Credit</span>` : `<span class="badge badge-red">No Balance</span>`}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--text-muted);">Credit Wallet Balance</span>
          <span style="font-size:22px;font-weight:900;color:${maxRefund > 0 ? 'var(--primary)' : 'var(--danger)'};font-family:monospace;">${formatNGN(maxRefund)}</span>
        </div>
      </div>
      ${maxRefund <= 0 ? `
        <div class="alert alert-warning">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <div class="alert-title">No Credit Balance</div>
            <div class="alert-desc">${senderName} has no credit in their wallet to refund.</div>
          </div>
        </div>` : `
        <div class="form-group">
          <label class="form-label">Refund Amount (₦) — max: ${formatNGN(maxRefund)}</label>
          <input class="form-input" id="refund-amount" type="number" min="1" max="${maxRefund}"
            value="${maxRefund}" style="font-size:22px;font-weight:800;text-align:center;" />
        </div>
        <div class="form-group">
          <label class="form-label">Refund Method</label>
          <select class="form-input" id="refund-method">
            <option value="cash">💵 Cash</option>
            <option value="transfer">📲 Bank Transfer Back</option>
          </select>
        </div>
        <div class="alert alert-info" style="margin-top:8px;margin-bottom:0;">
          <div class="alert-icon">ℹ️</div>
          <div class="alert-content">
            <div class="alert-desc">This deducts from ${senderName}'s credit wallet and records a refund entry in your ledger.</div>
          </div>
        </div>`}
    </div>`;

  const confirmBtn = document.getElementById('refund-confirm-btn');
  confirmBtn.disabled = maxRefund <= 0;
  confirmBtn.onclick = () => _confirmRefund(senderName, maxRefund);
  openModal('modal-refund');
}

function _confirmRefund(senderName, maxRefund) {
  const amountEl = document.getElementById('refund-amount');
  const methodEl = document.getElementById('refund-method');
  const amount = parseFloat(amountEl?.value);
  const method = methodEl?.value || 'cash';

  if (isNaN(amount) || amount <= 0) { showToast('Enter a valid refund amount', 'warning'); return; }
  if (amount > maxRefund) { showToast(`Cannot refund more than ${formatNGN(maxRefund)}`, 'warning'); return; }

  // Deduct from credit wallet
  upsertCreditWallet(
    appData, senderName, -amount,
    `Refund of ${formatNGN(amount)} issued via ${method}`
  );

  // Record refund in unified ledger (Sales History)
  appData.sales.push({
    id: 'ref_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type: 'refund',
    customerName: senderName,
    amount: amount,
    paymentType: method,
    timestamp: Date.now(),
    notes: `Refund of ${formatNGN(amount)} issued to ${senderName} via ${method}`
  });

  saveData(appData);
  closeModal('modal-refund');
  refreshActiveView();
  showToast(`💸 Refund of ${formatNGN(amount)} issued to ${senderName}!`, 'success', 5000);
}

// ── Bank Accounts View ──

function renderBankAccountsTab() {
  const accounts = getBankAccounts(appData);
  const stats = getReconciliationStats(appData);

  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
      ${accounts.map(acc => `
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-size: 24px;">🏦</div>
            <button class="btn btn-danger btn-sm" onclick="removeBankAccountConfirm('${acc.id}')">✕</button>
          </div>
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">${acc.bankName}</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
            •••• ${acc.accountNumber}
            <br />${acc.accountHolder}
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            Last sync: ${acc.lastSync ? formatDateTime(new Date(acc.lastSync)) : 'Never'}
          </div>
        </div>
      `).join('')}
      
      <div class="card" style="display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px dashed var(--border);" onclick="openBankSetup()">
        <div style="text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">➕</div>
          <div style="font-weight: 600; font-size: 14px;">Link Bank Account</div>
        </div>
      </div>
    </div>
  `;
}

// ── Reconciliation Summary Stats ──

function renderReconciliationStats() {
  const stats = getReconciliationStats(appData);
  
  return `
    <div class="grid-4" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-value" style="color: var(--primary);">${stats.pendingCount}</div>
        <div class="stat-label">Pending</div>
        <div class="stat-desc">${formatNGN(stats.pendingAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--warning);">${stats.assignedCount}</div>
        <div class="stat-label">Assigned</div>
        <div class="stat-desc">${formatNGN(stats.assignedAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--primary);">${stats.reconciledCount}</div>
        <div class="stat-label">Reconciled</div>
        <div class="stat-desc">${formatNGN(stats.reconciledAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.matchRate}%</div>
        <div class="stat-label">Match Rate</div>
        <div class="stat-desc">${stats.totalTransactions} total</div>
      </div>
    </div>
  `;
}

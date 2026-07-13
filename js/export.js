// ═══════════════════════════════════════════════════
// Backlog — Export Engine
// Excel (.xlsx) and Word (.docx as HTML) generation
// ═══════════════════════════════════════════════════

// ── Excel Export via SheetJS ──

function exportToExcel(data, reportType = 'full') {
  try {
    console.log('📊 Export initiated:', { reportType, dataKeys: Object.keys(data) });
    
    if (!window.XLSX) {
      console.error('XLSX library not loaded');
      showToast('Excel library not loaded. Please check your internet connection.', 'error');
      return;
    }

    if (!data || !data.sales || !data.products) {
      console.error('Invalid data structure:', data);
      showToast('Error: Data not properly initialized. Try refreshing the page.', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();
  const bizName = data.business?.name || 'Backlog Business';
  const dateStr = new Date().toLocaleDateString('en-NG');

  if (reportType === 'full' || reportType === 'sales') {
    // Sales Sheet
    const salesData = [
      ['Backlog — Sales Report', '', '', '', '', ''],
      ['Business:', bizName, '', 'Generated:', dateStr, ''],
      ['', '', '', '', '', ''],
      ['Date', 'Time', 'Product', 'Quantity', 'Unit Price (₦)', 'Amount (₦)', 'Payment Method'],
    ];

    data.sales.slice(0, 500).forEach(s => {
      const p = getProductById(data, s.productId);
      salesData.push([
        formatDate(s.timestamp),
        formatTime(s.timestamp),
        p ? p.name : 'Unknown',
        s.quantity,
        s.unitPrice || 0,
        s.amount,
        s.paymentType?.toUpperCase() || 'CASH'
      ]);
    });

    // Summary rows
    const totalRevenue = data.sales.reduce((s,x)=>s+x.amount, 0);
    const todayRev = getRevenue(getTodaySales(data));
    const weekRev = getRevenue(getSalesInRange(data, 7));
    const monthRev = getRevenue(getSalesInRange(data, 30));

    salesData.push(['', '', '', '', '', '']);
    salesData.push(['SUMMARY', '', '', '', '', '']);
    salesData.push(['Total Revenue (All Time)', '', '', '', '', totalRevenue]);
    salesData.push(['Today\'s Revenue', '', '', '', '', todayRev]);
    salesData.push(['This Week', '', '', '', '', weekRev]);
    salesData.push(['This Month', '', '', '', '', monthRev]);
    salesData.push(['Total Transactions', '', '', '', '', data.sales.length]);

    const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
    salesSheet['!cols'] = [
      {wch:14},{wch:10},{wch:22},{wch:10},{wch:16},{wch:16},{wch:16}
    ];
    XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales Report');
  }

  if (reportType === 'full' || reportType === 'inventory') {
    // Inventory Sheet
    const invData = [
      ['Backlog — Inventory Report', '', '', '', '', ''],
      ['Business:', bizName, '', 'Generated:', dateStr, ''],
      ['', '', '', '', '', ''],
      ['Product', 'Category', 'Stock', 'Unit', 'Selling Price (₦)', 'Cost Price (₦)', 'Stock Value (₦)', 'Status'],
    ];

    data.products.forEach(p => {
      const status = p.stock <= 0 ? 'OUT OF STOCK' :
                     p.stock <= (p.minStock || 10) ? 'LOW STOCK' :
                     p.stock <= (p.minStock || 10) * 2 ? 'MODERATE' : 'GOOD';
      const stockValue = p.stock * (p.costPrice || p.price * 0.7);
      invData.push([
        p.name,
        p.category || 'General',
        p.stock,
        p.unit || 'unit',
        p.price,
        p.costPrice || '',
        Math.round(stockValue),
        status
      ]);
    });

    const totalStockValue = data.products.reduce((sum, p) => {
      return sum + p.stock * (p.costPrice || p.price * 0.7);
    }, 0);

    invData.push(['', '', '', '', '', '', '', '']);
    invData.push(['TOTAL STOCK VALUE (₦)', '', '', '', '', '', Math.round(totalStockValue), '']);

    const invSheet = XLSX.utils.aoa_to_sheet(invData);
    invSheet['!cols'] = [
      {wch:22},{wch:14},{wch:10},{wch:10},{wch:18},{wch:16},{wch:16},{wch:14}
    ];
    XLSX.utils.book_append_sheet(wb, invSheet, 'Inventory');
  }

  if (reportType === 'full') {
    // Analytics Sheet
    const topProds = getTopProducts(data, 10, 30);
    const catSales = getCategorySales(data, 30);
    const payBreak = getPaymentMethodBreakdown(data, 30);
    const dailyChart = getDailySalesChart(data, 30);

    const analyticsData = [
      ['Backlog — Analytics Report (Last 30 Days)', ''],
      ['Business:', bizName],
      [''],
      ['TOP SELLING PRODUCTS', ''],
      ['Product', 'Revenue (₦)'],
      ...topProds.map(x => [x.product?.name || 'Unknown', x.revenue]),
      [''],
      ['SALES BY CATEGORY', ''],
      ['Category', 'Revenue (₦)'],
      ...catSales.map(([cat, rev]) => [cat, rev]),
      [''],
      ['PAYMENT METHODS', ''],
      ['Method', 'Amount (₦)'],
      ['Cash', payBreak.cash || 0],
      ['POS', payBreak.pos || 0],
      ['Transfer', payBreak.transfer || 0],
      ['Credit', payBreak.credit || 0],
      [''],
      ['DAILY REVENUE (LAST 30 DAYS)', ''],
      ['Date', 'Revenue (₦)', 'Transactions'],
      ...dailyChart.map(d => [d.label, d.revenue, d.count])
    ];

    const analyticsSheet = XLSX.utils.aoa_to_sheet(analyticsData);
    analyticsSheet['!cols'] = [{wch:25},{wch:18},{wch:14}];
    XLSX.utils.book_append_sheet(wb, analyticsSheet, 'Analytics');
  }

  // AI Insights Sheet
  const insights = generateInsights(data);
  const insightData = [
    ['Backlog — AI Business Insights', ''],
    ['Business:', bizName],
    ['Generated:', dateStr],
    [''],
    ['Priority', 'Type', 'Insight Title', 'Recommendation'],
    ...insights.map((ins, i) => [
      `#${i+1}`,
      ins.type.toUpperCase(),
      ins.title,
      ins.message
    ])
  ];
  if (reportType === 'full') {
    // Bank Reconciliation Sheet (only in full report)
    const stats = getReconciliationStats(data);
    const reconciled = getTransactionsByStatus(data, RECONCILIATION_STATUSES.RECONCILED);
    const pending = getTransactionsByStatus(data, RECONCILIATION_STATUSES.PENDING);
    const assigned = getTransactionsByStatus(data, RECONCILIATION_STATUSES.ASSIGNED);
    const accounts = getBankAccounts(data);

    const bankData = [
      ['Backlog — Bank Reconciliation Summary', '', '', ''],
      ['Business:', bizName, '', ''],
      ['Generated:', dateStr, '', ''],
      ['', '', '', ''],
      ['RECONCILIATION STATS', '', '', ''],
      ['Status', 'Count', 'Amount (\u20a6)', ''],
      ['Pending', stats.pendingCount, stats.pendingAmount, ''],
      ['Assigned', stats.assignedCount, stats.assignedAmount, ''],
      ['Reconciled', stats.reconciledCount, stats.reconciledAmount, ''],
      ['Match Rate', '', `${stats.matchRate}%`, ''],
    ];

    if (reconciled.length > 0) {
      bankData.push(['', '', '', '']);
      bankData.push(['RECONCILED TRANSACTIONS', '', '', '']);
      bankData.push(['Sender', 'Bank', 'Amount (\u20a6)', 'Synced Date']);
      reconciled.forEach(tx => bankData.push([
        tx.senderName, tx.bank, tx.amount,
        tx.reconciledAt ? formatDate(tx.reconciledAt) : ''
      ]));
    }

    if (pending.length > 0) {
      bankData.push(['', '', '', '']);
      bankData.push(['PENDING TRANSACTIONS', '', '', '']);
      bankData.push(['Sender', 'Bank', 'Amount (\u20a6)', 'Received']);
      pending.forEach(tx => bankData.push([
        tx.senderName, tx.bank, tx.amount, formatDate(tx.timestamp)
      ]));
    }

    if (accounts.length > 0) {
      bankData.push(['', '', '', '']);
      bankData.push(['LINKED BANK ACCOUNTS', '', '', '']);
      bankData.push(['Bank', 'Account Holder', 'Account Number', 'Last Sync']);
      accounts.forEach(acc => bankData.push([
        acc.bankName, acc.accountHolder, `****${acc.accountNumber}`,
        acc.lastSync ? formatDateTime(acc.lastSync) : 'Never'
      ]));
    }

    const bankSheet = XLSX.utils.aoa_to_sheet(bankData);
    bankSheet['!cols'] = [{wch:24},{wch:18},{wch:16},{wch:18}];
    XLSX.utils.book_append_sheet(wb, bankSheet, 'Bank Reconciliation');
  }

    // Download
    const filename = `Backlog_${bizName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    console.log('\u2705 Excel export successful:', filename);
    showToast(`\uD83D\uDCCA Excel report downloaded!`, 'success');
  } catch (error) {
    console.error('\u274C Export failed:', error);
    showToast(`Export failed: ${error.message}. Make sure your browser allows downloads.`, 'error');
  }
}

// Alias for PDF export (opens print dialog)
function exportToPDF(data) {
  printReport(data);
}

// ── Word/Business Summary Export (HTML → Word) ──

function exportToWord(data) {
  try {
    console.log('📄 Word export initiated');
    const bizName = data.business?.name || 'My Business';
  const dateStr = new Date().toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const monthRevenue = getRevenue(getSalesInRange(data, 30));
  const weekRevenue = getRevenue(getSalesInRange(data, 7));
  const todayRevenue = getRevenue(getTodaySales(data));
  const topProds = getTopProducts(data, 5, 30);
  const lowStock = getLowStockProducts(data);
  const insights = generateInsights(data).slice(0, 5);

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.6; margin: 40pt; }
  h1 { font-size: 22pt; color: #00875A; border-bottom: 3pt solid #00875A; padding-bottom: 8pt; margin-bottom: 6pt; }
  h2 { font-size: 15pt; color: #1a1a2e; margin-top: 20pt; margin-bottom: 6pt; border-left: 4pt solid #00875A; padding-left: 10pt; }
  h3 { font-size: 12pt; color: #4a4a6a; margin-top: 12pt; }
  .meta { color: #666; font-size: 10pt; margin-bottom: 20pt; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt; }
  th { background: #00875A; color: white; padding: 8pt 10pt; text-align: left; }
  td { padding: 6pt 10pt; border-bottom: 1pt solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .stat-box { display: inline-block; background: #f0faf5; border: 1pt solid #00875A; border-radius: 6pt; padding: 10pt 16pt; margin: 4pt; text-align: center; }
  .stat-val { font-size: 18pt; font-weight: bold; color: #00875A; }
  .stat-lbl { font-size: 9pt; color: #666; }
  .insight { background: #f8f9fa; border-left: 4pt solid #7B61FF; padding: 10pt; margin: 6pt 0; border-radius: 3pt; }
  .insight-title { font-weight: bold; color: #4a4a6a; }
  .badge-good { background: #e6f9f0; color: #00875A; padding: 2pt 6pt; border-radius: 3pt; font-size: 9pt; }
  .badge-low { background: #fff3cd; color: #856404; padding: 2pt 6pt; border-radius: 3pt; font-size: 9pt; }
  .badge-out { background: #f8d7da; color: #842029; padding: 2pt 6pt; border-radius: 3pt; font-size: 9pt; }
  .footer { margin-top: 40pt; border-top: 1pt solid #ccc; padding-top: 10pt; font-size: 9pt; color: #999; text-align: center; }
</style>
</head>
<body>

<h1>📊 Business Summary Report</h1>
<div class="meta">
  <strong>${bizName}</strong> &nbsp;|&nbsp; ${data.business?.state || ''} &nbsp;|&nbsp; ${data.business?.typeLabel || ''}<br>
  Generated by Backlog &nbsp;|&nbsp; ${dateStr}
</div>

<h2>Revenue Summary</h2>
<div>
  <div class="stat-box">
    <div class="stat-val">₦${todayRevenue.toLocaleString()}</div>
    <div class="stat-lbl">Today</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">₦${weekRevenue.toLocaleString()}</div>
    <div class="stat-lbl">This Week</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">₦${monthRevenue.toLocaleString()}</div>
    <div class="stat-lbl">This Month</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">${data.products.length}</div>
    <div class="stat-lbl">Products</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">${data.sales.length}</div>
    <div class="stat-lbl">Total Transactions</div>
  </div>
</div>

<h2>Top 5 Products (Last 30 Days)</h2>
<table>
  <tr><th>Rank</th><th>Product</th><th>Revenue</th><th>Current Stock</th></tr>
  ${topProds.map((x,i) => `
  <tr>
    <td>#${i+1}</td>
    <td>${x.product?.emoji || ''} ${x.product?.name || 'Unknown'}</td>
    <td><strong>₦${x.revenue.toLocaleString()}</strong></td>
    <td>${x.product?.stock} ${x.product?.unit}</td>
  </tr>`).join('')}
</table>

<h2>Inventory Status</h2>
<table>
  <tr><th>Product</th><th>Category</th><th>Stock</th><th>Price</th><th>Status</th></tr>
  ${data.products.map(p => {
    const status = p.stock <= 0 ? '<span class="badge-out">OUT OF STOCK</span>' :
                   p.stock <= (p.minStock||10) ? '<span class="badge-low">LOW STOCK</span>' :
                   '<span class="badge-good">GOOD</span>';
    return `
    <tr>
      <td>${p.emoji || ''} ${p.name}</td>
      <td>${p.category || 'General'}</td>
      <td><strong>${p.stock}</strong> ${p.unit}</td>
      <td>₦${p.price.toLocaleString()}</td>
      <td>${status}</td>
    </tr>`;
  }).join('')}
</table>

${lowStock.length > 0 ? `
<h2>⚠️ Restock Alerts</h2>
<p>The following ${lowStock.length} product(s) need immediate restocking:</p>
<ul>
  ${lowStock.map(p => `<li><strong>${p.name}</strong> — ${p.stock} ${p.unit}(s) remaining (minimum: ${p.minStock || 10})</li>`).join('')}
</ul>` : ''}

<h2>🤖 AI Recommendations</h2>
${insights.map(ins => `
<div class="insight">
  <div class="insight-title">${ins.icon} ${ins.title}</div>
  <div>${ins.message}</div>
</div>`).join('')}

<h2>Recent Sales (Last 20 Transactions)</h2>
<table>
  <tr><th>Date</th><th>Product</th><th>Qty</th><th>Amount</th><th>Payment</th></tr>
  ${data.sales.slice(0,20).map(s => {
    const p = getProductById(data, s.productId);
    return `
    <tr>
      <td>${formatDate(s.timestamp)}</td>
      <td>${p?.name || 'Unknown'}</td>
      <td>${s.quantity}</td>
      <td>₦${s.amount.toLocaleString()}</td>
      <td>${(s.paymentType||'cash').toUpperCase()}</td>
    </tr>`;
  }).join('')}
</table>

<div class="footer">
  Generated by <strong>Backlog</strong> — Nigeria Business Intelligence Platform<br>
  Every sale. Every insight. Every business.<br>
  ${new Date().toISOString()}
</div>

</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Backlog_${bizName.replace(/\s+/g,'_')}_Summary_${new Date().toISOString().slice(0,10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Word export successful');
  showToast('📄 Word document downloaded!', 'success');
  } catch (error) {
    console.error('❌ Word export failed:', error);
    showToast(`Word export error: ${error.message}`, 'error');
  }
}

// ── Print Report (PDF-ready) ──
function printReport(data) {
  try {
    console.log('🖨️ Print report initiated');
    const bizName = data.business?.name || 'My Business';
    const dateStr = new Date().toLocaleDateString('en-NG');
    const monthRevenue = getRevenue(getSalesInRange(data, 30));
    const weekRevenue = getRevenue(getSalesInRange(data, 7));
    const todayRevenue = getRevenue(getTodaySales(data));
    
    const content = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Backlog Report — ${bizName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1a1a2e; line-height: 1.6; padding: 20px; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 24px; color: #00D97E; margin: 20px 0 10px; border-bottom: 2px solid #00D97E; padding-bottom: 10px; }
  h2 { font-size: 16px; color: #1a1a2e; margin: 15px 0 8px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0; }
  .stat-card { background: #f0faf5; border: 1px solid #00D97E; border-radius: 5px; padding: 12px; text-align: center; }
  .stat-value { font-size: 20px; font-weight: bold; color: #00D97E; }
  .stat-label { font-size: 10px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #00D97E; color: white; padding: 8px; text-align: left; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .total-row { background: #e8f5e9; font-weight: bold; }
  .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #999; text-align: center; }
  @media print {
    body { padding: 0; }
    .page-break { page-break-after: always; }
  }
</style>
</head>
<body>
<div class="container">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1>📊 BACKLOG BUSINESS REPORT</h1>
    <div class="meta">
      <strong>${bizName}</strong> • Generated: ${dateStr}
    </div>
  </div>

  <h2>Revenue Summary</h2>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">₦${todayRevenue.toLocaleString()}</div>
      <div class="stat-label">TODAY</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">₦${weekRevenue.toLocaleString()}</div>
      <div class="stat-label">THIS WEEK</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">₦${monthRevenue.toLocaleString()}</div>
      <div class="stat-label">THIS MONTH</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.products.length}</div>
      <div class="stat-label">PRODUCTS</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.sales.length}</div>
      <div class="stat-label">TRANSACTIONS</div>
    </div>
  </div>

  <h2>Top 10 Products</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Product</th><th>Revenue (₦)</th><th>Stock</th></tr>
    </thead>
    <tbody>
      ${getTopProducts(data, 10, 30).map((x, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${x.product?.emoji || ''} ${x.product?.name}</td>
        <td>₦${x.revenue.toLocaleString()}</td>
        <td>${x.product?.stock} ${x.product?.unit}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Recent Sales (Last 25 Transactions)</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Product</th><th>Qty</th><th>Amount (₦)</th><th>Payment</th></tr>
    </thead>
    <tbody>
      ${data.sales.slice(0, 25).map(s => {
        const p = getProductById(data, s.productId);
        return `<tr>
          <td>${formatDate(s.timestamp)}</td>
          <td>${p?.name || 'Unknown'}</td>
          <td>${s.quantity}</td>
          <td>₦${s.amount.toLocaleString()}</td>
          <td>${(s.paymentType||'cash').toUpperCase()}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <strong>Backlog</strong> — Nigeria's Smartest SME Business Intelligence Platform<br>
    ${new Date().toISOString()}
  </div>
</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
    console.log('✅ Print report opened');
    showToast('🖨️ Report ready to print', 'success');
  } catch (error) {
    console.error('❌ Print failed:', error);
    showToast(`Print error: ${error.message}`, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BANK RECONCILIATION EXPORT
// ═══════════════════════════════════════════════════════════════════════════

function exportBankReconciliationToExcel(data) {
  try {
    console.log('🏦 Bank reconciliation export initiated');
    
    if (!window.XLSX) {
      console.error('XLSX library not loaded');
      showToast('Excel library not loaded.', 'error');
      return;
    }

    if (!data || !data.bankAccounts) {
      console.error('Bank data not initialized');
      showToast('Error: Bank data not initialized.', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();
    const bizName = data.business?.name || 'Backlog Business';
    const dateStr = new Date().toLocaleDateString('en-NG');
    const stats = getReconciliationStats(data);

    // Summary Sheet
  const summaryData = [
    ['Backlog — Bank Reconciliation Report', ''],
    ['Business:', bizName],
    ['Generated:', dateStr],
    ['', ''],
    ['RECONCILIATION SUMMARY', ''],
    ['Metric', 'Value'],
    ['Total Transactions', stats.totalTransactions],
    ['Pending (Unassigned)', stats.pendingCount],
    ['Assigned (Ready to Sync)', stats.assignedCount],
    ['Reconciled (Synced)', stats.reconciledCount],
    ['Match Rate', `${stats.matchRate}%`],
    ['', ''],
    ['AMOUNT SUMMARY', ''],
    ['Status', 'Amount (₦)'],
    ['Pending Amount', formatNGN(stats.pendingAmount)],
    ['Assigned Amount', formatNGN(stats.assignedAmount)],
    ['Reconciled Amount', formatNGN(stats.reconciledAmount)],
    ['Total Processed', formatNGN(stats.assignedAmount + stats.reconciledAmount)]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{wch:28},{wch:18}];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Pending Transactions
  const pending = getTransactionsByStatus(data, RECONCILIATION_STATUSES.PENDING);
  if (pending.length > 0) {
    const pendingData = [
      ['Pending Transactions (Awaiting Assignment)', '', '', ''],
      ['Sender', 'Bank', 'Amount (₦)', 'Received Date'],
      ...pending.map(tx => [
        tx.senderName,
        tx.bank,
        tx.amount,
        formatDate(tx.timestamp)
      ])
    ];
    const pendingSheet = XLSX.utils.aoa_to_sheet(pendingData);
    pendingSheet['!cols'] = [{wch:22},{wch:16},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb, pendingSheet, 'Pending');
  }

  // Assigned Transactions
  const assigned = getTransactionsByStatus(data, RECONCILIATION_STATUSES.ASSIGNED);
  if (assigned.length > 0) {
    const assignedData = [
      ['Assigned Transactions (Ready to Sync)', '', '', '', ''],
      ['Sender', 'Amount (₦)', 'Products Assigned', 'Matched (₦)', 'Status'],
      ...assigned.map(tx => {
        const matched = calculateTransactionMatched(tx.assignedProducts || []);
        const prodList = (tx.assignedProducts || [])
          .map(p => {
            const prod = getProductById(data, p.productId);
            return `${prod?.name} (×${p.quantity})`;
          })
          .join('; ');
        return [
          tx.senderName,
          tx.amount,
          prodList,
          matched,
          Math.abs(matched - tx.amount) === 0 ? 'Perfect Match' : 'Mismatch'
        ];
      })
    ];
    const assignedSheet = XLSX.utils.aoa_to_sheet(assignedData);
    assignedSheet['!cols'] = [{wch:22},{wch:14},{wch:40},{wch:14},{wch:16}];
    XLSX.utils.book_append_sheet(wb, assignedSheet, 'Assigned');
  }

  // Reconciled Transactions (History)
  const reconciled = getTransactionsByStatus(data, RECONCILIATION_STATUSES.RECONCILED);
  if (reconciled.length > 0) {
    const reconciledData = [
      ['Reconciled Transactions (Synced to Inventory)', '', '', '', ''],
      ['Sender', 'Bank', 'Amount (₦)', 'Products', 'Synced Date'],
      ...reconciled.map(tx => {
        const prodList = (tx.assignedProducts || [])
          .map(p => {
            const prod = getProductById(data, p.productId);
            return `${prod?.name} (×${p.quantity})`;
          })
          .join('; ');
        return [
          tx.senderName,
          tx.bank,
          tx.amount,
          prodList,
          formatDate(tx.reconciledAt)
        ];
      })
    ];
    const reconciledSheet = XLSX.utils.aoa_to_sheet(reconciledData);
    reconciledSheet['!cols'] = [{wch:22},{wch:16},{wch:14},{wch:50},{wch:16}];
    XLSX.utils.book_append_sheet(wb, reconciledSheet, 'Reconciled');
  }

  // Bank Accounts
  const accounts = getBankAccounts(data);
  if (accounts.length > 0) {
    const accountsData = [
      ['Linked Bank Accounts', '', '', ''],
      ['Bank Name', 'Account Holder', 'Account Number', 'Last Sync'],
      ...accounts.map(acc => [
        acc.bankName,
        acc.accountHolder,
        `****${acc.accountNumber}`,
        acc.lastSync ? formatDateTime(acc.lastSync) : 'Never'
      ])
    ];
    const accountsSheet = XLSX.utils.aoa_to_sheet(accountsData);
    accountsSheet['!cols'] = [{wch:20},{wch:22},{wch:18},{wch:20}];
    XLSX.utils.book_append_sheet(wb, accountsSheet, 'Bank Accounts');
  }

    // Download
    const filename = `Backlog_BankReconciliation_${bizName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    console.log('✅ Bank reconciliation export successful:', filename);
    showToast(`📊 Bank reconciliation report downloaded!`, 'success');
  } catch (error) {
    console.error('❌ Bank export failed:', error);
    showToast(`Bank export error: ${error.message}`, 'error');
  }
}

function exportBankReconciliationToWord(data) {
  try {
    console.log('🏦 Bank reconciliation Word export initiated');
    
    const bizName = data.business?.name || 'My Business';
    const dateStr = new Date().toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const stats = getReconciliationStats(data);
  const pending = getTransactionsByStatus(data, RECONCILIATION_STATUSES.PENDING);
  const assigned = getTransactionsByStatus(data, RECONCILIATION_STATUSES.ASSIGNED);
  const reconciled = getTransactionsByStatus(data, RECONCILIATION_STATUSES.RECONCILED);
  const accounts = getBankAccounts(data);

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.6; margin: 40pt; }
  h1 { font-size: 22pt; color: #00875A; border-bottom: 3pt solid #00875A; padding-bottom: 8pt; margin-bottom: 6pt; }
  h2 { font-size: 15pt; color: #1a1a2e; margin-top: 20pt; margin-bottom: 6pt; border-left: 4pt solid #00875A; padding-left: 10pt; }
  .meta { color: #666; font-size: 10pt; margin-bottom: 20pt; }
  .stat-grid { display: flex; flex-wrap: wrap; gap: 12pt; margin: 12pt 0; }
  .stat-box { flex: 1; min-width: 120pt; background: #f0faf5; border: 1pt solid #00875A; padding: 10pt; text-align: center; border-radius: 4pt; }
  .stat-val { font-size: 16pt; font-weight: bold; color: #00875A; }
  .stat-lbl { font-size: 9pt; color: #666; margin-top: 4pt; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt; }
  th { background: #00875A; color: white; padding: 8pt 10pt; text-align: left; }
  td { padding: 6pt 10pt; border-bottom: 1pt solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .footer { margin-top: 30pt; border-top: 1pt solid #ccc; padding-top: 10pt; font-size: 9pt; color: #999; text-align: center; }
</style>
</head>
<body>
  <h1>🏦 Bank Reconciliation Report</h1>
  <p class="meta">
    <strong>Business:</strong> ${bizName}<br/>
    <strong>Generated:</strong> ${dateStr}
  </p>

  <h2>Summary Statistics</h2>
  <div class="stat-grid">
    <div class="stat-box">
      <div class="stat-val">${stats.pendingCount}</div>
      <div class="stat-lbl">Pending</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${stats.assignedCount}</div>
      <div class="stat-lbl">Assigned</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${stats.reconciledCount}</div>
      <div class="stat-lbl">Reconciled</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${stats.matchRate}%</div>
      <div class="stat-lbl">Match Rate</div>
    </div>
  </div>

  <table>
    <tr>
      <th>Status</th>
      <th>Count</th>
      <th>Amount (₦)</th>
    </tr>
    <tr>
      <td>Pending</td>
      <td>${stats.pendingCount}</td>
      <td>${formatNGN(stats.pendingAmount)}</td>
    </tr>
    <tr>
      <td>Assigned</td>
      <td>${stats.assignedCount}</td>
      <td>${formatNGN(stats.assignedAmount)}</td>
    </tr>
    <tr>
      <td>Reconciled</td>
      <td>${stats.reconciledCount}</td>
      <td>${formatNGN(stats.reconciledAmount)}</td>
    </tr>
  </table>

  ${pending.length > 0 ? `
    <h2>Pending Transactions (Awaiting Assignment)</h2>
    <table>
      <tr>
        <th>Sender</th>
        <th>Bank</th>
        <th>Amount (₦)</th>
        <th>Date</th>
      </tr>
      ${pending.map(tx => `
        <tr>
          <td>${tx.senderName}</td>
          <td>${tx.bank}</td>
          <td>${formatNGN(tx.amount)}</td>
          <td>${formatDateTime(tx.timestamp)}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''}

  ${assigned.length > 0 ? `
    <h2>Assigned Transactions (Ready to Sync)</h2>
    <table>
      <tr>
        <th>Sender</th>
        <th>Amount (₦)</th>
        <th>Products</th>
        <th>Status</th>
      </tr>
      ${assigned.map(tx => {
        const matched = calculateTransactionMatched(tx.assignedProducts || []);
        const prodList = (tx.assignedProducts || [])
          .map(p => {
            const prod = getProductById(data, p.productId);
            return \`\${prod?.name} (×\${p.quantity})\`;
          })
          .join('; ');
        return \`
          <tr>
            <td>\${tx.senderName}</td>
            <td>\${formatNGN(tx.amount)}</td>
            <td>\${prodList}</td>
            <td>\${Math.abs(matched - tx.amount) === 0 ? 'Perfect Match' : 'Mismatch'}</td>
          </tr>
        \`;
      }).join('')}
    </table>
  ` : ''}

  ${accounts.length > 0 ? `
    <h2>Linked Bank Accounts</h2>
    <table>
      <tr>
        <th>Bank</th>
        <th>Account Holder</th>
        <th>Account Number</th>
        <th>Last Sync</th>
      </tr>
      ${accounts.map(acc => `
        <tr>
          <td>${acc.bankName}</td>
          <td>${acc.accountHolder}</td>
          <td>****${acc.accountNumber}</td>
          <td>${acc.lastSync ? formatDateTime(acc.lastSync) : 'Never'}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''}

  <div class="footer">
    <p>This report was automatically generated by Backlog — Nigeria's SME Business Intelligence Platform</p>
  </div>
</body>
</html>
  `;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backlog_BankReconciliation_${bizName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Bank reconciliation Word export successful');
    showToast(`📄 Bank reconciliation Word document generated!`, 'success');
  } catch (error) {
    console.error('❌ Bank Word export failed:', error);
    showToast(`Bank Word export error: ${error.message}`, 'error');
  }
}

// ═══════════════════════════════════════════════════
// Backlog — AI Insights Engine
// Rule-based intelligence + smart suggestions
// ═══════════════════════════════════════════════════

function generateInsights(data) {
  const insights = [];
  const today = getTodaySales(data);
  const week = getSalesInRange(data, 7);
  const month = getSalesInRange(data, 30);
  const lowStock = getLowStockProducts(data);
  const topProducts = getTopProducts(data, 5, 30);

  // ── Critical Stock Alerts ──
  const criticalStock = data.products.filter(p => p.stock <= 3 && p.stock > 0);
  const outOfStock = data.products.filter(p => p.stock <= 0);

  if (outOfStock.length > 0) {
    insights.push({
      type: 'critical',
      icon: '🚨',
      title: 'Out of Stock Alert',
      message: `${outOfStock.map(p=>p.name).join(', ')} ${outOfStock.length===1?'is':'are'} completely out of stock. You are losing sales right now. Reorder immediately.`,
      action: 'Go to Inventory',
      actionView: 'inventory',
      priority: 10
    });
  }

  if (criticalStock.length > 0) {
    insights.push({
      type: 'danger',
      icon: '⚠️',
      title: 'Critical Low Stock',
      message: `${criticalStock.map(p=>`${p.name} (${p.stock} left)`).join(', ')} will run out very soon.`,
      action: 'View Inventory',
      actionView: 'inventory',
      priority: 9
    });
  }

  // ── Revenue Insights ──
  const todayRevenue = getRevenue(today);
  const weekRevenue = getRevenue(week);
  const prevWeekSales = getSalesInRange(data, 14).filter(s => {
    const cutoff7 = Date.now() - 7*86400000;
    return s.timestamp < cutoff7;
  });
  const prevWeekRevenue = getRevenue(prevWeekSales);

  if (prevWeekRevenue > 0) {
    const weekGrowth = ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100;
    if (weekGrowth > 15) {
      insights.push({
        type: 'success',
        icon: '📈',
        title: 'Strong Week',
        message: `Your revenue is up ${weekGrowth.toFixed(0)}% compared to last week. ${formatNGN(weekRevenue)} earned this week vs ${formatNGN(prevWeekRevenue)} last week. Keep the momentum!`,
        action: 'View Analytics',
        actionView: 'analytics',
        priority: 7
      });
    } else if (weekGrowth < -15) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: 'Sales Dropped This Week',
        message: `Revenue is down ${Math.abs(weekGrowth).toFixed(0)}% vs last week. This week: ${formatNGN(weekRevenue)}, last week: ${formatNGN(prevWeekRevenue)}. Consider running a promotion or checking if competitors are offering lower prices.`,
        action: 'View Analytics',
        actionView: 'analytics',
        priority: 8
      });
    }
  }

  // ── Best Seller Insight ──
  if (topProducts.length > 0 && topProducts[0].product) {
    const best = topProducts[0];
    insights.push({
      type: 'info',
      icon: '🏆',
      title: 'Top Performer This Month',
      message: `${best.product.name} is your best-selling item. It generated ${formatNGN(best.revenue)} this month. Make sure you never run out — check your current stock: ${best.product.stock} ${best.product.unit}(s) remaining.`,
      action: 'View Product',
      actionView: 'inventory',
      priority: 5
    });
  }

  // ── Payment Method Insight ──
  const payBreakdown = getPaymentMethodBreakdown(data, 30);
  const totalPay = Object.values(payBreakdown).reduce((a,b)=>a+b,0);
  if (totalPay > 0) {
    const cashPct = (payBreakdown.cash / totalPay * 100).toFixed(0);
    if (cashPct > 70) {
      insights.push({
        type: 'info',
        icon: '💵',
        title: 'High Cash Dependency',
        message: `${cashPct}% of your transactions are cash-based. Consider encouraging POS or bank transfer payments — this reduces theft risk and makes your records more accurate.`,
        action: null,
        priority: 4
      });
    }
  }

  // ── Day-of-week pattern ──
  const daySales = {};
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  month.forEach(s => {
    const d = new Date(s.timestamp).getDay();
    daySales[d] = (daySales[d] || 0) + s.amount;
  });
  const sortedDays = Object.entries(daySales).sort((a,b)=>b[1]-a[1]);
  if (sortedDays.length >= 2) {
    const bestDay = dayNames[sortedDays[0][0]];
    const worstDay = dayNames[sortedDays[sortedDays.length-1][0]];
    insights.push({
      type: 'tip',
      icon: '📅',
      title: 'Your Sales Pattern',
      message: `${bestDay} is your strongest sales day this month. ${worstDay} is your slowest. Consider running a ${worstDay} special promotion to boost slow-day revenue.`,
      action: null,
      priority: 3
    });
  }

  // ── Dead stock ──
  const deadStock = data.products.filter(p => {
    const pSales = month.filter(s => s.productId === p.id);
    return pSales.length === 0 && p.stock > 0;
  });

  if (deadStock.length > 0) {
    insights.push({
      type: 'warning',
      icon: '📦',
      title: 'Dead Stock Detected',
      message: `${deadStock.slice(0,3).map(p=>p.name).join(', ')} haven't sold at all in the past 30 days. You have ${deadStock.length} product(s) sitting idle. Consider discounting or bundling these items.`,
      action: 'View Inventory',
      actionView: 'inventory',
      priority: 6
    });
  }

  // ── Restocking suggestion ──
  if (lowStock.length > 0) {
    const totalRestockCost = lowStock.reduce((sum, p) => {
      return sum + ((p.minStock || 10) * 3 * (p.costPrice || p.price * 0.7));
    }, 0);
    insights.push({
      type: 'warning',
      icon: '🛒',
      title: 'Restock Needed',
      message: `${lowStock.length} product(s) are running low. Estimated restock cost: ${formatNGN(Math.round(totalRestockCost))}. Items: ${lowStock.map(p=>p.name).join(', ')}.`,
      action: 'View Inventory',
      actionView: 'inventory',
      priority: 7
    });
  }

  // ── Today's quick summary ──
  if (today.length > 0) {
    insights.push({
      type: 'info',
      icon: '☀️',
      title: "Today's Performance",
      message: `You've made ${today.length} sale(s) today worth ${formatNGN(getRevenue(today))}. ${today.length >= 10 ? "Great day so far! 🎉" : "Keep it going — post your daily specials on WhatsApp to attract more customers."}`,
      action: null,
      priority: 5
    });
  } else {
    insights.push({
      type: 'tip',
      icon: '💡',
      title: 'No Sales Recorded Today',
      message: `You haven't recorded any sales today yet. If you made cash sales, tap "Record Sale" now to keep your records accurate.`,
      action: 'Record Sale',
      actionView: 'sales',
      priority: 6
    });
  }

  // ── Profitability ──
  const monthWithCost = month.reduce((acc, s) => {
    const p = getProductById(data, s.productId);
    if (!p || !p.costPrice) return acc;
    acc.revenue += s.amount;
    acc.cost += p.costPrice * s.quantity;
    return acc;
  }, { revenue: 0, cost: 0 });

  if (monthWithCost.revenue > 0) {
    const profit = monthWithCost.revenue - monthWithCost.cost;
    const margin = (profit / monthWithCost.revenue * 100).toFixed(1);
    insights.push({
      type: margin > 20 ? 'success' : margin > 10 ? 'info' : 'warning',
      icon: '💰',
      title: 'Profit Margin This Month',
      message: `Your estimated profit margin is ${margin}%. ${
        margin > 20 ? 'Excellent! Your pricing strategy is working well.' :
        margin > 10 ? 'Decent, but there is room to optimize your purchase costs or pricing.' :
        'Your margins are thin. Review your cost prices and consider adjusting selling prices on key items.'
      } Estimated profit: ${formatNGN(Math.round(profit))}.`,
      action: 'View Analytics',
      actionView: 'analytics',
      priority: 5
    });
  }

  return insights.sort((a,b) => b.priority - a.priority);
}

function getInsightColor(type) {
  const map = {
    critical: 'var(--danger)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    success: 'var(--primary)',
    info: 'var(--info)',
    tip: 'var(--secondary)'
  };
  return map[type] || 'var(--text-muted)';
}

function getInsightBgColor(type) {
  const map = {
    critical: 'var(--danger-dim)',
    danger: 'var(--danger-dim)',
    warning: 'var(--warning-dim)',
    success: 'var(--primary-dim)',
    info: 'rgba(0,184,255,0.1)',
    tip: 'var(--secondary-dim)'
  };
  return map[type] || 'var(--card)';
}

// ── Nigeria Demand Context (mocked national data) ──
const nigeriaStateDemand = {
  'Lagos':          { level: 10, label: 'Very High' },
  'Kano':           { level: 9,  label: 'Very High' },
  'Rivers':         { level: 8,  label: 'High' },
  'Oyo':            { level: 8,  label: 'High' },
  'Kaduna':         { level: 7,  label: 'High' },
  'Anambra':        { level: 8,  label: 'High' },
  'Imo':            { level: 7,  label: 'High' },
  'Delta':          { level: 7,  label: 'High' },
  'Akwa Ibom':      { level: 6,  label: 'Moderate' },
  'Enugu':          { level: 6,  label: 'Moderate' },
  'Cross River':    { level: 5,  label: 'Moderate' },
  'Plateau':        { level: 5,  label: 'Moderate' },
  'Abia':           { level: 6,  label: 'Moderate' },
  'FCT':            { level: 9,  label: 'Very High' },
  'Edo':            { level: 6,  label: 'Moderate' },
  'Bayelsa':        { level: 4,  label: 'Low' },
  'Ondo':           { level: 5,  label: 'Moderate' },
  'Ekiti':          { level: 4,  label: 'Low' },
  'Osun':           { level: 5,  label: 'Moderate' },
  'Ogun':           { level: 7,  label: 'High' },
  'Kwara':          { level: 5,  label: 'Moderate' },
  'Kogi':           { level: 4,  label: 'Low' },
  'Niger':          { level: 4,  label: 'Low' },
  'Kebbi':          { level: 3,  label: 'Low' },
  'Sokoto':         { level: 3,  label: 'Low' },
  'Zamfara':        { level: 2,  label: 'Very Low' },
  'Katsina':        { level: 5,  label: 'Moderate' },
  'Jigawa':         { level: 3,  label: 'Low' },
  'Bauchi':         { level: 4,  label: 'Low' },
  'Gombe':          { level: 3,  label: 'Low' },
  'Adamawa':        { level: 4,  label: 'Low' },
  'Borno':          { level: 3,  label: 'Low' },
  'Yobe':           { level: 2,  label: 'Very Low' },
  'Taraba':         { level: 3,  label: 'Low' },
  'Nassarawa':      { level: 4,  label: 'Low' },
  'Benue':          { level: 5,  label: 'Moderate' },
};

function getDemandColor(level) {
  if (level >= 9) return '#00D97E';
  if (level >= 7) return '#7B61FF';
  if (level >= 5) return '#00B8FF';
  if (level >= 3) return '#FF6B35';
  return '#555570';
}

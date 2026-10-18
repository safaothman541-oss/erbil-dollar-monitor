const fs = require('fs');
const path = require('path');
const config = require('../config');
const zohoService = require('../services/zohoService');
const telegramService = require('../services/telegramService');

const STATE_FILE = path.join(__dirname, '..', 'state', 'stock_state.json');

function ensureStateDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadState() {
  ensureStateDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {}
  }
  return { lastAlertTime: null, lastOutCount: 0, lastLowCount: 0 };
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function getThreshold(item) {
  const name = (item.name || '').toLowerCase();
  const sku = (item.sku || '').toLowerCase();
  if (name.includes('paper') || name.includes('roll') || name.includes('label') || sku.includes('8080') || sku.includes('5719')) {
    return 500;
  }
  return 2;
}

async function auditStock(options = {}) {
  const { isForce = false } = options;
  console.log('[StockAuditor] Auditing inventory in Zoho Books...');

  const items = await zohoService.getItems();
  const trackedItems = items.filter(it => it.track_inventory);

  const outOfStock = [];
  const lowStock = [];

  for (const it of trackedItems) {
    const stock = it.actual_available_stock !== undefined ? it.actual_available_stock : (it.stock_on_hand || 0);
    const threshold = getThreshold(it);

    if (stock <= 0) {
      outOfStock.push({ ...it, currentStock: stock, threshold });
    } else if (stock <= threshold) {
      lowStock.push({ ...it, currentStock: stock, threshold });
    }
  }

  const state = loadState();
  const shouldAlert = isForce || (outOfStock.length !== state.lastOutCount || lowStock.length !== state.lastLowCount);

  if (!shouldAlert && !isForce) {
    console.log('[StockAuditor] Stock levels unchanged, skipping notification.');
    return { outOfStock, lowStock };
  }

  if (outOfStock.length === 0 && lowStock.length === 0) {
    console.log('[StockAuditor] All inventory healthy, no alerts needed.');
    state.lastOutCount = 0;
    state.lastLowCount = 0;
    saveState(state);
    return { outOfStock, lowStock };
  }

  let msg = `⚠️ <b>هۆشداریی کۆگا و مەخزەنی کۆمپانیا</b>\n\n`;
  
  if (lowStock.length > 0) {
    msg += `🟡 <b>کاڵاکان کە بەرەو تەواوبوون دەچن (کەمن):</b>\n`;
    lowStock.forEach(it => {
      msg += `  • <b>${it.name}</b> (${it.sku || 'N/A'})\n`;
      msg += `    بڕی ماوە: <code>${it.currentStock.toLocaleString()}</code> | سنووری داواکردن: <code>${it.threshold}</code>\n`;
    });
    msg += `\n`;
  }

  if (outOfStock.length > 0) {
    msg += `🔴 <b>کاڵاکان کە لە مەخزەن تەواوبوون (0 دانە):</b>\n`;
    outOfStock.slice(0, 10).forEach(it => {
      msg += `  • <code>${it.sku || 'N/A'}</code> - ${it.name}\n`;
    });
    if (outOfStock.length > 10) {
      msg += `  <i>... و ${outOfStock.length - 10} کاڵای تر</i>\n`;
    }
    msg += `\n`;
  }

  msg += `💡 <i>تکایە پێش تەواوبوونی یەکجاری، داواکاری کڕینی نوێ (Purchase Order) تۆمار بکەن.</i>`;

  await telegramService.sendMessage(msg, {
    threadId: config.TOPICS.STOCK
  });

  console.log('[StockAuditor] Stock alert sent to Topic 6.');

  state.lastAlertTime = new Date().toISOString();
  state.lastOutCount = outOfStock.length;
  state.lastLowCount = lowStock.length;
  saveState(state);

  return { outOfStock, lowStock };
}

module.exports = {
  auditStock
};

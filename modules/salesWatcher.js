const fs = require('fs');
const path = require('path');
const config = require('../config');
const zohoService = require('../services/zohoService');
const telegramService = require('../services/telegramService');
const profitCalculator = require('../services/profitCalculator');
const dollarScraper = require('../services/dollarScraper');

const STATE_FILE = path.join(__dirname, '..', 'state', 'sales_state.json');

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
  return { processedInvoiceIds: [] };
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function checkNewInvoices(options = {}) {
  const { isForce = false, previewLatest = false } = options;
  console.log('[SalesWatcher] Checking for new invoices in Zoho Books...');

  const state = loadState();
  const recentInvoices = await zohoService.getRecentInvoices(10);
  if (!recentInvoices || recentInvoices.length === 0) {
    console.log('[SalesWatcher] No invoices found in Zoho.');
    return;
  }

  // Get current market dollar rate
  let currentDollarRate = 1685;
  try {
    const market = await dollarScraper.getLatestMarketRate();
    if (market && market.ratePerDollar) {
      currentDollarRate = market.ratePerDollar;
    }
  } catch (e) {}

  // If initial run and no state exists, mark all recent as seen to avoid alert storm
  if (state.processedInvoiceIds.length === 0 && !previewLatest && !isForce) {
    state.processedInvoiceIds = recentInvoices.map(inv => inv.invoice_id);
    saveState(state);
    console.log(`[SalesWatcher] Initialized state with ${state.processedInvoiceIds.length} existing invoices.`);
    return;
  }

  const invoicesToProcess = previewLatest
    ? [recentInvoices[0]]
    : recentInvoices.filter(inv => !state.processedInvoiceIds.includes(inv.invoice_id));

  if (invoicesToProcess.length === 0) {
    console.log('[SalesWatcher] No new invoices to announce.');
    return;
  }

  console.log(`[SalesWatcher] Found ${invoicesToProcess.length} new invoice(s) to process.`);

  for (const invSummary of invoicesToProcess) {
    try {
      const invoice = await zohoService.getInvoiceDetails(invSummary.invoice_id);
      if (!invoice) continue;

      let totalSalesUsd = invoice.total || 0;
      let totalCostUsd = 0;
      let totalCostIqd = 0;
      let itemsListText = '';

      if (invoice.line_items && invoice.line_items.length > 0) {
        for (const item of invoice.line_items) {
          const qty = item.quantity || 1;
          const sellRate = item.rate || 0;
          const purchaseRate = item.purchase_rate || 0;
          
          // Cost calculation
          const itemCostUsd = purchaseRate * qty;
          // Assumed purchase dollar rate ~1560 if September batch
          const itemCostIqd = itemCostUsd * 1560;

          totalCostUsd += itemCostUsd;
          totalCostIqd += itemCostIqd;

          itemsListText += `  • <b>${item.name}</b>\n`;
          itemsListText += `    بڕ: <code>${qty.toLocaleString()}</code> ${item.unit || 'دانە'} | فرۆش: <code>$${sellRate}</code> | تێچوو: <code>$${purchaseRate}</code>\n`;
        }
      }

      const totalSalesIqd = totalSalesUsd * currentDollarRate;
      const realProfitIqd = totalSalesIqd - totalCostIqd;
      const realProfitUsd = totalSalesUsd - totalCostUsd;
      const marginPct = totalSalesIqd > 0 ? (realProfitIqd / totalSalesIqd) * 100 : 0;

      let msg = `🧾 <b>وەسڵی نوێ تۆمارکرا: ${invoice.invoice_number}</b>\n\n`;
      msg += `👤 <b>کڕیار:</b> ${invoice.customer_name || 'دیارینەکراو'}\n`;
      msg += `📅 <b>بەروار:</b> ${invoice.date}\n`;
      msg += `📌 <b>دۆخ:</b> ${invoice.status.toUpperCase()}\n\n`;
      msg += `📦 <b>کاڵاکانی وەسڵ:</b>\n${itemsListText}\n`;
      msg += `---------------------------------\n`;
      msg += `💰 <b>کۆی فرۆش:</b> <b>$${totalSalesUsd.toLocaleString()}</b> (~${Math.round(totalSalesIqd).toLocaleString()} د.ع)\n`;
      msg += `📉 <b>تێچووی کڕین (FIFO):</b> $${totalCostUsd.toFixed(2)} (~${Math.round(totalCostIqd).toLocaleString()} د.ع)\n`;
      
      if (realProfitIqd >= 0) {
        msg += `📈 <b>قازانجی ڕاستەقینە:</b> <b>+${Math.round(realProfitIqd).toLocaleString()} دینار</b> (+$${realProfitUsd.toFixed(2)})\n`;
        msg += `✨ <b>ڕێژەی قازانج:</b> <b>${marginPct.toFixed(1)}%</b>\n`;
      } else {
        msg += `⚠️ <b>زەرەر:</b> ${Math.round(realProfitIqd).toLocaleString()} دینار\n`;
      }

      msg += `\n💵 <i>حیسابکراوە بەپێی نرخی بازاڕ: 1$ = ${currentDollarRate} دینار</i>`;

      await telegramService.sendMessage(msg, {
        threadId: config.TOPICS.SALES
      });

      console.log(`[SalesWatcher] Successfully announced invoice ${invoice.invoice_number} in Topic 4.`);

      if (!state.processedInvoiceIds.includes(invoice.invoice_id)) {
        state.processedInvoiceIds.push(invoice.invoice_id);
      }
    } catch (err) {
      console.error(`[SalesWatcher] Error processing invoice ${invSummary.invoice_id}:`, err);
    }
  }

  if (state.processedInvoiceIds.length > 500) {
    state.processedInvoiceIds = state.processedInvoiceIds.slice(-500);
  }

  saveState(state);
}

module.exports = {
  checkNewInvoices
};

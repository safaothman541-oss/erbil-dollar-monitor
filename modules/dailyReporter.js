const config = require('../config');
const zohoService = require('../services/zohoService');
const telegramService = require('../services/telegramService');
const dollarScraper = require('../services/dollarScraper');

async function generateDailyReport() {
  console.log('[DailyReporter] Generating daily evening report...');

  // 1. Get today's invoices
  const todayInvoices = await zohoService.getTodayInvoices();

  // 2. Get current dollar rate
  let dollarRate = 1685;
  let rawDollarText = '100=168,500';
  try {
    const market = await dollarScraper.getLatestMarketRate();
    if (market && market.ratePerDollar) {
      dollarRate = market.ratePerDollar;
      rawDollarText = market.rawText;
    }
  } catch (e) {}

  let totalSalesUsd = 0;
  let totalCostUsd = 0;
  let totalCostIqd = 0;

const fifoService = require('../services/fifoService');

  for (const invSummary of todayInvoices) {
    try {
      const inv = await zohoService.getInvoiceDetails(invSummary.invoice_id);
      totalSalesUsd += inv.total || 0;

      if (inv.line_items) {
        for (const item of inv.line_items) {
          const qty = item.quantity || 1;
          let itemCostUsd = 0;
          try {
            const fifoRes = await fifoService.getItemFifoCost(item.item_id, qty, inv.date);
            itemCostUsd = fifoRes.totalCostUsd;
          } catch (e) {
            itemCostUsd = (item.purchase_rate || 0) * qty;
          }
          totalCostUsd += itemCostUsd;
          totalCostIqd += itemCostUsd * 1560; // September baseline rate
        }
      }
    } catch (e) {}
  }

  const totalSalesIqd = totalSalesUsd * dollarRate;
  const realProfitIqd = totalSalesIqd - totalCostIqd;
  const realProfitUsd = totalSalesUsd - totalCostUsd;
  const marginPct = totalSalesIqd > 0 ? (realProfitIqd / totalSalesIqd) * 100 : 0;

  // 3. Inventory health check
  const allItems = await zohoService.getItems();
  const outOfStockCount = allItems.filter(i => i.track_inventory && (i.actual_available_stock <= 0 || i.stock_on_hand <= 0)).length;

  const dateObj = new Date();
  const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
  const baghdadTime = dateObj.toLocaleString('en-GB', options);

  let msg = `📊 <b>ڕاپۆرتی پوختەی ئێوارانی کۆمپانیای Vertex</b>\n`;
  msg += `📅 <b>بەروار و کات:</b> ${baghdadTime}\n\n`;

  msg += `💵 <b>نرخی داخستنی دۆلاری ئەمڕۆ:</b>\n`;
  msg += `   • <code>${rawDollarText}</code> (1$ = ${dollarRate.toLocaleString()} د.ع)\n\n`;

  msg += `🧾 <b>ئاماری فرۆش و وەسڵەکانی ئەمڕۆ:</b>\n`;
  msg += `   • ژمارەی وەسڵەکان: <b>${todayInvoices.length} وەسڵ</b>\n`;
  msg += `   • کۆی فرۆش: <b>$${totalSalesUsd.toLocaleString()}</b> (~${Math.round(totalSalesIqd).toLocaleString()} د.ع)\n`;
  msg += `   • کۆی تێچووی کاڵاکان: $${totalCostUsd.toFixed(2)} (~${Math.round(totalCostIqd).toLocaleString()} د.ع)\n\n`;

  msg += `📈 <b>قازانجی پوختەی ئەمڕۆ:</b>\n`;
  if (realProfitIqd >= 0) {
    msg += `   • قازانجی کاش: <b>+${Math.round(realProfitIqd).toLocaleString()} دینار</b> (+$${realProfitUsd.toFixed(2)})\n`;
    msg += `   • تێکڕای قازانج (Margin): <b>${marginPct.toFixed(1)}%</b>\n\n`;
  } else {
    msg += `   • زەرەری کاش: ${Math.round(realProfitIqd).toLocaleString()} دینار\n\n`;
  }

  msg += `📦 <b>دۆخی مەخزەن:</b>\n`;
  msg += `   • کۆی کاڵاکان لە سیستەم: ${allItems.length} بابەت\n`;
  msg += `   • کاڵای تەواوبوو لە مەخزەن: ${outOfStockCount} بابەت\n\n`;

  msg += `✨ <i>ڕۆژێکی پڕ لە خێر و سەرکەوتن بۆ هەموان!</i>`;

  await telegramService.sendMessage(msg, {
    threadId: config.TOPICS.REPORT
  });

  console.log('[DailyReporter] Daily report sent to Topic 7.');
  return msg;
}

module.exports = {
  generateDailyReport
};

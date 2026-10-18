const config = require('./config');
const telegramService = require('./services/telegramService');
const zohoService = require('./services/zohoService');
const dollarScraper = require('./services/dollarScraper');
const profitCalculator = require('./services/profitCalculator');
const salesWatcher = require('./modules/salesWatcher');
const stockAuditor = require('./modules/stockAuditor');
const dailyReporter = require('./modules/dailyReporter');
const customerStorefront = require('./modules/customerStorefront');
const pdfGenerator = require('./services/pdfPriceListGenerator');
const stickerGenerator = require('./services/qrStickerGenerator');

let lastUpdateId = 0;
let lastEveningReportDate = null;

// Build Interactive Calculator Keyboards
function getCalculatorKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🐼 Panda 80*80', callback_data: 'calc:8080P' },
        { text: '📄 Panda 80*19', callback_data: 'calc:PaperRoll-Panda' }
      ],
      [
        { text: '🧾 Panda 57*19', callback_data: 'calc:Paper Roll Panda' },
        { text: '🖨 پرینتەری Novex', callback_data: 'calc:Novex-8370' }
      ],
      [
        { text: '📋 لیستی کاڵاکانی کۆگا', callback_data: 'action:list_items' },
        { text: '💵 نرخی ئێستای دۆلار', callback_data: 'action:dollar_rate' }
      ]
    ]
  };
}

async function handleCalculatorQuery(chatId, threadId, queryText) {
  const market = await dollarScraper.getLatestMarketRate();
  const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;

  const text = queryText.trim();
  const parts = text.split(/\s+/).filter(Boolean);

  // If user entered numbers: e.g. "0.784 0.86 1000" or "/calc 0.784 0.86"
  const nums = parts.map(p => parseFloat(p.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n) && n > 0);

  if (nums.length >= 1) {
    const costUsd = nums[0];
    const sellUsd = nums.length >= 2 ? nums[1] : costUsd * 1.1;
    const qty = nums.length >= 3 ? nums[2] : 1;

    const calc = profitCalculator.calculateDetailedProfit({
      purchasePriceUsd: costUsd,
      purchaseRateIqd: 1560, // Baseline purchase rate
      sellingPriceUsd: sellUsd,
      currentMarketRateIqd: currentRate,
      quantity: qty
    });

    const reply = profitCalculator.formatReportText(calc, `کاڵای دیاریکراو ($${costUsd})`);
    await telegramService.sendMessage(reply, {
      chatId,
      threadId,
      replyMarkup: getCalculatorKeyboard()
    });
    return;
  }

  // If user searched for item name or SKU e.g. "panda" or "8080"
  const items = await zohoService.getItems();
  const matched = items.find(i => 
    (i.sku && i.sku.toLowerCase().includes(text.toLowerCase())) ||
    (i.name && i.name.toLowerCase().includes(text.toLowerCase()))
  );

  if (matched) {
    await calculateAndSendForItem(chatId, threadId, matched, currentRate);
  } else {
    let msg = `🧮 <b>حاسیبەی زیرەکی کۆمپانیای Vertex</b>\n\n`;
    msg += `دەتوانیت بە دوو شێواز نرخ و قازانج حیساب بکەیت:\n`;
    msg += `1️⃣ <b>دوگمەکان دابگرە:</b> کلیک لەسەر یەکێک لە کاڵاکانی خوارەوە بکە.\n`;
    msg += `2️⃣ <b>خۆت بنووسە:</b> بنووسە <code>تێچوو فرۆش بڕ</code>\n`;
    msg += `   نموونە: <code>0.784 0.86 1000</code>\n`;
    msg += `   یان تەنها ناوی کاڵا بنووسە: <code>8080</code> یان <code>panda</code>`;

    await telegramService.sendMessage(msg, {
      chatId,
      threadId,
      replyMarkup: getCalculatorKeyboard()
    });
  }
}

async function calculateAndSendForItem(chatId, threadId, item, currentRate) {
  const cost = item.purchase_rate || 0.784;
  const sell = item.rate || (cost * 1.15);

  const calc = profitCalculator.calculateDetailedProfit({
    purchasePriceUsd: cost,
    purchaseRateIqd: 1560,
    sellingPriceUsd: sell,
    currentMarketRateIqd: currentRate,
    quantity: 1
  });

  const reply = profitCalculator.formatReportText(calc, item.name);
  await telegramService.sendMessage(reply, {
    chatId,
    threadId,
    replyMarkup: getCalculatorKeyboard()
  });
}

async function handleCallback(cb) {
  const data = cb.data;
  const chatId = cb.message.chat.id;
  const threadId = cb.message.message_thread_id || config.TOPICS.CALCULATOR;

  await telegramService.answerCallbackQuery(cb.id);

  const market = await dollarScraper.getLatestMarketRate();
  const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;

  // Customer Storefront Callbacks
  if (data.startsWith('cat:')) {
    const cat = data.split(':')[1];
    if (cat === 'home') {
      await customerStorefront.sendWelcome(chatId);
    } else if (cat === 'contact') {
      await customerStorefront.sendContactInfo(chatId);
    } else if (cat === 'dollar') {
      let msg = `💵 <b>نرخی ئێستای دۆلاری بازاڕ:</b>\n`;
      msg += `• نرخ لە بازاڕ: <code>${market ? market.rawText : '100=168,400'}</code>\n`;
      msg += `• 1$ = <b>${currentRate.toLocaleString()} دینار</b>\n\n`;
      msg += `<i>هەموو نرخەکانی فڕۆشگا بەپێی ئەم نرخە حیساب دەکرێن.</i>`;
      await telegramService.sendMessage(msg, { chatId, replyMarkup: customerStorefront.getMainMenuKeyboard() });
    } else {
      await customerStorefront.sendCategory(chatId, cat, currentRate);
    }
    return;
  }

  if (data.startsWith('prod:')) {
    const prodId = data.replace('prod:', '');
    await customerStorefront.sendProductDetails(chatId, prodId, currentRate);
    return;
  }

  if (data.startsWith('order_start:')) {
    const prodId = data.replace('order_start:', '');
    await customerStorefront.startOrderFlow(chatId, prodId);
    return;
  }

  if (data.startsWith('order_qty:')) {
    const qty = data.replace('order_qty:', '');
    await customerStorefront.handleQuantitySelected(chatId, qty);
    return;
  }

  if (data === 'order_submit') {
    await customerStorefront.submitOrder(chatId);
    return;
  }

  if (data === 'action:download_pdf') {
    const pdfPath = require('path').join(__dirname, 'Vertex_Price_List.pdf');
    try {
      await pdfGenerator.generatePriceListPdf(pdfPath);
      await telegramService.sendDocument(pdfPath, {
        chatId,
        caption: `📄 <b>لیستی فەرمیی نرخەکانی کۆمپانیای Vertex</b>\nبەپێی داتای ئەمڕۆی Zoho Books و نرخی بازاڕ (1$ = ${currentRate} د.ع).`
      });
    } catch (e) {
      console.error('Error sending PDF:', e);
    }
    return;
  }

  // Admin button to acknowledge order
  if (data.startsWith('zoho_create_order:')) {
    const orderId = data.replace('zoho_create_order:', '');
    await telegramService.sendMessage(`✅ داواکاری #${orderId} لەلایەن تیمەوە بینرا و لە پڕۆسەی ئامادەکردن و گەیاندندایە.`, {
      chatId: config.GROUP_CHAT_ID,
      threadId: config.TOPICS.SALES
    });
    return;
  }

  // Calculator Callbacks
  if (data.startsWith('calc:')) {
    const sku = data.split(':')[1];
    const items = await zohoService.getItems();
    const item = items.find(i => (i.sku && i.sku === sku) || (i.name && i.name.includes(sku)));

    if (item) {
      await calculateAndSendForItem(chatId, threadId, item, currentRate);
    } else {
      await telegramService.sendMessage(`کاڵای [${sku}] نەدۆزرایەوە.`, { chatId, threadId });
    }
  } else if (data === 'action:list_items') {
    const items = await zohoService.getItems();
    let text = `📦 <b>لیستی کاڵاکانی کۆگا لەگەڵ نرخی کڕین و فرۆشتن:</b>\n\n`;
    const buttons = [];

    items.slice(0, 15).forEach(it => {
      text += `• <b>${it.name}</b> (${it.sku || 'N/A'})\n`;
      text += `  کڕین: $${it.purchase_rate} | فرۆش: $${it.rate} | مەخزەن: ${it.actual_available_stock || it.stock_on_hand || 0}\n\n`;
      if (buttons.length < 8 && it.sku) {
        buttons.push([{ text: `🧮 حیسابی ${it.name.slice(0, 20)}`, callback_data: `calc:${it.sku}` }]);
      }
    });

    buttons.push([{ text: '🔙 گەڕانەوە بۆ حاسیبە', callback_data: 'action:home_calc' }]);

    await telegramService.sendMessage(text, {
      chatId,
      threadId,
      replyMarkup: { inline_keyboard: buttons }
    });

  } else if (data === 'action:dollar_rate') {
    let msg = `💵 <b>نرخی ئێستای دۆلاری هەولێر:</b>\n\n`;
    msg += `• نرخ لە بازاڕ: <code>${market ? market.rawText : '100=168,400'}</code>\n`;
    msg += `• 1$ بەرامبەرە بە: <b>${currentRate.toLocaleString()} دینار</b>\n`;
    msg += `• هاوکات لەگەڵ Zoho Books بەستراوەتەوە.\n`;

    await telegramService.sendMessage(msg, {
      chatId,
      threadId,
      replyMarkup: getCalculatorKeyboard()
    });

  } else if (data === 'action:home_calc') {
    let msg = `🧮 <b>حاسیبەی نرخ و قازانجی کۆمپانیا</b>\nتکایە یەکێک لە بژاردەکان هەڵبژێرە:`;
    await telegramService.sendMessage(msg, {
      chatId,
      threadId,
      replyMarkup: getCalculatorKeyboard()
    });
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const threadId = msg.message_thread_id;
  const text = (msg.text || '').trim();
  const isPrivate = msg.chat.type === 'private';

  // --- Private Chat with Customer ---
  if (isPrivate) {
    // Check if customer is entering info during an active order
    const handledByOrder = await customerStorefront.handleTextReply(chatId, text);
    if (handledByOrder) return;

    if (text.startsWith('/calc') || text.startsWith('/price')) {
      const cleanText = text.replace(/^\/calc\s*/i, '').replace(/^\/price\s*/i, '');
      await handleCalculatorQuery(chatId, null, cleanText);
      return;
    }

    if (text.startsWith('/dollar')) {
      const market = await dollarScraper.getLatestMarketRate();
      const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;
      let dMsg = `💵 <b>نرخی ئێستای دۆلار:</b> <code>${market ? market.rawText : '100=168,400'}</code> (1$ = ${currentRate.toLocaleString()} د.ع)\n`;
      await telegramService.sendMessage(dMsg, { chatId, replyMarkup: customerStorefront.getMainMenuKeyboard() });
      return;
    }

    if (text.startsWith('/pdf')) {
      const pdfPath = require('path').join(__dirname, 'Vertex_Price_List.pdf');
      await pdfGenerator.generatePriceListPdf(pdfPath);
      await telegramService.sendDocument(pdfPath, {
        chatId,
        caption: '📄 <b>فایلی PDFی فەرمیی نرخەکانی کۆمپانیای Vertex</b>\nبەپێی داتای ئەمڕۆی Zoho Books و نرخی بازاڕ.'
      });
      return;
    }

    if (text.startsWith('/sticker')) {
      const stickerPath = require('path').join(__dirname, 'Carton_Sticker_Panda8080.pdf');
      await stickerGenerator.generateCartonStickerPdf(stickerPath);
      await telegramService.sendDocument(stickerPath, {
        chatId,
        caption: '🏷 <b>فایلی ستیکەری بارکۆدی سەر کارتۆن</b>\nقەبارەی 100x150 ملم بۆ چاپی سەر کارتۆن و داواکردنی خێرا.'
      });
      return;
    }

    if (text.startsWith('/start reorder_8080')) {
      const market = await dollarScraper.getLatestMarketRate();
      const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;
      await customerStorefront.sendProductDetails(chatId, '8080P', currentRate);
      return;
    }

    // Default in private: Show Customer Digital Storefront
    await customerStorefront.sendWelcome(chatId);
    return;
  }

  // Handle /pdf and /sticker in group as well
  if (text.startsWith('/pdf')) {
    const pdfPath = require('path').join(__dirname, 'Vertex_Price_List.pdf');
    await pdfGenerator.generatePriceListPdf(pdfPath);
    await telegramService.sendDocument(pdfPath, {
      chatId,
      threadId,
      caption: '📄 <b>فایلی PDFی فەرمیی نرخەکانی کۆمپانیای Vertex</b>'
    });
    return;
  }

  if (text.startsWith('/sticker')) {
    const stickerPath = require('path').join(__dirname, 'Carton_Sticker_Panda8080.pdf');
    await stickerGenerator.generateCartonStickerPdf(stickerPath);
    await telegramService.sendDocument(stickerPath, {
      chatId,
      threadId,
      caption: '🏷 <b>فایلی ستیکەری سەر کارتۆن بۆ چاپی ڕاستەوخۆ</b>'
    });
    return;
  }

  // --- Supergroup Topic Handlers ---
  // If command /start or /help in group
  if (text.startsWith('/start') || text.startsWith('/help')) {
    let welcome = `👋 <b>بەخێربێن بۆ سیستەمی یەکگرتووی کۆمپانیای Vertex</b>\n\n`;
    welcome += `ئەم بۆتە بەستراوەتەوە بە هەموو بەشەکانی گروپ:\n`;
    welcome += `• 💵 <b>Topic 3:</b> نرخی دۆلاری بازاڕ و نوێکردنەوەی ئۆتۆماتیکی لە Zoho\n`;
    welcome += `• 🧾 <b>Topic 4:</b> وەسڵ و داواکارییە نوێیەکانی فڕۆشگا\n`;
    welcome += `• 🧮 <b>Topic 5:</b> حاسیبەی نرخ و قازانج و پێشنیاری فرۆش\n`;
    welcome += `• ⚠️ <b>Topic 6:</b> هۆشداریی کەمی کاڵاکانی کۆگا\n`;
    welcome += `• 📊 <b>Topic 7:</b> ڕاپۆرتی ڕۆژانەی ئێواران\n\n`;
    welcome += `دەتوانیت هەر کاتێک لە بەشی حاسیبە کلیک لەسەر دوگمەکان بکەیت یان فەرمان بنووسیت.`;

    await telegramService.sendMessage(welcome, { chatId, threadId });
    return;
  }

  // Topic 7 or /report command
  if (text.startsWith('/report') || threadId === config.TOPICS.REPORT) {
    if (text.startsWith('/report') || text.includes('ڕاپۆرت') || text.includes('report')) {
      await dailyReporter.generateDailyReport();
      return;
    }
  }

  // Topic 6 or /stock command
  if (text.startsWith('/stock') || (threadId === config.TOPICS.STOCK && (text.includes('کۆگا') || text.includes('مەخزەن')))) {
    await stockAuditor.auditStock({ isForce: true });
    return;
  }

  // Topic 3 or /dollar command
  if (text.startsWith('/dollar') || (threadId === config.TOPICS.DOLLAR && text.includes('دۆلار'))) {
    const market = await dollarScraper.getLatestMarketRate();
    if (market) {
      await zohoService.updateExchangeRate(market.ratePer100);
      let dMsg = `💵 <b>نرخی ئێستای دۆلار:</b> <code>${market.rawText}</code> (1$ = ${(market.ratePer100 / 100).toLocaleString()} د.ع)\n`;
      dMsg += `🔄 هاوکات لە سیستەمی Zoho Books جێگیرکرا.`;
      await telegramService.sendMessage(dMsg, { chatId, threadId: config.TOPICS.DOLLAR });
    }
    return;
  }

  // Topic 5 or /calc command
  if (text.startsWith('/calc') || text.startsWith('/price') || threadId === config.TOPICS.CALCULATOR) {
    const cleanText = text.replace(/^\/calc\s*/i, '').replace(/^\/price\s*/i, '');
    await handleCalculatorQuery(chatId, config.TOPICS.CALCULATOR, cleanText);
    return;
  }
}

// Scheduled Background Loop (Dollar Check, Sales Check, Evening Report)
async function backgroundCycle() {
  try {
    // 1. Check dollar price & sync Zoho
    const market = await dollarScraper.getLatestMarketRate();
    if (market && market.ratePer100) {
      const stateFile = require('path').join(__dirname, 'last_state.json');
      let lastText = '';
      if (require('fs').existsSync(stateFile)) {
        try { lastText = JSON.parse(require('fs').readFileSync(stateFile, 'utf8')).text; } catch (e) {}
      }

      if (lastText !== market.rawText) {
        console.log('[Background] New dollar rate detected:', market.rawText);
        const zohoInfo = await zohoService.updateExchangeRate(market.ratePer100);
        let msg = `🔔 <b>ئاگاداری نرخی نوێی دۆلار لە بازاڕ</b>\n\n`;
        msg += `💵 <b>نرخ:</b> <code>${market.rawText}</code>\n`;
        msg += `🔄 <b>سیستەمی Zoho Books نوێکرایەوە:</b> 1$ = ${zohoInfo.ratePerDollar} د.ع`;
        await telegramService.sendMessage(msg, { threadId: config.TOPICS.DOLLAR });

        require('fs').writeFileSync(stateFile, JSON.stringify({
          channel: 'bazari_dolaraka',
          text: market.rawText,
          rate: market.ratePer100,
          time: market.time,
          updated_at: new Date().toISOString()
        }, null, 2), 'utf8');
      }
    }

    // 2. Check for new invoices
    await salesWatcher.checkNewInvoices();

    // 3. Evening Report check (8:00 PM Baghdad time = 17:00 UTC)
    const now = new Date();
    const baghdadHour = (now.getUTCHours() + 3) % 24;
    const baghdadMinute = now.getUTCMinutes();
    const todayDateStr = now.toISOString().split('T')[0];

    if (baghdadHour === 20 && baghdadMinute < 10 && lastEveningReportDate !== todayDateStr) {
      console.log('[Background] Evening report time reached (20:00 Baghdad).');
      await dailyReporter.generateDailyReport();
      lastEveningReportDate = todayDateStr;
    }

  } catch (err) {
    console.error('[BackgroundCycle] Error:', err.message);
  }
}

let isPollingActive = true;

async function runPollingLoop() {
  while (isPollingActive) {
    try {
      const updates = await telegramService.getUpdates(lastUpdateId + 1, 15);
      if (Array.isArray(updates)) {
        for (const update of updates) {
          lastUpdateId = update.update_id;

          if (update.callback_query) {
            await handleCallback(update.callback_query).catch(e => console.error('Callback error:', e.message));
          } else if (update.message) {
            await handleMessage(update.message).catch(e => console.error('Message error:', e.message));
          }
        }
      }
    } catch (err) {
      const msg = err.message || '';
      console.error('[PollLoop] Catch Error:', msg);
      if (msg.includes('Conflict')) {
        await new Promise(r => setTimeout(r, 6000));
      } else if (!msg.includes('timeout') && !msg.includes('ETIMEDOUT')) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    // Small delay between polls
    await new Promise(r => setTimeout(r, 200));
  }
}

async function start() {
  console.log('🚀 Starting Vertex Business Hub Interactive Bot...');
  
  // Send startup pinned calculator card to Topic 5
  try {
    let msg = `🧮 <b>حاسیبەی نرخ و قازانجی کۆمپانیای Vertex</b>\n\n`;
    msg += `• بۆ حیسابکردنی قازانج و دۆزینەوەی نرخی فرۆشتنی گونجاو بەپێی نرخی بازاڕی ئێستای دۆلار.\n`;
    msg += `• دەتوانیت کلیک لەسەر یەکێک لە کاڵاکانی خوارەوە بکەیت یان تەنها نرخی کڕین یان ناوی کاڵا بنووسیت:`;

    await telegramService.sendMessage(msg, {
      threadId: config.TOPICS.CALCULATOR,
      replyMarkup: getCalculatorKeyboard()
    });
    console.log('Interactive calculator menu posted to Topic 5.');
  } catch (e) {
    console.error('Failed to post initial menu:', e.message);
  }

  // Start sequential polling loop
  runPollingLoop();

  // Run background cycle every 5 minutes
  setInterval(backgroundCycle, 5 * 60 * 1000);
  backgroundCycle(); // Initial check
}

start();

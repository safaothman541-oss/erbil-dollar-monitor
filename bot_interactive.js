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
const channelPublisher = require('./modules/channelPublisher');
const whatsappBaileys = require('./services/whatsappBaileys');
const whatsappService = require('./services/whatsappService');
const dailyOutreach = require('./modules/dailyOutreach');
const groqService = require('./services/groqService');
const aiRouter = require('./services/aiRouter');
const secondBrain = require('./modules/secondBrain');
const dailyBriefing = require('./modules/dailyBriefing');
const socialContentEngine = require('./modules/socialContentEngine');
const agencyHub = require('./modules/agencyHub');
const conversationManager = require('./services/conversationManager');
const emailCalendarHub = require('./modules/emailCalendarHub');

// Global Crash Prevention Watchdogs
process.on('uncaughtException', (err) => {
  console.error('[Bot Crash Prevention] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Bot Crash Prevention] Unhandled Rejection:', reason?.message || reason);
});

let lastUpdateId = 0;
let lastEveningReportDate = null;
let lastPriceListDate = null;
let lastOutreachDate = null;
let lastNightlyQueueDate = null;
let lastReorderDate = null;
let lastBriefingDate = null;



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

  // Outreach Callbacks
  if (data.startsWith('outreach:')) {
    const action = data.replace('outreach:', '');
    if (action === 'send_file') {
      const filePath = dailyOutreach.generateQueueTextFile();
      await telegramService.sendDocument(filePath, {
        chatId,
        threadId,
        caption: `📋 <b>لیستی تەواوی ١٠٠ شوێنی ئامادەکراو بۆ واتسئاپ</b>\nبەروار: ${dailyOutreach.queue.date || 'سبەینێ'}`
      });
    } else if (action === 'toggle_pause') {
      dailyOutreach.togglePause();
      await dailyOutreach.postQueueToTelegram(chatId, threadId);
    } else if (action === 'refresh') {
      await telegramService.sendMessage('🔄 <b>دەستکرا بە پشکنینەوەی ١٠٠ دانەی نوێ...</b>', { chatId, threadId });
      await dailyOutreach.prepareNightlyQueue(100);
    } else if (action === 'start_now') {
      await telegramService.sendMessage('🚀 <b>دەستکرا بە ناردنی نامەکان هەر ئێستا...</b>', { chatId, threadId });
      dailyOutreach.executeMorningOutreach(true).catch(console.error);
    }
    return;
  }

  // Safa OS: Task Completion Callback
  if (data.startsWith('task:done:')) {
    const taskId = data.split(':')[2];
    const completed = secondBrain.completeTask(taskId);
    if (completed) {
      await telegramService.sendMessage(`🎉 <b>ئەرکی «${completed.task}» بە سەرکەوتوویی تەواو کرا! ✅</b>`, { chatId });
    }
    return;
  }
}

// =============================================================
// --- Safa OS: Personal Autonomous Executive AI Assistant ---
// =============================================================

function getSafaOSKeyboard() {
  return {
    keyboard: [
      [{ text: '🌅 ڕاپۆرتی بەیانیان' }, { text: '💰 خەرجی و دارایی' }],
      [{ text: '📋 ئەرکەکان (Tasks)' }, { text: '📅 کالێندەر و مەوعید' }],
      [{ text: '💡 بیرۆکەکان (Brain)' }, { text: '✉️ ئیمەیڵەکانی مۆبایل' }],
      [{ text: '📱 دروستکردنی پۆست' }, { text: '🏢 دۆخی VERTEX' }]
    ],
    resize_keyboard: true,
    persistent: true
  };
}

async function handleSafaVoice(msg) {
  const chatId = msg.chat.id;
  try {
    await telegramService.sendMessage('🎙 <i>خەریکی گوێگرتن لە دەنگەکەتە بە زیرەکی دەستکرد...</i>', { chatId });

    const fileId = msg.voice.file_id;
    const audioBuffer = await telegramService.downloadFile(fileId);

    // Fast Kurdish Groq Whisper
    const transcribed = await groqService.transcribeAudio(audioBuffer, 'voice.oga');
    if (!transcribed) {
      await telegramService.sendMessage('⚠️ دەنگەکە نەبیسترا یان کورت بوو. تکایە دووبارەی بکەرەوە.', { chatId });
      return;
    }

    await telegramService.sendMessage(`🗣 <b>دەقی دەنگەکەت:</b>\n<i>«${transcribed}»</i>`, { chatId });
    await handleSafaSmartText(transcribed, chatId);
  } catch (err) {
    console.error('[SafaVoice] Error:', err.message);
    await telegramService.sendMessage(`❌ هەڵە لە پڕۆسەی دەنگ: ${err.message}`, { chatId });
  }
}

async function handleSafaSmartText(text, chatId) {
  await telegramService.sendMessage('🧠 <i>سەرۆکی دیوان (Safa OS) خەریکی تاوتوێکردن و ئامادەکردنی وەڵامە...</i>', { chatId });

  try {
    const { reply, actions } = await conversationManager.chat(text);

    // 1. Send the conversational response first
    if (reply) {
      await telegramService.sendMessage(reply, { chatId });
    }

    // 2. Process any agreed-upon actions
    if (actions && actions.length > 0) {
      for (const act of actions) {
        if (act.type === 'EXPENSE') {
          const item = act.item;
          const summary = secondBrain.getExpensesSummary();
          let msg = `💰 <b>خەرجی تۆمارکرا لە مێشکی دووەم:</b>\n`;
          msg += `• <b>بڕ:</b> ${item.amount.toLocaleString()} ${item.currency} (${item.category})\n`;
          if (item.note) msg += `• <b>تێبینی:</b> ${item.note}\n`;
          msg += `📊 کۆی ئەم مانگە: ${summary.totalIQD.toLocaleString()} د.ع`;
          await telegramService.sendMessage(msg, { chatId });
        } else if (act.type === 'TASK') {
          const item = act.item;
          let msg = `📋 <b>ئەرک زیادکرا بۆ خشتەکەت:</b>\n`;
          msg += `• #${item.id}: <b>${item.task}</b>\n`;
          if (item.dueDate) msg += `• کات: ${item.dueDate}\n`;
          msg += `• ئاستی گرنگی: ${item.priority}`;
          await telegramService.sendMessage(msg, { chatId });
        } else if (act.type === 'IDEA') {
          const item = act.item;
          let msg = `💡 <b>بیرۆکە پارێزرا لە مێشکی دووەم:</b>\n`;
          msg += `• <b>${item.title}</b>\n`;
          if (item.tags && item.tags.length > 0) msg += `🏷 ${item.tags.map(t => `#${t}`).join(' ')}`;
          await telegramService.sendMessage(msg, { chatId });
        } else if (act.type === 'CALENDAR') {
          const cal = act.item;
          let cap = `📅 <b>مەوعیدی نوێ بۆ کالێندەر ئامادەکرا!</b>\n\n`;
          cap += `• <b>ناونیشان:</b> ${cal.event.title}\n`;
          cap += `• <b>کات:</b> ${new Date(cal.event.start).toLocaleString('en-GB')}\n\n`;
          cap += `📲 <b>بۆ زیادکردن بۆ مۆبایلەکەت:</b>\n`;
          cap += `فایلی هاوپێچکراوی خوارەوە دابەزێنە یان دوگمەی خوارەوە لێبدە بۆ گووگڵ کالێندەر!`;

          const gcalKeyboard = {
            inline_keyboard: [
              [{ text: '📅 زیادکردن بۆ Google Calendar بە ۱ کلیک', url: cal.googleCalendarUrl }]
            ]
          };

          if (fs.existsSync(cal.filePath)) {
            await telegramService.sendDocument(cal.filePath, {
              chatId,
              caption: cap,
              replyMarkup: gcalKeyboard
            });
          } else {
            await telegramService.sendMessage(cap, { chatId, replyMarkup: gcalKeyboard });
          }
        } else if (act.type === 'EMAIL') {
          const em = act.item;
          let msg = `✉️ <b>ڕەشنووسی ئیمەیڵ ئامادەیە:</b>\n\n`;
          msg += `• <b>بۆ:</b> ${em.to || 'دیاری نەکراوە'}\n`;
          msg += `• <b>سەردێڕ:</b> ${em.subject}\n`;
          msg += `• <b>دەق:</b>\n<i>${em.body}</i>\n\n`;
          msg += `دەتوانیت بە یەک کلیک لە ئەپی Gmail بیکەیتەوە و بینێریت:`;

          const emailKeyboard = {
            inline_keyboard: [
              [{ text: '🚀 کردنەوە و ناردن لە Gmail', url: em.composeUrl }]
            ]
          };
          await telegramService.sendMessage(msg, { chatId, replyMarkup: emailKeyboard });
        } else if (act.type === 'DEVICE') {
          const cmd = act.item;
          let msg = `📲 <b>فەرمانی کارپێکردنی مۆبایل (${cmd.type}) نێردرا:</b>\n`;
          if (cmd.payload && (cmd.payload.target || cmd.payload.number)) {
            msg += `• ئامانج / ژمارە: <code>${cmd.payload.target || cmd.payload.number}</code>\n`;
          }
          if (cmd.payload && cmd.payload.message) {
            msg += `• دەق: <i>${cmd.payload.message}</i>\n`;
          }
          msg += `⚡ فەرمان ڕەوانەی بریکاری SafaDroid لەسەر مۆبایلەکەت کرا...`;
          await telegramService.sendMessage(msg, { chatId });
        }
      }
    }
  } catch (err) {
    console.error('[ProcessSmartText] Error:', err.message);
    await telegramService.sendMessage(`⚠️ کێشەیەک ڕوویدا: ${err.message}`, { chatId });
  }
}

async function handleSafaMessage(chatId, text) {
  if (text === '/start' || text === '/menu') {
    let welcome = `👑 <b>بەخێربێیت کاکە سەفا بۆ Safa OS (سیستەمی هۆشمەندی ژیانت)</b>\n\n`;
    welcome += `ئەم چاتە مێشکی دووەمتە و ۲٤ کاتژمێر لە خزمەتتاندایە:\n`;
    welcome += `• 🎙 <b>دەنگ بنێرە:</b> خەرجییەکانت، بیرۆکەکانت، یان ئەرکەکانت بڵێ و سیستەم خۆی دەیکاتە کردار.\n`;
    welcome += `• 🌅 <b>ڕاپۆرتی بەیانیان:</b> کەشوهەوای هەولێر، دارایی، ئەرکەکان و سێرڤەر.\n`;
    welcome += `• 📱 <b>سۆشیال میدیا:</b> بە یەک تێکست پۆستی LinkedIn, Twitter, Reels دروست بکە.\n`;
    welcome += `• 💼 <b>مۆنیتایزینگ:</b> پێشنیاری پڕۆژەی گەورە دروست بکە بە فەرمانی <code>/pitch [بوار] [ناوی کڕیار]</code>\n\n`;
    welcome += `دوگمەکانی خوارەوە هەڵبژێرە یان ڕاستەوخۆ دەنگ و دەق بنێرە:`;

    await telegramService.sendMessage(welcome, {
      chatId,
      replyMarkup: getSafaOSKeyboard()
    });
    return;
  }

  // Button: 🌅 ڕاپۆرتی بەیانیان
  if (text === '🌅 ڕاپۆرتی بەیانیان' || text === '/briefing') {
    await telegramService.sendMessage('⏳ <i>خەریکی ئامادەکردنی نوێترین زانیارییەکانی هەولێر و کۆمپانیایە...</i>', { chatId });
    const brief = await dailyBriefing.generateExecutiveBriefing();
    await telegramService.sendMessage(brief, { chatId });
    return;
  }

  // Button: 💰 خەرجی و دارایی
  if (text === '💰 خەرجی و دارایی' || text === '/expenses') {
    const summary = secondBrain.getExpensesSummary();
    let reply = `💰 <b>پووختەی دارایی و خەرجییەکانت (ئەم مانگە)</b>\n\n`;
    reply += `• <b>کۆی خەرجی بە دینار:</b> <b>${summary.totalIQD.toLocaleString()} د.ع</b>\n`;
    reply += `• <b>کۆی خەرجی بە دۆلار:</b> <b>$${summary.totalUSD.toLocaleString()}</b>\n`;
    reply += `• <b>ژمارەی خەرجی تۆمارکراو:</b> ${summary.count}\n\n`;

    if (Object.keys(summary.byCategory).length > 0) {
      reply += `📊 <b>دابەشبوون بەپێی بەشەکان:</b>\n`;
      for (const [cat, amt] of Object.entries(summary.byCategory)) {
        reply += `• ${cat}: ${amt.toLocaleString()} د.ع\n`;
      }
      reply += `\n`;
    }

    if (summary.recent.length > 0) {
      reply += `🕒 <b>دوایین خەرجییەکان:</b>\n`;
      summary.recent.forEach(r => {
        reply += `• ${r.dateFormatted}: ${r.amount.toLocaleString()} ${r.currency} (${r.category}) ${r.note ? `- ${r.note}` : ''}\n`;
      });
    }

    reply += `\n💡 <i>دەتوانیت هەر کاتێک تەنها بە دەنگ بڵێیت «١٥ هەزارم دا بە نانخواردن» یەکسەر تۆماری دەکات.</i>`;
    await telegramService.sendMessage(reply, { chatId });
    return;
  }

  // Button: 📋 ئەرکەکان (Tasks)
  if (text === '📋 ئەرکەکان (Tasks)' || text === '/tasks') {
    const pending = secondBrain.getPendingTasks();
    if (pending.length === 0) {
      await telegramService.sendMessage('🎉 <b>دەستخۆش کاک سەفا! هیچ ئەرکێکی هەڵپەسێردراو لە خشتەکەتدا نییە.</b>', { chatId });
      return;
    }

    let reply = `📋 <b>ئەرکە هەنووکەییەکانت (${pending.length} ئەرک):</b>\n\n`;
    const inlineKeyboard = [];

    pending.forEach(t => {
      reply += `• <b>[#${t.id}] ${t.task}</b>\n`;
      if (t.dueDate) reply += `  ⏰ کات: ${t.dueDate}\n`;
      reply += `  ⚡ گرنگی: ${t.priority}\n\n`;

      inlineKeyboard.push([
        { text: `✅ تەواوکردنی #${t.id}: ${t.task.slice(0, 20)}`, callback_data: `task:done:${t.id}` }
      ]);
    });

    await telegramService.sendMessage(reply, {
      chatId,
      replyMarkup: { inline_keyboard: inlineKeyboard }
    });
    return;
  }

  // Button: 💡 بیرۆکەکان (Brain)
  if (text === '💡 بیرۆکەکان (Brain)' || text === '/brain') {
    const ideas = secondBrain.getRecentIdeas(5);
    if (ideas.length === 0) {
      await telegramService.sendMessage('💡 <b>هێشتا هیچ بیرۆکەیەک لە مێشکی دووەم تۆمار نەکراوە.</b>\nتەنها بە دەنگ یان دەق بڵێ «بیرۆکەیەکم هەیە بۆ...» تا یەکسەر تۆماری بکات.', { chatId });
      return;
    }

    let reply = `🧠 <b>مێشکی دووەم - دوایین بیرۆکە تۆمارکراوەکان:</b>\n\n`;
    ideas.forEach((item, idx) => {
      reply += `${idx + 1}. <b>${item.title}</b>\n`;
      reply += `   ${item.analysis}\n`;
      if (item.tags && item.tags.length > 0) {
        reply += `   🏷 ${item.tags.map(t => `#${t}`).join(' ')}\n`;
      }
      reply += `\n`;
    });
    await telegramService.sendMessage(reply, { chatId });
    return;
  }

  // Button: 📱 دروستکردنی پۆست
  if (text === '📱 دروستکردنی پۆست') {
    await telegramService.sendMessage('✍️ تکایە بە دەنگ یان دەق ئەو بیرۆکەیە بنێرە کە دەتەوێت بیکەیتە پۆستی سۆشیال میدیا.\n(نموونە: <i>«بۆچی سیستەمی ئۆتۆماتیک بۆ بازاڕی عێراق پێویستە»</i>)', { chatId });
    return;
  }

  // Button: 🏢 دۆخی VERTEX
  if (text === '🏢 دۆخی VERTEX' || text === '/vertex') {
    const v = await dailyBriefing.getVertexStatus();
    let reply = `🏢 <b>دۆخی ڕاستەوخۆی ژێرخانی کۆمپانیای VERTEX:</b>\n\n`;
    reply += `• سێرڤەری کلاود (AlwaysData): ${v.server === 'online' ? '🟢 کارایە (Online)' : '🔴 ناچالاکە'}\n`;
    reply += `• واتسئاپ بزنس: ${v.wa ? `🟢 بەستراوە بە ژمارەی ${v.user}` : '⚠️ دابڕاوە'}\n`;
    reply += `• ئەپی داواکاری کلاود: <a href="${config.VERTEX.WEB_PORTAL_URL}">بینین لە براوسەر</a>\n\n`;
    reply += `💡 <i>سیستەمەکە سبەینێ سەعات ۱۰:۳۰ خۆکارانە ۱۰۰ مارکێت بەسەردەکاتەوە.</i>`;
    await telegramService.sendMessage(reply, { chatId });
    return;
  }

  // Button: 📅 کالێندەر و مەوعید
  if (text === '📅 کالێندەر و مەوعید' || text === '/calendar') {
    const upcoming = emailCalendarHub.getUpcomingEvents();
    let reply = `📅 <b>کالێندەر و مەوعیدەکانی مۆبایلت</b>\n\n`;
    if (upcoming.length === 0) {
      reply += `هیچ مەوعیدێکی ئاییندە تۆمار نەکراوە.\n\n`;
    } else {
      reply += `<b>مەوعیدە نزیکەکان (${upcoming.length}):</b>\n`;
      upcoming.forEach((ev, idx) => {
        const dStr = new Date(ev.start).toLocaleString('en-GB');
        reply += `${idx + 1}. <b>${ev.title}</b>\n   ⏰ ${dStr}\n`;
        if (ev.description) reply += `   📝 ${ev.description}\n`;
      });
      reply += `\n`;
    }
    reply += `💡 <b>چۆن مەوعید زیاد بکەیت؟</b>\n`;
    reply += `• تەنها بە دەنگ یان دەق بڵێ: <i>«سبەینێ سەعات ٤ کۆبوونەوەم هەیە لەگەڵ بەڕێوەبەری کۆمپانیا»</i>، Safa OS فایلی کالێندەر (.ics) و لینکی ۱-کلیکی گووگڵت بۆ دەنێرێت تا ڕاستەوخۆ بخرێتە ناو مۆبایلەکەت!\n`;
    reply += `• یان فەرمانی: <code>/add_event [سەردێڕ] [بەروار و کات]</code> بنێرە.`;
    await telegramService.sendMessage(reply, { chatId });
    return;
  }

  // Command: /add_event [title] [date]
  if (text.startsWith('/add_event')) {
    const clean = text.replace(/^\/add_event\s*/i, '').trim();
    if (!clean) {
      await telegramService.sendMessage('تکایە بەم شێوازە بنێرە:\n<code>/add_event کۆبوونەوە 2026-10-22 15:00</code>', { chatId });
      return;
    }
    const cal = emailCalendarHub.generateIcsFile(clean, new Date().toISOString(), 60);
    const gcalKeyboard = {
      inline_keyboard: [
        [{ text: '📅 زیادکردن بۆ Google Calendar بە ۱ کلیک', url: cal.googleCalendarUrl }]
      ]
    };
    await telegramService.sendDocument(cal.filePath, {
      chatId,
      caption: `✅ مەوعیدی <b>«${clean}»</b> ئامادەکرا! فایلی سەرەوە دابەزێنە یان دوگمەی خوارەوە دابگرە بۆ زیادکردن بۆ مۆبایلەکەت.`,
      replyMarkup: gcalKeyboard
    });
    return;
  }

  // Button: ✉️ ئیمەیڵەکانی مۆبایل
  if (text === '✉️ ئیمەیڵەکانی مۆبایل' || text === '/email') {
    const status = emailCalendarHub.getStatus();
    if (!status.emailConfigured) {
      let reply = `✉️ <b>بەستنەوەی ئیمەیڵی مۆبایل بە Safa OS</b>\n\n`;
      reply += `ئەم تایبەتمەندییە ڕێگەت پێدەدات بە دەنگ یان دەق نامەکانی ناو ئیمەیڵەکەت ببینی، وەڵام بنووسیت و کورتەی ئیمەیڵە گرنگەکان وەربگریت.\n\n`;
      reply += `🔑 <b>چۆن بە ۱ خولەک بیبەستیتەوە؟</b>\n`;
      reply += `١. بڕۆ بۆ هەژماری گووگڵەکەت (Google Account) -> بەشی Security -> دواتر <b>App Passwords</b> دروست بکە (ناوی بنێ SafaOS).\n`;
      reply += `٢. کۆدی ۱٦ پیتییەکە وەرگرە و لێرە بەم شێوازە بینێرە:\n`;
      reply += `<code>/connect_email example@gmail.com xxxx xxxx xxxx xxxx</code>\n\n`;
      reply += `🛡 <i>تێبینی: لەبەر سەلامەتی، سیستەمەکە ڕاستەوخۆ لە ڕێگەی پرۆتۆکۆڵی پارێزراوی TLS/IMAP لە کلاود دەبەسترێتەوە بەبێ پێویستی بە تێپەڕەوشەی سەرەکیت.</i>`;
      await telegramService.sendMessage(reply, { chatId });
      return;
    }

    await telegramService.sendMessage('📬 <i>خەریکی پشکنینی سندوقی ئیمەیڵەکەتە لە کلاود...</i>', { chatId });
    const res = await emailCalendarHub.fetchRecentUnreadEmails(5);
    if (!res.success) {
      await telegramService.sendMessage(`⚠️ ناتوانرا سندوقی ئیمەیڵ بپشکنرێت: ${res.message}`, { chatId });
      return;
    }

    if (res.count === 0) {
      await telegramService.sendMessage(`🎉 <b>هیچ ئیمەیڵێکی نوێ و نەخوێندراوە لە سندوقی ${status.emailAddress} نییە!</b>`, { chatId });
      return;
    }

    let reply = `📬 <b>ئیمەیڵە نوێ و نەخوێندراوەکانت (${res.count}):</b>\n\n`;
    res.emails.forEach((em, idx) => {
      reply += `${idx + 1}. <b>لە:</b> ${em.from}\n`;
      reply += `   <b>سەردێڕ:</b> ${em.subject}\n`;
      if (em.date) reply += `   ⏰ ${em.date}\n`;
      reply += `\n`;
    });
    reply += `💡 <i>دەتوانیت بڵێیت: «وەڵامێکی فەرمی بنووسە بۆ یەکەمیان» تا Safa OS ڕەشنووسەکەت بۆ ئامادە بکات.</i>`;
    await telegramService.sendMessage(reply, { chatId });
    return;
  }

  // Command: /connect_email [email] [app_password]
  if (text.startsWith('/connect_email')) {
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await telegramService.sendMessage('⚠️ تکایە بەم شێوازە بینێرە:\n<code>/connect_email yourname@gmail.com app_password</code>', { chatId });
      return;
    }
    const email = parts[1];
    const pass = parts.slice(2).join('');
    emailCalendarHub.configureEmail(email, pass, 'gmail');
    await telegramService.sendMessage(`✅ <b>ئیمەیڵی ${email} بە سەرکەوتوویی لە Safa OS تۆمارکرا!</b>\nئێستا دەتوانیت بە دوگمەی «✉️ ئیمەیڵەکانی مۆبایل» سندوقی نامەکانت بپشکنیت.`, { chatId });
    return;
  }

  // Command: /device or دۆخی مۆبایل
  if (text === '/device' || text === '📱 دۆخی مۆبایل') {
    const androidBridge = require('./modules/androidBridge');
    const st = androidBridge.getDeviceStatus();
    let reply = `📱 <b>دۆخی ڕاستەوخۆی مۆبایلی ئەندرۆید (SafaDroid):</b>\n\n`;
    reply += `• <b>دۆخی پەیوەندی:</b> ${st.online ? '🟢 بەستراوەتەوە (Online)' : '🔴 ناچالاکە (Offline)'}\n`;
    if (st.lastSeen) {
      reply += `• <b>دوایین پەیوەندی:</b> پێش ${st.secondsAgo} چرکە\n`;
    }
    if (st.battery !== null) {
      reply += `• <b>پاتری:</b> ${st.battery}%\n`;
    }
    if (st.charging !== null) {
      reply += `• <b>شەحن:</b> ${st.charging ? '⚡ لەسەر شەحنە' : '🔌 لە شەحن نییە'}\n`;
    }
    if (!st.online) {
      reply += `\n💡 <i>بۆ دەستپێکردنەوە لەسەر مۆبایلت، لەناو Termux فەرمانی <code>node agent.js</code> بنووسە.</i>`;
    }
    await telegramService.sendMessage(reply, { chatId });
    return;
  }

  // Command: /clear or /reset
  if (text === '/clear' || text === '/reset') {
    conversationManager.clearHistory();
    await telegramService.sendMessage('🧹 <b>مێژووی گفتوگۆ پاککرایەوە!</b> ئێستا وەک سەرەتایەکی نوێ لە خزمەتتاندام کاکە سەفا.', { chatId });
    return;
  }

  // Monetization Command: /pitch [sector] [name]
  if (text.startsWith('/pitch')) {
    const parts = text.split(/\s+/);
    const sector = parts[1] || 'کۆمپانیا و مارکێت';
    const name = parts.slice(2).join(' ') || 'کڕیاری بەڕێز';

    await telegramService.sendMessage(`💼 <i>خەریکی داڕشتنی گەورەترین پێشنیاری فرۆشتنی ئۆتۆمەیشنە بۆ «${name}»...</i>`, { chatId });
    const proposal = await agencyHub.generateClientProposal(sector, name);
    await telegramService.sendMessage(proposal, { chatId });
    return;
  }

  // General Smart Text: Route to AI
  await handleSafaSmartText(text, chatId);
}


async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const threadId = msg.message_thread_id;
  const text = (msg.text || '').trim();
  const isPrivate = msg.chat.type === 'private';

  // --- Private Chat ---
  if (isPrivate) {
    // 1. Safa OS: If message is from Safa (Owner / Admin)
    if (String(chatId) === String(config.ADMIN_USER_ID)) {
      await handleSafaMessage(chatId, text);
      return;
    }

    // 2. Otherwise: Private Chat with customer
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

  // Publish to public channel @vertexiqzone
  if (text.startsWith('/publish_all')) {
    await channelPublisher.publishAllShowcase();
    await telegramService.sendMessage('🚀 <b>سەرجەم ٥ پۆستە سەرەکییەکە لە چەناڵی @vertexiqzone بڵاوکرانەوە.</b>', { chatId, threadId });
    return;
  }

  if (text.startsWith('/publish') || text.startsWith('/post')) {
    const market = await dollarScraper.getLatestMarketRate();
    const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;
    await channelPublisher.publishDailyPriceList(null, currentRate);
    await telegramService.sendMessage('📄 <b>فایلی فەرمیی نرخی ئەمڕۆ لە چەناڵی @vertexiqzone بڵاوکرایەوە.</b>', { chatId, threadId });
    return;
  }

  // WhatsApp Cloud API commands
  if (text.startsWith('/whatsapp') || text.startsWith('/wa')) {
    if (text.startsWith('/wa_test')) {
      const parts = text.split(/\s+/);
      const targetPhone = parts[1] || '9647507586992';
      try {
        await whatsappService.sendKurdishInvoice(targetPhone, {
          invoiceNumber: 'INV-TEST-01',
          customerName: 'تێستی واتسئاپ',
          totalAmount: '$100 (~168,500 د.ع)',
          date: new Date().toISOString().split('T')[0]
        });
        await telegramService.sendMessage(`✅ وەسڵی تێستی کوردی بە سەرکەوتوویی بۆ <code>${targetPhone}</code> نێردرا!`, { chatId, threadId });
      } catch (err) {
        await telegramService.sendMessage(`❌ کێشە لە ناردنی واتسئاپ: ${err.message}`, { chatId, threadId });
      }
      return;
    }

    let waMsg = `📱 <b>سیستەمی فەرمیی WhatsApp Cloud API - Vertex</b>\n\n`;
    waMsg += `• <b>دۆخی سێرڤەر:</b> چالاکە (Active)\n`;
    waMsg += `• <b>WABA ID:</b> <code>${config.WHATSAPP.BUSINESS_ACCOUNT_ID}</code>\n`;
    waMsg += `• <b>Phone ID:</b> <code>${config.WHATSAPP.PHONE_NUMBER_ID}</code>\n`;
    waMsg += `• <b>وەڵامدانەوەی خودکار:</b> لەسەر پۆرت ${config.WHATSAPP.PORT}\n`;
    waMsg += `• <b>تێمپلەیتی پسوولەی پەسەندکراو:</b> <code>vertex_invoice_kurdish_v1</code>\n\n`;
    waMsg += `بۆ ناردنی وەسڵی تێست بۆ واتسئاپ:\n<code>/wa_test 0750xxxxxxx</code>`;
    await telegramService.sendMessage(waMsg, { chatId, threadId });
    return;
  }

  // --- Outreach & Marketing Queue Management Commands ---
  if (text.startsWith('/queue') || text.startsWith('/outreach')) {
    if (text.startsWith('/outreach_prepare') || text.startsWith('/prepare_queue')) {
      await telegramService.sendMessage('🔍 <b>دەستکرا بە پشکنینی واتسئاپ و ئامادەکردنی ١٠٠ مارکێت بۆ سبەینێ...</b>\nتکایە کەمێک چاوەڕوان بە.', { chatId, threadId });
      await dailyOutreach.prepareNightlyQueue(100);
      return;
    }

    if (text.startsWith('/outreach_list')) {
      const filePath = dailyOutreach.generateQueueTextFile();
      await telegramService.sendDocument(filePath, {
        chatId,
        threadId,
        caption: `📋 <b>لیستی تەواوی ١٠٠ شوێنی ئامادەکراو بۆ واتسئاپ</b>\nبەروار: ${dailyOutreach.queue.date || 'سبەینێ'}\nدەتوانیت بە فەرمانی <code>/remove ژمارە</code> هەر یەکێکیان لابدەیت.`
      });
      return;
    }

    if (text.startsWith('/outreach_test')) {
      const parts = text.split(/\s+/);
      const testPhone = parts[1];
      if (!testPhone) {
        await telegramService.sendMessage('⚠️ تکایە ژمارەکە دیاری بکە: <code>/outreach_test 0750xxxxxxx</code>', { chatId, threadId });
        return;
      }
      await telegramService.sendMessage(`⏳ لە ناردندایە بۆ <code>${testPhone}</code>...`, { chatId, threadId });
      const res = await dailyOutreach.sendTestMessage(testPhone);
      if (res.success) {
        await telegramService.sendMessage(`✅ نامەی فەرمیی ڤێرتێکس بە سەرکەوتوویی بۆ <code>${testPhone}</code> نێردرا!`, { chatId, threadId });
      } else {
        await telegramService.sendMessage(`❌ ئەم ژمارەیە واتسئاپی نییە یان کێشەیەک ڕوویدا: ${res.reason}`, { chatId, threadId });
      }
      return;
    }

    // Default: Show queue status & options
    await dailyOutreach.postQueueToTelegram(chatId, threadId);
    return;
  }

  // Remove number from outreach queue
  if (text.startsWith('/remove') || text.startsWith('/skip')) {
    const parts = text.split(/\s+/);
    const phoneToDel = parts[1];
    if (!phoneToDel) {
      await telegramService.sendMessage('⚠️ تکایە ژمارەی مۆبایلەکە دیاری بکە: <code>/remove 0750xxxxxxx</code>', { chatId, threadId });
      return;
    }
    const removedItem = dailyOutreach.removeNumber(phoneToDel);
    if (removedItem) {
      await telegramService.sendMessage(`❌ <b>شوێنی «${removedItem.name}» (${removedItem.phone})</b> لە لیستی سبەینێ لادرا و نامەی بۆ ناڕوات.\n(کۆی ئامادەکراو بۆ سبەینێ: ${dailyOutreach.queue.items.filter(i => i.enabled).length} شوێن)`, { chatId, threadId });
    } else {
      await telegramService.sendMessage(`⚠️ ژمارەی <code>${phoneToDel}</code> خرایە لیستی سڕاوەکانەوە تا بە هیچ جۆرێک نامەی بۆ نەڕوات.`, { chatId, threadId });
    }
    return;
  }

  // Add custom number to outreach queue
  if (text.startsWith('/add') || text.startsWith('/include')) {
    const parts = text.split(/\s+/);
    const phoneToAdd = parts[1];
    const nameToAdd = parts.slice(2).join(' ') || 'مارکێتی بەڕێز';
    if (!phoneToAdd) {
      await telegramService.sendMessage('⚠️ تکایە ژمارە و ناوی شوێنەکە بنووسە:\n<code>/add 0750xxxxxxx ناوی مارکێت</code>', { chatId, threadId });
      return;
    }
    await telegramService.sendMessage(`🔍 پشکنینی واتسئاپ بۆ <code>${phoneToAdd}</code>...`, { chatId, threadId });
    const addRes = await dailyOutreach.addNumber(phoneToAdd, nameToAdd);
    if (addRes.success) {
      await telegramService.sendMessage(`✅ <b>«${nameToAdd}» (${addRes.item.phone})</b> لەسەر واتسئاپ پشتڕاستکرایەوە و زیادکرا بۆ لیستی سبەینێ!\n(کۆی ئامادەکراو: ${dailyOutreach.queue.items.filter(i => i.enabled).length} شوێن)`, { chatId, threadId });
    } else {
      await telegramService.sendMessage(`❌ نەتوانرا زیاد بکرێت: ئەم ژمارەیە (${phoneToAdd}) لەسەر واتسئاپ نییە!`, { chatId, threadId });
    }
    return;
  }

  if (text.startsWith('/pause_outreach')) {
    dailyOutreach.queue.status = 'paused';
    dailyOutreach.saveQueue();
    await telegramService.sendMessage('⏸ <b>ناردنی نامەکانی واتسئاپ بە شێوەیەکی کاتی ڕاگیرا (Paused).</b>\nبۆ دەستپێکردنەوە بنووسە: <code>/resume_outreach</code>', { chatId, threadId });
    return;
  }

  if (text.startsWith('/resume_outreach') || text.startsWith('/approve_outreach')) {
    dailyOutreach.queue.status = 'approved';
    dailyOutreach.saveQueue();
    await telegramService.sendMessage('▶️ <b>ناردنی نامەکانی بەیانیان چالاککرایەوە (Approved).</b>\nسبەینێ سەعات ١٠:٣٠ی پێشنیوەڕۆ دەستپێدەکات.', { chatId, threadId });
    return;
  }

  // --- Re-Order Replenishment Automation Commands ---
  if (text.startsWith('/reorder')) {
    const reorderCycle = require('./modules/reorderCycle');

    if (text.startsWith('/reorder_check')) {
      await telegramService.sendMessage('⏳ <b>پشکنینی کڕیارانی شایستە بۆ پڕکردنەوەی ٣٠ ڕۆژەی وەرەقە...</b>', { chatId, threadId });
      const res = await reorderCycle.checkAndSendReorders();
      if (res.success) {
        await telegramService.sendMessage(`✅ <b>پشکنین تەواو بوو:</b> ${res.count} نامەی بیرخستنەوەی ٣٠ ڕۆژە بە سەرکەوتوویی نێردرا!`, { chatId, threadId });
      } else {
        await telegramService.sendMessage(`⚠️ هۆشداری: ${res.reason || res.message}`, { chatId, threadId });
      }
      return;
    }

    if (text.startsWith('/reorder_add')) {
      const parts = text.split(/\s+/);
      const phone = parts[1];
      const name = parts[2] || 'مارکێتی بەڕێز';
      const date = parts[3] || null;
      if (!phone) {
        await telegramService.sendMessage('⚠️ تکایە ژمارەکە بنووسە:\n<code>/reorder_add 0750xxxxxxx [ناوی مارکێت] [2026-09-20]</code>', { chatId, threadId });
        return;
      }
      const added = reorderCycle.recordOrder(phone, name, date);
      if (added) {
        await telegramService.sendMessage(`✅ <b>«${added.name}» (${added.phone})</b> بۆ سووڕی پڕکردنەوەی ٣٠ ڕۆژە تۆمارکرا.\n• بەرواری کڕین: ${added.lastOrderDate}\n• ڕۆژانی تێپەڕبوو: ${reorderCycle.getDaysElapsed(added.lastOrderDate)} ڕۆژ`, { chatId, threadId });
      } else {
        await telegramService.sendMessage('❌ نەتوانرا زیاد بکرێت (ژمارەکە پارێزراوە یان هەڵەیە).', { chatId, threadId });
      }
      return;
    }

    if (text.startsWith('/reorder_pause')) {
      const parts = text.split(/\s+/);
      const phone = reorderCycle.normalizePhone(parts[1]);
      if (phone && reorderCycle.customers[phone]) {
        reorderCycle.customers[phone].status = 'paused';
        reorderCycle.saveCustomers();
        await telegramService.sendMessage(`⏸ پەیامی ٣٠ ڕۆژە بۆ <b>«${reorderCycle.customers[phone].name}» (${phone})</b> ڕاگیرا.`, { chatId, threadId });
      } else {
        await telegramService.sendMessage('⚠️ ئەم ژمارەیە لە سیستەمی پڕکردنەوە نەدۆزرایەوە.', { chatId, threadId });
      }
      return;
    }

    if (text.startsWith('/reorder_resume')) {
      const parts = text.split(/\s+/);
      const phone = reorderCycle.normalizePhone(parts[1]);
      if (phone && reorderCycle.customers[phone]) {
        reorderCycle.customers[phone].status = 'active';
        reorderCycle.saveCustomers();
        await telegramService.sendMessage(`▶️ پەیامی ٣٠ ڕۆژە بۆ <b>«${reorderCycle.customers[phone].name}» (${phone})</b> کاراکرانەوە.`, { chatId, threadId });
      } else {
        await telegramService.sendMessage('⚠️ ئەم ژمارەیە لە سیستەمی پڕکردنەوە نەدۆزرایەوە.', { chatId, threadId });
      }
      return;
    }

    // Default: Show Summary Card
    const summary = reorderCycle.getTelegramSummary();
    await telegramService.sendMessage(summary, { chatId, threadId: threadId || config.TOPICS.SALES });
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
  const isDollarCmd = /^\/(dollar|dolar|rate)/i.test(text) || 
                      (threadId === config.TOPICS.DOLLAR && (text.includes('دۆلار') || text.includes('نرخ') || text === 'دۆلار')) ||
                      text.trim() === 'دۆلار' || text.trim() === 'نرخی دۆلار';
  if (isDollarCmd) {
    const market = await dollarScraper.getLatestMarketRate();
    if (market) {
      let zohoSynced = false;
      let zohoInfo = null;
      try {
        zohoInfo = await zohoService.updateExchangeRate(market.ratePer100);
        zohoSynced = true;
      } catch (e) {
        console.warn('Zoho exchange rate update note:', e.message);
      }

      const dateObj = new Date(market.time);
      const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
      const localTimeStr = dateObj.toLocaleString('en-GB', options);

      let dMsg = `💵 <b>نرخی ئێستای دۆلاری بازاڕ</b>\n\n`;
      dMsg += `• <b>نرخ:</b> <code>${market.rawText}</code> (100$)\n`;
      dMsg += `• <b>نرخی هەر دۆلارێک:</b> <b>${(market.ratePer100 / 100).toLocaleString()} دینار</b>\n`;
      dMsg += `• <b>کاتی بازاڕ:</b> ${localTimeStr}\n`;
      dMsg += `• <b>سەرچاوە:</b> کەناڵی بازاڕی دۆلارەکە (@bazari_dolaraka)\n`;
      if (zohoSynced && zohoInfo) {
        dMsg += `\n🔄 <b>سیستەمی Zoho Books نوێکرایەوە:</b> 1$ = ${zohoInfo.ratePerDollar.toLocaleString()} د.ع`;
      }
      dMsg += `\n\n🏢 <i>کۆمپانیای بازرگانی گشتی VERTEX</i>`;

      await telegramService.sendMessage(dMsg, { chatId, threadId: threadId || config.TOPICS.DOLLAR });
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
        let zohoSynced = false;
        let zohoInfo = null;
        try {
          zohoInfo = await zohoService.updateExchangeRate(market.ratePer100);
          zohoSynced = true;
          console.log(`[Background] Zoho Books updated: 1$ = ${zohoInfo.ratePerDollar} IQD`);
        } catch (zErr) {
          console.error('[Background] Zoho rate sync error:', zErr.message);
        }

        const dateObj = new Date(market.time);
        const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
        const localTimeStr = dateObj.toLocaleString('en-GB', options);

        let groupMsg = `🔔 <b>ئاگاداری نوێبوونەوەی نرخی دۆلار لە بازاڕ</b>\n\n`;
        groupMsg += `💵 <b>نرخ لە بازاڕ:</b> <code>${market.rawText}</code>\n`;
        groupMsg += `⏰ <b>کاتی بازاڕ:</b> ${localTimeStr}\n`;
        groupMsg += `📢 <b>سەرچاوە:</b> کەناڵی بازاڕی دۆلارەکە (@bazari_dolaraka)\n`;

        if (zohoSynced && zohoInfo) {
          groupMsg += `\n🔄 <b>سیستەمی Zoho Books نوێکرایەوە:</b>\n`;
          groupMsg += `   • نرخی فەرمی دانرا: <b>1$ = ${zohoInfo.ratePerDollar.toLocaleString()} دینار</b>\n`;
        }

        groupMsg += `\n🤖 <i>سیستەمی خۆکاری چاودێری نرخ - کۆمپانیای VERTEX</i>`;

        // 1. Post to Topic 3 (💵 نرخی دۆلاری بازاڕ)
        try {
          await telegramService.sendMessage(groupMsg, { threadId: config.TOPICS.DOLLAR });
          console.log('[Background] Telegram alert sent to Topic 3.');
        } catch (tErr) {
          console.error('[Background] Failed to send to Topic 3:', tErr.message);
        }

        // 2. Post to Public Channel (@vertexiqzone)
        try {
          let channelMsg = `💵 <b>نوێترین نرخی کاتیی دۆلاری بازاڕ</b>\n\n`;
          channelMsg += `• <b>نرخی بازاڕ:</b> <code>${market.rawText}</code>\n`;
          channelMsg += `• <b>نرخی هەر یەک دۆلار:</b> <b>${(market.ratePer100 / 100).toLocaleString()} دینار</b>\n`;
          channelMsg += `• <b>کاتی تۆمارکردن:</b> ${localTimeStr}\n\n`;
          channelMsg += `🏢 <b>کۆمپانیای VERTEX بۆ کەرەستەی کاشێر و مارکێت</b>\n`;
          channelMsg += `🚗 گەیاندن بەردەستە بۆ هەموو شارەکان\n`;
          channelMsg += `📞 فرۆشتن: 0750 758 6992 | 0751 949 6848`;

          const channelKeyboard = {
            inline_keyboard: [
              [
                { text: '🌐 وێبسایتی فەرمی (vertex1.tech)', url: 'https://vertex1.tech' },
                { text: '💬 پەیوەندی لە واتسئاپ', url: 'https://wa.me/9647519496848' }
              ]
            ]
          };

          await telegramService.sendMessage(channelMsg, {
            chatId: config.CHANNEL_ID,
            replyMarkup: channelKeyboard
          });
          console.log('[Background] Telegram alert sent to Channel @vertexiqzone.');
        } catch (cErr) {
          console.warn('[Background] Channel post note:', cErr.message);
        }

        require('fs').writeFileSync(stateFile, JSON.stringify({
          channel: 'bazari_dolaraka',
          text: market.rawText,
          rate: market.ratePer100,
          zoho_synced: zohoSynced,
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

    // 4. Morning Price List Publication check (10:00 AM Baghdad time)
    if (baghdadHour === 10 && lastPriceListDate !== todayDateStr) {
      console.log('[Background] Morning Price List publication time reached (10:00 Baghdad).');
      const market = await dollarScraper.getLatestMarketRate();
      const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;
      await channelPublisher.publishDailyPriceList(config.CHANNEL_ID, currentRate);
      lastPriceListDate = todayDateStr;
    }

    // 5. Morning WhatsApp Daily Outreach check (From 10:30 AM to 2:00 PM Baghdad time - Resilient Auto-Retry)
    if (baghdadHour >= 10 && baghdadHour < 14 && lastOutreachDate !== todayDateStr) {
      if (baghdadHour > 10 || baghdadMinute >= 30) {
        const outreachStatus = dailyOutreach.getStatus();
        if (!outreachStatus.isRunning && outreachStatus.queueStatus !== 'paused') {
          console.log(`[Background] Checking/Triggering morning WhatsApp outreach (${baghdadHour}:${String(baghdadMinute).padStart(2, '0')} Baghdad)...`);
          dailyOutreach.executeMorningOutreach().then(res => {
            if (res && (res.status === 'completed' || res.status === 'no_pending_items')) {
              console.log(`[Background] ✅ Daily WhatsApp outreach completed successfully for ${todayDateStr}!`);
              lastOutreachDate = todayDateStr;
            } else if (res && res.status === 'whatsapp_not_connected') {
              console.warn(`[Background] ⚠️ WhatsApp not connected. Outreach will automatically retry in next 5-minute cycle.`);
            }
          }).catch(err => {
            console.error('[Background] Daily outreach attempt error:', err.message);
          });
        }
      }
    }

    // 6. 30-Day Customer Re-Order Replenishment Cycle (11:30 AM Baghdad time)
    if (baghdadHour === 11 && baghdadMinute >= 30 && baghdadMinute < 45 && lastReorderDate !== todayDateStr) {
      console.log('[Background] Running 30-day customer re-order replenishment check (11:30 AM Baghdad)...');
      lastReorderDate = todayDateStr;
      const reorderCycle = require('./modules/reorderCycle');
      reorderCycle.checkAndSendReorders().catch(err => {
        console.error('[Background] Re-order cycle error:', err.message);
      });
    }

    // 7. Nightly Pre-Screening & Queue Preparation check (10:00 PM to 11:59 PM Baghdad time - Resilient Auto-Retry)
    if (baghdadHour >= 22 && baghdadHour <= 23 && lastNightlyQueueDate !== todayDateStr) {
      console.log(`[Background] Checking/Triggering nightly WhatsApp pre-screening (${baghdadHour}:${String(baghdadMinute).padStart(2, '0')} Baghdad)...`);
      dailyOutreach.prepareNightlyQueue(100).then(res => {
        if (res && res.status === 'prepared') {
          console.log(`[Background] ✅ Nightly queue prepared successfully for ${res.targetDate}!`);
          lastNightlyQueueDate = todayDateStr;
        } else if (res && res.status === 'whatsapp_not_connected') {
          console.warn(`[Background] ⚠️ WhatsApp not connected for nightly queue. Retrying in next 5-minute cycle.`);
        }
      }).catch(err => {
        console.error('[Background] Nightly queue error:', err.message);
      });
    }

    // 8. Safa OS: 8:00 AM Morning Executive Briefing
    if (baghdadHour === 8 && baghdadMinute < 10 && lastBriefingDate !== todayDateStr) {
      console.log('[Background] Sending 8:00 AM Morning Executive Briefing to Safa...');
      lastBriefingDate = todayDateStr;
      dailyBriefing.generateExecutiveBriefing().then(brief => {
        telegramService.sendMessage(brief, { chatId: config.ADMIN_USER_ID });
      }).catch(err => console.error('Briefing error:', err.message));
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
            if (update.message.voice && String(update.message.chat.id) === String(config.ADMIN_USER_ID)) {
              await handleSafaVoice(update.message).catch(e => console.error('Voice error:', e.message));
            } else {
              await handleMessage(update.message).catch(e => console.error('Message error:', e.message));
            }
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

  // Start WhatsApp Linked Bot (0751 949 6848)
  try {
    whatsappBaileys.start();
  } catch (waErr) {
    console.error('Failed to start WhatsApp Baileys:', waErr.message);
  }

  // Start sequential polling loop
  runPollingLoop();

  // Seed Re-order replenishment tracker from Zoho clients
  try {
    const reorderCycle = require('./modules/reorderCycle');
    reorderCycle.syncFromZohoClients();
  } catch (e) {}

  // Run background cycle every 5 minutes
  setInterval(backgroundCycle, 5 * 60 * 1000);
  backgroundCycle(); // Initial check
}

start();

const fs = require('fs');
const path = require('path');
const config = require('../config');
const telegramService = require('../services/telegramService');
const whatsappBaileys = require('../services/whatsappBaileys');

const LEADS_FILE = path.join(__dirname, '../data/leads_contacts.json');
const STATE_FILE = path.join(config.STATE_DIR, 'outreach_state.json');
const QUEUE_FILE = path.join(config.STATE_DIR, 'outreach_queue.json');
const REGISTRY_FILE = path.join(config.STATE_DIR, 'sent_registry.json');
const ZOHO_CLIENTS_FILE = path.join(config.STATE_DIR, 'zoho_clients_blacklist.json');

const PHONE_SALES = '\u200E0750 758 6992';
const PHONE_BOT = '\u200E0751 949 6848';
const WEBSITE_URL = 'https://vertex1.tech';
const TELEGRAM_URL = 'https://t.me/vertexiqzone';

class DailyOutreach {
  constructor() {
    this.leads = [];
    this.sentRegistry = {};
    this.zohoClients = {};
    this.state = {
      lastRunDate: null,
      lastQueueDate: null,
      currentIndex: 0,
      totalSent: 0,
      totalSkippedNotWa: 0,
      isRunning: false,
      excludedPhones: [],
      history: []
    };
    this.queue = {
      date: null,
      status: 'pending', // 'pending', 'approved', 'paused', 'completed'
      createdAt: null,
      items: []
    };
    this.loadLeads();
    this.loadState();
    this.loadQueue();
    this.loadSentRegistry();
    this.loadZohoClients();
  }

  loadLeads() {
    try {
      if (fs.existsSync(LEADS_FILE)) {
        this.leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
        console.log(`[DailyOutreach] Loaded ${this.leads.length} leads contacts.`);
      } else {
        console.warn(`[DailyOutreach] Leads file not found at ${LEADS_FILE}`);
        this.leads = [];
      }
    } catch (e) {
      console.error('[DailyOutreach] Failed to load leads:', e.message);
      this.leads = [];
    }
  }

  loadState() {
    try {
      if (!fs.existsSync(config.STATE_DIR)) {
        fs.mkdirSync(config.STATE_DIR, { recursive: true });
      }
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        this.state = Object.assign(this.state, JSON.parse(raw));
      }
    } catch (e) {
      console.error('[DailyOutreach] Failed to load state:', e.message);
    }
  }

  saveState() {
    try {
      if (!fs.existsSync(config.STATE_DIR)) {
        fs.mkdirSync(config.STATE_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.error('[DailyOutreach] Failed to save state:', e.message);
    }
  }

  loadQueue() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
        this.queue = Object.assign(this.queue, JSON.parse(raw));
      }
    } catch (e) {
      console.error('[DailyOutreach] Failed to load queue:', e.message);
    }
  }

  saveQueue() {
    try {
      if (!fs.existsSync(config.STATE_DIR)) {
        fs.mkdirSync(config.STATE_DIR, { recursive: true });
      }
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (e) {
      console.error('[DailyOutreach] Failed to save queue:', e.message);
    }
  }

  loadSentRegistry() {
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        this.sentRegistry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      } else {
        this.sentRegistry = {};
      }
    } catch (e) {
      console.error('[DailyOutreach] Failed to load sent registry:', e.message);
      this.sentRegistry = {};
    }
  }

  saveSentRegistry() {
    try {
      if (!fs.existsSync(config.STATE_DIR)) {
        fs.mkdirSync(config.STATE_DIR, { recursive: true });
      }
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(this.sentRegistry, null, 2), 'utf8');
    } catch (e) {
      console.error('[DailyOutreach] Failed to save sent registry:', e.message);
    }
  }

  loadZohoClients() {
    try {
      if (fs.existsSync(ZOHO_CLIENTS_FILE)) {
        this.zohoClients = JSON.parse(fs.readFileSync(ZOHO_CLIENTS_FILE, 'utf8'));
      } else {
        this.zohoClients = {};
      }
    } catch (e) {
      this.zohoClients = {};
    }
  }

  normalizePhone(phone) {
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (clean.startsWith('00964')) clean = clean.substring(2);
    else if (clean.startsWith('07')) clean = '964' + clean.substring(1);
    else if (clean.startsWith('7') && clean.length === 10) clean = '964' + clean;
    return clean;
  }

  // Check if phone was messaged or in queue
  isOutreachRecipient(phone) {
    const clean = this.normalizePhone(phone);
    if (this.sentRegistry && this.sentRegistry[clean]) {
      return this.sentRegistry[clean];
    }
    if (this.queue && this.queue.items) {
      const item = this.queue.items.find(i => i.phone === clean);
      if (item) return item;
    }
    return null;
  }

  generateKurdishOutreachMessage(lead) {
    const shopName = lead.name && lead.name !== 'مارکێت / شوێنی بەڕێز' ? lead.name : 'مارکێت و دوکانی بەڕێزتان';

    let msg = `سڵاو و ڕێز لە بەڕێوەبەر و ستافی بەڕێزی ${shopName} 🌸\n`;
    msg += `هیوادارین کار و کاسبیتان هەمیشە پڕ لە بەرەکەت و گەشەدا بێت.\n\n`;

    msg += `ئێمە لە کۆمپانیای ڤێرتێکس (VERTEX) وەکو هاوبەش و دابینکەری سەرەکی کەرەستەکانی سیستەمی کاشێر و مارکێت لە کوردستان، پەیوەندیتان پێوە دەکەین تا وەک دابینکەرێکی متمانەپێکراو لە خزمەتتاندا بین:\n\n`;

    msg += `📄 وەرەقەی ڕەسیپت و ڕۆڵی کاغەز (Thermal Paper Rolls):\n`;
    msg += `ئایا وەرەقەی کاشێرەکەت کەم ماوە یان پێویستیت پێیەتی؟ ئێمە بەرزترین کوالێتی وەرەقەی حەراری (Panda و براندە پلە یەکەکان) ڕاستەوخۆ دابین دەکەین بە بێ گیربوون، چاپی زۆر تۆخ و بە پارێزراوی.\n\n`;

    msg += `🖥 ئامێرەکانی خاڵی فرۆشتن (POS Systems):\n`;
    msg += `ئایا پێویستیت بە نوێکردنەوە یان کڕینی ئامێری نوێ هەیە؟\n`;
    msg += `(پرینتەری پسوولە، سکانەری بارکۆدی خێرا، کەش درۆوەر (سندوقی پارە)، مۆنیتەری دەستی، کۆمپیوتەری لەمس). هەمووی بە گەرەنتی ڕاستەقینە و کوالێتی بەرز بەردەستە.\n\n`;

    msg += `🛠 چاککردنەوە و چارەسەری کێشەی ئامێرەکان:\n`;
    msg += `ئەگەر هەر ئامێرێکت لە مارکێت/شوێنەکەتدا کێشەی تێدایە یان تێکچووە، تیمی ئەندازیاران و چاکسازی ئێمە دەتوانن لە کەمترین ماوەدا بۆتان چاک بکەنەوە.\n\n`;

    msg += `💰 دەربارەی نرخەکان:\n`;
    msg += `ئەو نرخانەی لە پرایس لیستی ئێمەدا دیاریکراون نرخی تاکن (Retail). بۆ داواکاری بە بڕی زۆر و دابینکردنی بەردەوام بە نرخی کۆ (Wholesale)، داشکاندن و تەخفیفی زۆر تایبەتمان هەیە، دەتوانن بۆ نرخی کۆ ڕاستەوخۆ پەیوەندیمان پێوە بکەن.\n\n`;

    msg += `📞 بۆ داواکاری و پەیوەندی خێرا:\n`;
    msg += `• فرۆشتن و پەیوەندی خێرا: ${PHONE_SALES}\n`;
    msg += `• واتسئاپ و بۆتی فەرمی: ${PHONE_BOT}\n`;
    msg += `🌐 ماڵپەڕی فەرمی: ${WEBSITE_URL}\n`;
    msg += `📢 کەناڵی فەرمی تیلیگرام: ${TELEGRAM_URL}\n\n`;

    msg += `(دەتوانیت هەر ئێستا لێرە لە واتسئاپ بنووسیت «سڵاو» بۆ بینینی لیستی نرخ و کەتەلۆگ بە شێوەیەکی ئۆتۆماتیکی).`;

    return msg;
  }

  // Pre-screen and prepare tomorrow's 100 targets (Called at 10:00 PM nightly or via Telegram command)
  async prepareNightlyQueue(targetCount = 100) {
    if (!whatsappBaileys.isConnected) {
      console.warn('[DailyOutreach] WhatsApp Baileys is not connected. Cannot pre-screen.');
      return { status: 'whatsapp_not_connected' };
    }

    if (this.leads.length === 0) this.loadLeads();
    if (this.leads.length === 0) return { status: 'no_leads' };

    this.loadSentRegistry();
    this.loadZohoClients();

    console.log(`[DailyOutreach] 🔍 Starting nightly WhatsApp pre-screening for ${targetCount} verified targets...`);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const queueItems = [];
    let checkPointer = this.state.currentIndex;
    let checkedTotal = 0;
    let skippedExcluded = 0;
    let skippedDuplicates = 0;
    let skippedNotWa = 0;

    const excludedSet = new Set(this.state.excludedPhones || []);
    const sentSet = new Set(Object.keys(this.sentRegistry || {}));
    const zohoSet = new Set(Object.keys(this.zohoClients || {}));
    const currentBatchSet = new Set();

    while (queueItems.length < targetCount && checkPointer < this.leads.length) {
      const lead = this.leads[checkPointer];
      checkPointer++;
      checkedTotal++;

      const clean = this.normalizePhone(lead.phone);

      // --- MULTI-LAYER ZERO-DUPLICATE GUARD ---
      if (sentSet.has(clean)) {
        skippedDuplicates++;
        continue;
      }
      if (zohoSet.has(clean)) {
        skippedExcluded++;
        continue;
      }
      if (excludedSet.has(clean)) {
        skippedExcluded++;
        continue;
      }
      if (currentBatchSet.has(clean)) {
        skippedDuplicates++;
        continue;
      }
      // ----------------------------------------

      // Check WhatsApp existence
      let waJid = null;
      try {
        waJid = await whatsappBaileys.checkNumberOnWhatsApp(clean);
      } catch (err) {
        console.warn(`[DailyOutreach] Pre-check error on ${clean}:`, err.message);
      }

      if (!waJid) {
        skippedNotWa++;
        this.state.totalSkippedNotWa++;
        continue;
      }

      currentBatchSet.add(clean);

      queueItems.push({
        id: queueItems.length + 1,
        leadIndex: checkPointer - 1,
        name: lead.name,
        city: lead.city,
        phone: clean,
        rawPhone: lead.rawPhone || lead.phone,
        waJid: waJid,
        enabled: true,
        status: 'pending'
      });

      // Small delay between checks to avoid rate limit
      await new Promise(r => setTimeout(r, 200));
    }

    this.queue = {
      date: tomorrowStr,
      status: 'pending',
      createdAt: new Date().toISOString(),
      items: queueItems
    };
    this.saveQueue();

    this.state.lastQueueDate = new Date().toISOString().split('T')[0];
    this.saveState();

    console.log(`[DailyOutreach] ✅ Pre-screened ${queueItems.length} verified WhatsApp numbers for ${tomorrowStr}. Duplicates prevented: ${skippedDuplicates}`);

    // Post to Telegram
    await this.postQueueToTelegram();

    return {
      status: 'prepared',
      targetDate: tomorrowStr,
      count: queueItems.length,
      checkedTotal,
      skippedDuplicates,
      skippedNotWa
    };
  }

  async postQueueToTelegram(chatId = null, threadId = null) {
    const targetChat = chatId || config.GROUP_CHAT_ID;
    const targetThread = threadId || config.TOPICS.SALES;

    const enabledItems = (this.queue.items || []).filter(i => i.enabled);
    const disabledItems = (this.queue.items || []).filter(i => !i.enabled);
    const totalSentSoFar = Object.keys(this.sentRegistry || {}).length;

    let msg = `📋 <b>خشتەی ١٠٠ مارکێت و شوێنی ئامادەکراو بۆ سبەینێ (سەعات ٩:٠٠ی بەیانی) 🌅</b>\n\n`;
    msg += `• <b>بەرواری ناردن:</b> سبەینێ ${this.queue.date || 'ئەمڕۆ'}\n`;
    msg += `• <b>سەلامەتی و دژە دووبارە:</b> ١٠٠٪ پشکنراوە؛ هیچ ژمارەیەکی دووبارە یان کڕیاری کۆنی زۆهۆی تێدا نییە 🛡️\n`;
    msg += `• <b>کۆی ئامادەکراو:</b> ${enabledItems.length} شوێن`;
    if (disabledItems.length > 0) {
      msg += ` (${disabledItems.length} شوێن بە دەستی لادراون)`;
    }
    msg += `\n• <b>کۆی گشتی کڕیارانی پێشوو:</b> ${totalSentSoFar} مارکێت\n`;
    msg += `• <b>دۆخی ناردن:</b> ${this.queue.status === 'paused' ? '⏸ ڕاگیراوە (Paused)' : '▶️ چالاکە و سەعات ٩ دەستپێدەکات'}\n\n`;

    msg += `<b>نموونەی ١٠ مارکێتی یەکەمی لیستەکە:</b>\n`;
    const previewList = (this.queue.items || []).slice(0, 10);
    previewList.forEach((it, idx) => {
      const statusIcon = it.enabled ? '🟢' : '🔴 (لادراوە)';
      msg += `${idx + 1}. ${statusIcon} <b>${it.name}</b> (${it.city}) - <code>${it.phone}</code>\n`;
    });

    msg += `\n🎮 <b>دەستکاری و کۆنتڕۆڵی تەواو لە چاتەوە:</b>\n`;
    msg += `• بۆ لادانی هەر ژمارەیەک: <code>/remove 0750xxxxxxx</code>\n`;
    msg += `• بۆ زیادکردنی شوێنی تایبەت: <code>/add 0750xxxxxxx ناوی شوێن</code>\n`;
    msg += `• بینینی تەواوی ١٠٠ ناوەکە: <code>/outreach_list</code>\n`;
    msg += `• تاقیکردنەوەی ١ نامە: <code>/outreach_test 0750xxxxxxx</code>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📄 داگرتنی فایلی تەواوی لیست', callback_data: 'outreach:send_file' },
          { text: this.queue.status === 'paused' ? '▶️ چالاککردنەوە' : '⏸ ڕاگرتنی سبەینێ', callback_data: 'outreach:toggle_pause' }
        ],
        [
          { text: '🔄 پشکنینەوەی ١٠٠ دانەی نوێ', callback_data: 'outreach:refresh' },
          { text: '🚀 دەستپێکردنی ناردن هەر ئێستا', callback_data: 'outreach:start_now' }
        ]
      ]
    };

    await telegramService.sendMessage(msg, {
      chatId: targetChat,
      threadId: targetThread,
      replyMarkup: keyboard
    }).catch(e => console.error('[DailyOutreach] Failed to post queue to Telegram:', e.message));
  }

  // Remove / Exclude a number from queue
  removeNumber(phoneInput) {
    const clean = this.normalizePhone(phoneInput);
    if (!this.state.excludedPhones) this.state.excludedPhones = [];
    if (!this.state.excludedPhones.includes(clean)) {
      this.state.excludedPhones.push(clean);
      this.saveState();
    }

    let found = null;
    if (this.queue && this.queue.items) {
      for (const item of this.queue.items) {
        if (item.phone === clean || item.phone.endsWith(clean.slice(-7))) {
          item.enabled = false;
          item.status = 'removed_by_user';
          found = item;
          break;
        }
      }
      this.saveQueue();
    }

    return found;
  }

  // Add custom number into queue
  async addNumber(phoneInput, nameInput, cityInput = 'کوردستان') {
    const clean = this.normalizePhone(phoneInput);

    // Check duplicate against sent registry
    if (this.sentRegistry && this.sentRegistry[clean]) {
      return { success: false, reason: 'already_sent_previously' };
    }
    
    // Check WhatsApp existence
    let waJid = null;
    try {
      waJid = await whatsappBaileys.checkNumberOnWhatsApp(clean);
    } catch (e) {
      console.warn(`[DailyOutreach] Check error on addNumber:`, e.message);
    }

    if (!waJid) {
      return { success: false, reason: 'not_on_whatsapp' };
    }

    // Remove from excluded if it was there
    if (this.state.excludedPhones) {
      this.state.excludedPhones = this.state.excludedPhones.filter(p => p !== clean);
      this.saveState();
    }

    const newItem = {
      id: (this.queue.items ? this.queue.items.length : 0) + 1,
      name: nameInput.trim() || 'مارکێتی بەڕێز',
      city: cityInput.trim() || 'کوردستان',
      phone: clean,
      rawPhone: phoneInput,
      waJid: waJid,
      enabled: true,
      status: 'pending',
      customAdded: true
    };

    if (!this.queue.items) this.queue.items = [];
    this.queue.items.unshift(newItem);
    this.saveQueue();

    return { success: true, item: newItem };
  }

  togglePause() {
    this.queue.status = this.queue.status === 'paused' ? 'approved' : 'paused';
    this.saveQueue();
    return this.queue.status;
  }

  // Generate full readable text file of queue for download
  generateQueueTextFile() {
    const filePath = path.join(config.STATE_DIR, 'outreach_targets_tomorrow.txt');
    let text = `لیستی ١٠٠ شوێنی ئامادەکراو بۆ ناردنی نامەی واتسئاپ\n`;
    text += `بەروار: ${this.queue.date || 'سبەینێ'} | دۆخ: ${this.queue.status}\n`;
    text += `سیستەمی پاراستن: بێ ژمارەی دووبارە (Zero Duplicate Guaranteed)\n`;
    text += `========================================================\n\n`;

    (this.queue.items || []).forEach((it, idx) => {
      const stateStr = it.enabled ? '[چالاک]' : '[لادراوە]';
      text += `${idx + 1}. ${stateStr} ${it.name} | شار: ${it.city} | مۆبایل: ${it.phone}\n`;
    });

    fs.writeFileSync(filePath, text, 'utf8');
    return filePath;
  }

  // Execute the morning outreach (Called at 9:00 AM)
  async executeMorningOutreach(forced = false) {
    if (this.state.isRunning) {
      console.warn('[DailyOutreach] Outreach batch is already running.');
      return { status: 'already_running' };
    }

    if (!whatsappBaileys.isConnected) {
      console.warn('[DailyOutreach] WhatsApp Baileys is not connected.');
      return { status: 'whatsapp_not_connected' };
    }

    // Refresh sent registry from disk
    this.loadSentRegistry();
    this.loadZohoClients();

    // If queue is empty or from a past date, prepare now
    if (!this.queue.items || this.queue.items.length === 0) {
      console.log('[DailyOutreach] Queue was empty, preparing queue now...');
      await this.prepareNightlyQueue(100);
    }

    if (this.queue.status === 'paused' && !forced) {
      console.log('[DailyOutreach] Queue is paused by user. Skipping morning outreach.');
      await telegramService.sendMessage('⏸ <b>ئاگاداری:</b> ناردنی نامەکانی واتسئاپ بۆ ئەم بەیانییە بە فەرمانی بەڕێوەبەر ڕاگیراوە (Paused).', {
        chatId: config.GROUP_CHAT_ID,
        threadId: config.TOPICS.SALES
      }).catch(() => {});
      return { status: 'paused' };
    }

    const enabledItems = (this.queue.items || []).filter(i => i.enabled && i.status === 'pending');
    if (enabledItems.length === 0) {
      console.log('[DailyOutreach] No pending enabled items in queue.');
      return { status: 'no_pending_items' };
    }

    this.state.isRunning = true;
    this.saveState();

    console.log(`[DailyOutreach] 🚀 Executing morning outreach to ${enabledItems.length} targets...`);

    // Notify Telegram start
    await telegramService.sendMessage(`🚀 <b>دەستکرا بە ناردنی نامەی واتسئاپ بۆ ${enabledItems.length} مارکێتی پەسەندکراو</b>\n` +
      `• کاتی دەستپێکردن: ٩:٠٠ی بەیانی\n` +
      `• سیستەمی دژە دووبارەبوونەوە: چالاکە 🛡️\n` +
      `• بۆ پاراستنی ئەکاونت، نێوان هەر نامەیەک ٣٠ چرکەیە.`, {
      chatId: config.GROUP_CHAT_ID,
      threadId: config.TOPICS.SALES
    }).catch(() => {});

    let sentCount = 0;
    let duplicateSkipped = 0;

    for (let i = 0; i < enabledItems.length; i++) {
      const item = enabledItems[i];
      const cleanPhone = this.normalizePhone(item.phone);

      // --- RUNTIME DUPLICATE & CLIENT GUARD ---
      if (this.sentRegistry[cleanPhone]) {
        console.warn(`[DailyOutreach] [DUPLICATE BLOCKED] ${cleanPhone} (${item.name}) was already sent. Skipping.`);
        item.status = 'duplicate_skipped';
        duplicateSkipped++;
        this.saveQueue();
        continue;
      }

      if (this.zohoClients[cleanPhone]) {
        console.warn(`[DailyOutreach] [ZOHO CLIENT BLOCKED] ${cleanPhone} is an active Zoho client. Skipping.`);
        item.status = 'zoho_client_skipped';
        this.saveQueue();
        continue;
      }
      // ----------------------------------------

      const message = this.generateKurdishOutreachMessage(item);

      try {
        await whatsappBaileys.sendText(item.waJid, message);
        sentCount++;
        this.state.totalSent++;
        item.status = 'sent';
        item.sentAt = new Date().toISOString();

        // Save immediately to permanent sent registry
        this.sentRegistry[cleanPhone] = {
          name: item.name,
          city: item.city,
          phone: cleanPhone,
          sentAt: item.sentAt
        };
        this.saveSentRegistry();

        this.state.history.unshift({
          phone: cleanPhone,
          name: item.name,
          city: item.city,
          sentAt: item.sentAt
        });
        if (this.state.history.length > 50) this.state.history.pop();

        this.saveQueue();
        this.saveState();

        console.log(`[DailyOutreach] ✅ (${sentCount}/${enabledItems.length}) Sent to ${item.name} (${item.phone})`);
      } catch (err) {
        console.error(`[DailyOutreach] ❌ Error sending to ${item.phone}:`, err.message);
        item.status = 'error';
        this.saveQueue();
      }

      // Natural delay (25-45 seconds)
      if (i < enabledItems.length - 1) {
        const delaySec = Math.floor(Math.random() * 20) + 25;
        console.log(`[DailyOutreach] ⏳ Anti-ban delay: waiting ${delaySec}s...`);
        await new Promise(r => setTimeout(r, delaySec * 1000));
      }
    }

    // Advance pointer in leads database past this batch
    const maxLeadIdx = Math.max(...enabledItems.map(it => it.leadIndex || 0), this.state.currentIndex);
    this.state.currentIndex = maxLeadIdx + 1;
    this.state.lastRunDate = new Date().toISOString().split('T')[0];
    this.state.isRunning = false;
    this.queue.status = 'completed';

    this.saveState();
    this.saveQueue();

    console.log(`[DailyOutreach] 🏁 Morning outreach finished: ${sentCount} sent, ${duplicateSkipped} duplicates blocked.`);

    // Notify Telegram finish
    const totalPermanent = Object.keys(this.sentRegistry || {}).length;
    await telegramService.sendMessage(`✅ <b>هەڵمەتی نامەناردنی بەیانیان بە سەرکەوتوویی کۆتایی هات!</b>\n\n` +
      `• <b>نامەی نێردراو ئەمڕۆ:</b> ${sentCount} مارکێت\n` +
      `• <b>دووبارەی بلۆککراو:</b> ${duplicateSkipped}\n` +
      `• <b>کۆی گشتی کڕیارانی تۆمارکراو:</b> ${totalPermanent} شوێن\n` +
      `• <b>ڕیزبەندی داهاتوو:</b> لە ژمارە ${this.state.currentIndex + 1} دەستپێدەکاتەوە.\n` +
      `• <b>وەڵامدانەوە:</b> هەر کڕیارێک وەڵام بداتەوە بە خێرایی لەم کەناڵە ئاگاداری دەدرێت 💬`, {
      chatId: config.GROUP_CHAT_ID,
      threadId: config.TOPICS.SALES
    }).catch(() => {});

    return { status: 'completed', sentCount, duplicateSkipped };
  }

  // Send a single test message immediately
  async sendTestMessage(phoneInput) {
    const clean = this.normalizePhone(phoneInput);
    const waJid = await whatsappBaileys.checkNumberOnWhatsApp(clean);
    if (!waJid) {
      return { success: false, reason: 'not_on_whatsapp' };
    }

    const testLead = {
      name: 'بەڕێزتان (تاقیکردنەوە)',
      city: 'کوردستان',
      phone: clean
    };
    const msg = this.generateKurdishOutreachMessage(testLead);
    await whatsappBaileys.sendText(waJid, msg);
    return { success: true, phone: clean };
  }

  getStatus() {
    return {
      totalLeads: this.leads.length,
      currentIndex: this.state.currentIndex,
      totalSent: this.state.totalSent,
      totalPermanentRegistered: Object.keys(this.sentRegistry || {}).length,
      totalSkippedNotWa: this.state.totalSkippedNotWa,
      isRunning: this.state.isRunning,
      queueStatus: this.queue.status,
      queueDate: this.queue.date,
      queueCount: (this.queue.items || []).filter(i => i.enabled).length,
      excludedCount: (this.state.excludedPhones || []).length,
      zohoClientsProtected: Object.keys(this.zohoClients || {}).length
    };
  }
}

module.exports = new DailyOutreach();

const fs = require('fs');
const path = require('path');
const config = require('../config');
const telegramService = require('../services/telegramService');
const whatsappBaileys = require('../services/whatsappBaileys');

const LEADS_FILE = path.join(__dirname, '../data/leads_contacts.json');
const STATE_FILE = path.join(config.STATE_DIR, 'outreach_state.json');

const PHONE_SALES = '\u200E0750 758 6992';
const PHONE_BOT = '\u200E0751 949 6848';
const WEBSITE_URL = 'https://vertex1.tech';
const TELEGRAM_URL = 'https://t.me/vertexiqzone';

class DailyOutreach {
  constructor() {
    this.leads = [];
    this.state = {
      lastRunDate: null,
      currentIndex: 0,
      totalSent: 0,
      totalSkippedNotWa: 0,
      isRunning: false,
      history: []
    };
    this.loadLeads();
    this.loadState();
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

  async runDailyBatch(targetCount = 100) {
    if (this.state.isRunning) {
      console.warn('[DailyOutreach] Outreach is already running.');
      return { status: 'already_running' };
    }

    if (!whatsappBaileys.isConnected) {
      console.warn('[DailyOutreach] WhatsApp Baileys is not connected. Aborting outreach batch.');
      return { status: 'whatsapp_not_connected' };
    }

    if (this.leads.length === 0) {
      this.loadLeads();
    }

    if (this.leads.length === 0) {
      console.error('[DailyOutreach] No leads available.');
      return { status: 'no_leads' };
    }

    this.state.isRunning = true;
    this.saveState();

    console.log(`[DailyOutreach] 🚀 Starting daily outreach batch of ${targetCount} messages. Starting index: ${this.state.currentIndex}`);

    // Notify Telegram Admin / Topic 4 (Sales/Invoices)
    try {
      const startNote = `🚀 <b>دەستکرا بە هەڵمەتی نامەناردنی بەیانیان بۆ ${targetCount} مارکێت و بازرگان</b>\n` +
        `• کاتی دەستپێکردن: ٩:٠٠ی بەیانی\n` +
        `• شوێنی ڕیزبەندی: لە ژمارە <b>${this.state.currentIndex + 1}</b> لە کۆی ${this.leads.length} ژمارە\n` +
        `• نامەکان بە هێمنی (بە جیاوازی ٣٠ چرکه) دەنێردرێن بۆ پاراستنی ئەکاونتی واتسئاپ.`;
      
      await telegramService.sendMessage(startNote, {
        chatId: config.GROUP_CHAT_ID,
        threadId: config.TOPICS.SALES
      }).catch(() => {});
    } catch (e) {
      console.error('[DailyOutreach] Failed to send Telegram start notification:', e.message);
    }

    let sentToday = 0;
    let checkedCount = 0;

    try {
      while (sentToday < targetCount && this.state.currentIndex < this.leads.length) {
        const lead = this.leads[this.state.currentIndex];
        this.state.currentIndex++;
        checkedCount++;

        // 1. Verify if number is registered on WhatsApp
        let waJid = null;
        try {
          waJid = await whatsappBaileys.checkNumberOnWhatsApp(lead.phone);
        } catch (checkErr) {
          console.warn(`[DailyOutreach] Error checking ${lead.phone}:`, checkErr.message);
        }

        if (!waJid) {
          this.state.totalSkippedNotWa++;
          console.log(`[DailyOutreach] [SKIP] ${lead.phone} (${lead.name}) is NOT on WhatsApp.`);
          this.saveState();
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        // 2. Format personalized message
        const message = this.generateKurdishOutreachMessage(lead);

        // 3. Send message via Baileys
        try {
          await whatsappBaileys.sendText(waJid, message);
          sentToday++;
          this.state.totalSent++;
          this.state.history.unshift({
            phone: lead.phone,
            name: lead.name,
            city: lead.city,
            sentAt: new Date().toISOString()
          });
          if (this.state.history.length > 50) this.state.history.pop();
          this.saveState();

          console.log(`[DailyOutreach] ✅ Sent (${sentToday}/${targetCount}) to ${lead.name} (${lead.phone})`);
        } catch (sendErr) {
          console.error(`[DailyOutreach] ❌ Failed to send to ${lead.phone}:`, sendErr.message);
        }

        // 4. Natural anti-ban delay (25 to 45 seconds between messages)
        if (sentToday < targetCount && this.state.currentIndex < this.leads.length) {
          const delaySec = Math.floor(Math.random() * 20) + 25; // 25-45 seconds
          console.log(`[DailyOutreach] ⏳ Anti-ban delay: waiting ${delaySec}s before next send...`);
          await new Promise(r => setTimeout(r, delaySec * 1000));
        }
      }

      const todayDateStr = new Date().toISOString().split('T')[0];
      this.state.lastRunDate = todayDateStr;
      this.state.isRunning = false;
      this.saveState();

      console.log(`[DailyOutreach] 🏁 Finished daily batch: ${sentToday} sent, ${checkedCount} checked.`);

      // Send completion report to Telegram
      try {
        const finishNote = `✅ <b>هەڵمەتی نامەناردنی بەیانیان بە سەرکەوتوویی تەواو بوو!</b>\n\n` +
          `• <b>نامەی نێردراو ئەمڕۆ:</b> ${sentToday} نامە\n` +
          `• <b>ژمارەی پشکێنراو:</b> ${checkedCount}\n` +
          `• <b>کۆی گشتی نێردراوەکان تا ئێستا:</b> ${this.state.totalSent} مارکێت\n` +
          `• <b>ڕیزبەندی داهاتوو:</b> لە ژمارە ${this.state.currentIndex + 1} دەستپێدەکاتەوە.\n` +
          `• <b>وەڵامی کڕیاران:</b> ڕاستەوخۆ لەلایەن بۆتی کلاودی واتسئاپەوە وەڵام دەدرێتەوە 💬`;

        await telegramService.sendMessage(finishNote, {
          chatId: config.GROUP_CHAT_ID,
          threadId: config.TOPICS.SALES
        }).catch(() => {});
      } catch (e) {
        console.error('[DailyOutreach] Failed to send Telegram finish notification:', e.message);
      }

      return {
        status: 'completed',
        sentToday,
        checkedCount,
        totalSent: this.state.totalSent,
        nextIndex: this.state.currentIndex
      };

    } catch (fatalErr) {
      console.error('[DailyOutreach] Fatal error during batch:', fatalErr.message);
      this.state.isRunning = false;
      this.saveState();
      return { status: 'error', error: fatalErr.message };
    }
  }

  getStatus() {
    return {
      totalLeads: this.leads.length,
      currentIndex: this.state.currentIndex,
      totalSent: this.state.totalSent,
      totalSkippedNotWa: this.state.totalSkippedNotWa,
      isRunning: this.state.isRunning,
      lastRunDate: this.state.lastRunDate,
      recentHistory: this.state.history.slice(0, 10)
    };
  }
}

module.exports = new DailyOutreach();

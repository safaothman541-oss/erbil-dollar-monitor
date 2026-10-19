const fs = require('fs');
const path = require('path');
const config = require('../config');
const telegramService = require('../services/telegramService');
const whatsappBaileys = require('../services/whatsappBaileys');

const STATE_FILE = path.join(__dirname, '..', 'state', 'customer_orders.json');
const PHONE_SALES = '\u200E0750 758 6992';
const PHONE_BOT = '\u200E0751 949 6848';

class ReorderCycle {
  constructor() {
    this.customers = {};
    this.loadCustomers();
  }

  ensureStateDir() {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  loadCustomers() {
    this.ensureStateDir();
    if (fs.existsSync(STATE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        this.customers = data.customers || {};
      } catch (e) {
        console.error('[ReorderCycle] Error loading state:', e.message);
        this.customers = {};
      }
    } else {
      this.customers = {};
    }
  }

  saveCustomers() {
    this.ensureStateDir();
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify({
        updatedAt: new Date().toISOString(),
        totalCustomers: Object.keys(this.customers).length,
        customers: this.customers
      }, null, 2), 'utf8');
    } catch (e) {
      console.error('[ReorderCycle] Error saving state:', e.message);
    }
  }

  normalizePhone(phone) {
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (clean.startsWith('00964')) clean = clean.substring(2);
    else if (clean.startsWith('07')) clean = '964' + clean.substring(1);
    else if (clean.startsWith('7') && clean.length === 10) clean = '964' + clean;
    return clean;
  }

  isProtected(phone) {
    const clean = this.normalizePhone(phone);
    // Ignore old deprecated number and official numbers
    if (clean === '9647505299118' || clean === '9647507586992' || clean === '9647519496848' || clean === '9647504808899') {
      return true;
    }
    return false;
  }

  // Record or update a customer order
  recordOrder(rawPhone, name, orderDate = null, invoiceNumber = null) {
    const clean = this.normalizePhone(rawPhone);
    if (!clean || clean.length < 10 || this.isProtected(clean)) return null;

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());
    const dateStr = orderDate || todayStr;

    if (!this.customers[clean]) {
      this.customers[clean] = {
        phone: clean,
        name: name || 'مارکێتی بەڕێز',
        firstOrderDate: dateStr,
        lastOrderDate: dateStr,
        lastRemindedDate: null,
        reminderCount: 0,
        status: 'active',
        invoiceNumber: invoiceNumber || null
      };
    } else {
      // Update with latest order date
      this.customers[clean].lastOrderDate = dateStr;
      if (name && name !== 'مارکێتی بەڕێز') this.customers[clean].name = name;
      if (invoiceNumber) this.customers[clean].invoiceNumber = invoiceNumber;
      // Reset reminder since they just placed an order
      this.customers[clean].lastRemindedDate = null;
    }

    this.saveCustomers();
    console.log(`[ReorderCycle] ✅ Recorded order for ${name} (${clean}) on ${dateStr}`);
    return this.customers[clean];
  }

  // Calculate days elapsed since last order
  getDaysElapsed(lastOrderDate) {
    if (!lastOrderDate) return 0;
    const orderTime = new Date(lastOrderDate).getTime();
    const nowTime = Date.now();
    return Math.floor((nowTime - orderTime) / (1000 * 3600 * 24));
  }

  // Get list of customers eligible for 30-day replenishment reminder
  getEligibleCandidates(minDays = 30) {
    const candidates = [];
    const now = Date.now();

    for (const [phone, cust] of Object.entries(this.customers)) {
      if (cust.status !== 'active' || this.isProtected(phone)) continue;

      const daysElapsed = this.getDaysElapsed(cust.lastOrderDate);

      // Must be at least 30 days
      if (daysElapsed >= minDays) {
        // Prevent reminding multiple times in the same 25-day window
        if (cust.lastRemindedDate) {
          const daysSinceRemind = Math.floor((now - new Date(cust.lastRemindedDate).getTime()) / (1000 * 3600 * 24));
          if (daysSinceRemind < 25) continue;
        }

        candidates.push({
          ...cust,
          daysElapsed
        });
      }
    }

    // Sort by longest days elapsed first
    candidates.sort((a, b) => b.daysElapsed - a.daysElapsed);
    return candidates;
  }

  generateKurdishReorderMessage(cust) {
    const shopName = cust.name && cust.name !== 'مارکێتی بەڕێز' ? cust.name : 'مارکێت و دوکانی بەڕێزتان';

    let msg = `سڵاو و ڕێز لە بەڕێوەبەر و ستافی بەڕێزی ${shopName} 🌸\n`;
    msg += `هیوادارین کار و کاسبیتان هەمیشە پڕ لە بەرەکەت بێت.\n\n`;

    msg += `هیوادارین وەرەقە حەرارییەکانی کاشێرتان بەدڵ بووبێت و لە کوالێتی و چاپی تەواو ڕازی بووبن.\n`;
    msg += `بەپێی تێپەڕبوونی نزیکەی مانگێک بەسەر کڕینی پێشووتاندا، ئایا وەرەقەی کاشێرەکەت کەم ماوە تا کارتۆنێکی ترت بە گەیاندنی خێرا لە هەولێر بۆ دابین بکەین؟ 🚚\n\n`;

    msg += `⚡ *داواکردنی دەستبەجێ بە ژمارەیەک:*\n`;
    msg += `• بۆ داواکردنی کارتۆنی وەرەقەی نوێ تەنها بنووسە: *١*\n`;
    msg += `• بۆ بینینی پرایس لیستی نوێ بە PDF بنووسە: *٢*\n`;
    msg += `• بۆ قسەکردن لەگەڵ تیمی فرۆشتن بنووسە: *٣*\n\n`;

    msg += `📞 فرۆشتن و داواکاری خێرا: ${PHONE_SALES}\n`;
    msg += `💬 واتسئاپ و بۆت: ${PHONE_BOT}\n`;
    msg += `🏢 کۆمپانیای بازرگانی ڤێرتێکس (VERTEX) - هەولێر`;

    return msg;
  }

  // Execute the daily 30-day re-order check and dispatch
  async checkAndSendReorders() {
    if (!whatsappBaileys.isConnected) {
      console.warn('[ReorderCycle] WhatsApp Baileys is not connected. Skipping re-order cycle.');
      return { success: false, reason: 'whatsapp_not_connected' };
    }

    const candidates = this.getEligibleCandidates(30);
    console.log(`[ReorderCycle] 🔍 Found ${candidates.length} candidate(s) for 30-day re-order replenishment.`);

    if (candidates.length === 0) {
      return { success: true, count: 0, message: 'No customers due for 30-day reminder today.' };
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());
    let sentCount = 0;

    for (const cust of candidates) {
      try {
        const jid = `${cust.phone}@s.whatsapp.net`;
        const textMsg = this.generateKurdishReorderMessage(cust);

        await whatsappBaileys.sock.sendMessage(jid, { text: textMsg });

        // Update customer state
        cust.lastRemindedDate = todayStr;
        cust.reminderCount = (cust.reminderCount || 0) + 1;
        this.customers[cust.phone] = cust;
        this.saveCustomers();
        sentCount++;

        console.log(`[ReorderCycle] 📨 Sent 30-day re-order reminder to ${cust.name} (${cust.phone}).`);

        // Alert Telegram Topic 4 (Sales)
        const alertMsg = `🔄 <b>نامەی بیرخستنەوەی ٣٠ ڕۆژەی وەرەقە نێردرا!</b>\n\n` +
          `• <b>مارکێت:</b> <b>${cust.name}</b>\n` +
          `• <b>مۆبایل:</b> <code>${cust.phone}</code>\n` +
          `• <b>تێپەڕبوونی کات:</b> <b>${cust.daysElapsed} ڕۆژ</b> بەسەر کڕینی پێشوو\n` +
          `• <b>بەرواری کڕین:</b> <code>${cust.lastOrderDate}</code>\n` +
          `• <b>ژمارەی بیرخستنەوە:</b> #${cust.reminderCount}\n\n` +
          `<i>⚡ ئەگەر کڕیار بە ١ وەڵام بداتەوە بۆتەکە دەستبەجێ داواکاری نوێی بۆ تۆمار دەکات.</i>`;

        await telegramService.sendMessage(alertMsg, {
          threadId: config.TOPICS.SALES
        });

        // Delay 15-25 seconds between customer reminders
        await new Promise(r => setTimeout(r, 15000 + Math.random() * 10000));
      } catch (err) {
        console.error(`[ReorderCycle] Failed to send reminder to ${cust.phone}:`, err.message);
      }
    }

    return { success: true, count: sentCount };
  }

  // Preload historical Zoho clients into re-order tracker
  syncFromZohoClients() {
    const blacklistPath = path.join(__dirname, '..', 'state', 'zoho_clients_blacklist.json');
    if (!fs.existsSync(blacklistPath)) return 0;

    try {
      const blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
      let added = 0;

      // Estimated initial dates around 30 days ago for past buyers to seed system
      const initialDates = {
        '9647513926226': { name: 'Agrin Market', date: '2026-09-18' },
        '9647507285858': { name: 'Paytakht Market', date: '2026-09-16' },
        '9647504602877': { name: 'Ram', date: '2026-09-20' },
        '9647728621414': { name: 'Sherman', date: '2026-09-24' },
        '9647501301415': { name: 'Dilan', date: '2026-10-06' },
        '9647502908000': { name: 'Proware', date: '2026-10-18' },
        '9647506902242': { name: 'Nan W Nmak', date: '2026-09-15' },
        '9647501855860': { name: 'TSB Smart Tech', date: '2026-10-01' }
      };

      for (const [phone, info] of Object.entries(initialDates)) {
        if (!this.customers[phone]) {
          this.recordOrder(phone, info.name, info.date);
          added++;
        }
      }

      console.log(`[ReorderCycle] 🔄 Seeded ${added} existing Zoho clients into re-order tracker.`);
      return added;
    } catch (e) {
      console.error('[ReorderCycle] Seed error:', e.message);
      return 0;
    }
  }

  // Generate Telegram Summary Card
  getTelegramSummary() {
    const list = Object.values(this.customers);
    const eligible = this.getEligibleCandidates(30);

    let msg = `🔄 <b>سووڕی خودکاری پڕکردنەوەی مەخزەن (Re-order Automation)</b>\n\n`;
    msg += `• <b>کۆی کڕیارانی تۆمارکراو:</b> <code>${list.length}</code> کڕیار\n`;
    msg += `• <b>ئامادەکراو بۆ بیرخستنەوەی ٣٠ ڕۆژە:</b> <b>${eligible.length}</b> مارکێت\n`;
    msg += `• <b>کاتی پشکنینی ڕۆژانە:</b> هەموو ڕۆژێک لە کاتژمێر <b>١١:٣٠ی پێشنیوەڕۆ</b>\n\n`;

    if (eligible.length > 0) {
      msg += `📋 <b>مارکێتە شایستەکانی ئەمڕۆ (≥٣٠ ڕۆژ لەمەوبەر):</b>\n`;
      eligible.slice(0, 10).forEach((c, idx) => {
        msg += `${idx + 1}. <b>${c.name}</b> (<code>${c.phone}</code>)\n   کڕینی پێشوو: ${c.lastOrderDate} (پێش <b>${c.daysElapsed}</b> ڕۆژ)\n`;
      });
      msg += `\n<i>بۆ ناردنی دەستبەجێ دەتوانیت بنووسیت: <code>/reorder_check</code></i>\n`;
    } else {
      msg += `✨ <i>لە ئێستادا هیچ مارکێتێک نەگەیشتووەتە ٣٠ ڕۆژ، بە شێوەی خودکار کاتێک گەیشتە ٣٠ ڕۆژ پەیامەکەی بۆ دەڕوات.</i>\n`;
    }

    msg += `\n💡 <b>فەرمانەکانی بەڕێوەبردن لە تێلیگرام:</b>\n`;
    msg += `• <code>/reorder_check</code> ➔ پشکنین و ناردنی دەستبەجێ\n`;
    msg += `• <code>/reorder_add 0750xxxxxxx ناوی مارکێت 2026-09-20</code> ➔ زیادکردنی کڕیاری نوێ\n`;
    msg += `• <code>/reorder_pause 0750xxxxxxx</code> ➔ ڕاگرتنی پەیام بۆ ئەم ژمارەیە\n`;
    msg += `• <code>/reorder_resume 0750xxxxxxx</code> ➔ کاراکردنەوەی پەیام`;

    return msg;
  }
}

module.exports = new ReorderCycle();

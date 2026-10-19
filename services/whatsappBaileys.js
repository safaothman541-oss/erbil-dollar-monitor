const path = require('path');
const fs = require('fs');
const http = require('http');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const config = require('../config');
const dollarScraper = require('./dollarScraper');

const PHONE_1 = '\u200E0750 758 6992';
const PHONE_2 = '\u200E0750 529 9118';
const DELIVERY_NOTE = 'گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی)';

class WhatsAppBaileys {
  constructor() {
    this.authDir = path.join(__dirname, '..', 'state', 'baileys_auth');
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.sock = null;
    this.currentQr = null;
    this.currentQrDataUrl = null;
    this.isConnected = false;
    this.connectedUser = null;
    this.customerSessions = new Map();
    this.httpServer = null;
    this.profileConfigured = false;
  }

  getSession(phone) {
    if (!this.customerSessions.has(phone)) {
      this.customerSessions.set(phone, {
        welcomeSentAt: 0,
        mutedUntil: 0,
        lastInteractionAt: 0
      });
    }
    return this.customerSessions.get(phone);
  }

  async start() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    this.startHttpServer();
    await this.connectToWhatsApp();
  }

  async connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`[Baileys] Connecting to WhatsApp (v${version.join('.')})...`);

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Vertex AI Bot', 'Chrome', '1.0.0']
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQr = qr;
        this.isConnected = false;
        try {
          this.currentQrDataUrl = await QRCode.toDataURL(qr);
        } catch (e) {}

        console.log('\n============================================================');
        console.log('📱 [Baileys] سکانی ئەم بارکۆدە بکە بە مۆبایلەکەت لە WhatsApp:');
        console.log(`🌐 یان لە براوسەر ئەم بەستەرە بکەرەوە: http://localhost:${this.port}`);
        console.log('============================================================\n');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.currentQr = null;
        this.currentQrDataUrl = null;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[Baileys] Connection closed. Reason: ${statusCode || 'unknown'}. Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => this.connectToWhatsApp(), 3000);
        } else {
          console.log('[Baileys] Logged out. Cleaning auth state for new QR scan...');
          fs.rmSync(this.authDir, { recursive: true, force: true });
          setTimeout(() => this.connectToWhatsApp(), 2000);
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.currentQr = null;
        this.currentQrDataUrl = null;
        this.connectedUser = this.sock.user;
        console.log('\n============================================================');
        console.log(`🎉 [Baileys] سێرڤەری واتسئاپ بە سەرکەوتوویی پەیوەست بوو!`);
        console.log(`📱 ژمارەی بەستراوە: ${this.connectedUser.id.split(':')[0]}`);
        console.log('🤖 بۆتەکە ۲٤ کاتژمێر چالاکە و وەڵامی هەموو کڕیارێک دەداتەوە.');
        console.log('============================================================\n');

        // Automatically configure WhatsApp Business profile and identity
        this.setupBusinessProfile().catch(err => {
          console.warn('[Baileys] setupBusinessProfile background note:', err.message);
        });
      }
    });

    // Listen for incoming messages
    this.sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
          if (!msg.message) continue;
          if (msg.key.fromMe) continue; // Ignore messages sent by self

          const remoteJid = msg.key.remoteJid;
          if (remoteJid.endsWith('@g.us')) continue; // Ignore groups, handle private customer chats

          const text = msg.message.conversation ||
                       msg.message.extendedTextMessage?.text ||
                       msg.message.buttonsResponseMessage?.selectedButtonId ||
                       msg.message.templateButtonReplyMessage?.selectedId ||
                       '';

          if (!text || !text.trim()) continue;

          console.log(`[Baileys] Incoming message from ${remoteJid}: "${text}"`);
          await this.handleCustomerMessage(remoteJid, text.trim());
        }
      } catch (err) {
        console.error('[Baileys] Error in messages.upsert:', err);
      }
    });
  }

  async setupBusinessProfile(force = false) {
    if (this.profileConfigured && !force) return { success: true };
    try {
      console.log('[Baileys] ڕێکخستنی پرۆفایل و ناسنامەی فەرمی VERTEX...');

      // 1. WhatsApp About Status
      try {
        await this.sock.updateProfileStatus('🏢 کۆمپانیای VERTEX بۆ کەرەستەی POS و مارکێت | 📞 0750 529 9118');
        console.log('✅ [Baileys] نووسینی About لەسەر واتسئاپ دانرا.');
      } catch (e) {
        console.warn('[Baileys] updateProfileStatus note:', e.message);
      }

      // 2. Profile Picture
      try {
        const avatarPath = path.join(__dirname, '..', 'assets', 'vertex_avatar_square.jpg');
        if (fs.existsSync(avatarPath)) {
          const buf = fs.readFileSync(avatarPath);
          await this.sock.updateProfilePicture(this.sock.user.id, buf);
          console.log('✅ [Baileys] وێنەی پرۆفایلی لۆگۆی VERTEX دانرا.');
        }
      } catch (e) {
        console.warn('[Baileys] updateProfilePicture note:', e.message);
      }

      // 3. Business Profile (Description, Address, Email, Websites)
      try {
        await this.sock.updateBussinesProfile({
          description: 'کۆمپانیای بازرگانی گشتی VERTEX - دابینکردنی کاغەزی حەراری، پرینتەری پسوولە، بارکۆد سکانەر، کش دراوەر، تەرازووی دیجیتاڵ و سیستەمی تەواوی خاڵی فرۆش (POS) لە سەرانسەری عێراق.',
          address: 'عێراق - هەولێر - شەقامی سەرەکی',
          email: 'info@vertex1.tech',
          websites: ['https://vertex1.tech', 'https://t.me/vertexiqzone']
        });
        console.log('✅ [Baileys] زانیاری فەرمی پرۆفایلی بزنس (وەسف، ناونیشان، ئیمەیڵ، ماڵپەڕ) بە سەرکەوتوویی دانرا.');
      } catch (e) {
        console.warn('[Baileys] updateBussinesProfile note:', e.message);
      }

      this.profileConfigured = true;
      console.log('🌟 [Baileys] ناسنامەی فەرمی VERTEX لەسەر واتسئاپ جێبەجێکرا!');
      return { success: true };
    } catch (err) {
      console.warn('[Baileys] Error during business profile setup:', err.message);
      return { success: false, error: err.message };
    }
  }

  async handleCustomerMessage(remoteJid, text) {
    const fromPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const session = this.getSession(fromPhone);
    const now = Date.now();
    const lower = text.toLowerCase().trim();

    // Load showcase items
    let showcaseItems = [];
    try {
      const showcaseFile = path.join(__dirname, '..', 'assets', 'showcase_items.json');
      if (fs.existsSync(showcaseFile)) {
        showcaseItems = JSON.parse(fs.readFileSync(showcaseFile, 'utf8'));
      }
    } catch (e) {}

    // Get live dollar rate
    let currentRate = 1685;
    let rateStr = '168,500 دینار';
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1200));
      const market = await Promise.race([dollarScraper.getLatestMarketRate(), timeout]);
      if (market && market.ratePerDollar) {
        currentRate = market.ratePerDollar;
        rateStr = market.rawText || `${market.ratePer100.toLocaleString()} دینار`;
      }
    } catch (e) {}

    // Helper: Send text or image with caption
    const replyWithPhotoOrText = async (jid, caption, photoPath = null) => {
      try {
        if (photoPath && fs.existsSync(photoPath)) {
          return await this.sock.sendMessage(jid, {
            image: fs.readFileSync(photoPath),
            caption: caption
          });
        }
      } catch (err) {
        console.warn('[Baileys] Photo send failed, falling back to text:', err.message);
      }
      return await this.sock.sendMessage(jid, { text: caption });
    };

    // -------------------------------------------------------------
    // 1. SPECIFIC QUERY: DOLLAR RATE
    // -------------------------------------------------------------
    if (lower === '8' || lower.includes('دۆلار') || lower.includes('dollar') || lower.includes('صرف') || lower.includes('rate')) {
      let reply = `💵 *نوێترین نرخی دۆلار لە بازاڕی هەولێر:*\n\n`;
      reply += `• 100$ = *${rateStr}*\n`;
      reply += `• 1$ = *${currentRate.toLocaleString()} دینار*\n\n`;
      reply += `🏢 *کۆمپانیای Vertex*\n`;
      reply += `🌐 کەناڵی فەرمی: https://t.me/vertexiqzone\n`;
      reply += `📞 فرۆشتن: ${PHONE_1} | ${PHONE_2}`;
      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 2. CATEGORY 1: THERMAL PAPER & SUPPLIES (Panda)
    // -------------------------------------------------------------
    if (lower === '1' || lower.includes('کاغەز') || lower.includes('panda') || lower.includes('پانیدا') || lower.includes('8080') || lower.includes('رۆڵ')) {
      let reply = `🐼 *کەتەلۆگی کاغەزی حەراری Panda (High Quality)*\n\n`;
      reply += `1️⃣ *کاغەزی حەراری Panda 80×80 (کارتۆنی ٥٠ دانە):*\n`;
      reply += `• باشترین کوالێتی کاغەزی حەراری لە عێراق\n`;
      reply += `• نووسینی زۆر تۆخ، سەر و ددانی پرینتەر دەپارێزێت\n`;
      reply += `💰 نرخ: *$0.86* بۆ هەر ڕۆڵێک (~${Math.round(0.86 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `2️⃣ *ڕۆڵی کاغەزی 80mm × 19m:* *$0.50*\n`;
      reply += `3️⃣ *ڕۆڵی کاغەزی 58mm × 19m (مۆبایل و گەیاندن):* *$0.40*\n`;
      reply += `4️⃣ *لەیبڵ و ستیکەری 100×50mm:* *$8.50*\n`;
      reply += `5️⃣ *لەیبڵی 40×25mm و بارکۆد:* *$4.50*\n\n`;
      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن و کڕین: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = 'C:\\Users\\SAFA\\vertex-ads\\out\\approve_930e924d.png';
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 3. CATEGORY 2: RECEIPT PRINTERS (Novex, Epson, Zywell, Biison)
    // -------------------------------------------------------------
    if (lower === '2' || lower.includes('پرینتەری پسوولە') || lower.includes('پسوولە') || lower.includes('novex') || lower.includes('8370') || lower.includes('epson') || lower.includes('zywell')) {
      let reply = `🖨 *کەتەلۆگی پرینتەری پسوولەی کاشێر و مەتبەخ (POS)*\n\n`;
      reply += `🔹 *Novex 8370 Ultra Fast (پڕفرۆشترین):*\n`;
      reply += `• خێرایی چاپ: 260mm/s زۆر خێرا بە قاشکەری ئۆتۆماتیکی\n`;
      reply += `• پۆرتی: USB + LAN (شەبەکە بۆ ناردنی ئۆردەر بۆ مەتبەخ)\n`;
      reply += `💰 نرخ: *$53.00* (~${Math.round(53 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Epson TM-T20III Original:*\n`;
      reply += `• مارکەی جیهانی ئەپسن بە تەمەنی درێژ و چاپی نایاب\n`;
      reply += `💰 نرخ: *$215.00* (~${Math.round(215 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *BIISON B802 High Speed Receipt:*\n`;
      reply += `💰 نرخ: *$70.00* (~${Math.round(70 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = 'C:\\Users\\SAFA\\vertex-ads\\out\\approve_8cfba0c9.png';
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 4. CATEGORY 3: LABEL & BARCODE PRINTERS (Zebra, HPRT, Biison)
    // -------------------------------------------------------------
    if (lower === '3' || lower.includes('پرینتەری لەیبڵ') || lower.includes('ستیکەر') || lower.includes('zebra') || lower.includes('hprt') || lower.includes('biison')) {
      let reply = `🏷 *کەتەلۆگی پرینتەری لەیبڵ و بارکۆد (Label Printers)*\n\n`;
      reply += `🔹 *Zebra ZD220 Thermal Label Printer:*\n`;
      reply += `• مارکەی پلە یەکی جیهانی، بۆ چاپی ستیکەری نرخ، بارکۆد و کۆگا\n`;
      reply += `💰 نرخ: *$175.00* (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *HPRT LQ58 Label Printer:*\n`;
      reply += `💰 نرخ: *$115.00* (~${Math.round(115 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *BIISON B480B Thermal Label:*\n`;
      reply += `💰 نرخ: *$75.00* (~${Math.round(75 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = 'C:\\Users\\SAFA\\vertex-ads\\out\\approve_46d4ebbd.png';
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 5. CATEGORY 4: BARCODE SCANNERS
    // -------------------------------------------------------------
    if (lower === '4' || lower.includes('سکانەر') || lower.includes('scanner') || lower.includes('oddex') || lower.includes('بارکۆد')) {
      let reply = `🔫 *کەتەلۆگی بارکۆد سکانەری خێرا (1D / 2D / QR)*\n\n`;
      reply += `🔹 *ODDeX P55 High Speed Handheld:*\n`;
      reply += `• خوێندنەوەی هەموو جۆرە بارکۆد و QR Codeیەک، کواڵیتی پۆڵایین\n`;
      reply += `💰 نرخ: *$115.00* (~${Math.round(115 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *ODDeX 2D QR Desktop Omnidirectional (سەر مێزی مۆڵ و مارکێت):*\n`;
      reply += `💰 نرخ: *$95.00* (~${Math.round(95 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Pocket Wireless Bluetooth Scanner:*\n`;
      reply += `💰 نرخ: *$55.00* (~${Math.round(55 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = 'C:\\Users\\SAFA\\vertex-ads\\out\\approve_cfe7e2b9.png';
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 6. CATEGORY 5: CASH DRAWERS
    // -------------------------------------------------------------
    if (lower === '5' || lower.includes('دراوەر') || lower.includes('قاسە') || lower.includes('drawer') || lower.includes('cd-410')) {
      let reply = `💰 *کش دراوەری پارەی پۆڵایینی کاشێر (CD-410 6.5 KG)*\n\n`;
      reply += `• کێش: 6.5 کیلۆگرام ئاسنی قورس و زۆر بەهێز\n`;
      reply += `• ٥ خانی پارەی کاغەز + ٨ خانی وردە پارە\n`;
      reply += `• دەرچەی RJ11 (بەستنەوە بە پرینتەر بۆ کرانەوەی ئۆتۆماتیکی لە کاتی وەسڵ دەرچوون)\n`;
      reply += `• کلیل و قوفڵی سەلامەتی\n\n`;
      reply += `💰 نرخ: *$50.00* (~${Math.round(50 * currentRate).toLocaleString()} دینار)\n`;
      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = 'C:\\Users\\SAFA\\vertex-ads\\out\\approve_2b145377.png';
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 7. CATEGORY 6: POS SYSTEMS & DIGITAL SCALES
    // -------------------------------------------------------------
    if (lower === '6' || lower.includes('سیستەم') || lower.includes('تەرازوو') || lower.includes('sunmi') || lower.includes('rongta') || lower.includes('scale')) {
      let reply = `💻 *کەتەلۆگی سیستەمی تەواوی POS و تەرازووی دیجیتاڵ*\n\n`;
      reply += `🔹 *SUNMI V2 Android Smart POS Terminal:*\n`;
      reply += `• شاشەی لەمس، پرینتەری حەراری لەسەرخۆ، کامێرا و وایفای\n`;
      reply += `💰 نرخ: *$160.00* (~${Math.round(160 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *RONGTA RLS1000 Digital Barcode Scale (تەرازووی بارکۆد):*\n`;
      reply += `• تەرازووی دیجیتاڵی مارکێت و میوەفرۆشی بە چاپی لەیبڵ و بارکۆد\n`;
      reply += `💰 نرخ: *$240.00* (~${Math.round(240 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *BIISON POS System All-in-One:*\n`;
      reply += `💰 نرخ: *$320.00* (~${Math.round(320 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = 'C:\\Users\\SAFA\\vertex-ads\\out\\approve_993f9c26.png';
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 8. CATEGORY 7: PACKAGES & BUNDLE OFFERS
    // -------------------------------------------------------------
    if (lower === '7' || lower.includes('پاکێج') || lower.includes('ئۆفەر') || lower.includes('bundle') || lower.includes('pack')) {
      let reply = `🎁 *پاکێج و ئۆفەرە تایبەتەکانی VERTEX بۆ خاڵی فرۆش (POS)*\n\n`;
      reply += `🏪 *پاکێجی ١: سوپەرمارکێت و دەرمانخانە*\n`;
      reply += `• پرینتەری خێرای پسوولە بە قاشکەری ئۆتۆماتیکی\n`;
      reply += `• کش دراوەری پۆڵایینی 6.5 KG (CD-410)\n`;
      reply += `• بارکۆد سکانەری خێرا بە پایەوە\n`;
      reply += `• ١ کارتۆن کاغەزی Panda 80×80 (٥٠ دانە بەلاش)\n`;
      reply += `💰 *کۆی نرخ: $175.00* (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🍽 *پاکێجی ٢: چێشتخانە و کافێ (Kitchen LAN Pack)*\n`;
      reply += `• پرینتەری پسوولەی LAN (بەستنەوە لە کاشێرەوە بۆ مەتبەخ)\n`;
      reply += `• ١ کارتۆن کاغەزی Panda 80×80 (٥٠ دانە)\n`;
      reply += `💰 *کۆی نرخ: $89.00* (~${Math.round(89 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `📦 *پاکێجی ٣: جوملەی ١٠ کارتۆن کاغەزی Panda (٥٠٠ ڕۆڵ)*\n`;
      reply += `• نرخی داشکاندنی تایبەت: $0.85 بۆ ڕۆڵێک\n`;
      reply += `💰 *کۆی نرخ: $425.00* (~${Math.round(425 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردنی پاکێج: ${PHONE_1} | ${PHONE_2}`;

      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 9. CATEGORY 9: ADDRESS, HOURS, CONTACT
    // -------------------------------------------------------------
    if (lower === '9' || lower.includes('ناونیشان') || lower.includes('شوێن') || lower.includes('پەیوەندی') || lower.includes('تەلەفۆن') || lower.includes('کات')) {
      let reply = `🏢 *کۆمپانیای بازرگانی گشتی VERTEX*\n\n`;
      reply += `📍 *ناونیشان:* عێراق - هەولێر - شەقامی سەرەکی\n`;
      reply += `⏰ *کاتی دەوامی فەرمی:* ٩:٠٠ی بەیانی تا ٧:٠٠ی ئێوارە (شەممە تا پێنجشەممە)\n`;
      reply += `🌐 *وێبسایتی فەرمی:* https://vertex1.tech\n`;
      reply += `📢 *کەناڵی تێلیگرام:* https://t.me/vertexiqzone\n\n`;
      reply += `📞 *تەلەفۆن و واتسئاپ:* \n`;
      reply += `• ${PHONE_1}\n`;
      reply += `• ${PHONE_2}\n\n`;
      reply += `🚗 *گەیاندن بەردەستە بۆ هەموو شارەکانی کوردستان و عێراق* (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).`;

      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // ORDERING / PURCHASING GUIDE
    // -------------------------------------------------------------
    if (lower.includes('ئۆردەر') || lower.includes('داواکاری') || lower.includes('کڕین') || lower.includes('حجز') || lower.includes('طلب') || lower.includes('شراء') || lower.includes('order')) {
      let orderReply = `🛒 *داواکردنی کاڵا و تۆمارکردنی ئۆردەر*\n\n`;
      orderReply += `سوپاس بۆ پەیوەندیکردنتان بە کۆمپانیای VERTEX! تکایە ئەم زانیارییانە لێرە بنووسە:\n\n`;
      orderReply += `1️⃣ *ناوی کاڵای داواکراو و ژمارەی دانە* (نموونە: ١ کارتۆن کاغەزی پاندا)\n`;
      orderReply += `2️⃣ *ناوی بەڕێزتان و ژمارەی مۆبایل*\n`;
      orderReply += `3️⃣ *ناونیشانی تەواو* (شار، گەڕەک، نزیکترین شوێنی دیار)\n\n`;
      orderReply += `🚗 *گەیاندن:*\n${DELIVERY_NOTE}\n\n`;
      orderReply += `📞 تیمی فرۆشتنمان ڕاستەوخۆ پەیوەندیت پێوە دەکەن بۆ پشتڕاستکردنەوە:\n`;
      orderReply += `• ${PHONE_1}\n`;
      orderReply += `• ${PHONE_2}`;
      await this.sock.sendMessage(remoteJid, { text: orderReply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // DELIVERY & SHIPPING INQUIRY
    // -------------------------------------------------------------
    if (lower.includes('گەیاندن') || lower.includes('گواستنەوە') || lower.includes('شەحن') || lower.includes('توصيل') || lower.includes('شحن') || lower.includes('delivery')) {
      let deliveryReply = `🚗 *خزمەتگوزاری گەیاندن و گواستنەوەی VERTEX*\n\n`;
      deliveryReply += `• *شارەکان:* گەیاندن بەردەستە بۆ هەموو شار و شارۆچکەکانی عێراق و هەرێمی کوردستان (هەولێر، سلێمانی، دهۆک، کەرکووک، بەغدا و سەرجەم شارەکان).\n`;
      deliveryReply += `• *تێبینی گرنگ:* گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی و گونجاو بەپێی شارەکە حساب دەکرێت.\n`;
      deliveryReply += `• *ماوەی گەیشتن:* ناو هەولێر هەمان ڕۆژ یان ڕۆژی دواتر؛ بۆ شارەکانی تر لە ماوەی ٢٤ بۆ ٤٨ کاتژمێردا دەگات.\n\n`;
      deliveryReply += `📞 بەشی گەیاندن و فرۆشتن:\n`;
      deliveryReply += `• ${PHONE_1}\n`;
      deliveryReply += `• ${PHONE_2}`;
      await this.sock.sendMessage(remoteJid, { text: deliveryReply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // PDF PRICE LIST INQUIRY
    // -------------------------------------------------------------
    if (lower === 'pdf' || lower.includes('فایل') || lower.includes('لیستی pdf') || lower.includes('قائمة pdf')) {
      const pdfPath = path.join(__dirname, '..', 'Vertex_Price_List.pdf');
      if (fs.existsSync(pdfPath)) {
        await this.sock.sendMessage(remoteJid, {
          document: fs.readFileSync(pdfPath),
          fileName: 'Vertex_POS_Price_List_2026.pdf',
          mimetype: 'application/pdf',
          caption: `📄 *لیستی فەرمی نرخەکانی کۆمپانیای VERTEX (PDF)*\n\nتەواوی ٤١ بەرهەم و کەرەستەکانی خاڵی فرۆش لەگەڵ وێنە و تایبەتمەندییەکان.\n🚗 ${DELIVERY_NOTE}\n📞 ${PHONE_1} | ${PHONE_2}`
        });
        session.lastInteractionAt = now;
        return;
      }
    }

    // -------------------------------------------------------------
    // 10. GREETINGS & FULL MAIN MENU
    // -------------------------------------------------------------
    const greetingKeywords = [
      'سڵاو', 'سلام', 'slaw', 'hello', 'hi', 'مرحبا', 'سلاو', 'salam',
      'salam alaikum', 'assalam', 'سەلام', 'سلام علیکم', 'السلام عليكم',
      'slawe', 'سڵاو عەلەیکوم', 'چۆنی', 'باشی', 'menu', 'کەتەلۆگ', 'لیست',
      'نرخ', 'کاتالۆگ', 'کاتەلۆگ', 'catalog', 'prices', 'list', 'دەستپێک', 'سەرەتا', 'help'
    ];
    const isGreeting = greetingKeywords.some(g => lower === g || lower.startsWith(g + ' ') || lower.includes(g));
    const isFirstTime = !session.welcomeSentAt || (now - session.welcomeSentAt > 12 * 3600 * 1000);

    if (isGreeting || lower === '0' || isFirstTime) {
      let welcome = `🌟 *بەخێربێن بۆ کۆمپانیای ڤێرتێکس (Vertex)*\n`;
      welcome += `دابینکردنی کاغەزی حەراری و سەرجەم کەرەستەکانی خاڵی فرۆش (POS) لە عێراق.\n\n`;
      welcome += `📋 *کەتەلۆگی خێرا - ژمارەی بەشەکە بنووسە:*\n`;
      welcome += `1️⃣ 📄 کاغەزی حەراری و لەیبڵ (Panda & Rolls)\n`;
      welcome += `2️⃣ 🖨 پرینتەری پسوولەی کاشێر و مەتبەخ (Novex, Zywell, Epson)\n`;
      welcome += `3️⃣ 🏷 پرینتەری لەیبڵ و بارکۆد (Zebra, HPRT, Biison)\n`;
      welcome += `4️⃣ 🔫 بارکۆد سکانەری 1D/2D و بێ وایەر\n`;
      welcome += `5️⃣ 💰 کش دراوەری پارەی پۆڵایینی (CD-410)\n`;
      welcome += `6️⃣ 💻 سیستەمی تەواوی POS و تەرازووی دیجیتاڵ\n`;
      welcome += `7️⃣ 🎁 پاکێج و ئۆفەری تایبەتی POS\n`;
      welcome += `8️⃣ 💵 نوێترین نرخی دۆلاری بازاڕ\n`;
      welcome += `9️⃣ 📍 ناونیشان، کاتی دەوام و پەیوەندی\n\n`;
      welcome += `💡 دەتوانیت بنووسیت *«pdf»* بۆ وەرگرتنی فایل، یان *«ئۆردەر»* بۆ داواکردنی ڕاستەوخۆ.\n\n`;
      welcome += `🚗 *گەیاندن:*\n${DELIVERY_NOTE}\n\n`;
      welcome += `📞 *پەیوەندی بە فرۆشتن:*\n`;
      welcome += `• ${PHONE_1}\n`;
      welcome += `• ${PHONE_2}`;

      await this.sock.sendMessage(remoteJid, { text: welcome });
      session.welcomeSentAt = now;
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 11. DYNAMIC SEARCH ACROSS 41 PRODUCTS
    // -------------------------------------------------------------
    const matchedProducts = showcaseItems.filter(item => {
      const searchTerms = [item.name, item.brand, item.model, item.category].filter(Boolean).join(' ').toLowerCase();
      return searchTerms.includes(lower) || lower.split(' ').some(w => w.length > 2 && searchTerms.includes(w));
    });

    if (matchedProducts.length > 0) {
      const topMatch = matchedProducts[0];
      const priceIqd = Math.round(topMatch.priceUsd * currentRate);

      let caption = `🔍 *زانیاری کاڵا: ${topMatch.name}*\n\n`;
      if (topMatch.brand) caption += `🏢 *براند:* ${topMatch.brand}\n`;
      if (topMatch.model) caption += `🔖 *مۆدێل:* ${topMatch.model}\n`;
      if (topMatch.description) caption += `📝 ${topMatch.description}\n\n`;

      if (topMatch.specs && topMatch.specs.length > 0) {
        caption += `📋 *تایبەتمەندییەکان:*\n`;
        topMatch.specs.slice(0, 5).forEach(s => caption += `• ${s}\n`);
        caption += `\n`;
      }

      caption += `💰 *نرخ:* *$${topMatch.priceUsd.toFixed(2)}* (~*${priceIqd.toLocaleString()}* دینار)\n\n`;
      caption += `🚗 ${DELIVERY_NOTE}\n`;
      caption += `📞 داواکردن و کڕین: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = `C:\\Users\\SAFA\\vertex-ads\\out\\approve_${topMatch.shortId}.png`;
      await replyWithPhotoOrText(remoteJid, caption, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 12. UNRECOGNIZED -> GUIDE TO MENU
    // -------------------------------------------------------------
    let guideMsg = `بەڕێزم پەیامەکەت گەیشت، بە زووترین کات کارمەندانی فرۆشتن لێرە وەڵامت دەدەنەوە.\n\n`;
    guideMsg += `💡 دەتوانیت ژمارەیەک هەڵبژێریت یان ناوی کاڵاکە بنووسیت:\n`;
    guideMsg += `• بنووسە *«دۆلار»* بۆ نرخی بازاڕ\n`;
    guideMsg += `• بنووسە *«کەتەلۆگ»* بۆ بینینی هەموو ٩ بەشەکە\n\n`;
    guideMsg += `📞 پەیوەندی بەپەلە: ${PHONE_1} | ${PHONE_2}`;

    await this.sock.sendMessage(remoteJid, { text: guideMsg });
    session.lastInteractionAt = now;
    console.log(`[Baileys] Guidance sent to ${fromPhone}.`);
  }

  // Send message directly to any phone number
  async sendText(to, text) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp bot is not connected yet.');
    }
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const remoteJid = `${cleanTo}@s.whatsapp.net`;
    return this.sock.sendMessage(remoteJid, { text });
  }

  startHttpServer() {
    this.httpServer = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
      }

      // QR Code Page & Status Dashboard
      if (pathname === '/' || pathname === '/qr') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = this.renderStatusPage();
        return res.end(html);
      }

      // API: Check Status
      if (pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          connected: this.isConnected,
          user: this.connectedUser ? this.connectedUser.id.split(':')[0] : null,
          hasQr: !!this.currentQr
        }));
      }

      // API: Trigger Business Setup
      if (pathname === '/api/setup-business') {
        const resObj = await this.setupBusinessProfile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(resObj));
      }

      // API: Send Text
      if (pathname === '/api/send-text' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
          try {
            const { to, text } = JSON.parse(body);
            const result = await this.sendText(to, text);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    this.httpServer.listen(this.port, () => {
      console.log(`[Baileys Server] Vertex Linked WhatsApp Hub running on port ${this.port}`);
      console.log(`[Baileys Server] Open http://localhost:${this.port} to view and scan QR code.`);
    });
  }

  renderStatusPage() {
    return `<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VERTEX WhatsApp Linked Bot</title>
  <meta http-equiv="refresh" content="${this.isConnected ? '60' : '8'}">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #09090b 100%);
      color: #f4f4f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(24, 24, 27, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .badge-connected {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
    }
    .badge-waiting {
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid rgba(234, 179, 8, 0.3);
      color: #facc15;
    }
    .qr-container {
      background: white;
      padding: 16px;
      border-radius: 20px;
      display: inline-block;
      margin: 20px 0;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .qr-container img {
      width: 250px;
      height: 250px;
      display: block;
    }
    .steps {
      text-align: right;
      background: rgba(39, 39, 42, 0.6);
      border-radius: 16px;
      padding: 20px;
      margin-top: 24px;
      font-size: 14px;
      line-height: 1.8;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .steps div { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="card">
    ${this.isConnected ? `
      <div class="badge badge-connected">
        🟢 سێرڤەری واتسئاپ بزنس بە سەرکەوتوویی بەستراوەتەوە (Online)
      </div>
      <h1 style="font-size: 26px; margin-bottom: 8px; color: #fff;">VERTEX WhatsApp Business Hub</h1>
      <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 20px;">
        بۆتەکە ئێستا لەسەر ژمارەی <b>${this.connectedUser ? this.connectedUser.id.split(':')[0] : ''}</b> ۲٤ کاتژمێر چالاکە و وەڵامی هەموو کڕیارێک دەداتەوە!
      </p>

      <div style="background: rgba(39, 39, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; margin-bottom: 20px; text-align: right; font-size: 14px; line-height: 1.8;">
        <div style="color: #38bdf8; font-weight: 700; margin-bottom: 8px;">🏢 ناسنامە و پرۆفایلی واتسئاپ بزنس:</div>
        <div>• <b>ناو:</b> کۆمپانیای VERTEX بۆ کەرەستەی POS و مارکێت</div>
        <div>• <b>دەربارە (About):</b> 🏢 کۆمپانیای VERTEX بۆ کەرەستەی POS و مارکێت | 📞 0750 529 9118</div>
        <div>• <b>کەتەلۆگ:</b> ٤١ بەرهەمی فەرمی بە وێنەی 2K و نرخی ڕاستەوخۆ بە دۆلار و دینار</div>
        <div>• <b>دەوامی فەرمی:</b> ٩:٠٠ی بەیانی تا ٧:٠٠ی ئێوارە (شەممە تا پێنجشەممە)</div>
        <div>• <b>گەیاندن:</b> هەموو شارەکان بە کرێی ئاسایی (گەیاندن بێ بەرامبەر نییە)</div>
        <div>• <b>فرۆشتن:</b> \u200E0750 529 9118 | \u200E0750 758 6992</div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 16px;">
        <button onclick="syncBusiness()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px;">
          🔄 نوێکردنەوەی لۆگۆ و پرۆفایل
        </button>
      </div>
      <div id="syncResult" style="font-size: 13px; color: #4ade80; margin-bottom: 16px;"></div>

      <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 12px; padding: 14px; color: #86efac; font-size: 13px; text-align: right; line-height: 1.7;">
        ✨ <b>تاقیکردنەوە لە مۆبایلەوە:</b><br>
        هەر لە مۆبایلەکەتەوە یان لە ژمارەیەکی ترەوە ئەم وشانە بۆ ژمارە <b>0751 949 6848</b> بنێرە:<br>
        • <b>«کەتەلۆگ»</b> یان <b>«سڵاو»</b> ➔ بینینی هەر ٩ بەشەکە<br>
        • <b>«١» تا «٧»</b> ➔ کەتەلۆگ و وێنەی کوالێتی بەرز<br>
        • <b>«دۆلار»</b> ➔ نوێترین نرخی بازاڕی هەولێر<br>
        • <b>«ئۆردەر»</b> ➔ فۆڕمی داواکردنی خێرا
      </div>

      <script>
        async function syncBusiness() {
          const resEl = document.getElementById('syncResult');
          resEl.textContent = '⏳ پرۆفایل نوێ دەکرێتەوە...';
          try {
            const res = await fetch('/api/setup-business');
            const data = await res.json();
            if (data.success) {
              resEl.textContent = '✅ پرۆفایل و لۆگۆ بە سەرکەوتوویی نوێکرانەوە!';
            } else {
              resEl.textContent = 'تێبینی: ' + (data.error || 'تەواوبوو');
            }
          } catch (e) {
            resEl.textContent = '❌ هەڵە لە پەیوەندی: ' + e.message;
          }
        }
      </script>
    ` : `
      <div class="badge badge-waiting">
        ⏳ چاوەڕوانی سکانکردنی بارکۆد...
      </div>
      <h1 style="font-size: 24px; margin-bottom: 8px;">بەستنەوەی واتسئاپ بە بۆت</h1>
      <p style="color: #a1a1aa; font-size: 14px;">بە کامێرای مۆبایلت لە ناو واتسئاپ ئەم بارکۆدە سکان بکە:</p>

      ${this.currentQrDataUrl ? `
        <div class="qr-container">
          <img src="${this.currentQrDataUrl}" alt="WhatsApp QR Code">
        </div>
      ` : `
        <div style="padding: 60px 20px; color: #a1a1aa;">
          کەمێکی تر بارکۆد دەردەکەوێت...
        </div>
      `}

      <div class="steps">
        <div style="font-weight: 700; color: #fff; margin-bottom: 10px;">📋 هەنگاوەکان:</div>
        <div>١. ئەپی <b>WhatsApp</b> لەسەر مۆبایلەکەت بکەرەوە.</div>
        <div>٢. بچۆ سەر <b>Settings (ڕێکخستنەکان)</b> ➔ <b>Linked Devices (ئامێرە بەستراوەکان)</b>.</div>
        <div>٣. کلیک لەسەر <b>Link a Device</b> بکە و کامێراکە بگرە لەم بارکۆدەی سەرەوە.</div>
      </div>
    `}
  </div>
</body>
</html>`;
  }
}

const bot = new WhatsAppBaileys();
module.exports = bot;

if (require.main === module) {
  bot.start();
}

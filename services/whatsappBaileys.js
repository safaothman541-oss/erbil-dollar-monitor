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
    this.loadSessions();
  }

  loadSessions() {
    try {
      const sessFile = path.join(__dirname, '..', 'state', 'customer_sessions.json');
      if (fs.existsSync(sessFile)) {
        const raw = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
        this.customerSessions = new Map(Object.entries(raw));
      }
    } catch (e) {
      this.customerSessions = new Map();
    }
  }

  saveSessions() {
    try {
      const sessFile = path.join(__dirname, '..', 'state', 'customer_sessions.json');
      const obj = Object.fromEntries(this.customerSessions);
      fs.writeFileSync(sessFile, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {}
  }

  getSession(phone) {
    if (!this.customerSessions.has(phone)) {
      this.customerSessions.set(phone, {
        welcomeSentAt: 0,
        mutedUntil: 0,
        lastInteractionAt: 0
      });
      this.saveSessions();
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

    async sendMasterMenu(remoteJid) {
    let welcome = `🌟 *بەخێربێن بۆ کۆمپانیای VERTEX*\n`;
    welcome += `دابینکردنی کاغەزی حەراری و سەرجەم کەرەستەکانی خاڵی فرۆش (POS) لە عێراق بەپێی سیستەمی فەرمی Zoho Books.\n\n`;
    welcome += `🤖 *ڕێبەری هۆشمەندی خێرا - هەر ژمارەیەک بنووسیت کەتەلۆگ و نرخەکانی دەبینیت:*\n\n`;
    welcome += `1️⃣ 📄 *کاغەزی حەراری و لەیبڵ* (Panda 80×80, 80×19, 57×19 & Labels)\n`;
    welcome += `2️⃣ 🖨 *پرینتەری پسوولەی کاشێر* (Novex 8370, Xprinter, Zywell, Portable)\n`;
    welcome += `3️⃣ 🏷 *پرینتەری ستیکەر و بارکۆد* (Zebra ZD230, HPRT, Zywell 910, Van Gold)\n`;
    welcome += `4️⃣ 🔫 *بارکۆد سکانەری خێرا* (Honeywell Orbit/HF680, Zebra DS2208, Henex)\n`;
    welcome += `5️⃣ 💰 *کش دراوەری پارەی کاشێر* (X10 Heavy Duty Cash Drawer)\n`;
    welcome += `6️⃣ 💻 *سیستەمی POS و کۆمپیوتەر* (Venex POS, Dell AIO, Case i5)\n`;
    welcome += `7️⃣ 💵 *نوێترین نرخی کاتیی دۆلاری بازاڕ*\n`;
    welcome += `8️⃣ 📍 *ناونیشان، دەوام و پەیوەندی بە فرۆشتن*\n\n`;
    welcome += `💡 *فەرمانی خێرا:*\n`;
    welcome += `• بنووسە *«pdf»* ➔ بۆ فایلی فەرمی نرخەکان\n`;
    welcome += `• بنووسە *«ئۆردەر»* ➔ بۆ داواکردن و کڕین\n`;
    welcome += `• یان ڕاستەوخۆ *ناوی هەر کاڵایەک* بنووسە تا زانیاری و نرخەکەی ببینیت!\n\n`;
    welcome += `🚗 *گەیاندن:* بۆ هەموو شارەکان بەردەستە (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).\n`;
    welcome += `📞 *پەیوەندی بەپەلە:* ${PHONE_1} | ${PHONE_2}`;

    await this.sock.sendMessage(remoteJid, { text: welcome });
  }

  async handleCustomerMessage(remoteJid, text) {
    const fromPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const session = this.getSession(fromPhone);
    const now = Date.now();
    const lower = text.toLowerCase().trim();

    // -------------------------------------------------------------
    // FIRST-TIME ONBOARDING & GUIDANCE (سەرەتا ڕێنمایی تەواو پێدەدات)
    // -------------------------------------------------------------
    const isFirstTime = !session.welcomeSentAt || (now - session.welcomeSentAt > 24 * 3600 * 1000);

    if (isFirstTime) {
      session.welcomeSentAt = now;
      session.lastInteractionAt = now;
      this.saveSessions();
      await this.sendMasterMenu(remoteJid);

      // Check if the first message was purely a greeting or start command
      const greetingKeywords = [
        'سڵاو', 'سلام', 'slaw', 'hello', 'hi', 'مرحبا', 'سلاو', 'salam',
        'salam alaikum', 'assalam', 'سەلام', 'سلام علیکم', 'السلام عليكم',
        'slawe', 'سڵاو عەلەیکوم', 'چۆنی', 'باشی', 'menu', 'کەتەلۆگ', 'لیست',
        'نرخ', 'کاتالۆگ', 'کاتەلۆگ', 'catalog', 'prices', 'list', 'دەستپێک', 'سەرەتا', 'help', '0', '.'
      ];
      const isPureGreeting = greetingKeywords.some(g => lower === g || lower.startsWith(g + ' '));
      if (isPureGreeting) {
        return; // Master guide was already sent as the complete response!
      }
      // If their first message ALSO asked for a specific item (e.g. "کاغەز", "پرینتەر", "دۆلار"),
      // execution continues below to send that specific item right with it!
    }

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
        // -------------------------------------------------------------
    // 1. CATEGORY 1: THERMAL PAPER & LABELS (Panda & Labels from Zoho Books)
    // -------------------------------------------------------------
    if (lower === '1' || lower.includes('کاغەز') || lower.includes('panda') || lower.includes('پانیدا') || lower.includes('8080') || lower.includes('رۆڵ') || lower.includes('لەیبڵ') || lower.includes('ستیکەر')) {
      let reply = `🐼 *کاغەزی حەراری Panda و لەیبڵەکان (تۆمارکراو لە Zoho Books)*\n\n`;
      reply += `📄 *ڕۆڵەکانی کاغەزی پسوولە:*\n`;
      reply += `1️⃣ *Panda 80×80mm (کارتۆنی ٥٠ دانە):* *$1.25* بۆ هەر ڕۆڵێک (~${Math.round(1.25 * currentRate).toLocaleString()} دینار)\n`;
      reply += `2️⃣ *Panda 80×19m:* *$0.65* (~${Math.round(0.65 * currentRate).toLocaleString()} دینار)\n`;
      reply += `3️⃣ *Panda 57×19m (تەکسی و POS دەستی):* *$0.40* (~${Math.round(0.40 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🏷 *ڕۆڵەکانی لەیبڵ و بارکۆد (Thermal Labels):*\n`;
      reply += `• *Label 100×150mm (بۆ گەیاندن و کارگۆ):* *$11.00* (~${Math.round(11 * currentRate).toLocaleString()} دینار)\n`;
      reply += `• *Label 100×100mm:* *$7.50* (~${Math.round(7.5 * currentRate).toLocaleString()} دینار)\n`;
      reply += `• *Label 80×50mm (1000 دانەیی):* *$5.00* (~${Math.round(5 * currentRate).toLocaleString()} دینار)\n`;
      reply += `• *Label 58×39mm (Chinese):* *$2.00* (~${Math.round(2 * currentRate).toLocaleString()} دینار)\n`;
      reply += `• *Label 58×39mm (S):* *$1.10* (~${Math.round(1.1 * currentRate).toLocaleString()} دینار)\n`;
      reply += `• *Label 50×25mm:* *$2.00* (~${Math.round(2 * currentRate).toLocaleString()} دینار)\n`;
      reply += `• *Label 38×25mm:* *$2.00* (~${Math.round(2 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن و کڕین: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'panda_80_80.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 2. CATEGORY 2: RECEIPT PRINTERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '2' || lower.includes('پرینتەری پسوولە') || lower.includes('پسوولە') || lower.includes('novex') || lower.includes('8370') || lower.includes('xprinter') || lower.includes('xp-80') || lower.includes('zywell 310') || lower.includes('pt210') || lower.includes('rpp300')) {
      let reply = `🖨 *پرینتەرەکانی پسوولەی کاشێر و مەتبەخ (Zoho Books)*\n\n`;
      reply += `🔹 *Novex 8370 Fast Receipt Printer (USB + LAN):*\n`;
      reply += `• خێرایی چاپ: 220-260mm/s، قاشکەری ئۆتۆماتیک، گونجاو بۆ کاشێر و مەتبەخ\n`;
      reply += `💰 نرخ: *$53.00* (~${Math.round(53 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Xprinter XP-80T (Auto-Cutter + USB):*\n`;
      reply += `• خێرایی تا 200mm/s، دەرچەی سندوقی پارە\n`;
      reply += `💰 نرخ: *$45.00* (~${Math.round(45 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Zywell 310 Heavy-Duty Commercial Printer:*\n`;
      reply += `• زۆر بەهێز بۆ سوپەرمارکێت و چێشتخانەی زۆر قەرەباڵغ\n`;
      reply += `💰 نرخ: *$95.00* (~${Math.round(95 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *PT-210 Portable Bluetooth Printer (58mm):*\n`;
      reply += `• پاتری 1500mAh، چاپ ڕاستەوخۆ لە مۆبایلەوە (Android/iOS)\n`;
      reply += `💰 نرخ: *$37.00* (~${Math.round(37 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Rongta RPP300 Portable Bluetooth (80mm):*\n`;
      reply += `• پاتری 2000mAh، Bluetooth + USB، چاپی وەسڵی پان\n`;
      reply += `💰 نرخ: *$85.00* (~${Math.round(85 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Zywell M04 Portable Printer:*\n`;
      reply += `💰 نرخ: *$80.00* (~${Math.round(80 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'novex_8370.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 3. CATEGORY 3: LABEL & BARCODE PRINTERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '3' || lower.includes('پرینتەری لەیبڵ') || lower.includes('zebra') || lower.includes('zd230') || lower.includes('hprt') || lower.includes('lpq58') || lower.includes('zywell 910') || lower.includes('vg80') || lower.includes('van gold')) {
      let reply = `🏷 *پرینتەرەکانی لەیبڵ و بارکۆد ستیکەر (Zoho Books)*\n\n`;
      reply += `🔹 *Zebra ZD230 Desktop 4-inch Label Printer:*\n`;
      reply += `• مارکەی جیهانی ئەسڵی زێبرا، بۆ بارکۆدی کۆگا، نرخ و لەیبڵی گەیاندن (203 dpi)\n`;
      reply += `💰 نرخ: *$175.00* (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *HPRT LPQ58 Thermal Label Printer:*\n`;
      reply += `• پرینتەری پێشکەوتووی لەیبڵ و ستیکەری نرخ\n`;
      reply += `💰 نرخ: *$115.00* (~${Math.round(115 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Zywell 910 (ZY910) 4-inch Label Printer (USB + Bluetooth):*\n`;
      reply += `• چاپی ستیکەری 100×150 و 100×100 لە مۆبایل و کۆمپیوتەرەوە\n`;
      reply += `💰 نرخ: *$110.00* (~${Math.round(110 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Van Gold VG80 Label Printer:*\n`;
      reply += `• بۆ لەیبڵی سەر ڕەف، بارکۆد و ستیکەری کۆگا\n`;
      reply += `💰 نرخ: *$95.00* (~${Math.round(95 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'zebra_printer.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 4. CATEGORY 4: BARCODE SCANNERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '4' || lower.includes('سکانەر') || lower.includes('scanner') || lower.includes('orbit') || lower.includes('ds2208') || lower.includes('hf680') || lower.includes('henex') || lower.includes('symbol') || lower.includes('بارکۆد')) {
      let reply = `🔫 *بارکۆد سکانەرەکانی مارکێت و کۆگا (Zoho Books)*\n\n`;
      reply += `🔹 *Honeywell Orbit 7120 Omnidirectional Laser (سەر مێز):*\n`;
      reply += `• ٢٠ هێڵی لەیزەر، ١١٢٠ سکان لە چرکەیەکدا، سەری دەچەمێتەوە بۆ کاشێری خێرا\n`;
      reply += `💰 نرخ: *$120.00* (~${Math.round(120 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Honeywell HF680 2D Hands-free Presentation Scanner:*\n`;
      reply += `• خوێندنەوەی خێرای 1D و 2D لەسەر شاشەی مۆبایل و کاغەز\n`;
      reply += `💰 نرخ: *$125.00* (~${Math.round(125 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Zebra DS2208 2D Imager Handheld Scanner:*\n`;
      reply += `• مارکەی زێبرا، خوێندنەوەی بارکۆدی تێکچوو و هەموو جۆرە کۆدێک\n`;
      reply += `💰 نرخ: *$125.00* (~${Math.round(125 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Zebra LS2208 Laser Scanner (Symbol):*\n`;
      reply += `• سکانەری بەناوبانگی بەهێزی شووشە دژە ڕووشان بۆ کاشێر\n`;
      reply += `💰 نرخ: *$105.00* (~${Math.round(105 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Henex 6052 2D Desktop Omnidirectional:*\n`;
      reply += `💰 نرخ: *$85.00* (~${Math.round(85 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Henex 2210 2D Wireless Scanner (2.4G & Bluetooth):*\n`;
      reply += `• بێتەل مەودای ١٠٠ مەتر بۆ کۆگا و مارکێت\n`;
      reply += `💰 نرخ: *$75.00* (~${Math.round(75 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Henex Wired 1D/2D QR Scanner:*\n`;
      reply += `• سکانەری وایەردار بە کوالێتی بەرز بۆ کاشێر\n`;
      reply += `💰 نرخ: *$50.00* (~${Math.round(50 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'honeywell_orbit.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 5. CATEGORY 5: CASH DRAWERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '5' || lower.includes('دراوەر') || lower.includes('قاسە') || lower.includes('drawer') || lower.includes('cash drawer') || lower.includes('x10')) {
      let reply = `💰 *سندوقی پارەی ئۆتۆماتیکی پۆڵایین (X10 Cash Drawer)*\n\n`;
      reply += `• ئاسنی قورسی تۆکمە و زۆر بەهێز\n`;
      reply += `• ٥ خانی پارەی کاغەز + ٨ خانی وردە پارە\n`;
      reply += `• پۆرتی RJ11 بۆ بەستنەوە بە پرینتەر (خۆکارانە دەکرێتەوە لە کاتی دەرچوونی وەسڵ)\n`;
      reply += `• کلیلی تایبەتی سەلامەتی\n\n`;
      reply += `💰 نرخ: *$45.00* (~${Math.round(45 * currentRate).toLocaleString()} دینار)\n`;
      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'cash_drawer.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 6. CATEGORY 6: POS SYSTEMS & COMPUTERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '6' || lower.includes('سیستەم') || lower.includes('pos') || lower.includes('venex') || lower.includes('aio') || lower.includes('dell') || lower.includes('کۆمپیوتەر')) {
      let reply = `💻 *سیستەمی تەواوی POS و کۆمپیوتەری ژمێریاری (Zoho Books)*\n\n`;
      reply += `🔹 *Venex POS Terminal (Double Screen):*\n`;
      reply += `• Core i5 (5th gen)، 8GB RAM، 128GB SSD، دوو شاشە بۆ کڕیار و کاشێر\n`;
      reply += `💰 نرخ: *$360.00* (~${Math.round(360 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Dell All-in-One (AIO):*\n`;
      reply += `• ئامێری یەکپارچەی دێڵ بۆ سیستمەکانی ژمێریاری\n`;
      reply += `💰 نرخ: *$350.00* (~${Math.round(350 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Case Core i5 (6th gen):*\n`;
      reply += `• کیس کۆمپیوتەری کارا بۆ سیستەمی مارکێت\n`;
      reply += `💰 نرخ: *$285.00* (~${Math.round(285 * currentRate).toLocaleString()} دینار)\n\n`;

      reply += `🔹 *Dell OptiPlex 7020 Case:* *$650.00*\n`;
      reply += `🔹 *Lenovo ThinkCentre Neo 30s:* *$625.00*\n`;
      reply += `🔹 *HP Zbook Workstation:* *$230.00*\n`;
      reply += `🔹 *Monitor LG 24-inch (24MS500-B):* *$95.00*\n\n`;

      reply += `🚗 ${DELIVERY_NOTE}\n`;
      reply += `📞 داواکردن: ${PHONE_1} | ${PHONE_2}`;

      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 7. SPECIFIC QUERY: DOLLAR RATE
    // -------------------------------------------------------------
    if (lower === '7' || lower.includes('دۆلار') || lower.includes('dollar') || lower.includes('صرف') || lower.includes('rate')) {
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
    // 8. CATEGORY 8: ADDRESS, HOURS, CONTACT
    // -------------------------------------------------------------
    if (lower === '8' || lower.includes('ناونیشان') || lower.includes('شوێن') || lower.includes('پەیوەندی') || lower.includes('تەلەفۆن') || lower.includes('کات')) {
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
    // PACKAGE INQUIRY EXPLANATION (پاکێج بە تەواوی لابراوە)
    // -------------------------------------------------------------
    if (lower.includes('پاکێج') || lower.includes('ئۆفەر') || lower.includes('bundle') || lower.includes('pack')) {
      let reply = `ℹ️ *ئاگاداری دەربارەی پاکێج و کاڵاکان:*\n\n`;
      reply += `سەرجەم بەرهەمەکان بە شێوەی سەربەخۆ و ڕاستەوخۆ بەپێی کۆگای فەرمی Zoho Books بە کواڵیتی باڵا و گەرەنتی بەردەستن.\n\n`;
      reply += `👇 تکایە ژمارەی بەشەکە هەڵبژێرە لە ١ تا ٨:\n`;
      reply += `1️⃣ کاغەزی حەراری و لەیبڵ\n`;
      reply += `2️⃣ پرینتەری پسوولە\n`;
      reply += `3️⃣ پرینتەری لەیبڵ و ستیکەر\n`;
      reply += `4️⃣ بارکۆد سکانەر\n`;
      reply += `5️⃣ کش دراوەری پارە\n`;
      reply += `6️⃣ سیستەمی POS و کۆمپیوتەر\n`;
      reply += `7️⃣ نرخی دۆلار\n`;
      reply += `8️⃣ پەیوەندی و ناونیشان\n\n`;
      reply += `📞 پرسیار و فرۆشتن: ${PHONE_1} | ${PHONE_2}`;
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
          caption: `📄 *لیستی فەرمی نرخەکانی کۆمپانیای VERTEX (PDF)*\n\nتەواوی کاڵاکانی کۆمپانیای VERTEX بەپێی کۆگای زۆهۆ (Zoho Books) لەگەڵ وێنە و تایبەتمەندییەکان.\n🚗 ${DELIVERY_NOTE}\n📞 ${PHONE_1} | ${PHONE_2}`
        });
        session.lastInteractionAt = now;
        return;
      }
    }

    // -------------------------------------------------------------
    // 10. EXPLICIT REQUEST FOR MAIN MENU / CATALOG
    // -------------------------------------------------------------
    const menuKeywords = [
      'سڵاو', 'سلام', 'slaw', 'hello', 'hi', 'مرحبا', 'سلاو', 'salam',
      'salam alaikum', 'assalam', 'سەلام', 'سلام علیکم', 'السلام عليكم',
      'slawe', 'سڵاو عەلەیکوم', 'چۆنی', 'باشی', 'menu', 'کەتەلۆگ', 'لیست',
      'نرخ', 'کاتالۆگ', 'کاتەلۆگ', 'catalog', 'prices', 'list', 'دەستپێک', 'سەرەتا', 'help', '0'
    ];
    const wantsMenu = menuKeywords.some(g => lower === g || lower.startsWith(g + ' ') || lower.includes(g));

    if (wantsMenu) {
      await this.sendMasterMenu(remoteJid);
      session.lastInteractionAt = now;
      this.saveSessions();
      return;
    }

    // -------------------------------------------------------------
    // 11. DYNAMIC SEARCH ACROSS ZOHO BOOKS PRODUCTS
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

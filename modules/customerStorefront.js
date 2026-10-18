const config = require('../config');
const telegramService = require('../services/telegramService');
const zohoService = require('../services/zohoService');
const dollarScraper = require('../services/dollarScraper');
const fs = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, '..', 'state', 'customer_orders.json');

// Session storage for in-progress orders (chatId -> session)
const userSessions = new Map();

function loadOrders() {
  if (fs.existsSync(ORDERS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    } catch (e) {}
  }
  return [];
}

function saveOrder(order) {
  const dir = path.dirname(ORDERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const orders = loadOrders();
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

// Product catalog definitions with marketing details
const PRODUCTS = {
  // Papers
  '8080P': {
    name: 'کاغەزی حەراری Panda 80*80',
    category: 'paper',
    sku: '8080P',
    unit: 'ڕۆڵ',
    cartonSize: 50,
    priceUsd: 0.86,
    wholesaleUsd: 0.84,
    description: 'کاغەزی حەراری کواڵیتی باڵای Panda قەبارەی 80×80 ملم.\n• گونجاوە بۆ هەموو جۆرە پرینتەرێکی پسوولە (Epson, Novex, Xprinter, Zywell).\n• نووسینی زۆر تۆخ و درەوشاوە، سەری پرینتەرەکەت لە سووتان دەپارێزێت.\n• پاکەتی ٥٠ دانەیی (کارتۆن).',
    presets: [50, 100, 250, 500]
  },
  'PaperRoll-Panda': {
    name: 'کاغەزی حەراری Panda 80*19',
    category: 'paper',
    sku: 'PaperRoll-Panda',
    unit: 'ڕۆڵ',
    cartonSize: 100,
    priceUsd: 0.65,
    wholesaleUsd: 0.60,
    description: 'کاغەزی حەراری Panda 80*19 ملم.\n• گونجاوە بۆ پرینتەری بچووک و ژمێریاری کاش.\n• کواڵیتی باڵا و تۆخی چاپ.',
    presets: [50, 100, 200]
  },
  'Paper Roll Panda': {
    name: 'کاغەزی حەراری 57*19 ملم',
    category: 'paper',
    sku: 'Paper Roll Panda',
    unit: 'ڕۆڵ',
    cartonSize: 100,
    priceUsd: 0.40,
    wholesaleUsd: 0.35,
    description: 'کاغەزی حەراری بۆ پرینتەری پرۆتۆبڵ و دەستی و تەکسی و ڤیزا کارد (POS).\n• پانی 57 ملم.',
    presets: [50, 100, 200]
  },

  // Printers
  'Novex-8370': {
    name: 'پرینتەری پسوولەی Novex 8370',
    category: 'printers',
    sku: 'Novex-8370',
    unit: 'ئامێر',
    priceUsd: 53.00,
    wholesaleUsd: 49.00,
    description: 'پرینتەری خێرای گەرمیی پسوولە (Thermal Receipt Printer).\n• خێرایی چاپ: 260 ملم لە چرکەیەکدا (Ultra Fast).\n• بەستنەوە: USB + LAN (شەبەکە) - گونجاوە بۆ چێشتخانە و مطبخ و کاشێر.\n• قاشکەری ئۆتۆماتیکی (Auto-Cutter) بە توانای زیاتر لە ١.٥ ملیۆن بڕین.\n• گەرەنتی ڕاستەقینەی کارکردن.',
    presets: [1, 2, 3, 5]
  },
  'zywell 310': {
    name: 'پرینتەری پسوولەی Zywell 310',
    category: 'printers',
    sku: 'zywell 310',
    unit: 'ئامێر',
    priceUsd: 95.00,
    wholesaleUsd: 88.00,
    description: 'پرینتەری پێشکەوتووی بازرگانی Zywell 310.\n• بەهێز بۆ شوێنی زۆر قەرەباڵغ و سوپەرمارکێتە گەورەکان.\n• پۆرتەکانی LAN و USB و Serial.',
    presets: [1, 2, 5]
  },
  'Label Printer- VG80': {
    name: 'پرینتەری لەیبڵی Van Gold VG80',
    category: 'printers',
    sku: 'Label Printer- VG80',
    unit: 'ئامێر',
    priceUsd: 95.00,
    wholesaleUsd: 90.00,
    description: 'پرینتەری لەیبڵ و بارکۆد ستیکەری ڤان گۆڵد.\n• چاپی ڕاستەوخۆی بارکۆد، نرخی سەر ڕەف، و لەیبڵی دیلیڤەری.',
    presets: [1, 2]
  },
  'ZEBRA-ZD230': {
    name: 'پرینتەری لەیبڵی Zebra ZD230 ئەسڵی',
    category: 'printers',
    sku: 'ZEBRA-ZD230',
    unit: 'ئامێر',
    priceUsd: 175.00,
    wholesaleUsd: 168.00,
    description: 'پرینتەری پیشەسازی ناوداری جیهانی Zebra ZD230.\n• بەرگەی کارکردنی بەردەوام و بڕی زۆر دەگرێت.\n• زۆر گونجاو بۆ کۆگا و کارگە و دەرمانخانەکان.',
    presets: [1, 2]
  },

  // Scanners
  'Henex-Wired': {
    name: 'بارکۆد سکانەری Henex Wired',
    category: 'scanners',
    sku: 'Henex-Wired',
    unit: 'دانە',
    priceUsd: 50.00,
    wholesaleUsd: 45.00,
    description: 'بارکۆد سکانەری خێرا بە وایەر.\n• خوێندنەوەی هەموو جۆرە بارکۆدێکی 1D و 2D (QR Code).\n• لەسەر شاشەی مۆبایلیش بارکۆد دەخوێنێتەوە بە خێرایی بەرز.',
    presets: [1, 2, 5]
  },
  'Henex-2210': {
    name: 'بارکۆد سکانەری بێتەل Henex 2210 (Wireless)',
    category: 'scanners',
    sku: 'Henex-2210',
    unit: 'دانە',
    priceUsd: 75.00,
    wholesaleUsd: 70.00,
    description: 'بارکۆد سکانەری بێتەل (Wireless 2.4G & Bluetooth).\n• مەودای کارکردن تا ١٠٠ مەتر.\n• پاتری بەهێز بۆ زیاتر لە ٢٤ کاتژمێر کارکردنی بەردەوام.',
    presets: [1, 2]
  },
  'HONEYWELL-ORBIT7120': {
    name: 'بارکۆد سکانەری سەر مێز Honeywell Orbit 7120',
    category: 'scanners',
    sku: 'HONEYWELL-ORBIT7120',
    unit: 'دانە',
    priceUsd: 120.00,
    wholesaleUsd: 115.00,
    description: 'سکانەری دەسکتۆپی ئۆربێت ناسراو بە لێزەری چەند ئاڕاستەیی.\n• تایبەت بە کاشێری مارکێتە قەرەباڵغەکان بۆ لێدانی خێرای کاڵاکان.',
    presets: [1, 2]
  },

  // POS Hardware
  'X10-CASH DRAWER': {
    name: 'سندوقی پارەی ئۆتۆماتیکی (Cash Drawer)',
    category: 'pos_hardware',
    sku: 'X10-CASH DRAWER',
    unit: 'دانە',
    priceUsd: 45.00,
    wholesaleUsd: 40.00,
    description: 'کش دراوەری پارەی بەهێزی ئاسنینی قورس.\n• ٥ بەشی دۆلار و دینار + بەشی دراوی ئاسن.\n• بەستنەوەی ڕاستەوخۆ بە پرینتەری پسوولە کە لە کاتی دەرچوونی وەسڵ خۆکار دەکرێتەوە.',
    presets: [1, 2, 5]
  },

  // Special Bundles (Strictly calculated for High Net Profit)
  'bundle_supermarket': {
    name: '🏪 پاکێجی دەستپێکی مارکێت (Supermarket Starter Pack)',
    category: 'bundles',
    sku: 'BUNDLE-MKT',
    unit: 'پاکێج',
    priceUsd: 175.00,
    originalPriceUsd: 191.00,
    description: '🌟 <b>تەواوترین پاکێج بۆ هەر کەسێک کە مارکێت یان فرۆشگا دەکاتەوە:</b>\n' +
      '  1️⃣ پرینتەری خێرای Novex 8370 بە خێرایی 260mm/s و قاشکەری ئۆتۆماتیک.\n' +
      '  2️⃣ کش دراوەری ئۆتۆماتیکی قورسی پارە (Heavy Duty Cash Drawer).\n' +
      '  3️⃣ بارکۆد سکانەری خێرای Henex Wired.\n' +
      '  4️⃣ یەک کارتۆنی تەواو کاغەزی ئەسڵی Panda 80*80 (٥٠ ڕۆڵ).\n\n' +
      '• کۆی نرخی تاک بە تاکیان لە بازاڕ: $191 ❌\n' +
      '• <b>نرخی پاکێج پێکەوە: تەنها $175 ✅</b> (کڕیار $16 داشکاندنی دەستدەکەوێت).',
    presets: [1, 2]
  },
  'bundle_restaurant': {
    name: '🍽 پاکێجی چێشتخانە و کافێ (Restaurant Pack)',
    category: 'bundles',
    sku: 'BUNDLE-REST',
    unit: 'پاکێج',
    priceUsd: 89.00,
    originalPriceUsd: 96.00,
    description: '🔥 <b>پاکێجی تایبەت بە چێشتخانە و کافێ:</b>\n' +
      '  1️⃣ پرینتەری خێرای Novex 8370 بە پۆرتی LAN (شەبەکە) تایبەت بە مطبخ و کاشێر.\n' +
      '  2️⃣ یەک کارتۆن کاغەزی ئەسڵی Panda 80*80 (٥٠ ڕۆڵ).\n\n' +
      '• کۆی نرخ بە جیا: $96 ❌\n' +
      '• <b>نرخی پاکێج: تەنها $89 ✅</b>',
    presets: [1, 2]
  },
  'bundle_bulk_paper': {
    name: '📦 ئۆفەری جوملەی کاغەزی Panda 80*80 (١٠ کارتۆن)',
    category: 'bundles',
    sku: 'BUNDLE-PAPER-10',
    unit: 'ئۆفەر (١٠ کارتۆن)',
    priceUsd: 425.00, // 10 * 50 * 0.85 = 425
    originalPriceUsd: 430.00,
    description: '🚚 <b>ئۆفەری تایبەتی جوملە بۆ سوپەرمارکێت و دەرمانخانە:</b>\n' +
      '  • ١٠ کارتۆن کاغەزی ئەسڵی Panda 80*80 (٥٠٠ ڕۆڵ).\n' +
      '  • نرخی دانە حیسابکراوە بە: <b>$0.85</b> لە جیاتی $0.86.\n' +
      '  • <b>گەیاندن:</b> بەردەستە بۆ هەموو شارەکان.',
    presets: [1, 2]
  }
};

class CustomerStorefront {
  getMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📄 کاغەزی حەراری (Panda Rolls)', callback_data: 'cat:paper' },
          { text: '🖨 پرینتەری پسوولە و لەیبڵ', callback_data: 'cat:printers' }
        ],
        [
          { text: '🔫 بارکۆد سکانەر', callback_data: 'cat:scanners' },
          { text: '💰 کش دراوەر و ئامێری POS', callback_data: 'cat:pos_hardware' }
        ],
        [
          { text: '🎁 ئۆفەر و پاکێجی تایبەت (داشکاندن)', callback_data: 'cat:bundles' }
        ],
        [
          { text: '📄 داگرتنی لیستی فەرمیی نرخەکان (PDF)', callback_data: 'action:download_pdf' }
        ],
        [
          { text: '📞 پەیوەندی و ناونیشان', callback_data: 'cat:contact' },
          { text: '💵 نرخی دۆلاری بازاڕ', callback_data: 'cat:dollar' }
        ]
      ]
    };
  }

  async sendWelcome(chatId) {
    let msg = `🏪 <b>بەخێربێن بۆ فڕۆشگای فەرمیی کۆمپانیای Vertex</b>\n\n`;
    msg += `کۆمپانیای <b>Vertex</b> دابینکەری سەرەکییە بۆ:\n`;
    msg += `• کاغەزی حەراریی پلە یەکی <b>Panda</b> بە هەموو قەبارەکان.\n`;
    msg += `• ئامێر و پرینتەری پێشکەوتووی مارکێت، چێشتخانە و دەرمانخانە.\n`;
    msg += `• کەرەستە و پێداویستییەکانی سیستەمی بارکۆد و ژمێریاری (POS).\n\n`;
    msg += `👇 <i>تکایە بەشێک هەڵبژێرە بۆ بینینی کاڵاکان و نرخەکانیان:</i>`;

    return telegramService.sendMessage(msg, {
      chatId,
      replyMarkup: this.getMainMenuKeyboard()
    });
  }

  async resolveProductWithZoho(productId) {
    const p = PRODUCTS[productId];
    if (!p) return null;

    if (p.category === 'bundles') {
      return p;
    }

    try {
      const items = await zohoService.getItems();
      const zohoItem = items.find(it => (it.sku && it.sku === p.sku) || (it.name && it.name === p.name));
      if (zohoItem && zohoItem.rate !== undefined && zohoItem.rate !== null) {
        return {
          ...p,
          priceUsd: zohoItem.rate, // Dynamic live Zoho Books selling price!
          stockOnHand: zohoItem.actual_available_stock !== undefined ? zohoItem.actual_available_stock : zohoItem.stock_on_hand
        };
      }
    } catch (e) {
      console.error('[Storefront] Could not fetch live Zoho rate, using fallback:', e.message);
    }
    return p;
  }

  async sendCategory(chatId, categoryKey, currentRate) {
    const matchedKeys = Object.keys(PRODUCTS).filter(id => PRODUCTS[id].category === categoryKey);

    if (matchedKeys.length === 0) {
      return telegramService.sendMessage('ئەم بەشە لە ئێستادا بەردەست نییە.', { chatId });
    }

    const catTitles = {
      paper: '📄 بەشی کاغەزی حەراری (Panda Thermal Rolls)',
      printers: '🖨 بەشی پرینتەری پسوولە و لەیبڵ',
      scanners: '🔫 بەشی بارکۆد سکانەر',
      pos_hardware: '💰 بەشی کش دراوەر و کەلوپەلی POS',
      bundles: '🎁 بەشی ئۆفەر و پاکێجی تایبەت (تخفیض)'
    };

    let text = `<b>${catTitles[categoryKey] || 'کاڵاکان'}</b>\n\n`;
    text += `نرخەکان ڕاستەوخۆ لە <b>Zoho Books</b> بەپێی نرخی بازاڕ (1$ = ${currentRate} د.ع):\n`;
    text += `---------------------------------\n\n`;

    const buttons = [];

    for (const id of matchedKeys) {
      const p = await this.resolveProductWithZoho(id);
      const priceIqd = Math.round(p.priceUsd * currentRate);
      text += `🔹 <b>${p.name}</b>\n`;
      text += `  • نرخی تاک: <b>$${p.priceUsd}</b> (~${priceIqd.toLocaleString()} د.ع)\n`;
      if (p.category !== 'bundles') {
        text += `  • 📞 <i>بۆ نرخی جوملە: پەیوەندیمان پێوە بکەن</i>\n`;
      }
      text += `\n`;

      buttons.push([{
        text: `🔍 بینین و داواکردنی ${p.name.slice(0, 24)}`,
        callback_data: `prod:${id}`
      }]);
    }

    buttons.push([{ text: '🔙 گەڕانەوە بۆ بەشە سەرەکییەکان', callback_data: 'cat:home' }]);

    return telegramService.sendMessage(text, {
      chatId,
      replyMarkup: { inline_keyboard: buttons }
    });
  }

  async sendProductDetails(chatId, productId, currentRate) {
    const p = await this.resolveProductWithZoho(productId);
    if (!p) return;

    const priceIqd = Math.round(p.priceUsd * currentRate);

    let text = `📦 <b>${p.name}</b>\n\n`;
    text += `${p.description}\n\n`;
    text += `---------------------------------\n`;
    text += `💰 <b>نرخی فەرمیی تاک (Zoho):</b> <b>$${p.priceUsd}</b> (~${priceIqd.toLocaleString()} دینار)\n`;
    
    if (p.category !== 'bundles') {
      text += `📦 <b>بڕی جوملە:</b> تکایە ڕاستەوخۆ پەیوەندیمان پێوە بکەن بۆ وەرگرتنی داشکاندنی تایبەتی جوملە.\n`;
    }
    
    text += `✅ <b>دۆخی کۆگا:</b> بەردەستە لە مەخزەن\n`;
    text += `🚚 <b>گەیاندن:</b> بەردەستە بۆ هەموو شارەکانی کوردستان و عێراق\n`;

    const buttons = [
      [{ text: '🛒 داواکردنی ئەم کاڵایە (نرخی تاک)', callback_data: `order_start:${productId}` }]
    ];

    if (p.category !== 'bundles') {
      buttons.push([{ text: '📞 داواکردنی نرخی جوملە (پەیوەندی)', callback_data: 'cat:contact' }]);
    }

    buttons.push([
      { text: '🔙 گەڕانەوە بۆ بەشەکە', callback_data: `cat:${p.category}` },
      { text: '🏠 سەرەتا', callback_data: 'cat:home' }
    ]);

    return telegramService.sendMessage(text, {
      chatId,
      replyMarkup: { inline_keyboard: buttons }
    });
  }

  async startOrderFlow(chatId, productId) {
    const p = PRODUCTS[productId];
    if (!p) return;

    userSessions.set(chatId, {
      step: 'quantity',
      productId: productId,
      quantity: 1
    });

    const buttons = [];
    const presets = p.presets || [1, 2, 5, 10];
    
    // Create preset buttons
    const row = [];
    presets.forEach(qty => {
      row.push({
        text: `${qty} ${p.unit || 'دانە'}`,
        callback_data: `order_qty:${qty}`
      });
    });
    buttons.push(row);
    buttons.push([{ text: '❌ پاشگەزبوونەوە', callback_data: 'cat:home' }]);

    let msg = `🛒 <b>داواکردنی: [${p.name}]</b>\n\n`;
    msg += `تکایە بڕی داواکراو دیاری بکە بە دوگمەکانی خوارەوە، یان ژمارەی دڵخوازی خۆت لە چاتەکەدا بنووسە:`;

    return telegramService.sendMessage(msg, {
      chatId,
      replyMarkup: { inline_keyboard: buttons }
    });
  }

  async handleQuantitySelected(chatId, qty) {
    const session = userSessions.get(chatId);
    if (!session) return;

    session.quantity = parseInt(qty, 10) || 1;
    session.step = 'customer_info';
    userSessions.set(chatId, session);

    const p = PRODUCTS[session.productId];

    let msg = `👍 <b>بڕی دیاریکراو:</b> ${session.quantity} ${p.unit || 'دانە'}\n\n`;
    msg += `تکایە <b>ناوی خۆت / ناوی مارکێت</b> لەگەڵ <b>ژمارەی مۆبایل و شار/ناونیشان</b> بنووسە لە یەک نامەدا.\n\n`;
    msg += `نموونە:\n<code>مارکێتی هەولێر - 07501234567 - هەولێر گەڕەکی وەزیران</code>`;

    return telegramService.sendMessage(msg, { chatId });
  }

  async handleTextReply(chatId, text) {
    const session = userSessions.get(chatId);
    if (!session) return false;

    if (session.step === 'quantity') {
      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
      if (num && num > 0) {
        await this.handleQuantitySelected(chatId, num);
        return true;
      }
    }

    if (session.step === 'customer_info') {
      session.customerInfo = text.trim();
      session.step = 'confirm';
      userSessions.set(chatId, session);

      const p = await this.resolveProductWithZoho(session.productId);
      const market = await dollarScraper.getLatestMarketRate();
      const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;

      let unitPrice = p.priceUsd;
      const totalUsd = unitPrice * session.quantity;
      const totalIqd = Math.round(totalUsd * currentRate);

      session.totalUsd = totalUsd;
      session.totalIqd = totalIqd;
      session.unitPrice = unitPrice;

      let summary = `📋 <b>پوختەی داواکارییەکەت:</b>\n\n`;
      summary += `📦 <b>کاڵا:</b> ${p.name}\n`;
      summary += `🔢 <b>بڕ:</b> ${session.quantity} ${p.unit || 'دانە'}\n`;
      summary += `💵 <b>نرخی تاک (Zoho Books):</b> $${unitPrice}\n`;
      summary += `💰 <b>کۆی گشتی:</b> <b>$${totalUsd.toLocaleString()}</b> (~${totalIqd.toLocaleString()} د.ع)\n`;
      summary += `👤 <b>زانیاری کڕیار و ناونیشان:</b>\n<code>${session.customerInfo}</code>\n\n`;
      summary += `ئایا دڵنیایت لە ناردنی ئەم داواکارییە؟`;

      const buttons = [
        [{ text: '✅ بەڵێ، داواکاری بنێرە', callback_data: 'order_submit' }],
        [{ text: '❌ هەڵوەشاندنەوە', callback_data: 'cat:home' }]
      ];

      await telegramService.sendMessage(summary, {
        chatId,
        replyMarkup: { inline_keyboard: buttons }
      });
      return true;
    }

    return false;
  }

  async submitOrder(chatId) {
    const session = userSessions.get(chatId);
    if (!session) return;

    const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    const p = PRODUCTS[session.productId];
    const now = new Date();
    const baghdadTime = now.toLocaleString('en-GB', { timeZone: 'Asia/Baghdad' });

    const orderRecord = {
      orderId,
      chatId,
      productId: session.productId,
      productName: p.name,
      quantity: session.quantity,
      unitPriceUsd: session.unitPrice,
      totalUsd: session.totalUsd,
      totalIqd: session.totalIqd,
      customerInfo: session.customerInfo,
      date: baghdadTime
    };

    saveOrder(orderRecord);
    userSessions.delete(chatId);

    // 1. Send confirmation to Customer
    let custMsg = `🎉 <b>سوپاس! داواکارییەکەت بە سەرکەوتوویی تۆمارکرا.</b>\n\n`;
    custMsg += `🆔 <b>ژمارەی داواکاری:</b> <code>#${orderId}</code>\n`;
    custMsg += `📦 <b>کاڵا:</b> ${p.name} (بڕ: ${session.quantity})\n`;
    custMsg += `💰 <b>بڕی پارە:</b> $${session.totalUsd.toLocaleString()} (~${session.totalIqd.toLocaleString()} د.ع)\n\n`;
    custMsg += `📞 نوێنەری فرۆشتنی کۆمپانیای <b>Vertex</b> لە ماوەیەکی زۆر کەمدا پەیوەندیت پێوە دەکات بۆ پشتڕاستکردنەوە و گەیاندن.\n\n`;
    custMsg += `✨ <i>سوپاس بۆ متمانەتان بە کۆمپانیای Vertex!</i>`;

    await telegramService.sendMessage(custMsg, {
      chatId,
      replyMarkup: this.getMainMenuKeyboard()
    });

    // 2. Dispatch High Priority Notification to Internal Group -> Topic 4 (🧾 وەسڵ و فرۆشتنی نوێ)
    let internalMsg = `🔔 <b>داواکارییەکی نوێ لە فڕۆشگای کڕیاران هات!</b>\n\n`;
    internalMsg += `🆔 <b>ژمارەی داواکاری:</b> <code>#${orderId}</code>\n`;
    internalMsg += `📦 <b>کاڵا:</b> <b>${p.name}</b> (${p.sku})\n`;
    internalMsg += `🔢 <b>بڕی داواکراو:</b> <b>${session.quantity} ${p.unit || 'دانە'}</b>\n`;
    internalMsg += `💰 <b>کۆی بڕ:</b> <b>$${session.totalUsd.toLocaleString()}</b> (~${session.totalIqd.toLocaleString()} د.ع)\n`;
    internalMsg += `👤 <b>زانیاری و ناونیشانی کڕیار:</b>\n${session.customerInfo}\n`;
    internalMsg += `⏰ <b>کاتی داواکاری:</b> ${baghdadTime}\n\n`;
    internalMsg += `⚡ <i>تکایە دەستبەجێ پەیوەندی بە کڕیارەوە بکەن بۆ گەیاندن.</i>`;

    const adminButtons = [
      [{ text: `🧾 دروستکردنی وەسڵ لە Zoho (#${orderId})`, callback_data: `zoho_create_order:${orderId}` }]
    ];

    await telegramService.sendMessage(internalMsg, {
      chatId: config.GROUP_CHAT_ID,
      threadId: config.TOPICS.SALES,
      replyMarkup: { inline_keyboard: adminButtons }
    });

    console.log(`[Storefront] Order #${orderId} successfully submitted and routed to Topic 4.`);
  }

  async sendContactInfo(chatId) {
    let msg = `🏢 <b>کۆمپانیای Vertex بۆ بازرگانی گشتی و تەکنەلۆژیا</b>\n\n`;
    msg += `🌐 <b>وێبسایتی فەرمی:</b> <a href="https://vertex1.tech">vertex1.tech</a>\n`;
    msg += `📍 <b>ناونیشان:</b> هەرێمی کوردستان - هەولێر\n`;
    msg += `📞 <b>پەیوەندی و تەلەفۆن:</b> <code>\u200E0750 758 6992</code> | <code>\u200E0750 529 9118</code>\n`;
    msg += `💬 <b>واتسئەپ:</b> <code>\u200E+964 750 758 6992</code> | <code>\u200E+964 750 529 9118</code>\n`;
    msg += `✉️ <b>ئیمەیڵ:</b> vertexiqzone@gmail.com\n`;
    msg += `⏰ <b>کاتی دەوام:</b> هەموو ڕۆژێک لە 8:30 بەیانی تا 7:00 ئێوارە (جگە لە هەینی)\n`;
    msg += `🚚 <b>گەیاندن:</b> بەردەستە بۆ هەموو مارکێت، چێشتخانە و دەرمانخانەکانی هەولێر، سلێمانی، دهۆک، و سەرجەم شارەکان (بە کرێی گواستنەوەی ئاسایی).\n`;

    const contactButtons = [
      [
        { text: '💬 واتسئەپ (١)', url: 'https://wa.me/9647507586992' },
        { text: '💬 واتسئەپ (٢)', url: 'https://wa.me/9647505299118' }
      ],
      [
        { text: '🌐 سەردانی وێبسایت (vertex1.tech)', url: 'https://vertex1.tech' }
      ],
      [{ text: '🔙 گەڕانەوە بۆ فڕۆشگا', callback_data: 'cat:home' }]
    ];

    return telegramService.sendMessage(msg, {
      chatId,
      replyMarkup: { inline_keyboard: contactButtons }
    });
  }
}

module.exports = new CustomerStorefront();

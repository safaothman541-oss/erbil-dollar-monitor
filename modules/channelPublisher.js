const path = require('path');
const config = require('../config');
const telegramService = require('../services/telegramService');
const zohoService = require('../services/zohoService');
const dollarScraper = require('../services/dollarScraper');
const pdfGenerator = require('../services/pdfPriceListGenerator');

class ChannelPublisher {
  constructor() {
    this.channelId = config.CHANNEL_ID || '@vertexiqzone';
  }

  getChannelButtons(productTitle = 'کاڵاکانی کۆمپانیا') {
    const encoded = encodeURIComponent(`سڵاو، لە چەناڵی تێلیگرامەوە پەیوەندیتان پێوە دەکەم سەبارەت بە: ${productTitle}. دەخوازم داواکاری تۆمار بکەم.`);
    return {
      inline_keyboard: [
        [
          { text: '💬 داواکردن لە واتسئەپ', url: `https://wa.me/9647507586992?text=${encoded}` },
          { text: '📞 0750 758 6992', url: 'https://wa.me/9647507586992' }
        ],
        [
          { text: '🌐 وێبسایتی فەرمی (vertex1.tech)', url: 'https://vertex1.tech' }
        ]
      ]
    };
  }

  // 1. Pinned Corporate Welcome Post
  async publishWelcomePost(targetChat = null) {
    const chat = targetChat || this.channelId;
    let msg = `🏢 <b>بەخێربێن بۆ چەناڵی فەرمیی کۆمپانیای VERTEX</b>\n`;
    msg += `<i>ڕابەری هاوردەکردن و دابەشکردنی کاغەزی حەراری و کەرەستەکانی ژمێریاری و خاڵی فرۆش (POS) لە عێراق و هەرێمی کوردستان</i>\n\n`;
    msg += `کۆمپانیای <b>Vertex</b> بریکار و دابینکەری سەرەکییە بۆ:\n`;
    msg += `• 🐼 <b>کاغەزی حەراری Panda (AAA Grade):</b> قەبارەکانی 80×80، 80×19، 57×19.\n`;
    msg += `• 🖨 <b>پرینتەری پسوولە و لەیبڵ:</b> پرینتەری خێرای Novex، Zywell، Van Gold، Zebra.\n`;
    msg += `• 🔫 <b>بارکۆد سکانەر:</b> سکانەری خێرای وایەر و وایەرلێسی Henex و Honeywell.\n`;
    msg += `• 💰 <b>کش دراوەر (قاصەی پارە):</b> قاصەی پۆڵایینی ئۆتۆماتیکی پێنج خانەیی.\n`;
    msg += `• 🎁 <b>پاکێجی ئامادەکراوی سوپەرمارکێت، چێشتخانە و دەرمانخانە</b> بە گەیاندنی بێبەرامبەر.\n\n`;
    msg += `---------------------------------\n`;
    msg += `📍 <b>ناونیشان:</b> هەولێر - هەرێمی کوردستان، عێراق\n`;
    msg += `🌐 <b>وێبسایتی فەرمی:</b> <a href="https://vertex1.tech">vertex1.tech</a>\n`;
    msg += `📞 <b>پەیوەندی ڕاستەوخۆ:</b> <code>+964 750 758 6992</code> (0750 758 6992)\n`;
    msg += `💬 <b>واتسئەپ:</b> <a href="https://wa.me/9647507586992">+964 750 758 6992</a>\n`;
    msg += `✉️ <b>ئیمەیڵ:</b> vertexiqzone@gmail.com\n\n`;
    msg += `🚚 <i>گەیاندنی خێرا بەردەستە بۆ هەموو شوێنێکی هەولێر، سلێمانی، دهۆک و سەرجەم پارێزگاکانی عێراق.</i>`;

    const res = await telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('زانیاری گشتی و بەرهەمەکان')
    });

    try {
      if (res && res.message_id) {
        await telegramService.pinChatMessage(chat, res.message_id);
      }
    } catch (e) {}

    console.log('[ChannelPublisher] Welcome post published and pinned.');
    return res;
  }

  // 2. Paper Products Showcase
  async publishPaperPost(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    let p8080 = 0.86;
    let p8019 = 0.65;
    let p5719 = 0.40;

    try {
      const items = await zohoService.getItems();
      const i8080 = items.find(i => i.sku === '8080P');
      if (i8080 && i8080.rate) p8080 = i8080.rate;
      const i8019 = items.find(i => i.sku === 'PaperRoll-Panda');
      if (i8019 && i8019.rate) p8019 = i8019.rate;
      const i5719 = items.find(i => i.sku === 'Paper Roll Panda');
      if (i5719 && i5719.rate) p5719 = i5719.rate;
    } catch (e) {}

    let msg = `🐼 <b>کاغەزی حەراریی فەرمیی Panda (کوالیتی ئەسڵی ژاپۆنی AAA)</b>\n\n`;
    msg += `باشترین هەڵبژاردە بۆ سەرجەم مارکێت، مۆڵ، چێشتخانە و دەرمانخانەکان. نووسینی زۆر تۆخ و ڕوونە و سەری پرینتەر لە سووتان و داخوران دەپارێزێت.\n\n`;

    msg += `1️⃣ <b>Panda 80×80 mm (تایبەت بۆ پسوولە):</b>\n`;
    msg += `  • پاکەتکردن: کارتۆنی ٥٠ ڕۆڵ\n`;
    msg += `  • نرخی تاک: <b>$${p8080}</b> (~${Math.round(p8080 * currentRate).toLocaleString()} د.ع بۆ هەر ڕۆڵێک)\n`;
    msg += `  • 📦 <i>کارتۆنی ٥٠ دانەیی: $${(p8080 * 50).toFixed(2)} (~${Math.round(p8080 * 50 * currentRate).toLocaleString()} د.ع)</i>\n\n`;

    msg += `2️⃣ <b>Panda 80×19 mm (قەبارەی مامناوەند):</b>\n`;
    msg += `  • پاکەتکردن: کارتۆنی ١٠٠ ڕۆڵ\n`;
    msg += `  • نرخی تاک: <b>$${p8019}</b> (~${Math.round(p8019 * currentRate).toLocaleString()} د.ع)\n\n`;

    msg += `3️⃣ <b>Panda 57×19 mm (دەستی، تەکسی و ڤیزا کارت):</b>\n`;
    msg += `  • پاکەتکردن: کارتۆنی ١٠٠ ڕۆڵ\n`;
    msg += `  • نرخی تاک: <b>$${p5719}</b> (~${Math.round(p5719 * currentRate).toLocaleString()} د.ع)\n\n`;

    msg += `---------------------------------\n`;
    msg += `📢 <b>داشکاندنی تایبەتی جوملە:</b>\n`;
    msg += `بۆ داواکردنی بڕی جوملە (١٠ کارتۆن بەرەو سەرەوە یان کۆنتێنەر)، تکایە ڕاستەوخۆ پەیوەندی بە بەشی فرۆشتنمانەوە بکەن بۆ وەرگرتنی باشترین نرخی بازاڕ.\n\n`;
    msg += `🚚 <b>گەیاندنی خێرا بۆ هەموو عێراق بەردەستە.</b>`;

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('کاغەزی حەراری Panda')
    });
  }

  // 3. Hardware Showcase Post (Printers, Scanners, Cash Drawers)
  async publishHardwarePost(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    let msg = `🖨 <b>پرینتەری خێرا، بارکۆد سکانەر و ئامێرەکانی خاڵی فرۆش (POS)</b>\n\n`;
    msg += `کۆمپانیای Vertex بەهێزترین و نوێترین ئامێرەکانی بەڕێوەبردنی کاشێر و مارکێت دەخاتە بەردەستان بە گەرەنتی ڕاستەقینە:\n\n`;

    msg += `🔹 <b>پرینتەری پسوولەی Novex 8370 (Fast Receipt Printer):</b>\n`;
    msg += `  • خێرایی چاپ: 260 mm/s (زۆر خێرا)\n`;
    msg += `  • دەرچە: USB + LAN (شەبەکە) - گونجاوە بۆ کاشێر و چێشتخانە/مطبخ\n`;
    msg += `  • خاوەنی قاشکەری ئۆتۆماتیکی (Auto-Cutter) بە توانای زیاتر لە ١.٥ ملیۆن بڕین\n`;
    msg += `  • نرخ: <b>$53.00</b> (~${Math.round(53 * currentRate).toLocaleString()} د.ع)\n\n`;

    msg += `🔹 <b>بارکۆد سکانەری خێرای Henex (1D/2D QR Reader):</b>\n`;
    msg += `  • خوێندنەوەی دەستبەجێی هەموو جۆرە بارکۆدێک لەسەر شاشەی مۆبایل و پاکەت\n`;
    msg += `  • نرخ: <b>$50.00</b> وایەردار | <b>$75.00</b> بێوایەر (Wireless)\n\n`;

    msg += `🔹 <b>کش دراوەری ئۆتۆماتیکی (قاصەی پارەی کاشێر X10):</b>\n`;
    msg += `  • دروستکراو لە پۆڵای قورس، ٥ خانەی دراو و دەسکەی کانزایی\n`;
    msg += `  • بەستنەوەی ڕاستەوخۆ بە پرینتەر بۆ کرانەوەی ئۆتۆماتیکی لە کاتی چاپکردنی وەسڵ\n`;
    msg += `  • نرخ: <b>$45.00</b> (~${Math.round(45 * currentRate).toLocaleString()} د.ع)\n\n`;

    msg += `🔹 <b>پرینتەری لەیبڵ و بارکۆد ستیکەری Van Gold VG80:</b>\n`;
    msg += `  • چاپی ڕاستەوخۆی ستیکەری ڕەف، مێز، و لەیبڵی بارکۆد\n`;
    msg += `  • نرخ: <b>$95.00</b> (~${Math.round(95 * currentRate).toLocaleString()} د.ع)\n\n`;

    msg += `🛠 <i>هەموو ئامێرەکان خاوەنی گەرەنتی تەواون لەگەڵ ستافی تایبەت بۆ بەستنەوە و هاوکاری.</i>`;

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('ئامێرەکانی POS و پرینتەر')
    });
  }

  // 4. Bundles & Value Packs Post
  async publishBundleOffer(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    let msg = `🎁 <b>ئۆفەر و پاکێجە تایبەتەکانی کۆمپانیای VERTEX (داشکاندنی گەورە)</b>\n\n`;
    msg += `بۆ ئەوانەی دەیانەوێت پڕۆژەی نوێ (سوپەرمارکێت، چێشتخانە، کافێ یان دەرمانخانە) بکەنەوە، ئەم پاکێجانە بە تەواوی ئامادەکراون:\n\n`;

    msg += `🏪 <b>پاکێجی ١: دەستپێکردنی سوپەرمارکێت و دەرمانخانە (Supermarket Pack)</b>\n`;
    msg += `  • پرینتەری خێرای Novex 8370 بە قاشکەری ئۆتۆماتیکی\n`;
    msg += `  • بارکۆد سکانەری خێرای Henex لەگەڵ پایە\n`;
    msg += `  • کش دراوەری پۆڵایینی ئۆتۆماتیکی کاشێر\n`;
    msg += `  • <b>دیاری تایبەت: ١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ) بە بەهای $43</b>\n`;
    msg += `  • 🚚 <b>گەیاندنی بێبەرامبەر</b> لە ناو هەولێر\n`;
    msg += `  💰 <b>کۆی نرخ پێکەوە تەنها:</b> <b>$175.00</b> (~${Math.round(175 * currentRate).toLocaleString()} د.ع)\n`;
    msg += `  <i>(نرخی ئاسایی بە جیا: $191 - تۆ بڕی $16 پاشەکەوت دەکەیت)</i>\n\n`;

    msg += `🍽 <b>پاکێجی ٢: ڕێستۆرانت، مطبخ و کافێ (Restaurant LAN Pack)</b>\n`;
    msg += `  • پرینتەری پسوولەی Novex 8370 پۆرتی LAN (بۆ ناردنی داواکاری لە کاشێرەوە بۆ مطبخ)\n`;
    msg += `  • دەنگی هۆشداری چاپی نوێ + بەرگەی گەرما و هەڵم دەگرێت\n`;
    msg += `  • <b>دیاری تایبەت: ١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  • 🚚 <b>گەیاندنی بێبەرامبەر</b> لە ناو هەولێر\n`;
    msg += `  💰 <b>کۆی نرخ پێکەوە تەنها:</b> <b>$89.00</b> (~${Math.round(89 * currentRate).toLocaleString()} د.ع)\n\n`;

    msg += `📦 <b>پاکێجی ٣: ئۆفەری جوملەی ١٠ کارتۆن (Wholesale 10 Cartons Deal)</b>\n`;
    msg += `  • <b>١٠ کارتۆن کاغەزی Panda 80*80 (٥٠٠ ڕۆڵ بە یەکەوە)</b>\n`;
    msg += `  • حیسابکراو بە نرخی داشکاندنی $0.85 بۆ هەر ڕۆڵێک\n`;
    msg += `  • 🚚 <b>گەیاندنی بێبەرامبەر</b> بۆ مارکێت و کۆگاکەت\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$425.00</b> (~${Math.round(425 * currentRate).toLocaleString()} د.ع)`;

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('ئۆفەر و پاکێجەکان')
    });
  }

  // 5. Daily Official PDF Price Sheet Post
  async publishDailyPriceList(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    const pdfPath = path.join(__dirname, '..', 'Vertex_Price_List.pdf');

    await pdfGenerator.generatePriceListPdf(pdfPath);

    const todayDate = new Date().toLocaleDateString('en-GB');
    let caption = `📄 <b>لیستی فەرمیی نرخەکانی کۆمپانیای VERTEX</b>\n\n`;
    caption += `📅 <b>بەروار:</b> ${todayDate}\n`;
    caption += `💵 <b>نرخی دۆلاری بازاڕ:</b> 1$ = <b>${currentRate.toLocaleString()} دینار</b> ($100 = ${(currentRate * 100).toLocaleString()} د.ع)\n`;
    caption += `🔄 سەرجەم نرخەکان ڕاستەوخۆ لە سیستەمی <b>Zoho Books</b> هاوکات کراون.\n\n`;
    caption += `🌐 <b>وێبسایت:</b> vertex1.tech &nbsp;|&nbsp; 📞 <b>تەلەفۆن:</b> 0750 758 6992\n`;
    caption += `<i>فایلی PDFی هاوپێچکراو داگرە بۆ بینینی هەموو وردەکاری، قەبارە و نرخەکان.</i>`;

    return telegramService.sendDocument(pdfPath, {
      chatId: chat,
      caption: caption,
      replyMarkup: this.getChannelButtons('لیستی فەرمی نرخەکان')
    });
  }

  // Publish all sequentially
  async publishAllShowcase(targetChat = null) {
    const chat = targetChat || this.channelId;
    console.log(`[ChannelPublisher] Starting complete showcase publication to ${chat}...`);

    let currentRate = 1684;
    try {
      const market = await dollarScraper.getLatestMarketRate();
      if (market && market.ratePerDollar) currentRate = market.ratePerDollar;
    } catch (e) {}

    // 1. Welcome & pinned post
    await this.publishWelcomePost(chat);
    await new Promise(r => setTimeout(r, 2000));

    // 2. Paper Products
    await this.publishPaperPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2000));

    // 3. Hardware Products
    await this.publishHardwarePost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2000));

    // 4. Bundles & Offers
    await this.publishBundleOffer(chat, currentRate);
    await new Promise(r => setTimeout(r, 2000));

    // 5. Official PDF Price Sheet
    await this.publishDailyPriceList(chat, currentRate);

    console.log('[ChannelPublisher] All 5 showcase posts successfully published to channel!');
  }
}

module.exports = new ChannelPublisher();

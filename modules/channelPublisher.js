const path = require('path');
const config = require('../config');
const telegramService = require('../services/telegramService');
const zohoService = require('../services/zohoService');
const dollarScraper = require('../services/dollarScraper');
const pdfGenerator = require('../services/pdfPriceListGenerator');

// Left-to-Right Mark to prevent phone numbers and English text from reversing in Arabic/Kurdish BiDi text
const LTR = '\u200E';

class ChannelPublisher {
  constructor() {
    this.channelId = config.CHANNEL_ID || '@vertexiqzone';
  }

  getChannelButtons(productTitle = 'کاڵاکان') {
    const encoded = encodeURIComponent(`سڵاو، دەخوازم داواکاری تۆمار بکەم سەبارەت بە: ${productTitle}`);
    return {
      inline_keyboard: [
        [
          { text: `💬 داواکردن لە واتسئەپ`, url: `https://wa.me/9647507586992?text=${encoded}` },
          { text: `📞 ${LTR}0750 758 6992`, url: 'https://wa.me/9647507586992' }
        ],
        [
          { text: `🌐 ${LTR}vertex1.tech`, url: 'https://vertex1.tech' }
        ]
      ]
    };
  }

  // 1. Pinned Corporate Welcome Post (Modest, Factual, Professional)
  async publishWelcomePost(targetChat = null) {
    const chat = targetChat || this.channelId;
    let msg = `🏢 <b>کۆمپانیای VERTEX</b>\n`;
    msg += `<i>دابینکردنی کاغەزی حەراری و کەرەستەکانی خاڵی فرۆش (POS)</i>\n\n`;
    msg += `<b>کاڵا و خزمەتگوزارییە بەردەستەکان:</b>\n`;
    msg += `• کاغەزی حەراری Panda (قەبارەکانی 80×80، 80×19، 57×19 ملم)\n`;
    msg += `• پرینتەری پسوولەی Novex و Zywell (بە قاشکەری ئۆتۆماتیکی و پۆرتی LAN و USB)\n`;
    msg += `• پرینتەری لەیبڵ و ستیکەری Van Gold و Zebra\n`;
    msg += `• بارکۆد سکانەری Henex (بە وایەر و بێ وایەر)\n`;
    msg += `• کش دراوەر (قاصەی ئۆتۆماتیکی پارەی کاشێر)\n`;
    msg += `• پاکێجی ئامادەکراو بۆ مارکێت و چێشتخانەکان بە گەیاندنی بێبەرامبەر\n\n`;
    msg += `---------------------------------\n`;
    msg += `📍 <b>ناونیشان:</b> هەولێر - هەرێمی کوردستان، عێراق\n`;
    msg += `🌐 <b>وێبسایت:</b> <a href="https://vertex1.tech">${LTR}vertex1.tech</a>\n`;
    msg += `📞 <b>پەیوەندی و تەلەفۆن:</b> <code>${LTR}0750 758 6992</code>\n`;
    msg += `💬 <b>واتسئەپ:</b> <code>${LTR}+964 750 758 6992</code>\n`;
    msg += `✉️ <b>ئیمەیڵ:</b> vertexiqzone@gmail.com\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ هەولێر و سەرجەم شارەکانی تر.</i>`;

    const res = await telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('زانیاری گشتی')
    });

    try {
      if (res && res.message_id) {
        await telegramService.pinChatMessage(chat, res.message_id);
      }
    } catch (e) {}

    console.log('[ChannelPublisher] Welcome post published and pinned.');
    return res;
  }

  // 2. Paper Products Post
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

    let msg = `🐼 <b>کاغەزی حەراری Panda</b>\n\n`;
    msg += `گونجاو بۆ پرینتەری پسوولەی مارکێت، مۆڵ، چێشتخانە و کافێیەکان. چاپی تۆخ و پارێزەری سەری پرینتەر.\n\n`;

    msg += `1️⃣ <b>کاغەزی Panda 80×80 ملم:</b>\n`;
    msg += `  • پاکەتکردن: کارتۆنی ٥٠ ڕۆڵ\n`;
    msg += `  • نرخی تاک: <b>$${p8080}</b> (~${Math.round(p8080 * currentRate).toLocaleString()} دینار بۆ هەر ڕۆڵێک)\n`;
    msg += `  • نرخی ١ کارتۆن (٥٠ دانە): <b>$${(p8080 * 50).toFixed(2)}</b> (~${Math.round(p8080 * 50 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `2️⃣ <b>کاغەزی Panda 80×19 ملم:</b>\n`;
    msg += `  • پاکەتکردن: کارتۆنی ١٠٠ ڕۆڵ\n`;
    msg += `  • نرخی تاک: <b>$${p8019}</b> (~${Math.round(p8019 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `3️⃣ <b>کاغەزی Panda 57×19 ملم (پرینتەری دەستی و ڤیزا کارت):</b>\n`;
    msg += `  • پاکەتکردن: کارتۆنی ١٠٠ ڕۆڵ\n`;
    msg += `  • نرخی تاک: <b>$${p5719}</b> (~${Math.round(p5719 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `---------------------------------\n`;
    msg += `📦 <b>بۆ داواکردنی بڕی جوملە (کارتۆن و ژمارەی زۆر):</b>\n`;
    msg += `تکایە پەیوەندی بە بەشی فرۆشتن بکەن بۆ وەرگرتنی داشکاندن:\n`;
    msg += `📞 تەلەفۆن: <code>${LTR}0750 758 6992</code>\n`;
    msg += `💬 واتسئەپ: <code>${LTR}+964 750 758 6992</code>`;

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('کاغەزی Panda')
    });
  }

  // 3. Hardware Showcase Post (Printers, Scanners, Cash Drawers)
  async publishHardwarePost(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    let msg = `🖨 <b>ئامێرەکانی خاڵی فرۆش (POS)</b>\n\n`;

    msg += `🔹 <b>پرینتەری پسوولەی Novex 8370:</b>\n`;
    msg += `  • خێرایی چاپ: 260 mm/s\n`;
    msg += `  • دەرچە: USB + LAN (شەبەکە) - بۆ کاشێر و چێشتخانە و مطبخ\n`;
    msg += `  • خاوەنی قاشکەری ئۆتۆماتیکی (Auto-Cutter)\n`;
    msg += `  • نرخ: <b>$53.00</b> (~${Math.round(53 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🔹 <b>بارکۆد سکانەری Henex (خوێندنەوەی 1D و 2D QR):</b>\n`;
    msg += `  • وایەردار: <b>$50.00</b> (~${Math.round(50 * currentRate).toLocaleString()} دینار)\n`;
    msg += `  • بێ وایەر (Wireless): <b>$75.00</b> (~${Math.round(75 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🔹 <b>کش دراوەری ئۆتۆماتیکی (قاصەی پارەی کاشێر X10):</b>\n`;
    msg += `  • پەیکەری کانزایی پۆڵایین، ٥ خانەی دراو\n`;
    msg += `  • بەستنەوە بە پرینتەر بۆ کرانەوەی ئۆتۆماتیکی لەگەڵ وەسڵ\n`;
    msg += `  • نرخ: <b>$45.00</b> (~${Math.round(45 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🔹 <b>پرینتەری لەیبڵی Van Gold VG80:</b>\n`;
    msg += `  • چاپی لەیبڵ و ستیکەری بارکۆد و نرخی ڕەف\n`;
    msg += `  • نرخ: <b>$95.00</b> (~${Math.round(95 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `📞 پەیوەندی و داواکردن: <code>${LTR}0750 758 6992</code>`;

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('ئامێرەکانی POS')
    });
  }

  // 4. Bundles & Value Packs Post
  async publishBundleOffer(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    let msg = `🎁 <b>پاکێج و ئۆفەرەکانی VERTEX</b>\n\n`;

    msg += `🏪 <b>پاکێجی ١: سوپەرمارکێت و دەرمانخانە</b>\n`;
    msg += `  • پرینتەری خێرای Novex 8370 بە قاشکەری ئۆتۆماتیکی\n`;
    msg += `  • بارکۆد سکانەری Henex لەگەڵ پایە\n`;
    msg += `  • کش دراوەری پۆڵایینی ئۆتۆماتیکی\n`;
    msg += `  • <b>١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  • 🚚 گەیاندنی بێبەرامبەر لە هەولێر\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$175.00</b> (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🍽 <b>پاکێجی ٢: ڕێستۆرانت و کافێ (LAN Pack)</b>\n`;
    msg += `  • پرینتەری پسوولەی Novex 8370 پۆرتی LAN (بۆ ناردنی داواکاری لە کاشێرەوە بۆ مطبخ)\n`;
    msg += `  • <b>١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  • 🚚 گەیاندنی بێبەرامبەر لە هەولێر\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$89.00</b> (~${Math.round(89 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `📦 <b>پاکێجی ٣: جوملەی ١٠ کارتۆن کاغەزی Panda 80*80</b>\n`;
    msg += `  • ٥٠٠ ڕۆڵ بە نرخی داشکاندنی $0.85\n`;
    msg += `  • 🚚 گەیاندنی بێبەرامبەر لە هەولێر\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$425.00</b> (~${Math.round(425 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `📞 پەیوەندی و داواکردن: <code>${LTR}0750 758 6992</code>`;

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: this.getChannelButtons('پاکێجەکان')
    });
  }

  // 5. Daily Official PDF Price Sheet Post
  async publishDailyPriceList(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    const pdfPath = path.join(__dirname, '..', 'Vertex_Price_List.pdf');

    await pdfGenerator.generatePriceListPdf(pdfPath);

    const todayDate = new Date().toLocaleDateString('en-GB');
    let caption = `📄 <b>لیستی نرخی کاڵاکانی کۆمپانیای VERTEX</b>\n\n`;
    caption += `📅 <b>بەروار:</b> ${todayDate}\n`;
    caption += `💵 <b>نرخی دۆلار:</b> 1$ = <b>${currentRate.toLocaleString()} دینار</b> ($100 = ${(currentRate * 100).toLocaleString()} د.ع)\n`;
    caption += `🔄 نرخەکان بەپێی سیستەمی <b>Zoho Books</b> نوێکراونەتەوە.\n\n`;
    caption += `🌐 <b>وێبسایت:</b> ${LTR}vertex1.tech &nbsp;|&nbsp; 📞 <b>تەلەفۆن:</b> <code>${LTR}0750 758 6992</code>\n`;
    caption += `<i>فایلی PDFی هاوپێچکراو داگرە بۆ بینینی هەموو کاڵاکان.</i>`;

    return telegramService.sendDocument(pdfPath, {
      chatId: chat,
      caption: caption,
      replyMarkup: this.getChannelButtons('لیستی نرخەکان')
    });
  }

  // Publish all sequentially
  async publishAllShowcase(targetChat = null) {
    const chat = targetChat || this.channelId;
    console.log(`[ChannelPublisher] Starting refined publication to ${chat}...`);

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

    console.log('[ChannelPublisher] All 5 refined posts published to channel.');
  }
}

module.exports = new ChannelPublisher();

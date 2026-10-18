const path = require('path');
const fs = require('fs');
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
    this.assetsDir = path.join(__dirname, '..', 'assets', 'products');
  }

  getChannelButtons(productTitle = 'کاڵاکان') {
    const enc = encodeURIComponent(`سڵاو، دەخوازم داواکاری تۆمار بکەم سەبارەت بە: ${productTitle}`);
    return {
      inline_keyboard: [
        [
          { text: `💬 واتسئەپ (١)`, url: `https://wa.me/9647507586992?text=${enc}` },
          { text: `💬 واتسئەپ (٢)`, url: `https://wa.me/9647505299118?text=${enc}` }
        ],
        [
          { text: `📞 ${LTR}0750 758 6992`, url: 'https://wa.me/9647507586992' },
          { text: `📞 ${LTR}0750 529 9118`, url: 'https://wa.me/9647505299118' }
        ],
        [
          { text: `🌐 ${LTR}vertex1.tech`, url: 'https://vertex1.tech' }
        ]
      ]
    };
  }

  // Helper to send photo with fallback to text
  async sendShowcasePhoto(photoFile, caption, buttons, targetChat) {
    const chat = targetChat || this.channelId;
    let photoPath = photoFile.includes(path.sep) ? photoFile : path.join(this.assetsDir, photoFile);
    if (!fs.existsSync(photoPath)) {
      photoPath = path.join(__dirname, '..', 'assets', photoFile);
    }

    if (fs.existsSync(photoPath)) {
      try {
        return await telegramService.sendPhoto(photoPath, {
          chatId: chat,
          caption: caption,
          replyMarkup: buttons
        });
      } catch (err) {
        console.warn(`[ChannelPublisher] Failed to send photo ${photoFile}, falling back to text:`, err.message);
      }
    }

    return telegramService.sendMessage(caption, {
      chatId: chat,
      replyMarkup: buttons
    });
  }

  // 1. Pinned Corporate Welcome Post (Modest, Factual, Professional)
  async publishWelcomePost(targetChat = null) {
    const chat = targetChat || this.channelId;
    let msg = `🏢 <b>کۆمپانیای VERTEX</b>\n`;
    msg += `<i>دابینکردنی کاغەزی حەراری و کەرەستەکانی خاڵی فرۆش (POS)</i>\n\n`;
    msg += `<b>کاڵا و خزمەتگوزارییە بەردەستەکان:</b>\n`;
    msg += `• کاغەزی حەراری Panda (قەبارەکانی 80×80، 80×19، 57×19 ملم)\n`;
    msg += `• پرینتەری پسوولەی Novex و Zywell (قاشکەری ئۆتۆماتیکی و پۆرتی LAN و USB)\n`;
    msg += `• پرینتەری لەیبڵ و ستیکەری Van Gold و Zebra\n`;
    msg += `• بارکۆد سکانەری Henex و ODDEX (بە وایەر و بێ وایەر و سەر مێز)\n`;
    msg += `• کش دراوەر (قاصەی ئۆتۆماتیکی پۆڵایینی پارەی کاشێر)\n`;
    msg += `• پاکێجی ئامادەکراو بۆ مارکێت و چێشتخانە و دەرمانخانەکان\n\n`;
    msg += `---------------------------------\n`;
    msg += `📍 <b>ناونیشان:</b> هەولێر - هەرێمی کوردستان، عێراق\n`;
    msg += `🌐 <b>وێبسایت:</b> <a href="https://vertex1.tech">${LTR}vertex1.tech</a>\n`;
    msg += `📞 <b>پەیوەندی و تەلەفۆن:</b> <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>\n`;
    msg += `💬 <b>واتسئەپ:</b> <code>${LTR}+964 750 758 6992</code> | <code>${LTR}+964 750 529 9118</code>\n`;
    msg += `✉️ <b>ئیمەیڵ:</b> vertexiqzone@gmail.com\n\n`;
    msg += `🚚 <i>تێبینی: گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).</i>`;

    const res = await this.sendShowcasePhoto(
      'logo_light_ondark.png',
      msg,
      this.getChannelButtons('زانیاری گشتی کۆمپانیا'),
      chat
    );

    try {
      if (res && res.message_id) {
        await telegramService.pinChatMessage(chat, res.message_id);
      }
    } catch (e) {}

    console.log('[ChannelPublisher] Welcome post published and pinned.');
    return res;
  }

  // 2. Panda Paper 80x80 Roll with Photo & Pricing
  async publishPaperPost(targetChat = null, currentRate = 1684) {
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

    let msg = `🐼 <b>کاغەزی حەراری Panda (قەبارەی 80×80 ملم)</b>\n\n`;
    msg += `کاغەزی ئەسڵی پلە یەک بە ڕووپۆشی ژاپۆنی. چاپی تۆخ و ڕوون و پارێزەری سەری پرینتەر.\n\n`;
    msg += `• قەبارە: <b>80×80 ملم</b>\n`;
    msg += `• پاکەتکردن: <b>کارتۆنی ٥٠ ڕۆڵ</b>\n`;
    msg += `• نرخی تاک: <b>$${p8080}</b> (~${Math.round(p8080 * currentRate).toLocaleString()} دینار بۆ هەر ڕۆڵێک)\n`;
    msg += `• نرخی ١ کارتۆن (٥٠ دانە): <b>$${(p8080 * 50).toFixed(2)}</b> (~${Math.round(p8080 * 50 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `📄 <b>قەبارەکانی تر:</b>\n`;
    msg += `• Panda 80×19 ملم: <b>$${p8019}</b> (~${Math.round(p8019 * currentRate).toLocaleString()} دینار)\n`;
    msg += `• Panda 57×19 ملم: <b>$${p5719}</b> (~${Math.round(p5719 * currentRate).toLocaleString()} دینار - ڤیزا و مۆبایل)\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ هەموو شارەکان (بە کرێی ئاسایی).</i>\n`;
    msg += `📞 پەیوەندی: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'panda_80_80.png',
      msg,
      this.getChannelButtons('کاغەزی Panda'),
      targetChat
    );
  }

  // 3. Novex 8370 High-Speed Receipt Printer
  async publishNovexPrinterPost(targetChat = null, currentRate = 1684) {
    let msg = `🖨 <b>پرینتەری پسوولەی خێرای Novex 8370</b>\n\n`;
    msg += `پرینتەری حەراری خێرا بۆ کاشێر و سوپەرمارکێت و چێشتخانەکان.\n\n`;
    msg += `• خێرایی چاپ: <b>260 mm/s</b> (زۆر خێرا)\n`;
    msg += `• قاشکەری ئۆتۆماتیکی: <b>Auto-Cutter</b> ئەسڵی\n`;
    msg += `• پۆرت و بەستنەوە: <b>USB + LAN (شەبەکە)</b> - گونجاو بۆ مطبخ و کاشێر\n`;
    msg += `• قەبارەی کاغەز: ستاندارد 80 ملم\n`;
    msg += `💰 <b>نرخ:</b> <b>$53.00</b> (~${Math.round(53 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ سەرجەم شارەکان (گەیاندن بێ بەرامبەر نییە).</i>\n`;
    msg += `📞 پەیوەندی: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'novex_8370.png',
      msg,
      this.getChannelButtons('پرینتەری Novex 8370'),
      targetChat
    );
  }

  // 4. Zywell 310 Heavy-Duty POS Printer
  async publishZywellPrinterPost(targetChat = null, currentRate = 1684) {
    let msg = `🖨 <b>پرینتەری پسوولەی پیشەسازی Zywell 310</b>\n\n`;
    msg += `پرینتەری توندوتۆڵی heavy-duty بەرگەگری کارکردنی بەردەوام و زەختی زۆر بۆ مارکێتە گەورەکان و چێشتخانە پڕکارەکان.\n\n`;
    msg += `• خاوەنی قاشکەری ئۆتۆماتیکی بەهێز (Heavy-duty Auto-cutter)\n`;
    msg += `• دەرچەی هەمەجۆر: <b>LAN (شەبەکە) + USB</b>\n`;
    msg += `• چاپکردنی خێرا بەبێ وەستان لەسەر کاغەزی 80 ملم\n`;
    msg += `💰 <b>نرخ:</b> <b>$95.00</b> (~${Math.round(95 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ سەرجەم شارەکان (گەیاندن بێ بەرامبەر نییە).</i>\n`;
    msg += `📞 پەیوەندی: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'zywell_310_real.jpeg',
      msg,
      this.getChannelButtons('پرینتەری Zywell 310'),
      targetChat
    );
  }

  // 5. Automatic Cash Drawer X10
  async publishCashDrawerPost(targetChat = null, currentRate = 1684) {
    let msg = `💰 <b>کش دراوەری ئۆتۆماتیکی X10 (قاصەی پارەی کاشێر)</b>\n\n`;
    msg += `قاصەی کانزایی پۆڵایینی قورس و پتەو بۆ هەڵگرتنی پارەی کاشێری مارکێت و چێشتخانەکان.\n\n`;
    msg += `• پێکهاتەی بەهێزی کانزایی و کێشی بەرز (جێگیر لەسەر مێز)\n`;
    msg += `• ٥ خانەی تایبەت بە دراوی کاغەز و ٨ خانەی سکە\n`;
    msg += `• کێبڵی تایبەتی RJ11 بۆ بەستنەوە بە پرینتەر (کرانەوەی ئۆتۆماتیکی لەگەڵ دەرچوونی وەسڵ)\n`;
    msg += `• کلیل و قوفڵی سەربەخۆ بۆ پاراستنی زیاتر\n`;
    msg += `💰 <b>نرخ:</b> <b>$45.00</b> (~${Math.round(45 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە).</i>\n`;
    msg += `📞 پەیوەندی: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'cash_drawer.png',
      msg,
      this.getChannelButtons('کش دراوەر X10'),
      targetChat
    );
  }

  // 6. Barcode Scanners (Henex & ODDEX 2D)
  async publishScannersPost(targetChat = null, currentRate = 1684) {
    let msg = `🔫 <b>بارکۆد سکانەرەکانی Henex و ODDEX</b>\n\n`;
    msg += `خوێندنەوەی دەستبەجێی هەموو جۆرە بارکۆدێکی کاڵا (1D) و QR کۆد (2D) لەسەر شاشەی مۆبایل و کاغەز.\n\n`;
    msg += `🔹 <b>سکانەری سەر مێز (Desktop 2D Scanner):</b>\n`;
    msg += `  • دەستبەجێ بەبێ دەستلێدان لە کاتی نزیکبوونەوەی کاڵا دەخوێنێتەوە\n`;
    msg += `  • نرخ: <b>$75.00</b> (~${Math.round(75 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🔹 <b>بارکۆد سکانەری وایەردار (Henex Wired):</b>\n`;
    msg += `  • لەگەڵ پایەی جێگیر، خوێندنەوەی خێرا بە کێبڵی USB\n`;
    msg += `  • نرخ: <b>$50.00</b> (~${Math.round(50 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🔹 <b>بارکۆد سکانەری بێ وایەر (Henex 2210 Wireless):</b>\n`;
    msg += `  • مەودای ١٠٠ مەتر، پاتری بەهێز بۆ کۆگا و مارکێت\n`;
    msg += `  • نرخ: <b>$75.00</b> (~${Math.round(75 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ هەموو شارەکان.</i>\n`;
    msg += `📞 پەیوەندی: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'desktop_scanner_2d.png',
      msg,
      this.getChannelButtons('بارکۆد سکانەر'),
      targetChat
    );
  }

  // 7. Label & Barcode Printers (Van Gold & Zebra)
  async publishLabelPrintersPost(targetChat = null, currentRate = 1684) {
    let msg = `🏷 <b>پرینتەری لەیبڵ و بارکۆدی Van Gold و Zebra</b>\n\n`;
    msg += `بۆ چاپکردنی لەیبڵ و ستیکەری بارکۆد، نرخی ڕەف، و مێژووی بەسەرچوون بەبێ پێویستی بە مەرەکەب (Direct Thermal).\n\n`;
    msg += `🔹 <b>پرینتەری لەیبڵی Van Gold VG80:</b>\n`;
    msg += `  • چاپی خێرای ستیکەری ڕەف و بارکۆد بۆ مارکێت و دەرمانخانە\n`;
    msg += `  • نرخ: <b>$95.00</b> (~${Math.round(95 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🔹 <b>پرینتەری پیشەسازی Zebra ZD230:</b>\n`;
    msg += `  • مارکەی ئەسڵی Zebra بۆ کارکردنی گەورە لە کۆگا و کارگەکان\n`;
    msg += `  • نرخ: <b>$175.00</b> (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🔹 <b>پرینتەری دەستی گەڕۆک PT-210 (Bluetooth):</b>\n`;
    msg += `  • 58 ملم بێ وایەر بۆ سیستەمی مۆبایل و گەیاندن و وەسڵی سەر ڕێگا\n`;
    msg += `  • نرخ: <b>$37.00</b> (~${Math.round(37 * currentRate).toLocaleString()} دینار)\n\n`;
    msg += `🚚 <i>گەیاندن بەردەستە بۆ هەموو شارەکان.</i>\n`;
    msg += `📞 پەیوەندی: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'vangold_vg80.png',
      msg,
      this.getChannelButtons('پرینتەری لەیبڵ'),
      targetChat
    );
  }

  // 8. Bundles & Value Packs Post (Delivery available, not free)
  async publishBundleOffer(targetChat = null, currentRate = 1684) {
    let msg = `🎁 <b>پاکێج و ئۆفەرەکانی VERTEX بۆ خاڵی فرۆش (POS)</b>\n\n`;

    msg += `🏪 <b>پاکێجی ١: سوپەرمارکێت و دەرمانخانە</b>\n`;
    msg += `  • پرینتەری خێرای Novex 8370 بە قاشکەری ئۆتۆماتیکی\n`;
    msg += `  • کش دراوەری پۆڵایینی ئۆتۆماتیکی X10\n`;
    msg += `  • بارکۆد سکانەری Henex لەگەڵ پایە\n`;
    msg += `  • <b>١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$175.00</b> (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🍽 <b>پاکێجی ٢: چێشتخانە و کافێ (LAN Kitchen Pack)</b>\n`;
    msg += `  • پرینتەری پسوولەی Novex 8370 پۆرتی LAN (بۆ ناردنی داواکاری لە کاشێرەوە بۆ مطبخ)\n`;
    msg += `  • <b>١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$89.00</b> (~${Math.round(89 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `📦 <b>پاکێجی ٣: جوملەی ١٠ کارتۆن کاغەزی Panda 80*80</b>\n`;
    msg += `  • ٥٠٠ ڕۆڵ بە نرخی داشکاندنی تایبەت ($0.85 بۆ ڕۆڵێک)\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$425.00</b> (~${Math.round(425 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🚚 <i>تێبینی: گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).</i>\n`;
    msg += `📞 پەیوەندی و داواکردن: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    return this.sendShowcasePhoto(
      'novex_printer_back.jpeg',
      msg,
      this.getChannelButtons('پاکێجەکان'),
      targetChat
    );
  }

  // 9. Daily Official PDF Price Sheet Post (English Only, No Stock, Both Phones)
  async publishDailyPriceList(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    const pdfPath = path.join(__dirname, '..', 'Vertex_Price_List.pdf');

    await pdfGenerator.generatePriceListPdf(pdfPath);

    const todayDate = new Date().toLocaleDateString('en-GB');
    let caption = `📄 <b>VERTEX COMPANY - OFFICIAL DAILY PRICE SHEET</b>\n\n`;
    caption += `📅 <b>Date:</b> ${todayDate}\n`;
    caption += `💵 <b>Market Exchange Rate:</b> $100 = <b>${(currentRate * 100).toLocaleString()} IQD</b> (1$ = ${currentRate.toLocaleString()} IQD)\n`;
    caption += `🔄 Live Zoho Books pricing synchronized.\n\n`;
    caption += `🌐 <b>Website:</b> <a href="https://vertex1.tech">vertex1.tech</a>\n`;
    caption += `📞 <b>Direct Inquiries:</b> <code>+964 750 758 6992</code> &bull; <code>+964 750 529 9118</code>\n\n`;
    caption += `<i>Download the attached PDF document for complete models and pricing.</i>`;

    const englishButtons = {
      inline_keyboard: [
        [
          { text: '💬 WhatsApp 1', url: 'https://wa.me/9647507586992?text=Hello%2C%20I%20would%20like%20to%20inquire%20about%20Vertex%20products.' },
          { text: '💬 WhatsApp 2', url: 'https://wa.me/9647505299118?text=Hello%2C%20I%20would%20like%20to%20inquire%20about%20Vertex%20products.' }
        ],
        [
          { text: '📞 Call 1: +964 750 758 6992', url: 'https://wa.me/9647507586992' },
          { text: '📞 Call 2: +964 750 529 9118', url: 'https://wa.me/9647505299118' }
        ],
        [
          { text: '🌐 Official Website (vertex1.tech)', url: 'https://vertex1.tech' }
        ]
      ]
    };

    return telegramService.sendDocument(pdfPath, {
      chatId: chat,
      caption: caption,
      replyMarkup: englishButtons
    });
  }

  // Publish complete showcase sequentially
  async publishAllShowcase(targetChat = null) {
    const chat = targetChat || this.channelId;
    console.log(`[ChannelPublisher] Starting refined photo showcase publication to ${chat}...`);

    let currentRate = 1684;
    try {
      const market = await dollarScraper.getLatestMarketRate();
      if (market && market.ratePerDollar) currentRate = market.ratePerDollar;
    } catch (e) {}

    // 1. Welcome & Pinned Post
    await this.publishWelcomePost(chat);
    await new Promise(r => setTimeout(r, 2500));

    // 2. Panda Paper Post (Photo + Price)
    await this.publishPaperPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 3. Novex 8370 Receipt Printer (Photo + Price)
    await this.publishNovexPrinterPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 4. Zywell 310 Industrial Printer (Photo + Price)
    await this.publishZywellPrinterPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 5. Cash Drawer X10 (Photo + Price)
    await this.publishCashDrawerPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 6. Barcode Scanners (Photo + Price)
    await this.publishScannersPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 7. Label Printers (Photo + Price)
    await this.publishLabelPrintersPost(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 8. Bundles & Value Packs (Photo + Price)
    await this.publishBundleOffer(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 9. Official Daily PDF Price Sheet (English Only, Live Zoho Sync)
    await this.publishDailyPriceList(chat, currentRate);

    console.log('[ChannelPublisher] Complete showcase published to channel successfully.');
  }
}

const channelPublisher = new ChannelPublisher();
module.exports = channelPublisher;

if (require.main === module) {
  channelPublisher.publishAllShowcase().then(() => {
    console.log('[ChannelPublisher] Showcase publication complete!');
    process.exit(0);
  }).catch(err => {
    console.error('[ChannelPublisher] Execution failed:', err);
    process.exit(1);
  });
}


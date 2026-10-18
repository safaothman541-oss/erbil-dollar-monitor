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
    this.showcaseFile = path.join(__dirname, '..', 'assets', 'showcase_items.json');
    this.externalOutDir = 'C:\\Users\\SAFA\\vertex-ads\\out';
  }

  // Clear previous bot messages in channel
  async clearChannel(fromId = 1, toId = 120, targetChat = null) {
    const chat = targetChat || this.channelId;
    console.log(`[ChannelPublisher] Cleaning old messages from ${chat}...`);
    for (let id = fromId; id <= toId; id++) {
      try {
        await telegramService.deleteMessage(chat, id);
      } catch (e) {}
    }
    console.log(`[ChannelPublisher] Channel cleared.`);
  }

  getChannelButtons(productTitle = 'کاڵاکان', directUrl = null) {
    // 1-Click Direct Order pre-filled template
    const prefillText = `سڵاو، داواکاری کڕینی (${productTitle})م هەیە بۆ ئەم ناونیشانە:\n\nناو:\nشار / ناونیشان:\nژمارەی مۆبایل:\nبڕ (تەعداد):`;
    const enc = encodeURIComponent(prefillText);

    return {
      inline_keyboard: [
        [
          { text: `🛒 داواکردنی خێرا (واتسئەپ ١)`, url: `https://wa.me/9647505299118?text=${enc}` },
          { text: `🛒 داواکردنی خێرا (واتسئەپ ٢)`, url: `https://wa.me/9647507586992?text=${enc}` }
        ],
        [
          { text: `📞 ${LTR}0750 529 9118`, url: 'https://wa.me/9647505299118' },
          { text: `📞 ${LTR}0750 758 6992`, url: 'https://wa.me/9647507586992' }
        ],
        [
          { text: `🌐 بینین لە وێبسایت: vertex1.tech`, url: directUrl || 'https://vertex1.tech' }
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
    msg += `• پرینتەری پسوولەی Novex، Zywell، Epson و BIISON (بە قاشکەری ئۆتۆماتیکی و پۆرتی LAN و USB)\n`;
    msg += `• پرینتەری لەیبڵ و ستیکەری Zebra، Van Gold، Honeywell و HPRT\n`;
    msg += `• بارکۆد سکانەری Henex و ODDeX (بە وایەر، بێ وایەر و سەر مێزی خێرا)\n`;
    msg += `• کش دراوەری ئۆتۆماتیکی پۆڵایینی پارەی کاشێر (CD-410 / X10)\n`;
    msg += `• سستەمی تەواوی POS و تەرازووی دیجیتاڵ و ئامێری ئەندرۆید\n\n`;
    msg += `---------------------------------\n`;
    msg += `📍 <b>ناونیشان:</b> هەولێر - هەرێمی کوردستان، عێراق\n`;
    msg += `🌐 <b>وێبسایت:</b> <a href="https://vertex1.tech">${LTR}vertex1.tech</a>\n`;
    msg += `📞 <b>پەیوەندی و تەلەفۆن:</b> <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>\n`;
    msg += `💬 <b>واتسئەپ:</b> <code>${LTR}+964 750 758 6992</code> | <code>${LTR}+964 750 529 9118</code>\n`;
    msg += `✉️ <b>ئیمەیڵ:</b> vertexiqzone@gmail.com\n\n`;
    msg += `🚚 <i>تێبینی: گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).</i>`;

    const logoPath = path.join(__dirname, '..', 'assets', 'logo_light_ondark.png');
    let res = null;

    if (fs.existsSync(logoPath)) {
      res = await telegramService.sendPhoto(logoPath, {
        chatId: chat,
        caption: msg,
        replyMarkup: this.getChannelButtons('زانیاری گشتی کۆمپانیا')
      });
    } else {
      res = await telegramService.sendMessage(msg, {
        chatId: chat,
        replyMarkup: this.getChannelButtons('زانیاری گشتی کۆمپانیا')
      });
    }

    try {
      if (res && res.message_id) {
        await telegramService.pinChatMessage(chat, res.message_id);
      }
    } catch (e) {}

    console.log('[ChannelPublisher] Welcome post published and pinned.');
    return res;
  }

  // 2. Publish an individual product post with 2K full quality photo and complete specs
  async publishSingleProduct(product, currentRate = 1684, targetChat = null) {
    const chat = targetChat || this.channelId;
    const priceUsd = product.priceUsd;
    const priceIqd = Math.round(priceUsd * currentRate);

    // Determine category icon
    let icon = '🔹';
    const cat = (product.category || '').toLowerCase();
    if (cat.includes('receipt-printer') || cat.includes('printer')) icon = '🖨';
    else if (cat.includes('label')) icon = '🏷';
    else if (cat.includes('scanner')) icon = '🔫';
    else if (cat.includes('drawer')) icon = '💰';
    else if (cat.includes('paper') || cat.includes('supplies')) icon = '📄';
    else if (cat.includes('pos') || cat.includes('pda') || cat.includes('mobile')) icon = '💻';
    else if (cat.includes('scale')) icon = '⚖️';
    else if (cat.includes('accessories')) icon = '🔔';

    const fullTitle = `${product.brand ? product.brand + ' ' : ''}${product.name.trim()}${product.model ? ' (' + product.model + ')' : ''}`;

    let caption = `${icon} <b>${fullTitle}</b>\n`;
    if (product.brand) {
      caption += `🏢 <b>براند:</b> ${product.brand}\n\n`;
    } else {
      caption += `\n`;
    }

    if (product.description && product.description.trim()) {
      caption += `<i>${product.description.trim()}</i>\n\n`;
    }

    if (product.specs && product.specs.length > 0) {
      caption += `📋 <b>مواسەفات و تایبەتمەندییەکان:</b>\n`;
      product.specs.slice(0, 6).forEach(spec => {
        caption += `• ${spec.trim()}\n`;
      });
      caption += `\n`;
    }

    caption += `💵 <b>نرخ:</b> <b>$${priceUsd.toFixed(2)}</b> (~<b>${priceIqd.toLocaleString()}</b> دینار)\n\n`;
    caption += `🚚 <i>تێبینی: گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).</i>\n`;
    caption += `📞 پەیوەندی و داواکردن: <code>${LTR}0750 529 9118</code> | <code>${LTR}0750 758 6992</code>`;

    // Locate full-quality photo
    let photoPath = null;
    const approveFile = path.join(this.externalOutDir, `approve_${product.shortId}.png`);
    if (fs.existsSync(approveFile)) {
      photoPath = approveFile;
    } else if (product.imagePath && fs.existsSync(product.imagePath)) {
      photoPath = product.imagePath;
    }

    const buttons = this.getChannelButtons(fullTitle, `https://vertex1.tech/products/${product.id}`);

    if (photoPath) {
      try {
        return await telegramService.sendPhoto(photoPath, {
          chatId: chat,
          caption: caption,
          replyMarkup: buttons
        });
      } catch (err) {
        console.warn(`[ChannelPublisher] Failed to send photo for ${product.shortId}, falling back to text:`, err.message);
      }
    }

    return telegramService.sendMessage(caption, {
      chatId: chat,
      replyMarkup: buttons
    });
  }

  // 3. Bundles & Value Packs Post (Delivery available, not free)
  async publishBundleOffer(targetChat = null, currentRate = 1684) {
    const chat = targetChat || this.channelId;
    let msg = `🎁 <b>پاکێج و ئۆفەرەکانی VERTEX بۆ خاڵی فرۆش (POS)</b>\n\n`;

    msg += `🏪 <b>پاکێجی ١: سوپەرمارکێت و دەرمانخانە</b>\n`;
    msg += `  • پرینتەری خێرای پسوولە بە قاشکەری ئۆتۆماتیکی\n`;
    msg += `  • کش دراوەری پۆڵایینی ئۆتۆماتیکی 6.5 KG (CD-410)\n`;
    msg += `  • بارکۆد سکانەری 1D/2D QR لەگەڵ پایە\n`;
    msg += `  • <b>١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$175.00</b> (~${Math.round(175 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🍽 <b>پاکێجی ٢: چێشتخانە و کافێ (LAN Kitchen Pack)</b>\n`;
    msg += `  • پرینتەری پسوولەی LAN (بۆ ناردنی داواکاری لە کاشێرەوە بۆ مطبخ)\n`;
    msg += `  • <b>١ کارتۆن کاغەزی Panda 80*80 (٥٠ ڕۆڵ)</b>\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$89.00</b> (~${Math.round(89 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `📦 <b>پاکێجی ٣: جوملەی ١٠ کارتۆن کاغەزی Panda 80*80</b>\n`;
    msg += `  • ٥٠٠ ڕۆڵ بە نرخی داشکاندنی تایبەت ($0.85 بۆ ڕۆڵێک)\n`;
    msg += `  💰 <b>کۆی نرخ:</b> <b>$425.00</b> (~${Math.round(425 * currentRate).toLocaleString()} دینار)\n\n`;

    msg += `🚚 <i>تێبینی: گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).</i>\n`;
    msg += `📞 پەیوەندی و داواکردن: <code>${LTR}0750 758 6992</code> | <code>${LTR}0750 529 9118</code>`;

    const bundlePhoto = path.join(__dirname, '..', 'assets', 'products', 'novex_printer_back.jpeg');
    const buttons = this.getChannelButtons('پاکێجەکان');

    if (fs.existsSync(bundlePhoto)) {
      try {
        return await telegramService.sendPhoto(bundlePhoto, {
          chatId: chat,
          caption: msg,
          replyMarkup: buttons
        });
      } catch (e) {}
    }

    return telegramService.sendMessage(msg, {
      chatId: chat,
      replyMarkup: buttons
    });
  }

  // 4. Daily Official PDF Price Sheet Post (English Only, No Stock, Both Phones)
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
    caption += `<i>Download the attached PDF document for complete models, specifications and pricing.</i>`;

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

  // 5. Complete publication of all products individually
  async publishAllShowcase(targetChat = null) {
    const chat = targetChat || this.channelId;
    console.log(`[ChannelPublisher] Starting individual product showcase publication to ${chat}...`);

    let currentRate = 1684;
    try {
      const market = await dollarScraper.getLatestMarketRate();
      if (market && market.ratePerDollar) currentRate = market.ratePerDollar;
    } catch (e) {}

    // 1. Welcome & Pinned Post
    await this.publishWelcomePost(chat);
    await new Promise(r => setTimeout(r, 2500));

    // 2. Load showcase items
    let items = [];
    if (fs.existsSync(this.showcaseFile)) {
      items = JSON.parse(fs.readFileSync(this.showcaseFile, 'utf8'));
    }

    console.log(`[ChannelPublisher] Publishing ${items.length} products individually...`);

    // 3. Publish each product with its individual 2K photo and full specs
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        console.log(`[ChannelPublisher] (${i + 1}/${items.length}) Publishing ${item.name} (${item.shortId})...`);
        await this.publishSingleProduct(item, currentRate, chat);
      } catch (err) {
        console.error(`[ChannelPublisher] Error publishing ${item.name}:`, err.message);
      }
      // 2.5s delay to strictly comply with Telegram broadcast rate limit
      await new Promise(r => setTimeout(r, 2500));
    }

    // 4. Bundles & Value Packs
    await this.publishBundleOffer(chat, currentRate);
    await new Promise(r => setTimeout(r, 2500));

    // 5. Official Daily PDF Price Sheet (English Only, Live Zoho Sync, Photo Thumbnails)
    await this.publishDailyPriceList(chat, currentRate);

    console.log('[ChannelPublisher] Complete showcase of all individual products published to channel successfully.');
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

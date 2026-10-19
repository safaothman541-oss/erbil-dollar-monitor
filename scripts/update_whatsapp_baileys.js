const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'whatsappBaileys.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. New sendMasterMenu implementation
const newSendMasterMenu = `  async sendMasterMenu(remoteJid) {
    let welcome = \`🌟 *بەخێربێن بۆ کۆمپانیای VERTEX*\\n\`;
    welcome += \`دابینکردنی کاغەزی حەراری و سەرجەم کەرەستەکانی خاڵی فرۆش (POS) لە عێراق بەپێی سیستەمی فەرمی Zoho Books.\\n\\n\`;
    welcome += \`🤖 *ڕێبەری هۆشمەندی خێرا - هەر ژمارەیەک بنووسیت کەتەلۆگ و نرخەکانی دەبینیت:*\\n\\n\`;
    welcome += \`1️⃣ 📄 *کاغەزی حەراری و لەیبڵ* (Panda 80×80, 80×19, 57×19 & Labels)\\n\`;
    welcome += \`2️⃣ 🖨 *پرینتەری پسوولەی کاشێر* (Novex 8370, Xprinter, Zywell, Portable)\\n\`;
    welcome += \`3️⃣ 🏷 *پرینتەری ستیکەر و بارکۆد* (Zebra ZD230, HPRT, Zywell 910, Van Gold)\\n\`;
    welcome += \`4️⃣ 🔫 *بارکۆد سکانەری خێرا* (Honeywell Orbit/HF680, Zebra DS2208, Henex)\\n\`;
    welcome += \`5️⃣ 💰 *کش دراوەری پارەی کاشێر* (X10 Heavy Duty Cash Drawer)\\n\`;
    welcome += \`6️⃣ 💻 *سیستەمی POS و کۆمپیوتەر* (Venex POS, Dell AIO, Case i5)\\n\`;
    welcome += \`7️⃣ 💵 *نوێترین نرخی کاتیی دۆلاری بازاڕ*\\n\`;
    welcome += \`8️⃣ 📍 *ناونیشان، دەوام و پەیوەندی بە فرۆشتن*\\n\\n\`;
    welcome += \`💡 *فەرمانی خێرا:*\\n\`;
    welcome += \`• بنووسە *«pdf»* ➔ بۆ فایلی فەرمی نرخەکان\\n\`;
    welcome += \`• بنووسە *«ئۆردەر»* ➔ بۆ داواکردن و کڕین\\n\`;
    welcome += \`• یان ڕاستەوخۆ *ناوی هەر کاڵایەک* بنووسە تا زانیاری و نرخەکەی ببینیت!\\n\\n\`;
    welcome += \`🚗 *گەیاندن:* بۆ هەموو شارەکان بەردەستە (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).\\n\`;
    welcome += \`📞 *پەیوەندی بەپەلە:* \${PHONE_1} | \${PHONE_2}\`;

    await this.sock.sendMessage(remoteJid, { text: welcome });
  }`;

// 2. New Category Handlers Block
const newCategoryHandlers = `    // -------------------------------------------------------------
    // 1. CATEGORY 1: THERMAL PAPER & LABELS (Panda & Labels from Zoho Books)
    // -------------------------------------------------------------
    if (lower === '1' || lower.includes('کاغەز') || lower.includes('panda') || lower.includes('پانیدا') || lower.includes('8080') || lower.includes('رۆڵ') || lower.includes('لەیبڵ') || lower.includes('ستیکەر')) {
      let reply = \`🐼 *کاغەزی حەراری Panda و لەیبڵەکان (تۆمارکراو لە Zoho Books)*\\n\\n\`;
      reply += \`📄 *ڕۆڵەکانی کاغەزی پسوولە:*\\n\`;
      reply += \`1️⃣ *Panda 80×80mm (کارتۆنی ٥٠ دانە):* *$1.25* بۆ هەر ڕۆڵێک (~\${Math.round(1.25 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`2️⃣ *Panda 80×19m:* *$0.65* (~\${Math.round(0.65 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`3️⃣ *Panda 57×19m (تەکسی و POS دەستی):* *$0.40* (~\${Math.round(0.40 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🏷 *ڕۆڵەکانی لەیبڵ و بارکۆد (Thermal Labels):*\\n\`;
      reply += \`• *Label 100×150mm (بۆ گەیاندن و کارگۆ):* *$11.00* (~\${Math.round(11 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`• *Label 100×100mm:* *$7.50* (~\${Math.round(7.5 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`• *Label 80×50mm (1000 دانەیی):* *$5.00* (~\${Math.round(5 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`• *Label 58×39mm (Chinese):* *$2.00* (~\${Math.round(2 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`• *Label 58×39mm (S):* *$1.10* (~\${Math.round(1.1 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`• *Label 50×25mm:* *$2.00* (~\${Math.round(2 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`• *Label 38×25mm:* *$2.00* (~\${Math.round(2 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🚗 \${DELIVERY_NOTE}\\n\`;
      reply += \`📞 داواکردن و کڕین: \${PHONE_1} | \${PHONE_2}\`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'panda_80_80.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 2. CATEGORY 2: RECEIPT PRINTERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '2' || lower.includes('پرینتەری پسوولە') || lower.includes('پسوولە') || lower.includes('novex') || lower.includes('8370') || lower.includes('xprinter') || lower.includes('xp-80') || lower.includes('zywell 310') || lower.includes('pt210') || lower.includes('rpp300')) {
      let reply = \`🖨 *پرینتەرەکانی پسوولەی کاشێر و مەتبەخ (Zoho Books)*\\n\\n\`;
      reply += \`🔹 *Novex 8370 Fast Receipt Printer (USB + LAN):*\\n\`;
      reply += \`• خێرایی چاپ: 220-260mm/s، قاشکەری ئۆتۆماتیک، گونجاو بۆ کاشێر و مەتبەخ\\n\`;
      reply += \`💰 نرخ: *$53.00* (~\${Math.round(53 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Xprinter XP-80T (Auto-Cutter + USB):*\\n\`;
      reply += \`• خێرایی تا 200mm/s، دەرچەی سندوقی پارە\\n\`;
      reply += \`💰 نرخ: *$45.00* (~\${Math.round(45 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Zywell 310 Heavy-Duty Commercial Printer:*\\n\`;
      reply += \`• زۆر بەهێز بۆ سوپەرمارکێت و چێشتخانەی زۆر قەرەباڵغ\\n\`;
      reply += \`💰 نرخ: *$95.00* (~\${Math.round(95 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *PT-210 Portable Bluetooth Printer (58mm):*\\n\`;
      reply += \`• پاتری 1500mAh، چاپ ڕاستەوخۆ لە مۆبایلەوە (Android/iOS)\\n\`;
      reply += \`💰 نرخ: *$37.00* (~\${Math.round(37 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Rongta RPP300 Portable Bluetooth (80mm):*\\n\`;
      reply += \`• پاتری 2000mAh، Bluetooth + USB، چاپی وەسڵی پان\\n\`;
      reply += \`💰 نرخ: *$85.00* (~\${Math.round(85 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Zywell M04 Portable Printer:*\\n\`;
      reply += \`💰 نرخ: *$80.00* (~\${Math.round(80 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🚗 \${DELIVERY_NOTE}\\n\`;
      reply += \`📞 داواکردن: \${PHONE_1} | \${PHONE_2}\`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'novex_8370.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 3. CATEGORY 3: LABEL & BARCODE PRINTERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '3' || lower.includes('پرینتەری لەیبڵ') || lower.includes('zebra') || lower.includes('zd230') || lower.includes('hprt') || lower.includes('lpq58') || lower.includes('zywell 910') || lower.includes('vg80') || lower.includes('van gold')) {
      let reply = \`🏷 *پرینتەرەکانی لەیبڵ و بارکۆد ستیکەر (Zoho Books)*\\n\\n\`;
      reply += \`🔹 *Zebra ZD230 Desktop 4-inch Label Printer:*\\n\`;
      reply += \`• مارکەی جیهانی ئەسڵی زێبرا، بۆ بارکۆدی کۆگا، نرخ و لەیبڵی گەیاندن (203 dpi)\\n\`;
      reply += \`💰 نرخ: *$175.00* (~\${Math.round(175 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *HPRT LPQ58 Thermal Label Printer:*\\n\`;
      reply += \`• پرینتەری پێشکەوتووی لەیبڵ و ستیکەری نرخ\\n\`;
      reply += \`💰 نرخ: *$115.00* (~\${Math.round(115 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Zywell 910 (ZY910) 4-inch Label Printer (USB + Bluetooth):*\\n\`;
      reply += \`• چاپی ستیکەری 100×150 و 100×100 لە مۆبایل و کۆمپیوتەرەوە\\n\`;
      reply += \`💰 نرخ: *$110.00* (~\${Math.round(110 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Van Gold VG80 Label Printer:*\\n\`;
      reply += \`• بۆ لەیبڵی سەر ڕەف، بارکۆد و ستیکەری کۆگا\\n\`;
      reply += \`💰 نرخ: *$95.00* (~\${Math.round(95 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🚗 \${DELIVERY_NOTE}\\n\`;
      reply += \`📞 داواکردن: \${PHONE_1} | \${PHONE_2}\`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'zebra_printer.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 4. CATEGORY 4: BARCODE SCANNERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '4' || lower.includes('سکانەر') || lower.includes('scanner') || lower.includes('orbit') || lower.includes('ds2208') || lower.includes('hf680') || lower.includes('henex') || lower.includes('symbol') || lower.includes('بارکۆد')) {
      let reply = \`🔫 *بارکۆد سکانەرەکانی مارکێت و کۆگا (Zoho Books)*\\n\\n\`;
      reply += \`🔹 *Honeywell Orbit 7120 Omnidirectional Laser (سەر مێز):*\\n\`;
      reply += \`• ٢٠ هێڵی لەیزەر، ١١٢٠ سکان لە چرکەیەکدا، سەری دەچەمێتەوە بۆ کاشێری خێرا\\n\`;
      reply += \`💰 نرخ: *$120.00* (~\${Math.round(120 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Honeywell HF680 2D Hands-free Presentation Scanner:*\\n\`;
      reply += \`• خوێندنەوەی خێرای 1D و 2D لەسەر شاشەی مۆبایل و کاغەز\\n\`;
      reply += \`💰 نرخ: *$125.00* (~\${Math.round(125 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Zebra DS2208 2D Imager Handheld Scanner:*\\n\`;
      reply += \`• مارکەی زێبرا، خوێندنەوەی بارکۆدی تێکچوو و هەموو جۆرە کۆدێک\\n\`;
      reply += \`💰 نرخ: *$125.00* (~\${Math.round(125 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Zebra LS2208 Laser Scanner (Symbol):*\\n\`;
      reply += \`• سکانەری بەناوبانگی بەهێزی شووشە دژە ڕووشان بۆ کاشێر\\n\`;
      reply += \`💰 نرخ: *$105.00* (~\${Math.round(105 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Henex 6052 2D Desktop Omnidirectional:*\\n\`;
      reply += \`💰 نرخ: *$85.00* (~\${Math.round(85 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Henex 2210 2D Wireless Scanner (2.4G & Bluetooth):*\\n\`;
      reply += \`• بێتەل مەودای ١٠٠ مەتر بۆ کۆگا و مارکێت\\n\`;
      reply += \`💰 نرخ: *$75.00* (~\${Math.round(75 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Henex Wired 1D/2D QR Scanner:*\\n\`;
      reply += \`• سکانەری وایەردار بە کوالێتی بەرز بۆ کاشێر\\n\`;
      reply += \`💰 نرخ: *$50.00* (~\${Math.round(50 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🚗 \${DELIVERY_NOTE}\\n\`;
      reply += \`📞 داواکردن: \${PHONE_1} | \${PHONE_2}\`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'honeywell_orbit.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 5. CATEGORY 5: CASH DRAWERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '5' || lower.includes('دراوەر') || lower.includes('قاسە') || lower.includes('drawer') || lower.includes('cash drawer') || lower.includes('x10')) {
      let reply = \`💰 *سندوقی پارەی ئۆتۆماتیکی پۆڵایین (X10 Cash Drawer)*\\n\\n\`;
      reply += \`• ئاسنی قورسی تۆکمە و زۆر بەهێز\\n\`;
      reply += \`• ٥ خانی پارەی کاغەز + ٨ خانی وردە پارە\\n\`;
      reply += \`• پۆرتی RJ11 بۆ بەستنەوە بە پرینتەر (خۆکارانە دەکرێتەوە لە کاتی دەرچوونی وەسڵ)\\n\`;
      reply += \`• کلیلی تایبەتی سەلامەتی\\n\\n\`;
      reply += \`💰 نرخ: *$45.00* (~\${Math.round(45 * currentRate).toLocaleString()} دینار)\\n\`;
      reply += \`🚗 \${DELIVERY_NOTE}\\n\`;
      reply += \`📞 داواکردن: \${PHONE_1} | \${PHONE_2}\`;

      const photoPath = path.join(__dirname, '..', 'assets', 'products', 'cash_drawer.png');
      await replyWithPhotoOrText(remoteJid, reply, photoPath);
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 6. CATEGORY 6: POS SYSTEMS & COMPUTERS (Zoho Books Real Stock)
    // -------------------------------------------------------------
    if (lower === '6' || lower.includes('سیستەم') || lower.includes('pos') || lower.includes('venex') || lower.includes('aio') || lower.includes('dell') || lower.includes('کۆمپیوتەر')) {
      let reply = \`💻 *سیستەمی تەواوی POS و کۆمپیوتەری ژمێریاری (Zoho Books)*\\n\\n\`;
      reply += \`🔹 *Venex POS Terminal (Double Screen):*\\n\`;
      reply += \`• Core i5 (5th gen)، 8GB RAM، 128GB SSD، دوو شاشە بۆ کڕیار و کاشێر\\n\`;
      reply += \`💰 نرخ: *$360.00* (~\${Math.round(360 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Dell All-in-One (AIO):*\\n\`;
      reply += \`• ئامێری یەکپارچەی دێڵ بۆ سیستمەکانی ژمێریاری\\n\`;
      reply += \`💰 نرخ: *$350.00* (~\${Math.round(350 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Case Core i5 (6th gen):*\\n\`;
      reply += \`• کیس کۆمپیوتەری کارا بۆ سیستەمی مارکێت\\n\`;
      reply += \`💰 نرخ: *$285.00* (~\${Math.round(285 * currentRate).toLocaleString()} دینار)\\n\\n\`;

      reply += \`🔹 *Dell OptiPlex 7020 Case:* *$650.00*\\n\`;
      reply += \`🔹 *Lenovo ThinkCentre Neo 30s:* *$625.00*\\n\`;
      reply += \`🔹 *HP Zbook Workstation:* *$230.00*\\n\`;
      reply += \`🔹 *Monitor LG 24-inch (24MS500-B):* *$95.00*\\n\\n\`;

      reply += \`🚗 \${DELIVERY_NOTE}\\n\`;
      reply += \`📞 داواکردن: \${PHONE_1} | \${PHONE_2}\`;

      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 7. SPECIFIC QUERY: DOLLAR RATE
    // -------------------------------------------------------------
    if (lower === '7' || lower.includes('دۆلار') || lower.includes('dollar') || lower.includes('صرف') || lower.includes('rate')) {
      let reply = \`💵 *نوێترین نرخی دۆلار لە بازاڕی هەولێر:*\\n\\n\`;
      reply += \`• 100$ = *\${rateStr}*\\n\`;
      reply += \`• 1$ = *\${currentRate.toLocaleString()} دینار*\\n\\n\`;
      reply += \`🏢 *کۆمپانیای Vertex*\\n\`;
      reply += \`🌐 کەناڵی فەرمی: https://t.me/vertexiqzone\\n\`;
      reply += \`📞 فرۆشتن: \${PHONE_1} | \${PHONE_2}\`;
      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // 8. CATEGORY 8: ADDRESS, HOURS, CONTACT
    // -------------------------------------------------------------
    if (lower === '8' || lower.includes('ناونیشان') || lower.includes('شوێن') || lower.includes('پەیوەندی') || lower.includes('تەلەفۆن') || lower.includes('کات')) {
      let reply = \`🏢 *کۆمپانیای بازرگانی گشتی VERTEX*\\n\\n\`;
      reply += \`📍 *ناونیشان:* عێراق - هەولێر - شەقامی سەرەکی\\n\`;
      reply += \`⏰ *کاتی دەوامی فەرمی:* ٩:٠٠ی بەیانی تا ٧:٠٠ی ئێوارە (شەممە تا پێنجشەممە)\\n\`;
      reply += \`🌐 *وێبسایتی فەرمی:* https://vertex1.tech\\n\`;
      reply += \`📢 *کەناڵی تێلیگرام:* https://t.me/vertexiqzone\\n\\n\`;
      reply += \`📞 *تەلەفۆن و واتسئاپ:* \\n\`;
      reply += \`• \${PHONE_1}\\n\`;
      reply += \`• \${PHONE_2}\\n\\n\`;
      reply += \`🚗 *گەیاندن بەردەستە بۆ هەموو شارەکانی کوردستان و عێراق* (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی).\`;

      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }

    // -------------------------------------------------------------
    // PACKAGE INQUIRY EXPLANATION (پاکێج بە تەواوی لابراوە)
    // -------------------------------------------------------------
    if (lower.includes('پاکێج') || lower.includes('ئۆفەر') || lower.includes('bundle') || lower.includes('pack')) {
      let reply = \`ℹ️ *ئاگاداری دەربارەی پاکێج و کاڵاکان:*\\n\\n\`;
      reply += \`سەرجەم بەرهەمەکان بە شێوەی سەربەخۆ و ڕاستەوخۆ بەپێی کۆگای فەرمی Zoho Books بە کواڵیتی باڵا و گەرەنتی بەردەستن.\\n\\n\`;
      reply += \`👇 تکایە ژمارەی بەشەکە هەڵبژێرە لە ١ تا ٨:\\n\`;
      reply += \`1️⃣ کاغەزی حەراری و لەیبڵ\\n\`;
      reply += \`2️⃣ پرینتەری پسوولە\\n\`;
      reply += \`3️⃣ پرینتەری لەیبڵ و ستیکەر\\n\`;
      reply += \`4️⃣ بارکۆد سکانەر\\n\`;
      reply += \`5️⃣ کش دراوەری پارە\\n\`;
      reply += \`6️⃣ سیستەمی POS و کۆمپیوتەر\\n\`;
      reply += \`7️⃣ نرخی دۆلار\\n\`;
      reply += \`8️⃣ پەیوەندی و ناونیشان\\n\\n\`;
      reply += \`📞 پرسیار و فرۆشتن: \${PHONE_1} | \${PHONE_2}\`;
      await this.sock.sendMessage(remoteJid, { text: reply });
      session.lastInteractionAt = now;
      return;
    }`;

// Replace sendMasterMenu
const sendMasterMenuRegex = /async sendMasterMenu\(remoteJid\) \{[\s\S]*?await this\.sock\.sendMessage\(remoteJid, \{ text: welcome \}\);\s*\}/;
if (!sendMasterMenuRegex.test(content)) {
  console.error('❌ Could not find sendMasterMenu regex');
  process.exit(1);
}
content = content.replace(sendMasterMenuRegex, newSendMasterMenu);

// Replace Category Handlers
// Match from "// 1. SPECIFIC QUERY: DOLLAR RATE" down to "// ORDERING / PURCHASING GUIDE"
const catHandlersRegex = /\/\/\s*1\.\s*SPECIFIC QUERY: DOLLAR RATE[\s\S]*?(?=\/\/\s*[-]+\s*\n\s*\/\/\s*ORDERING \/ PURCHASING GUIDE)/;
if (!catHandlersRegex.test(content)) {
  console.error('❌ Could not find category handlers regex');
  process.exit(1);
}
content = content.replace(catHandlersRegex, newCategoryHandlers + '\n\n    ');

// Replace any leftover 41 products mention
content = content.replace(/تەواوی ٤١ بەرهەم و کەرەستەکانی خاڵی فرۆش/g, 'تەواوی کاڵاکانی کۆمپانیای VERTEX بەپێی کۆگای زۆهۆ (Zoho Books)');
content = content.replace(/DYNAMIC SEARCH ACROSS 41 PRODUCTS/g, 'DYNAMIC SEARCH ACROSS ZOHO BOOKS PRODUCTS');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ whatsappBaileys.js successfully patched with Zoho Books inventory and packages purged!');

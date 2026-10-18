const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const zohoService = require('./zohoService');
const dollarScraper = require('./dollarScraper');

async function generatePriceListPdf(outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Get live dollar rate
      let dollarRate = 1684;
      try {
        const market = await dollarScraper.getLatestMarketRate();
        if (market && market.ratePerDollar) dollarRate = market.ratePerDollar;
      } catch (e) {}

      // Get live items from Zoho Books
      let zohoItems = [];
      try {
        zohoItems = await zohoService.getItems();
      } catch (e) {}

      const getZohoPrice = (sku, fallback) => {
        const found = zohoItems.find(it => (it.sku && it.sku === sku) || (it.name && it.name.includes(sku)));
        return (found && found.rate !== undefined) ? found.rate : fallback;
      };

      // Header Banner
      doc.rect(40, 40, 515, 75).fill('#1A365D');
      doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
        .text('VERTEX COMPANY', 55, 52);
      doc.fontSize(10).font('Helvetica')
        .text('General Trading, POS Hardware & Thermal Paper Solutions', 55, 78);
      doc.text('Erbil, Kurdistan Region, Iraq | Tel: 0750 000 0000 | Telegram: @vertex_ads_bot', 55, 93);

      // Subheader / Exchange Rate Notice
      const todayDate = new Date().toLocaleDateString('en-GB');
      doc.rect(40, 125, 515, 30).fill('#EDF2F7');
      doc.fillColor('#2D3748').fontSize(10).font('Helvetica-Bold')
        .text(`DAILY OFFICIAL PRICE SHEET - ${todayDate}`, 55, 134);
      doc.font('Helvetica').text(`Market Exchange Rate: $100 = ${(dollarRate * 100).toLocaleString()} IQD (1$ = ${dollarRate.toLocaleString()} IQD)`, 280, 134);

      let y = 170;

      function renderSectionHeader(title, color = '#2B6CB0') {
        doc.rect(40, y, 515, 22).fill(color);
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(title, 50, y + 6);
        y += 28;

        // Table Header
        doc.rect(40, y, 515, 18).fill('#E2E8F0');
        doc.fillColor('#4A5568').fontSize(9).font('Helvetica-Bold');
        doc.text('Product Name / Model', 50, y + 5);
        doc.text('Specifications / Packaging', 240, y + 5);
        doc.text('Unit Price ($)', 390, y + 5);
        doc.text('Price (IQD)', 465, y + 5);
        y += 22;
      }

      function renderRow(name, specs, priceUsd, isAlt = false) {
        if (isAlt) {
          doc.rect(40, y - 2, 515, 18).fill('#F7FAFC');
        }
        const priceIqd = Math.round(priceUsd * dollarRate);
        doc.fillColor('#1A202C').fontSize(9).font('Helvetica-Bold').text(name, 50, y + 2);
        doc.font('Helvetica').fillColor('#4A5568').text(specs, 240, y + 2);
        doc.fillColor('#2B6CB0').font('Helvetica-Bold').text(`$${priceUsd.toFixed(2)}`, 390, y + 2);
        doc.fillColor('#2D3748').text(`${priceIqd.toLocaleString()} د.ع`, 465, y + 2);
        y += 18;
      }

      // Section 1: Thermal Paper Rolls
      renderSectionHeader('1. PANDA THERMAL PAPER ROLLS (HIGH QUALITY)');
      renderRow('Paper / 80*80Mtr Panda', '80x80mm Thermal, 50 Rolls/Carton', getZohoPrice('8080P', 0.86), false);
      renderRow('Paper / 80*19Mtr Panda', '80x19mm Thermal, 100 Rolls/Carton', getZohoPrice('PaperRoll-Panda', 0.65), true);
      renderRow('Paper / 57*19Mtr Panda', '57x19mm Taxi & POS, 100 Rolls/Carton', getZohoPrice('Paper Roll Panda', 0.40), false);
      y += 8;

      // Section 2: Printers
      renderSectionHeader('2. RECEIPT & BARCODE PRINTERS');
      renderRow('Receipt Printer Novex 8370', '260mm/s Fast, Auto-Cutter, LAN + USB', getZohoPrice('Novex-8370', 53.00), false);
      renderRow('Zywell 310 Heavy Duty', 'Industrial POS Printer, LAN+USB+Serial', getZohoPrice('zywell 310', 95.00), true);
      renderRow('Van Gold VG80 Label Printer', 'Thermal Barcode & Shelf Label Printer', getZohoPrice('Label Printer- VG80', 95.00), false);
      renderRow('Zebra ZD230 Label Printer', 'Original Zebra Heavy Duty Desktop', getZohoPrice('ZEBRA-ZD230', 175.00), true);
      renderRow('PT-210 Portable Bluetooth', 'Portable 58mm Mobile Receipt Printer', getZohoPrice('PT-210', 37.00), false);
      y += 8;

      // Section 3: Barcode Scanners & Cash Drawers
      renderSectionHeader('3. BARCODE SCANNERS & CASH DRAWERS');
      renderRow('Henex High Speed Wired', '1D/2D QR Code Fast Reader, USB Cable', getZohoPrice('Henex-Wired', 50.00), false);
      renderRow('Henex 2210 2D Wireless', 'Bluetooth & 2.4G Wireless, Long Battery', getZohoPrice('Henex-2210', 75.00), true);
      renderRow('Honeywell Orbit 7120', 'Hands-Free Omnidirectional Desktop Scanner', getZohoPrice('HONEYWELL-ORBIT7120', 120.00), false);
      renderRow('Automatic Cash Drawer (X10)', 'Heavy Metal, 5 Bill Slots, RJ11 Auto-open', getZohoPrice('X10-CASH DRAWER', 45.00), true);
      y += 12;

      // Section 4: Special Value Bundles
      doc.rect(40, y, 515, 68).fill('#EBF8FF').stroke('#BEE3F8');
      doc.fillColor('#2B6CB0').fontSize(10).font('Helvetica-Bold')
        .text('OFFICIAL BUNDLE PACKS (SPECIAL DISCOUNTED PACKS):', 55, y + 8);
      
      doc.fillColor('#2D3748').fontSize(9).font('Helvetica')
        .text('• Supermarket Starter Pack: Novex Printer + Cash Drawer + Henex Scanner + 1 Carton Panda Paper -> $175', 55, y + 24)
        .text('• Restaurant LAN Pack: Novex 8370 LAN Printer + 1 Carton Panda 80*80 Paper -> $89', 55, y + 38)
        .text('• Bulk Paper Wholesale Deal: 10 Cartons Panda 80*80 (500 Rolls) with Free Erbil Delivery -> $425', 55, y + 52);
      y += 78;

      // Wholesale Note & QR Code Box
      doc.rect(40, y, 360, 60).fill('#FFF5F5').stroke('#FEB2B2');
      doc.fillColor('#C53030').fontSize(10).font('Helvetica-Bold')
        .text('WHOLESALE ORDERS & BULK QUANTITIES:', 50, y + 10);
      doc.fillColor('#4A5568').fontSize(8.5).font('Helvetica')
        .text('For carton volumes and container wholesale pricing, please contact our sales office directly.', 50, y + 25)
        .text('بۆ داواکردنی بڕی جوملە، تکایە ڕاستەوخۆ پەیوەندی بە بەشی فرۆشتنەوە بکەن.', 50, y + 38);

      // Generate QR Code Image Buffer
      const qrDataUrl = await QRCode.toDataURL('https://t.me/vertex_ads_bot', { margin: 1, width: 120 });
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');

      doc.image(qrBuffer, 435, y - 5, { width: 68, height: 68 });
      doc.fillColor('#718096').fontSize(7.5).font('Helvetica')
        .text('Scan for Telegram Store', 420, y + 65, { width: 100, align: 'center' });

      // Footer
      doc.fontSize(8).fillColor('#A0AEC0').text('Generated automatically by Vertex Business Automation System • Zoho Books Synced', 40, 780, { align: 'center', width: 515 });

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePriceListPdf
};

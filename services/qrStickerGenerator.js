const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');

async function generateCartonStickerPdf(outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // 100mm x 150mm standard sticker size (283 x 425 pt)
      const doc = new PDFDocument({
        size: [283.5, 425.2], // 100mm x 150mm
        margin: 15
      });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Border frame
      doc.rect(10, 10, 263.5, 405.2).lineWidth(2).stroke('#1A365D');
      doc.rect(13, 13, 257.5, 40).fill('#1A365D');

      // Header Banner
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
        .text('VERTEX COMPANY', 15, 23, { align: 'center', width: 253.5 });

      // Product Badge
      doc.fillColor('#2B6CB0').fontSize(14).font('Helvetica-Bold')
        .text('PANDA 80×80mm', 15, 65, { align: 'center', width: 253.5 });
      doc.fillColor('#4A5568').fontSize(9).font('Helvetica')
        .text('High-Grade Thermal Paper Rolls • 50 Rolls/Carton', 15, 83, { align: 'center', width: 253.5 });

      // Divider line
      doc.moveTo(25, 100).lineTo(258, 100).lineWidth(1).stroke('#CBD5E0');

      // Generate large QR Code
      const qrDataUrl = await QRCode.toDataURL('https://t.me/vertex_ads_bot?start=reorder_8080', {
        margin: 1,
        width: 300,
        color: {
          dark: '#1A365D',
          light: '#FFFFFF'
        }
      });
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');

      doc.image(qrBuffer, 52, 115, { width: 180, height: 180 });

      // Call to action boxes
      doc.rect(20, 305, 243.5, 45).fill('#EBF8FF').stroke('#BEE3F8');
      doc.fillColor('#2B6CB0').fontSize(11).font('Helvetica-Bold')
        .text('SCAN TO REORDER VIA TELEGRAM', 25, 314, { align: 'center', width: 233.5 });
      doc.fillColor('#2D3748').fontSize(9).font('Helvetica')
        .text('بۆ داواکردنی خێرای وەجبەی نوێ، ئەم کۆدە سکان بکە', 25, 332, { align: 'center', width: 233.5 });

      // Footer contact
      doc.fillColor('#718096').fontSize(8.5).font('Helvetica')
        .text('Tel / WhatsApp: 0750 000 0000 | Telegram: @vertex_ads_bot', 15, 365, { align: 'center', width: 253.5 });
      doc.fontSize(7.5).fillColor('#A0AEC0')
        .text('Official Distributor • Erbil, Kurdistan Region, Iraq', 15, 385, { align: 'center', width: 253.5 });

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);

    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  generateCartonStickerPdf
};

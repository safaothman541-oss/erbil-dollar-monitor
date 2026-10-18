const QRCode = require('qrcode');
const { convertHtmlToPdf } = require('./htmlPdfEngine');

async function generateCartonStickerPdf(outputPath) {
  const qrBase64 = await QRCode.toDataURL('https://t.me/vertex_ads_bot?start=reorder_8080', {
    margin: 1,
    width: 320,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF'
    }
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Panda 80*80 Carton Reorder Sticker</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 100mm;
      height: 150mm;
      font-family: 'Segoe UI', Tahoma, -apple-system, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      padding: 4mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sticker-border {
      width: 100%;
      height: 100%;
      border: 2mm solid #0F172A;
      border-radius: 3mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3mm;
    }
    .header-banner {
      background: #0F172A;
      color: #FFFFFF;
      text-align: center;
      padding: 2.5mm 1mm;
      border-radius: 1.5mm;
    }
    .header-main {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.8px;
    }
    .header-sub {
      font-size: 6.5pt;
      color: #94A3B8;
      letter-spacing: 0.3px;
      margin-top: 0.5mm;
    }
    .product-title {
      font-size: 17pt;
      font-weight: 950;
      color: #1E3A8A;
      text-align: center;
      margin-top: 1.5mm;
      letter-spacing: 0.5px;
    }
    .product-subtitle {
      font-size: 8pt;
      font-weight: 700;
      color: #475569;
      text-align: center;
      margin-top: 0.5mm;
    }
    .spec-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2mm;
      border: 1px solid #CBD5E1;
      font-size: 7pt;
    }
    .spec-grid td {
      padding: 1.2mm 2mm;
      border: 1px solid #CBD5E1;
    }
    .spec-label {
      background: #F1F5F9;
      font-weight: 700;
      color: #334155;
      width: 25%;
    }
    .spec-val {
      color: #0F172A;
      font-weight: 600;
      width: 25%;
    }
    .qr-container {
      text-align: center;
      margin-top: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .qr-frame {
      display: inline-block;
      padding: 1.5mm;
      border: 1.5px solid #0F172A;
      border-radius: 2mm;
      background: #FFFFFF;
    }
    .cta-box {
      background: #EFF6FF;
      border: 1.5px solid #3B82F6;
      border-radius: 2mm;
      padding: 2mm;
      text-align: center;
      margin-top: 2mm;
    }
    .cta-kurdish {
      font-size: 8.5pt;
      font-weight: 800;
      color: #1E3A8A;
      direction: rtl;
    }
    .cta-english {
      font-size: 6.5pt;
      font-weight: 700;
      color: #2563EB;
      letter-spacing: 0.3px;
      margin-top: 0.5mm;
    }
    .footer {
      text-align: center;
      font-size: 6.5pt;
      color: #64748B;
      border-top: 1px solid #E2E8F0;
      padding-top: 1.5mm;
      margin-top: 1.5mm;
    }
  </style>
</head>
<body>

  <div class="sticker-border">
    <!-- Top Brand -->
    <div class="header-banner">
      <div class="header-main">VERTEX COMPANY</div>
      <div class="header-sub">OFFICIAL IMPORTER & DISTRIBUTOR • ERBIL, KURDISTAN</div>
    </div>

    <!-- Product Title -->
    <div>
      <div class="product-title">PANDA 80×80 mm</div>
      <div class="product-subtitle">PREMIUM THERMAL RECEIPT PAPER ROLLS</div>
    </div>

    <!-- Specifications Table -->
    <table class="spec-grid">
      <tr>
        <td class="spec-label">Model</td>
        <td class="spec-val">8080-PANDA</td>
        <td class="spec-label">Paper Width</td>
        <td class="spec-val">80 mm (± 0.5)</td>
      </tr>
      <tr>
        <td class="spec-label">Roll Dia.</td>
        <td class="spec-val">80 mm Max</td>
        <td class="spec-label">Packaging</td>
        <td class="spec-val">50 Rolls / Box</td>
      </tr>
      <tr>
        <td class="spec-label">Coating</td>
        <td class="spec-val">AAA Japan Grade</td>
        <td class="spec-label">Core Size</td>
        <td class="spec-val">12 mm Standard</td>
      </tr>
    </table>

    <!-- Center QR Code -->
    <div class="qr-container">
      <div class="qr-frame">
        <img src="${qrBase64}" style="width: 38mm; height: 38mm; display: block;">
      </div>
    </div>

    <!-- Call to action -->
    <div class="cta-box">
      <div class="cta-kurdish">بۆ داواکردنی خێرای وەجبەی نوێ، ئەم کۆدە بە مۆبایلەکەت سکان بکە</div>
      <div class="cta-english">SCAN WITH PHONE CAMERA TO REORDER IN 5 SECONDS</div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div style="font-weight: 800; color: #1E3A8A; font-size: 7.2pt; margin-bottom: 0.5mm;">
        🌐 Web: vertex1.tech &nbsp;|&nbsp; 📞 Tel: +964 750 758 6992
      </div>
      <div><b>WhatsApp:</b> +964 750 758 6992 &nbsp;|&nbsp; <b>Telegram:</b> @vertex_ads_bot</div>
      <div style="font-size: 5.8pt; color: #94A3B8; margin-top: 0.5mm;">
        Vertex Company • Erbil, Kurdistan Region, Iraq • vertexiqzone@gmail.com
      </div>
    </div>
  </div>

</body>
</html>
  `;

  return convertHtmlToPdf(html, outputPath);
}

module.exports = {
  generateCartonStickerPdf
};

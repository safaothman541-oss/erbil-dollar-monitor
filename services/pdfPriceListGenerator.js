const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const zohoService = require('./zohoService');
const dollarScraper = require('./dollarScraper');
const { convertHtmlToPdf } = require('./htmlPdfEngine');

async function generatePriceListPdf(outputPath) {
  // 1. Get live dollar rate
  let dollarRate = 1684;
  try {
    const market = await dollarScraper.getLatestMarketRate();
    if (market && market.ratePerDollar) dollarRate = market.ratePerDollar;
  } catch (e) {}

  // 2. Get live items from Zoho Books
  let zohoItems = [];
  try {
    zohoItems = await zohoService.getItems();
  } catch (e) {}

  const getZohoPrice = (sku, fallback) => {
    const found = zohoItems.find(it => (it.sku && it.sku === sku) || (it.name && it.name.includes(sku)));
    return (found && found.rate !== undefined && found.rate !== null) ? found.rate : fallback;
  };

  const todayDate = new Date().toLocaleDateString('en-GB');
  const qrBase64 = await QRCode.toDataURL('https://t.me/vertex_ads_bot', { margin: 1, width: 220 });

  // Product Data
  const paperItems = [
    { name: 'Panda Thermal Paper 80*80', sku: '8080P', spec: '80×80mm, High-grade Japan coating, dark print', pack: '50 Rolls / Box', price: getZohoPrice('8080P', 0.86) },
    { name: 'Panda Thermal Paper 80*19', sku: 'PaperRoll-Panda', spec: '80×19mm, Compact desktop & POS printer', pack: '100 Rolls / Box', price: getZohoPrice('PaperRoll-Panda', 0.65) },
    { name: 'Panda Thermal Paper 57*19', sku: 'Paper Roll Panda', spec: '57×19mm, Portable, Taxi & Handheld POS', pack: '100 Rolls / Box', price: getZohoPrice('Paper Roll Panda', 0.40) }
  ];

  const hardwareItems = [
    { name: 'Novex 8370 Thermal Receipt Printer', sku: 'Novex-8370', spec: '260mm/s Fast, Auto-cutter, USB + LAN ports', pack: '1 Unit (Full Kit)', price: getZohoPrice('Novex-8370', 53.00) },
    { name: 'Zywell 310 Heavy-Duty POS Printer', sku: 'zywell 310', spec: 'Industrial high-volume thermal printer, LAN+USB', pack: '1 Unit', price: getZohoPrice('zywell 310', 95.00) },
    { name: 'Van Gold VG80 Label Printer', sku: 'Label Printer- VG80', spec: 'Thermal barcode & shelf sticker printer', pack: '1 Unit', price: getZohoPrice('Label Printer- VG80', 95.00) },
    { name: 'Zebra ZD230 Label Printer', sku: 'ZEBRA-ZD230', spec: 'Original Zebra industrial desktop barcode printer', pack: '1 Unit', price: getZohoPrice('ZEBRA-ZD230', 175.00) },
    { name: 'PT-210 Portable Bluetooth Printer', sku: 'PT-210', spec: '58mm wireless mobile receipt printer', pack: '1 Unit', price: getZohoPrice('PT-210', 37.00) },
    { name: 'Henex High-Speed Wired Scanner', sku: 'Henex-Wired', spec: '1D/2D QR code instant reader with stand & USB', pack: '1 Unit', price: getZohoPrice('Henex-Wired', 50.00) },
    { name: 'Henex 2210 2D Wireless Scanner', sku: 'Henex-2210', spec: '2.4G & Bluetooth wireless, 100m range, long battery', pack: '1 Unit', price: getZohoPrice('Henex-2210', 75.00) },
    { name: 'Honeywell Orbit 7120 Scanner', sku: 'HONEYWELL-ORBIT7120', spec: 'Hands-free omnidirectional laser cashier scanner', pack: '1 Unit', price: getZohoPrice('HONEYWELL-ORBIT7120', 120.00) },
    { name: 'Automatic Cash Drawer (X10)', sku: 'X10-CASH DRAWER', spec: 'Heavy metal, 5 bill slots, RJ11 auto printer trigger', pack: '1 Unit', price: getZohoPrice('X10-CASH DRAWER', 45.00) }
  ];

  function renderRows(items) {
    return items.map((it, idx) => {
      const priceIqd = Math.round(it.price * dollarRate);
      const bg = idx % 2 === 1 ? 'background-color: #F8FAFC;' : 'background-color: #FFFFFF;';
      return `
        <tr style="${bg} border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 6px 10px; font-weight: 700; color: #0F172A; font-size: 11px;">
            ${it.name}
            <div style="font-size: 9px; color: #64748B; font-weight: 400;">SKU: ${it.sku}</div>
          </td>
          <td style="padding: 6px 10px; color: #475569; font-size: 10.5px;">${it.spec}</td>
          <td style="padding: 6px 10px; color: #334155; font-size: 10px; text-align: center;">${it.pack}</td>
          <td style="padding: 6px 10px; color: #16A34A; font-weight: 600; font-size: 9.5px; text-align: center;">In Stock</td>
          <td style="padding: 6px 10px; color: #1E40AF; font-weight: 700; font-size: 11.5px; text-align: right;">$${it.price.toFixed(2)}</td>
          <td style="padding: 6px 10px; color: #0F172A; font-weight: 700; font-size: 11px; text-align: right;">${priceIqd.toLocaleString()} IQD</td>
        </tr>
      `;
    }).join('');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vertex Company - Official Price List</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #0F172A;
      letter-spacing: 0.5px;
    }
    .brand-sub {
      font-size: 10px;
      color: #475569;
      font-weight: 600;
      margin-top: 1px;
    }
    .rate-badge {
      display: inline-block;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 4px;
      padding: 6px 12px;
      text-align: right;
    }
    .section-title {
      background: #1E293B;
      color: #FFFFFF;
      font-size: 10.5px;
      font-weight: 800;
      padding: 5px 10px;
      letter-spacing: 0.5px;
      border-radius: 3px 3px 0 0;
      margin-top: 6px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #CBD5E1;
      border-top: none;
      margin-bottom: 6px;
    }
    .data-table th {
      background: #F1F5F9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 5px 10px;
      border-bottom: 1px solid #CBD5E1;
      letter-spacing: 0.3px;
    }
    .bundles-container {
      display: flex;
      gap: 8px;
      margin-top: 4px;
      margin-bottom: 6px;
    }
    .bundle-card {
      flex: 1;
      border: 1.5px solid #CBD5E1;
      border-radius: 4px;
      padding: 7px 9px;
      background: #F8FAFC;
    }
    .bundle-header {
      font-size: 10.5px;
      font-weight: 800;
      color: #1E3A8A;
      border-bottom: 1px dashed #CBD5E1;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .bundle-price {
      font-size: 14px;
      font-weight: 900;
      color: #047857;
      margin-top: 4px;
    }
    .footer-bar {
      margin-top: 6px;
      border-top: 1.5px solid #E2E8F0;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .wholesale-box {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 4px;
      padding: 6px 10px;
      flex: 1;
      margin-right: 12px;
    }
    .qr-box {
      text-align: center;
      width: 85px;
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div class="brand-title">VERTEX COMPANY</div>
        <div class="brand-sub">General Trading, POS Hardware & Thermal Paper Solutions</div>
        <div style="font-size: 10px; color: #1E40AF; font-weight: 800; margin-top: 3px;">
          Website: <a href="https://vertex1.tech" style="color: #1E40AF; text-decoration: none;">vertex1.tech</a> &nbsp;|&nbsp; Tel / WhatsApp: +964 750 758 6992 (0750 758 6992)
        </div>
        <div style="font-size: 9px; color: #64748B; margin-top: 1px;">
          Erbil, Kurdistan Region, Iraq &nbsp;|&nbsp; Email: vertexiqzone@gmail.com &nbsp;|&nbsp; Telegram: @vertex_ads_bot
        </div>
      </td>
      <td style="text-align: right; vertical-align: middle;">
        <div class="rate-badge">
          <div style="font-size: 11px; font-weight: 800; color: #1E3A8A;">OFFICIAL DAILY PRICE SHEET</div>
          <div style="font-size: 9px; color: #64748B; margin-top: 1px;">Date: ${todayDate} • Zoho Books Synced</div>
          <div style="font-size: 10px; font-weight: 700; color: #047857; margin-top: 2px;">
            Market Exchange Rate: $100 = ${(dollarRate * 100).toLocaleString()} IQD (1$ = ${dollarRate.toLocaleString()} IQD)
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Section 1: Paper -->
  <div class="section-title">1. PANDA THERMAL RECEIPT PAPER ROLLS (AAA GRADE)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: left; width: 30%;">Product / Model</th>
        <th style="text-align: left; width: 33%;">Specifications & Compatibility</th>
        <th style="text-align: center; width: 14%;">Packaging</th>
        <th style="text-align: center; width: 7%;">Status</th>
        <th style="text-align: right; width: 8%;">Price ($)</th>
        <th style="text-align: right; width: 8%;">Price (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(paperItems)}
    </tbody>
  </table>

  <!-- Section 2: Hardware -->
  <div class="section-title">2. RECEIPT PRINTERS, BARCODE SCANNERS & CASH DRAWERS</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: left; width: 30%;">Product / Model</th>
        <th style="text-align: left; width: 33%;">Specifications & Compatibility</th>
        <th style="text-align: center; width: 14%;">Packaging</th>
        <th style="text-align: center; width: 7%;">Status</th>
        <th style="text-align: right; width: 8%;">Price ($)</th>
        <th style="text-align: right; width: 8%;">Price (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(hardwareItems)}
    </tbody>
  </table>

  <!-- Section 3: Bundles -->
  <div class="section-title" style="background: #0F766E;">3. OFFICIAL BUNDLE PACKS (HIGH-VALUE SOLUTIONS)</div>
  <div class="bundles-container">
    <div class="bundle-card">
      <div class="bundle-header">🏪 Supermarket Starter Pack</div>
      <div style="font-size: 9px; color: #334155;">
        • Novex 8370 Fast Auto-Cutter Printer<br>
        • Heavy Metal Automatic Cash Drawer<br>
        • Henex High-Speed Wired Scanner<br>
        • <b>1 Full Carton Panda 80*80 Paper (50 Rolls)</b>
      </div>
      <div class="bundle-price">$175.00 <span style="font-size: 10px; font-weight: 600; color: #475569;">(${Math.round(175 * dollarRate).toLocaleString()} IQD)</span></div>
      <div style="font-size: 8px; color: #64748B;">Retail Value: $191.00 (Save $16.00)</div>
    </div>

    <div class="bundle-card">
      <div class="bundle-header">🍽 Restaurant / Cafe Pack</div>
      <div style="font-size: 9px; color: #334155;">
        • Novex 8370 Fast LAN Printer (Kitchen/Cashier)<br>
        • High-speed auto cutter & sound alert<br>
        • <b>1 Full Carton Panda 80*80 Paper (50 Rolls)</b><br>
        • Heat & steam resistant hardware
      </div>
      <div class="bundle-price">$89.00 <span style="font-size: 10px; font-weight: 600; color: #475569;">(${Math.round(89 * dollarRate).toLocaleString()} IQD)</span></div>
      <div style="font-size: 8px; color: #64748B;">Retail Value: $96.00 (Save $7.00)</div>
    </div>

    <div class="bundle-card">
      <div class="bundle-header">📦 Wholesale Paper Volume Deal</div>
      <div style="font-size: 9px; color: #334155;">
        • <b>10 Cartons Panda 80*80 (500 Rolls Total)</b><br>
        • Calculated at discounted $0.85 / roll<br>
        • <b>Free Delivery</b> within Erbil city limits<br>
        • Guaranteed Japanese dark thermal coating
      </div>
      <div class="bundle-price">$425.00 <span style="font-size: 10px; font-weight: 600; color: #475569;">(${Math.round(425 * dollarRate).toLocaleString()} IQD)</span></div>
      <div style="font-size: 8px; color: #64748B;">Regular Price: $430.00 + Free Delivery</div>
    </div>
  </div>

  <!-- Footer Area -->
  <div class="footer-bar">
    <div class="wholesale-box">
      <div style="font-weight: 800; color: #991B1B; font-size: 10px; margin-bottom: 2px;">
        WHOLESALE INQUIRIES & BULK CARTON ORDERS:
      </div>
      <div style="font-size: 9px; color: #4B5563;">
        For commercial supply contracts, distributor partnership, and volume pricing: <b>+964 750 758 6992</b> &bull; <b>vertex1.tech</b>
      </div>
      <div style="font-size: 9.5px; font-weight: 700; color: #1E293B; margin-top: 3px; direction: rtl; text-align: right;">
        بۆ داواکردنی بڕی جوملە (کارتۆن و کۆنتێنەر): پەیوەندی بە <b>0750 758 6992</b> یان سەردانی <b>vertex1.tech</b> بکەن.
      </div>
    </div>

    <div class="qr-box">
      <img src="${qrBase64}" style="width: 65px; height: 65px; border: 1px solid #CBD5E1; border-radius: 4px; display: block; margin: 0 auto;">
      <div style="font-size: 7.5px; color: #64748B; font-weight: 600; margin-top: 2px;">Telegram Store<br>@vertex_ads_bot</div>
    </div>
  </div>

</body>
</html>
  `;

  return convertHtmlToPdf(html, outputPath);
}

module.exports = {
  generatePriceListPdf
};

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const zohoService = require('./zohoService');
const dollarScraper = require('./dollarScraper');
const { convertHtmlToPdf } = require('./htmlPdfEngine');

async function generatePriceListPdf(outputPath) {
  // 1. Get live dollar rate
  let dollarRate = 1685;
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
  const qrBase64 = await QRCode.toDataURL('https://t.me/vertexiqzone', { margin: 1, width: 220 });

  // 3. Helper to encode local images to Base64 data URLs
  const getImgBase64 = (fileName) => {
    if (!fileName) return '';
    const p = path.join(__dirname, '..', 'assets', 'products', fileName);
    if (fs.existsSync(p)) {
      const ext = path.extname(p).slice(1).toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png');
      return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
    }
    return '';
  };

  // Logo Base64
  const logoPath = path.join(__dirname, '..', 'assets', 'logo_dark_oncream.png');
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  }

  // Strictly Zoho Books Items
  const paperAndLabels = [
    { name: 'Panda Thermal Paper 80*80', sku: '8080P', img: 'panda_80_80.png', spec: '80×80mm, High-grade Japan coating, dark print', pack: '50 Rolls / Box', price: getZohoPrice('8080P', 1.25) },
    { name: 'Panda Thermal Paper 80*19', sku: 'PaperRoll-Panda', img: 'panda_80_19.png', spec: '80×19mm, Compact desktop & POS printer', pack: '100 Rolls / Box', price: getZohoPrice('PaperRoll-Panda', 0.65) },
    { name: 'Panda Thermal Paper 57*19', sku: 'Paper Roll Panda', img: 'panda_57_19.png', spec: '57×19mm, Portable, Taxi & Handheld POS', pack: '100 Rolls / Box', price: getZohoPrice('Paper Roll Panda', 0.40) },
    { name: 'Thermal Shipping Label 100*150', sku: '100*150-Label', img: 'label_100_150.png', spec: '100×150mm, Delivery & courier shipping labels', pack: 'Roll (500 pcs)', price: getZohoPrice('100*150-Label', 11.00) },
    { name: 'Thermal Label 100*100', sku: '100*100-Label', img: 'label_100_150.png', spec: '100×100mm, Carton & warehouse product label', pack: 'Roll', price: getZohoPrice('100*100-Label', 7.50) },
    { name: 'Thermal Label 80*50', sku: 'Label Roll', img: 'label_80_50.png', spec: '80×50mm, Shelf & retail product stickers', pack: '1000 Pcs / Roll', price: getZohoPrice('Label Roll', 5.00) },
    { name: 'Thermal Label 58*39 (Chinese)', sku: 'Label 58*39 Chinese', img: 'label_58_39.png', spec: '58×39mm, Barcode & product price label', pack: 'Roll', price: getZohoPrice('Label 58*39 Chinese', 2.00) },
    { name: 'Thermal Label 50*25 (Chinese)', sku: '50*25 Chinese', img: 'label_58_39.png', spec: '50×25mm, Compact barcode sticker', pack: 'Roll', price: getZohoPrice('50*25 Chinese', 2.00) },
    { name: 'Thermal Label 38*25 (Chinese)', sku: '38*25C- Label', img: 'label_58_39.png', spec: '38×25mm, Pharmacy & jewelry mini label', pack: 'Roll', price: getZohoPrice('38*25C- Label', 2.00) }
  ];

  const hardwareItems = [
    { name: 'Novex 8370 Thermal Receipt Printer', sku: 'Novex-8370', img: 'novex_8370.png', spec: '260mm/s Fast, Auto-cutter, USB + LAN ports', pack: '1 Unit', price: getZohoPrice('Novex-8370', 53.00) },
    { name: 'Xprinter XP-80T Receipt Printer', sku: 'Xprinter-80ts', img: 'novex_8370.png', spec: '200mm/s, Auto-cutter, Cash drawer port, USB', pack: '1 Unit', price: getZohoPrice('Xprinter-80ts', 45.00) },
    { name: 'Zywell 310 Heavy-Duty POS Printer', sku: 'zywell 310', img: 'zywell_310_real.jpeg', spec: 'Industrial high-volume thermal printer, LAN+USB', pack: '1 Unit', price: getZohoPrice('zywell 310', 95.00) },
    { name: 'PT-210 Portable Bluetooth Printer', sku: 'PT-210', img: 'pt210_portable.png', spec: '58mm wireless mobile receipt printer, Android/iOS', pack: '1 Unit', price: getZohoPrice('PT-210', 37.00) },
    { name: 'Rongta RPP300 Portable Bluetooth', sku: 'Rongta-RPP300', img: 'rongta_rpp300.png', spec: '80mm wide mobile receipt printer, Bluetooth+USB', pack: '1 Unit', price: getZohoPrice('Rongta-RPP300', 85.00) },
    { name: 'Zebra ZD230 Desktop Label Printer', sku: 'ZEBRA-ZD230', img: 'zebra_printer.png', spec: 'Original Zebra 4-inch barcode & shipping printer', pack: '1 Unit', price: getZohoPrice('ZEBRA-ZD230', 175.00) },
    { name: 'HPRT LPQ58 Thermal Label Printer', sku: 'HPRT-LPQ58', img: 'hprt_printer.png', spec: 'Thermal label & shelf sticker printer', pack: '1 Unit', price: getZohoPrice('HPRT-LPQ58', 115.00) },
    { name: 'Zywell 910 4-inch Label Printer', sku: 'Zywell-910', img: 'vangold_vg80.png', spec: 'Up to 108mm print width, USB + Bluetooth', pack: '1 Unit', price: getZohoPrice('Zywell-910', 110.00) },
    { name: 'Van Gold VG80 Label Printer', sku: 'Label Printer- VG80', img: 'vangold_vg80.png', spec: 'Thermal barcode & shelf sticker printer', pack: '1 Unit', price: getZohoPrice('Label Printer- VG80', 95.00) },
    { name: 'Honeywell Orbit 7120 Scanner', sku: 'HONEYWELL-ORBIT7120', img: 'honeywell_orbit.png', spec: 'Hands-free omnidirectional laser cashier scanner', pack: '1 Unit', price: getZohoPrice('HONEYWELL-ORBIT7120', 120.00) },
    { name: 'Honeywell HF680 2D Scanner', sku: 'HONEYWELL-HF680', img: 'honeywell_hf680.jpg', spec: '2D Presentation hands-free scanner, reads phones', pack: '1 Unit', price: getZohoPrice('HONEYWELL-HF680', 125.00) },
    { name: 'Zebra DS2208 2D Imager Scanner', sku: 'ZEBRA-DS2208', img: 'henex_wireless.png', spec: 'Zebra cordless/corded handheld 1D/2D imager', pack: '1 Unit', price: getZohoPrice('ZEBRA-DS2208', 125.00) },
    { name: 'Zebra LS2208 Laser Scanner (Symbol)', sku: 'ZEBRA-LS2208', img: 'henex_wired.png', spec: 'Scratch-resistant window 1D laser checkout scanner', pack: '1 Unit', price: getZohoPrice('ZEBRA-LS2208', 105.00) },
    { name: 'Henex 6052 2D Desktop Scanner', sku: 'Henex-6052', img: 'honeywell_orbit.png', spec: '2D Omnidirectional desktop supermarket scanner', pack: '1 Unit', price: getZohoPrice('Henex-6052', 85.00) },
    { name: 'Henex 2210 2D Wireless Scanner', sku: 'Henex-2210', img: 'henex_wireless.png', spec: '2.4G & Bluetooth wireless, 100m range, long battery', pack: '1 Unit', price: getZohoPrice('Henex-2210', 75.00) },
    { name: 'Henex High-Speed Wired Scanner', sku: 'Henex-Wired', img: 'henex_wired.png', spec: '1D/2D QR code instant reader with stand & USB', pack: '1 Unit', price: getZohoPrice('Henex-Wired', 50.00) },
    { name: 'Automatic Cash Drawer (X10)', sku: 'X10-CASH DRAWER', img: 'cash_drawer.png', spec: 'Heavy metal, 5 bill slots, RJ11 auto printer trigger', pack: '1 Unit', price: getZohoPrice('X10-CASH DRAWER', 45.00) },
    { name: 'Venex POS All-in-One (Dual Screen)', sku: 'POS-Venex', img: 'biison_pos.png', spec: 'Core i5, 8GB RAM, 128GB SSD, Dual Display POS', pack: '1 Unit', price: getZohoPrice('POS-Venex', 360.00) },
    { name: 'Dell All-in-One POS System (AIO)', sku: 'AIO-Dell', img: 'biison_pos.png', spec: 'Commercial grade all-in-one POS computer', pack: '1 Unit', price: getZohoPrice('AIO-Dell', 350.00) },
    { name: 'Case Core i5 POS Computer (6th gen)', sku: 'Case i5- 6th gen', img: 'biison_pos.png', spec: 'Compact retail POS tower system', pack: '1 Unit', price: getZohoPrice('Case i5- 6th gen', 285.00) }
  ];

  function renderRows(items) {
    return items.map((it, idx) => {
      const priceIqd = Math.round(it.price * dollarRate);
      const bg = idx % 2 === 1 ? 'background-color: #F8FAFC;' : 'background-color: #FFFFFF;';
      const imgSrc = getImgBase64(it.img);
      return `
        <tr style="${bg} border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 3px 5px; text-align: center; vertical-align: middle; width: 38px;">
            ${imgSrc ? `<img src="${imgSrc}" style="width: 28px; height: 28px; object-fit: contain; border-radius: 3px; background: #FFFFFF; border: 1px solid #E2E8F0; display: block; margin: 0 auto;">` : ''}
          </td>
          <td style="padding: 4px 6px; font-weight: 700; color: #0F172A; font-size: 9.5px; vertical-align: middle;">
            ${it.name}
            <div style="font-size: 8px; color: #64748B; font-weight: 400;">SKU: ${it.sku}</div>
          </td>
          <td style="padding: 4px 6px; color: #475569; font-size: 9px; vertical-align: middle;">${it.spec}</td>
          <td style="padding: 4px 6px; color: #334155; font-size: 8.5px; text-align: center; vertical-align: middle;">${it.pack}</td>
          <td style="padding: 4px 6px; color: #1E40AF; font-weight: 700; font-size: 10px; text-align: right; vertical-align: middle;">$${it.price.toFixed(2)}</td>
          <td style="padding: 4px 6px; color: #0F172A; font-weight: 700; font-size: 9.5px; text-align: right; vertical-align: middle;">${priceIqd.toLocaleString()} IQD</td>
        </tr>
      `;
    }).join('');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vertex Company - Official Price List (Zoho Books Verified)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm 6mm 8mm;
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
      font-size: 9.5px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .brand-sub {
      font-size: 9px;
      color: #475569;
      font-weight: 600;
      margin-top: 1px;
    }
    .rate-badge {
      display: inline-block;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 4px;
      padding: 4px 8px;
      text-align: right;
    }
    .section-title {
      background: #1E293B;
      color: #FFFFFF;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 6px;
      letter-spacing: 0.5px;
      border-radius: 3px 3px 0 0;
      margin-top: 4px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #CBD5E1;
      border-top: none;
      margin-bottom: 4px;
    }
    .data-table th {
      background: #F1F5F9;
      color: #334155;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 6px;
      border-bottom: 1px solid #CBD5E1;
      letter-spacing: 0.3px;
    }
    .footer-bar {
      margin-top: 4px;
      border-top: 1px solid #E2E8F0;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .wholesale-box {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 4px 8px;
      flex: 1;
      margin-right: 10px;
    }
    .qr-box {
      text-align: center;
      width: 70px;
    }
  </style>
</head>
<body>

  <!-- Top Header with Official Vertex Logo -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        ${logoBase64 ? `<img src="${logoBase64}" style="height: 30px; display: block; margin-bottom: 2px;" alt="VERTEX">` : `<div style="font-size: 18px; font-weight: 900; color: #0F172A;">VERTEX COMPANY</div>`}
        <div class="brand-sub">General Trading, POS Hardware & Thermal Paper Solutions</div>
        <div style="font-size: 8.5px; color: #1E40AF; font-weight: 800; margin-top: 1px;">
          Website: <a href="https://vertex1.tech" style="color: #1E40AF; text-decoration: none;">vertex1.tech</a> &nbsp;|&nbsp; Tel: <span dir="ltr">+964 750 758 6992 &bull; +964 750 529 9118</span>
        </div>
        <div style="font-size: 8px; color: #64748B;">
          Erbil, Kurdistan Region, Iraq &nbsp;|&nbsp; Telegram: @vertexiqzone &nbsp;|&nbsp; Single Source of Truth: Zoho Books
        </div>
      </td>
      <td style="text-align: right; vertical-align: middle;">
        <div class="rate-badge">
          <div style="font-size: 9.5px; font-weight: 800; color: #1E3A8A;">OFFICIAL DAILY PRICE SHEET</div>
          <div style="font-size: 8px; color: #64748B; margin-top: 1px;">Date: ${todayDate} • Zoho Books Synced</div>
          <div style="font-size: 8.5px; font-weight: 700; color: #047857; margin-top: 1px;">
            Exchange Rate: $100 = ${(dollarRate * 100).toLocaleString()} IQD (1$ = ${dollarRate.toLocaleString()} IQD)
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Section 1: Paper & Labels -->
  <div class="section-title">1. PANDA THERMAL RECEIPT PAPER & THERMAL LABELS</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: center; width: 6%;">Photo</th>
        <th style="text-align: left; width: 28%;">Product / Model</th>
        <th style="text-align: left; width: 36%;">Specifications & Compatibility</th>
        <th style="text-align: center; width: 14%;">Packaging</th>
        <th style="text-align: right; width: 8%;">Price ($)</th>
        <th style="text-align: right; width: 8%;">Price (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(paperAndLabels)}
    </tbody>
  </table>

  <!-- Section 2: Hardware -->
  <div class="section-title">2. RECEIPT PRINTERS, LABEL PRINTERS, SCANNERS, CASH DRAWERS & POS</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: center; width: 6%;">Photo</th>
        <th style="text-align: left; width: 28%;">Product / Model</th>
        <th style="text-align: left; width: 36%;">Specifications & Compatibility</th>
        <th style="text-align: center; width: 14%;">Packaging</th>
        <th style="text-align: right; width: 8%;">Price ($)</th>
        <th style="text-align: right; width: 8%;">Price (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(hardwareItems)}
    </tbody>
  </table>

  <!-- Footer Area -->
  <div class="footer-bar">
    <div class="wholesale-box">
      <div style="font-weight: 800; color: #1E3A8A; font-size: 8.5px; margin-bottom: 2px;">
        COMMERCIAL SUPPLY & DIRECT SALES:
      </div>
      <div style="font-size: 8px; color: #4B5563;">
        Official WhatsApp & Calls: <span dir="ltr"><b>+964 750 758 6992</b> &bull; <b>+964 750 529 9118</b></span> &bull; Website: <b>vertex1.tech</b>
      </div>
      <div style="font-size: 7.5px; color: #64748B; margin-top: 1px;">
        Delivery available to all cities across Kurdistan Region and Iraq (Standard transit fees apply).
      </div>
    </div>

    <div class="qr-box">
      <img src="${qrBase64}" style="width: 48px; height: 48px; border: 1px solid #CBD5E1; border-radius: 4px; display: block; margin: 0 auto;">
      <div style="font-size: 6.5px; color: #64748B; font-weight: 600; margin-top: 1px;">@vertexiqzone</div>
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

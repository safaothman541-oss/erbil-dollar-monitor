const fs = require('fs');
const path = require('path');

// Read 49 items dumped from Zoho Books
const zohoDump = JSON.parse(fs.readFileSync('C:/Users/SAFA/.gemini/antigravity/brain/886b4b68-700c-4d28-88e0-a72f9498f593/.system_generated/steps/2897/output.txt', 'utf8'));

// Image mapping helper
function resolveImage(name, sku) {
  const norm = ((name || '') + ' ' + (sku || '')).toLowerCase();
  const prodDir = path.resolve(__dirname, '..', 'assets', 'products');

  if (norm.includes('80*80') || norm.includes('8080')) return path.join(prodDir, 'panda_80_80.png');
  if (norm.includes('80*19') || norm.includes('paperroll-panda')) return path.join(prodDir, 'panda_80_19.png');
  if (norm.includes('57*19')) return path.join(prodDir, 'panda_57_19.png');
  if (norm.includes('100*150') || norm.includes('100*100')) return path.join(prodDir, 'label_100_150.png');
  if (norm.includes('80*50')) return path.join(prodDir, 'label_80_50.png');
  if (norm.includes('58*39') || norm.includes('50*25') || norm.includes('38*25')) return path.join(prodDir, 'label_58_39.png');
  if (norm.includes('8370') || norm.includes('novex')) return path.join(prodDir, 'novex_8370.png');
  if (norm.includes('zywell 310') || norm.includes('zywell') && !norm.includes('910') && !norm.includes('m04')) return path.join(prodDir, 'zywell_310_real.jpeg');
  if (norm.includes('vg80') || norm.includes('van gold')) return path.join(prodDir, 'vangold_vg80.png');
  if (norm.includes('zd230') || norm.includes('zebra') && norm.includes('label')) return path.join(prodDir, 'zebra_printer.png');
  if (norm.includes('pt210') || norm.includes('pt-210')) return path.join(prodDir, 'pt210_portable.png');
  if (norm.includes('rpp300') || norm.includes('rongta')) return path.join(prodDir, 'rongta_rpp300.png');
  if (norm.includes('lpq58') || norm.includes('hprt')) return path.join(prodDir, 'hprt_printer.png');
  if (norm.includes('henex-wired') || norm.includes('henex wired')) return path.join(prodDir, 'henex_wired.png');
  if (norm.includes('2210') || norm.includes('6052') || norm.includes('henex')) return path.join(prodDir, 'henex_wireless.png');
  if (norm.includes('hf680') || norm.includes('hf 680')) return path.join(prodDir, 'honeywell_hf680.jpg');
  if (norm.includes('orbit') || norm.includes('7120')) return path.join(prodDir, 'honeywell_orbit.png');
  if (norm.includes('drawer') || norm.includes('cash drawer') || norm.includes('x10-cash')) return path.join(prodDir, 'cash_drawer.png');

  return '';
}

// Category helper
function resolveCategory(name, sku) {
  const norm = ((name || '') + ' ' + (sku || '')).toLowerCase();
  if (norm.includes('paper') || norm.includes('80*80') || norm.includes('80*19') || norm.includes('57*19')) return 'Paper & Rolls';
  if (norm.includes('label') || norm.includes('58*39') || norm.includes('50*25') || norm.includes('38*25') || norm.includes('100*150') || norm.includes('100*100') || norm.includes('80*50')) {
    if (norm.includes('printer')) return 'Label Printers';
    return 'Thermal Labels';
  }
  if (norm.includes('receipt printer') || norm.includes('8370') || norm.includes('xp-80ts') || norm.includes('zywell 310') || norm.includes('portable printer') || norm.includes('pt-210') || norm.includes('rpp300') || norm.includes('m04')) return 'Receipt Printers';
  if (norm.includes('label printer') || norm.includes('vg80') || norm.includes('zd230') || norm.includes('zywell 910') || norm.includes('lpq58') || norm.includes('hprt')) return 'Label Printers';
  if (norm.includes('scanner') || norm.includes('orbit') || norm.includes('ds 2208') || norm.includes('hf 680') || norm.includes('symbol') || norm.includes('henex')) return 'Barcode Scanners';
  if (norm.includes('cash drawer') || norm.includes('drawer')) return 'Cash Drawers';
  if (norm.includes('pos') || norm.includes('venex') || norm.includes('aio') || norm.includes('case') || norm.includes('dell') || norm.includes('lenovo') || norm.includes('zbook') || norm.includes('monitor')) return 'POS Systems & Computers';
  return 'Accessories & Peripherals';
}

// Brand helper
function resolveBrand(name, sku) {
  const norm = ((name || '') + ' ' + (sku || '')).toLowerCase();
  if (norm.includes('panda')) return 'Panda';
  if (norm.includes('novex')) return 'Novex';
  if (norm.includes('zebra') || norm.includes('symbol')) return 'Zebra';
  if (norm.includes('honeywell') || norm.includes('orbit') || norm.includes('hf 680')) return 'Honeywell';
  if (norm.includes('henex')) return 'Henex';
  if (norm.includes('zywell')) return 'Zywell';
  if (norm.includes('hprt')) return 'HPRT';
  if (norm.includes('van gold') || norm.includes('vg80')) return 'Van Gold';
  if (norm.includes('xprinter') || norm.includes('xp-')) return 'Xprinter';
  if (norm.includes('rongta')) return 'Rongta';
  if (norm.includes('dell')) return 'Dell';
  if (norm.includes('lenovo')) return 'Lenovo';
  if (norm.includes('hp')) return 'HP';
  if (norm.includes('lg')) return 'LG';
  if (norm.includes('logitech')) return 'Logitech';
  if (norm.includes('rapoo')) return 'Rapoo';
  if (norm.includes('ezviz')) return 'Ezviz';
  if (norm.includes('venex')) return 'Venex';
  if (norm.includes('x10')) return 'X10';
  return 'Vertex';
}

const cleanItems = zohoDump.items.map((it, idx) => {
  const shortId = (it.item_id || String(idx + 1)).slice(-8);
  const brand = resolveBrand(it.name, it.sku);
  const category = resolveCategory(it.name, it.sku);
  const imgPath = resolveImage(it.name, it.sku);

  return {
    id: it.item_id,
    shortId: shortId,
    name: it.name,
    sku: it.sku || '',
    brand: brand,
    model: it.sku || it.name,
    category: category,
    priceUsd: Number(it.rate) || 0,
    stockOnHand: typeof it.stock_on_hand === 'number' ? it.stock_on_hand : 0,
    unit: it.unit || 'pcs',
    description: (it.description || '').trim(),
    imagePath: imgPath,
    source: 'Zoho Books'
  };
});

fs.writeFileSync('assets/showcase_items.json', JSON.stringify(cleanItems, null, 2), 'utf8');
console.log(`✅ showcase_items.json updated with strictly ${cleanItems.length} Zoho Books items.`);

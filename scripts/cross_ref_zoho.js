const fs = require('fs');

const zohoData = JSON.parse(fs.readFileSync('C:/Users/SAFA/.gemini/antigravity/brain/886b4b68-700c-4d28-88e0-a72f9498f593/.system_generated/steps/2897/output.txt', 'utf8'));
const showcaseItems = JSON.parse(fs.readFileSync('assets/showcase_items.json', 'utf8'));

console.log('Total showcase items:', showcaseItems.length);
console.log('Total Zoho items:', zohoData.items.length);

// Compare
showcaseItems.forEach((item, idx) => {
  const match = zohoData.items.find(z => 
    (z.sku && item.model && z.sku.toLowerCase().includes(item.model.toLowerCase())) ||
    (z.name && item.name && (z.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(z.name.toLowerCase()))) ||
    (z.sku && item.sku && z.sku.toLowerCase() === item.sku.toLowerCase()) ||
    (z.name && item.model && z.name.toLowerCase().includes(item.model.toLowerCase()))
  );
  if (match) {
    console.log(`[MATCH] ${idx+1}. Showcase: "${item.name}" (${item.brand} ${item.model}) <=> Zoho: "${match.name}" [SKU: ${match.sku}] Rate: $${match.rate}`);
  } else {
    console.log(`[NO MATCH] ${idx+1}. Showcase: "${item.name}" (${item.brand} ${item.model}) Price: $${item.priceUsd}`);
  }
});

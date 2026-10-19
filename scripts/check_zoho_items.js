const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/SAFA/.gemini/antigravity/brain/886b4b68-700c-4d28-88e0-a72f9498f593/.system_generated/steps/2897/output.txt', 'utf8'));
console.log('Total items in Zoho:', data.items.length);
data.items.forEach((item, i) => {
  console.log(`${i+1}. [${item.sku || 'NO-SKU'}] "${item.name}" | Price: $${item.rate} | Stock: ${item.stock_on_hand}`);
});

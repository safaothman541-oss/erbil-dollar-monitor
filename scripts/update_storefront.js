const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'modules', 'customerStorefront.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update 8080P price to 1.25
content = content.replace(/priceUsd:\s*0\.86,[\s\S]*?wholesaleUsd:\s*0\.84,/, 'priceUsd: 1.25,\n    wholesaleUsd: 1.20,');

// 2. Remove bundles from PRODUCTS
const bundlesRegex = /,\s*\/\/ Special Bundles[\s\S]*?'bundle_bulk_paper': \{[\s\S]*?presets:\s*\[1,\s*2\]\s*\}/;
content = content.replace(bundlesRegex, '');

// 3. Remove bundles button from getMainMenuKeyboard
const bundleBtnRegex = /\s*\[\s*\{\s*text:\s*'🎁 ئۆفەر و پاکێجی تایبەت \(داشکاندن\)',\s*callback_data:\s*'cat:bundles'\s*\}\s*\],/;
content = content.replace(bundleBtnRegex, '');

// 4. Remove bundles from categoryTitles
content = content.replace(/\s*bundles:\s*'🎁 بەشی ئۆفەر و پاکێجی تایبەت \(تخفیض\)',?/, '');

// 5. Remove any leftover check for bundles
content = content.replace(/if \(p\.category === 'bundles'\) \{\s*return p;\s*\}/g, '');
content = content.replace(/if \(p\.category !== 'bundles'\) \{/g, 'if (true) {');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ customerStorefront.js updated: all bundles purged.');

const path = require('path');

module.exports = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8881714010:AAHSTD8KYcT_Mm4Kc-iUX4AOR-NAVzkH7rE',
  GROUP_CHAT_ID: process.env.TELEGRAM_GROUP_ID || '-1004485452111',
  ADMIN_USER_ID: process.env.TELEGRAM_CHAT_ID || '6558230965',

  // Forum Topic Thread IDs in Vertex Company supergroup
  TOPICS: {
    DOLLAR: 3,       // 💵 نرخی دۆلاری بازاڕ
    SALES: 4,        // 🧾 وەسڵ و فرۆشتنی نوێ
    CALCULATOR: 5,   // 🧮 حاسیبەی نرخ و قازانج
    STOCK: 6,        // ⚠️ هۆشداریی کۆگا و مەخزەن
    REPORT: 7        // 📊 ڕاپۆرتی ڕۆژانەی ئێواران
  },

  // Zoho Books Config
  ZOHO: {
    ORG_ID: '938156196',
    IQD_ID: '1441545000000177002',
    TOKEN_FILE: 'C:\\Users\\SAFA\\.mcp-auth\\mcp-remote-v1\\560ef5064af7d669feed46738b370221_tokens.json',
    REFRESH_SCRIPT: 'C:\\Users\\SAFA\\.gemini\\scripts\\refresh_zoho_token.js'
  },

  // State storage
  STATE_DIR: path.join(__dirname, 'state')
};

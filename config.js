const path = require('path');

module.exports = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8881714010:AAHSTD8KYcT_Mm4Kc-iUX4AOR-NAVzkH7rE',
  GROUP_CHAT_ID: process.env.TELEGRAM_GROUP_ID || '-1004485452111',
  ADMIN_USER_ID: process.env.TELEGRAM_CHAT_ID || '6558230965',
  CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID || '@vertexiqzone',

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

  // WhatsApp Cloud API Config
  WHATSAPP: {
    PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_ID || '1411075905419124',
    BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_WABA_ID || '1072965435604572',
    ACCESS_TOKEN: process.env.WHATSAPP_TOKEN || 'EAAHLzAavh1EBSybdQACBWH2tM9SDe8V7tOATDGPetN4TtYvmTk500xF3nF4LNmpsXaZAaZClewnn27dYxRHBPldNR09tDyIxBZB0xsaeiuyyBl3kos8DJhicJ3znsSOcu1VR4WOxuxBFJYgPTsa8DnN7WAUr9NdrkjZBJvLoFsLmZANOZAgRNilit8xf8caj59GwZDZD',
    VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'VERTEX_SECURE_TOKEN_2026',
    PORT: parseInt(process.env.PORT || process.env.WHATSAPP_PORT || '3000', 10),
    ADMIN_PHONES: ['9647507586992', '9647519496848']
  },

  // State storage
  STATE_DIR: path.join(__dirname, 'state')
};

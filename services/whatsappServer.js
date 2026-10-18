const http = require('http');
const url = require('url');
const config = require('../config');
const whatsappService = require('./whatsappService');
const dollarScraper = require('./dollarScraper');
const zohoService = require('./zohoService');

// Phone numbers with LTR mark to prevent reversal
const PHONE_1 = '\u200E0750 758 6992';
const PHONE_2 = '\u200E0750 529 9118';
const DELIVERY_NOTE = 'گەیاندن بەردەستە بۆ هەموو شارەکان (گەیاندن بێ بەرامبەر نییە - بە کرێی گواستنەوەی ئاسایی)';

class WhatsAppServer {
  constructor() {
    this.port = config.WHATSAPP.PORT || 3000;
    this.verifyToken = config.WHATSAPP.VERIFY_TOKEN;
    this.server = null;
  }

  start() {
    this.server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;
      const method = req.method;

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
      }

      // Health Check
      if (method === 'GET' && (pathname === '/' || pathname === '/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'ok',
          service: 'Vertex WhatsApp Cloud Hub',
          waba_id: config.WHATSAPP.BUSINESS_ACCOUNT_ID,
          phone_id: config.WHATSAPP.PHONE_NUMBER_ID,
          uptime: process.uptime()
        }));
      }

      // Webhook Verification (Meta GET)
      if (method === 'GET' && pathname === '/webhook') {
        const mode = parsedUrl.searchParams.get('hub.mode');
        const token = parsedUrl.searchParams.get('hub.verify_token');
        const challenge = parsedUrl.searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === this.verifyToken) {
          console.log('[WhatsAppServer] Webhook verified successfully by Meta!');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          return res.end(challenge);
        } else {
          console.warn('[WhatsAppServer] Webhook verification failed. Invalid token or mode.');
          res.writeHead(403);
          return res.end('Verification failed');
        }
      }

      // Webhook Events Dispatcher (Meta POST)
      if (method === 'POST' && pathname === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'received' }));

            // Process incoming message asynchronously
            await this.handleIncomingWebhook(data);
          } catch (err) {
            console.error('[WhatsAppServer] Webhook parse error:', err);
            res.writeHead(400);
            res.end('Bad Request');
          }
        });
        return;
      }

      // API: Direct Send Invoice Endpoint
      if (method === 'POST' && pathname === '/api/send-invoice') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            const { to, invoiceNumber, customerName, totalAmount, date } = payload;
            const result = await whatsappService.sendKurdishInvoice(to, {
              invoiceNumber,
              customerName,
              totalAmount,
              date
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // API: Direct Send Text Endpoint
      if (method === 'POST' && pathname === '/api/send-text') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { to, text } = JSON.parse(body);
            const result = await whatsappService.sendText(to, text);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    this.server.listen(this.port, () => {
      console.log(`[WhatsAppServer] Vertex WhatsApp Hub running on port ${this.port}`);
      console.log(`[WhatsAppServer] Webhook URL: http://localhost:${this.port}/webhook`);
      console.log(`[WhatsAppServer] Verify Token: ${this.verifyToken}`);
    });

    return this.server;
  }

  async handleIncomingWebhook(data) {
    try {
      if (!data.entry || data.entry.length === 0) return;
      const changes = data.entry[0].changes;
      if (!changes || changes.length === 0) return;

      const value = changes[0].value;
      if (!value.messages || value.messages.length === 0) return;

      const msg = value.messages[0];
      const from = msg.from; // Customer phone number
      const msgType = msg.type;

      let userText = '';
      if (msgType === 'text') {
        userText = msg.text.body.trim();
      } else if (msgType === 'interactive') {
        if (msg.interactive.type === 'button_reply') {
          userText = msg.interactive.button_reply.id || msg.interactive.button_reply.title;
        }
      }

      console.log(`[WhatsAppServer] Incoming from ${from}: "${userText}"`);

      // Handle based on intent
      await this.respondToCustomer(from, userText);
    } catch (err) {
      console.error('[WhatsAppServer] Error handling webhook message:', err);
    }
  }

  async respondToCustomer(from, text) {
    const lower = text.toLowerCase();

    // 1. Dollar Rate Query
    if (lower.includes('دۆلار') || lower.includes('dollar') || lower.includes('صرف') || lower.includes('rate')) {
      let rateStr = '168,500';
      let perDollar = 1685;
      try {
        const market = await dollarScraper.getLatestMarketRate();
        if (market) {
          rateStr = market.rawText || `${market.ratePer100.toLocaleString()} دینار`;
          perDollar = market.ratePerDollar || 1685;
        }
      } catch (e) {}

      let reply = `💵 <b>نرخی نوێی دۆلار لە بازاڕی هەولێر</b>\n\n`;
      reply += `• 100$ = <b>${rateStr}</b>\n`;
      reply += `• 1$ = <b>${perDollar.toLocaleString()} دینار</b>\n\n`;
      reply += `🏢 کۆمپانیای ڤێرتێکس (Vertex)\n`;
      reply += `📞 پەیوەندی:\n${PHONE_1}\n${PHONE_2}\n\n`;
      reply += `📢 چەناڵی فەرمی: https://t.me/vertexiqzone`;

      await whatsappService.sendText(from, reply.replace(/<b>|<\/b>/g, '*'));
      return;
    }

    // 2. Price List / Catalog Query
    if (lower.includes('لیست') || lower.includes('نرخ') || lower.includes('price') || lower.includes('catalog') || lower.includes('pdf')) {
      let reply = `📋 *لیستی فەرمیی کاڵاکانی کۆمپانیای Vertex*\n\n`;
      reply += `هەموو ڕۆژێک نوێترین لیستی نرخەکان بە تەواوی وێنە و مواسەفات لە چەناڵی فەرمیمان بڵاودەکرێتەوە:\n`;
      reply += `👉 https://t.me/vertexiqzone\n\n`;
      reply += `🚗 *گەیاندن:*\n${DELIVERY_NOTE}\n\n`;
      reply += `📞 *پەیوەندی بە کارمەندانی فرۆشتن:*\n`;
      reply += `• ${PHONE_1}\n`;
      reply += `• ${PHONE_2}\n\n`;
      reply += `دەتوانیت ناوی هەر کاڵایەک بنێریت (بۆ نموونە: Panda, Zywell, Novex, ستیکەر) تا ڕاستەوخۆ مواسەفات و نرخەکەت بۆ بنێرین.`;

      await whatsappService.sendText(from, reply);
      return;
    }

    // 3. Product Search (Panda, Zywell, Novex, etc.)
    if (lower.includes('panda') || lower.includes('8080') || lower.includes('کاغەز')) {
      let reply = `🐼 *کاغەزی حەراری Panda 80×80 (High Quality)*\n\n`;
      reply += `• باشترین کوالێتی کاغەزی حەراری لە عێراق\n`;
      reply += `• نووسینی زۆر تۆخ و سەری پرینتەر لە سووتان دەپارێزێت\n`;
      reply += `• کارتۆنی ٥٠ دانەیی\n\n`;
      reply += `💰 نرخ: *$0.86* بۆ هەر دانەیەک\n`;
      reply += `🚗 ${DELIVERY_NOTE}\n\n`;
      reply += `📞 داواکردن:\n${PHONE_1}\n${PHONE_2}`;

      await whatsappService.sendText(from, reply);
      return;
    }

    if (lower.includes('novex') || lower.includes('8370') || lower.includes('پرینتەر')) {
      let reply = `🖨 *پرینتەری پسوولەی Novex 8370 Ultra Fast*\n\n`;
      reply += `• خێرایی چاپ: 260mm/s زۆر خێرا\n`;
      reply += `• دەرچەی USB + LAN (شەبەکە بۆ مەتبەخ و کاشێر)\n`;
      reply += `• قاشکەری ئۆتۆماتیکی (Auto-Cutter)\n\n`;
      reply += `💰 نرخ: *$53.00*\n`;
      reply += `🚗 ${DELIVERY_NOTE}\n\n`;
      reply += `📞 داواکردن:\n${PHONE_1}\n${PHONE_2}`;

      await whatsappService.sendText(from, reply);
      return;
    }

    // 4. Default Welcome Greeting
    let welcome = `🌟 *بەخێربێن بۆ کۆمپانیای ڤێرتێکس (Vertex)*\n`;
    welcome += `کۆمپانیای بازرگانی گشتی بۆ کەرەستە و پێداویستییەکانی POS و مارکێت و تەکنەلۆژیا لە عێراق و هەرێمی کوردستان.\n\n`;
    welcome += `چۆن دەتوانین هاوکاریتان بکەین؟\n\n`;
    welcome += `• بنووسە *«نرخ»* یان *«لیست»* بۆ بینینی لیستی نرخەکان\n`;
    welcome += `• بنووسە *«دۆلار»* بۆ زانینی نوێترین نرخی دۆلار\n`;
    welcome += `• بنووسە ناوی کاڵاکە (وەک *Panda* یان *Novex*) بۆ بینینی مواسەفات\n\n`;
    welcome += `🚗 *گەیاندن:*\n${DELIVERY_NOTE}\n\n`;
    welcome += `📞 *پەیوەندی ڕاستەوخۆ بە کارمەندانی فرۆشتن:*\n`;
    welcome += `• ${PHONE_1}\n`;
    welcome += `• ${PHONE_2}\n\n`;
    welcome += `📢 چەناڵی تێلیگرام: https://t.me/vertexiqzone`;

    await whatsappService.sendText(from, welcome);
  }
}

module.exports = new WhatsAppServer();

if (require.main === module) {
  const server = new WhatsAppServer();
  server.start();
}

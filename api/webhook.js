const whatsappServer = require('../services/whatsappServer');
const config = require('../config');
const debugHelper = require('./debugHelper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check
  if (req.method === 'GET' && !req.query['hub.mode']) {
    return res.status(200).json({
      status: 'ok',
      service: 'Vertex WhatsApp Cloud Hub (Serverless)',
      waba_id: config.WHATSAPP.BUSINESS_ACCOUNT_ID,
      debug: debugHelper.getDebugInfo()
    });
  }

  // Webhook Verification (Meta GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    debugHelper.log(`[GET /webhook] mode=${mode}, token=${token}`);

    if (mode === 'subscribe' && token === config.WHATSAPP.VERIFY_TOKEN) {
      debugHelper.log(`[GET /webhook] Verified successfully by Meta!`);
      return res.status(200).send(challenge);
    } else {
      debugHelper.log(`[GET /webhook] Verification failed. Invalid token.`);
      return res.status(403).send('Verification failed');
    }
  }

  // Webhook Event (Meta POST)
  if (req.method === 'POST') {
    const data = req.body;
    debugHelper.log(`[POST /webhook] Received event at ${new Date().toISOString()}: ${JSON.stringify(data).slice(0, 200)}`);

    try {
      await whatsappServer.handleIncomingWebhook(data);
      debugHelper.recordWebhook(data, null);
      debugHelper.log(`[POST /webhook] Successfully processed event!`);
      return res.status(200).json({ status: 'received' });
    } catch (err) {
      debugHelper.recordWebhook(data, err);
      debugHelper.log(`[POST /webhook] Error handling webhook: ${err.message}`);
      return res.status(200).json({ status: 'error', message: err.message });
    }
  }
};

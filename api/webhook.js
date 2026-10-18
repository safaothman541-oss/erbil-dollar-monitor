const whatsappServer = require('../services/whatsappServer');
const config = require('../config');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check / index
  if (req.method === 'GET' && !req.query['hub.mode']) {
    return res.status(200).json({
      status: 'ok',
      service: 'Vertex WhatsApp Cloud Hub (Serverless)',
      waba_id: config.WHATSAPP.BUSINESS_ACCOUNT_ID
    });
  }

  // Webhook Verification (Meta GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.WHATSAPP.VERIFY_TOKEN) {
      console.log('[Vercel Webhook] Verified successfully by Meta!');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Verification failed');
    }
  }

  // Webhook Event (Meta POST)
  if (req.method === 'POST') {
    try {
      const data = req.body;
      await whatsappServer.handleIncomingWebhook(data);
      return res.status(200).json({ status: 'received' });
    } catch (err) {
      console.error('[Vercel Webhook] Error:', err);
      return res.status(200).json({ status: 'error', message: err.message });
    }
  }
};

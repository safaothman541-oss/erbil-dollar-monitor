const config = require('../config');

class WhatsAppService {
  constructor() {
    this.token = config.WHATSAPP.ACCESS_TOKEN;
    this.phoneId = config.WHATSAPP.PHONE_NUMBER_ID;
    this.wabaId = config.WHATSAPP.BUSINESS_ACCOUNT_ID;
    this.baseUrl = `https://graph.facebook.com/v21.0/${this.phoneId}/messages`;
  }

  /**
   * Helper method to send raw payload to WhatsApp Graph API
   */
  async _post(payload) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('WhatsApp API Error:', JSON.stringify(data, null, 2));
      throw new Error(data.error ? data.error.message : 'WhatsApp API call failed');
    }
    return data;
  }

  /**
   * Send pre-approved WhatsApp Template
   */
  async sendTemplate(to, templateName, languageCode = 'en_US', components = []) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode }
      }
    };

    if (components && components.length > 0) {
      payload.template.components = components;
    }

    return this._post(payload);
  }

  /**
   * Send Kurdish Vertex Invoice Notification
   * Template: vertex_invoice_kurdish_v1
   */
  async sendKurdishInvoice(to, { invoiceNumber, customerName, totalAmount, date }) {
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: String(invoiceNumber) },
          { type: 'text', text: String(customerName) },
          { type: 'text', text: String(totalAmount) },
          { type: 'text', text: String(date) }
        ]
      }
    ];

    return this.sendTemplate(to, 'vertex_invoice_kurdish_v1', 'en_US', components);
  }

  /**
   * Send Arabic Vertex Invoice Notification
   * Template: vertex_invoice_ar_v1
   */
  async sendArabicInvoice(to, { invoiceNumber, customerName, totalAmount, date, invoiceUrl }) {
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: String(invoiceNumber) },
          { type: 'text', text: String(customerName) },
          { type: 'text', text: String(totalAmount) },
          { type: 'text', text: String(date) },
          { type: 'text', text: String(invoiceUrl || 'https://vertex1.tech') }
        ]
      }
    ];

    return this.sendTemplate(to, 'vertex_invoice_ar_v1', 'ar', components);
  }

  /**
   * Send Standard Hello World Test
   */
  async sendHelloWorld(to) {
    return this.sendTemplate(to, 'hello_world', 'en_US');
  }

  /**
   * Send Free-form Text Message (valid inside 24h customer window)
   */
  async sendText(to, text) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'text',
      text: { body: text }
    };
    return this._post(payload);
  }

  /**
   * Send Document (e.g. PDF Price List)
   */
  async sendDocument(to, documentUrl, filename = 'Vertex_Price_List.pdf', caption = '') {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
        caption: caption
      }
    };
    return this._post(payload);
  }

  /**
   * Send Interactive Buttons
   */
  async sendInteractiveButtons(to, { bodyText, buttons = [] }) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b, i) => ({
            type: 'reply',
            reply: {
              id: b.id || `btn_${i}`,
              title: b.title
            }
          }))
        }
      }
    };
    return this._post(payload);
  }
}

module.exports = new WhatsAppService();

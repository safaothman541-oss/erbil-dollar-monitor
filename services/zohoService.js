const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const config = require('../config');

class ZohoService {
  constructor() {
    this.tokenFile = config.ZOHO.TOKEN_FILE;
    this.refreshScript = config.ZOHO.REFRESH_SCRIPT;
    this.orgId = config.ZOHO.ORG_ID;
    this.iqdId = config.ZOHO.IQD_ID;
  }

  getAccessToken() {
    if (!fs.existsSync(this.tokenFile)) return null;
    try {
      let tokens = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
      if (!tokens.expires_at || Date.now() >= (tokens.expires_at - 120000)) {
        if (fs.existsSync(this.refreshScript)) {
          execSync(`node "${this.refreshScript}"`, { timeout: 25000, stdio: 'ignore' });
          tokens = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
        }
      }
      return tokens.access_token;
    } catch (e) {
      try {
        if (fs.existsSync(this.refreshScript)) {
          execSync(`node "${this.refreshScript}"`, { timeout: 25000, stdio: 'ignore' });
          const tokens = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
          return tokens.access_token;
        }
      } catch (err) {}
      return null;
    }
  }

  request(method, endpoint, data = null) {
    const token = this.getAccessToken();
    if (!token) {
      return Promise.reject(new Error('No Zoho access token available.'));
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const pathWithOrg = `/api/v3${endpoint}${separator}organization_id=${this.orgId}`;

    return new Promise((resolve, reject) => {
      const payload = data ? JSON.stringify(data) : null;
      const headers = {
        'Authorization': 'Zoho-oauthtoken ' + token
      };

      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = https.request({
        hostname: 'books.zoho.com',
        path: pathWithOrg,
        method: method,
        headers: headers
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.code === 0) {
              resolve(json);
            } else {
              reject(new Error(`Zoho API Error (${json.code}): ${json.message}`));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async getItems() {
    const res = await this.request('GET', '/items');
    return res.items || [];
  }

  async getItem(itemId) {
    const res = await this.request('GET', `/items/${itemId}`);
    return res.item;
  }

  async getRecentInvoices(limit = 10) {
    const res = await this.request('GET', `/invoices?per_page=${limit}&sort_column=created_time&sort_order=D`);
    return res.invoices || [];
  }

  async getInvoiceDetails(invoiceId) {
    const res = await this.request('GET', `/invoices/${invoiceId}`);
    return res.invoice;
  }

  async getTodayInvoices() {
    const today = new Date().toISOString().split('T')[0];
    const res = await this.request('GET', `/invoices?date=${today}&per_page=100`);
    return res.invoices || [];
  }

  async updateExchangeRate(ratePer100) {
    const ratePerDollar = ratePer100 / 100; // e.g. 168500 / 100 = 1685 IQD
    const zohoRate = 1 / ratePerDollar;
    const today = new Date().toISOString().split('T')[0];

    // 1. Update currency current exchange rate
    const payload = {
      currency_code: 'IQD',
      currency_name: 'Iraqi Dinar',
      currency_symbol: 'IQD',
      price_precision: 3,
      currency_format: '1,234,567.899',
      auto_exchange_rate_enabled: false,
      exchange_rate: zohoRate
    };

    await this.request('PUT', `/settings/currencies/${this.iqdId}`, payload);

    // 2. Add entry to exchange rates history table
    try {
      await this.request('POST', `/settings/currencies/${this.iqdId}/exchangerates`, {
        currency_id: this.iqdId,
        effective_date: today,
        rate: zohoRate
      });
    } catch (e) {
      // Historical date might already exist, safe to ignore
    }

    return { ratePerDollar, zohoRate };
  }
}

module.exports = new ZohoService();

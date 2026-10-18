const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const config = require('../config');

const ZOHO_TOKEN_URL = 'https://mcp.zoho.com/baas/mcp/v1/oauth/8601bb7fecba17ee4bb0b68af10b0bc3/123627000000014020/token';

class ZohoService {
  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID || '1000.74OGCXOVDQ7CEELAD7VUSDCCDS433P';
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '1000.e2416ae8f0d49134b5ec3e234856b66a.ccfe1ec07f150f7245866bcea3368c5b';
    this.orgId = process.env.ZOHO_ORG_ID || config.ZOHO.ORG_ID;
    this.iqdId = process.env.ZOHO_IQD_ID || config.ZOHO.IQD_ID;
    this.tokenFile = config.ZOHO.TOKEN_FILE;
    this.refreshScript = config.ZOHO.REFRESH_SCRIPT;

    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.itemsCache = null;
    this.itemsCacheTime = 0;
  }

  // Pure HTTPS direct token refresh (Works 100% on Cloud / GitHub Actions / Linux)
  refreshDirectly() {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: this.refreshToken
      }).toString();

      const req = https.request({
        hostname: 'mcp.zoho.com',
        path: '/baas/mcp/v1/oauth/8601bb7fecba17ee4bb0b68af10b0bc3/123627000000014020/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.access_token) {
              resolve(json);
            } else {
              reject(new Error(`Direct refresh error: ${body}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async getAccessToken() {
    // Return cached token if still valid (buffer of 2 minutes)
    if (this.cachedToken && Date.now() < (this.tokenExpiresAt - 120000)) {
      return this.cachedToken;
    }

    // 1. Try Direct Cloud HTTPS Refresh
    if (this.clientId && this.refreshToken) {
      try {
        const refreshed = await this.refreshDirectly();
        if (refreshed && refreshed.access_token) {
          this.cachedToken = refreshed.access_token;
          this.tokenExpiresAt = Date.now() + ((refreshed.expires_in || 3600) * 1000);
          return this.cachedToken;
        }
      } catch (err) {
        console.error('Direct cloud token refresh failed, trying file fallback:', err.message);
      }
    }

    // 2. Fallback to local token file if running locally
    if (fs.existsSync(this.tokenFile)) {
      try {
        let tokens = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
        if (!tokens.expires_at || Date.now() >= (tokens.expires_at - 120000)) {
          if (fs.existsSync(this.refreshScript)) {
            execSync(`node "${this.refreshScript}"`, { timeout: 25000, stdio: 'ignore' });
            tokens = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
          }
        }
        this.cachedToken = tokens.access_token;
        this.tokenExpiresAt = tokens.expires_at || (Date.now() + 3600000);
        return this.cachedToken;
      } catch (e) {}
    }

    throw new Error('Unable to obtain a valid Zoho access token.');
  }

  async request(method, endpoint, data = null) {
    const token = await this.getAccessToken();
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

  async getItems(forceRefresh = false) {
    // Cache items for 60 seconds to avoid spamming Zoho on every button click, but always fresh
    if (!forceRefresh && this.itemsCache && Date.now() - this.itemsCacheTime < 60000) {
      return this.itemsCache;
    }

    const res = await this.request('GET', '/items');
    this.itemsCache = res.items || [];
    this.itemsCacheTime = Date.now();
    return this.itemsCache;
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
    const ratePerDollar = ratePer100 / 100;
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
    } catch (e) {}

    return { ratePerDollar, zohoRate };
  }
}

module.exports = new ZohoService();

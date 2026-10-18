const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const STATE_FILE = path.join(__dirname, 'last_state.json');

const TOKEN_FILE = 'C:\\Users\\SAFA\\.mcp-auth\\mcp-remote-v1\\560ef5064af7d669feed46738b370221_tokens.json';
const REFRESH_SCRIPT = 'C:\\Users\\SAFA\\.gemini\\scripts\\refresh_zoho_token.js';
const ZOHO_ORG_ID = '938156196';
const ZOHO_IQD_ID = '1441545000000177002';

const isForce = process.argv.includes('--force');

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required.');
  process.exit(1);
}

function decodeHtml(html) {
  return html
    .replace(/&#036;/g, '$')
    .replace(/&#36;/g, '$')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function fetchChannel() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 't.me',
      path: '/s/bazari_dolaraka',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sendTelegramMessage(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(resBody);
          if (json.ok) {
            resolve(json);
          } else {
            reject(new Error(`Telegram API Error: ${json.description}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getFreshZohoToken() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  try {
    let tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (!tokens.expires_at || Date.now() >= (tokens.expires_at - 120000)) {
      if (fs.existsSync(REFRESH_SCRIPT)) {
        execSync(`node "${REFRESH_SCRIPT}"`, { timeout: 25000, stdio: 'ignore' });
        tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      }
    }
    return tokens.access_token;
  } catch (e) {
    try {
      if (fs.existsSync(REFRESH_SCRIPT)) {
        execSync(`node "${REFRESH_SCRIPT}"`, { timeout: 25000, stdio: 'ignore' });
        const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        return tokens.access_token;
      }
    } catch (err) {}
    return null;
  }
}

function updateZohoExchangeRate(ratePer100) {
  const accessToken = getFreshZohoToken();
  if (!accessToken) {
    console.log('No Zoho access token available, skipping Zoho update.');
    return Promise.resolve(false);
  }

  const ratePerDollar = ratePer100 / 100; // e.g. 168500 / 100 = 1685 IQD
  const zohoRate = 1 / ratePerDollar; // Zoho stores 1 IQD = X USD
  const today = new Date().toISOString().split('T')[0];

  return new Promise((resolve) => {
    // 1. Update currency current exchange rate
    const payload = JSON.stringify({
      currency_code: 'IQD',
      currency_name: 'Iraqi Dinar',
      currency_symbol: 'IQD',
      price_precision: 3,
      currency_format: '1,234,567.899',
      auto_exchange_rate_enabled: false,
      exchange_rate: zohoRate
    });

    const req = https.request({
      hostname: 'books.zoho.com',
      path: `/api/v3/settings/currencies/${ZOHO_IQD_ID}?organization_id=${ZOHO_ORG_ID}`,
      method: 'PUT',
      headers: {
        'Authorization': 'Zoho-oauthtoken ' + accessToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.code === 0) {
            console.log(`Successfully updated Zoho Books active exchange rate to 1$ = ${ratePerDollar} IQD (${zohoRate})`);
            
            // Also record entry in exchangerates table for today
            const ratePayload = JSON.stringify({
              currency_id: ZOHO_IQD_ID,
              effective_date: today,
              rate: zohoRate
            });

            const rReq = https.request({
              hostname: 'books.zoho.com',
              path: `/api/v3/settings/currencies/${ZOHO_IQD_ID}/exchangerates?organization_id=${ZOHO_ORG_ID}`,
              method: 'POST',
              headers: {
                'Authorization': 'Zoho-oauthtoken ' + accessToken,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(ratePayload)
              }
            }, () => resolve(true));
            rReq.on('error', () => resolve(true));
            rReq.write(ratePayload);
            rReq.end();

          } else {
            console.error('Zoho update returned non-zero code:', json);
            resolve(false);
          }
        } catch (e) {
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Zoho request error:', e.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

function parseDollarRate(text) {
  // Matches $100=168,500 or 100=168500 or similar
  const match = text.match(/(?:100\s*=\s*|دۆلار.*?)([\d,.]+)/);
  if (match) {
    const cleaned = match[1].replace(/,/g, '').replace(/\./g, '');
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 100000 && num < 300000) {
      return num; // e.g. 168500
    }
  }
  return null;
}

async function run() {
  console.log(`[${new Date().toISOString()}] Checking bazari_dolaraka channel...`);

  try {
    const html = await fetchChannel();
    const messageRegex = /<div class="tgme_widget_message_wrap[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time datetime="([^"]+)"/g;
    let match;
    const posts = [];

    while ((match = messageRegex.exec(html)) !== null) {
      const text = decodeHtml(
        match[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
      );
      const time = match[2];
      posts.push({ text, time });
    }

    const dollarPosts = posts.filter(p => {
      return p.text.includes('100=') || p.text.includes('100 =') || (p.text.includes('100') && p.text.includes('دۆلار'));
    });

    if (dollarPosts.length === 0) {
      console.log('No dollar rate posts found.');
      return;
    }

    const latest = dollarPosts[dollarPosts.length - 1];
    console.log(`Latest rate post: "${latest.text}" (${latest.time})`);

    let lastState = null;
    if (fs.existsSync(STATE_FILE)) {
      try {
        lastState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      } catch (e) {
        console.error('Failed to parse last_state.json:', e.message);
      }
    }

    const isNew = !lastState || lastState.text !== latest.text;

    if (isNew || isForce) {
      console.log('Detected update! Syncing with Zoho and sending Telegram alert...');
      
      const parsedRate = parseDollarRate(latest.text);
      let zohoSynced = false;
      if (parsedRate) {
        zohoSynced = await updateZohoExchangeRate(parsedRate);
      }

      const dateObj = new Date(latest.time);
      const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
      const localTimeStr = dateObj.toLocaleString('en-GB', options);

      let msg = `🔔 <b>ئاگاداری نرخی نوێی دۆلار</b>\n\n`;
      msg += `💵 <b>نرخ لە بازاڕ:</b> <code>${latest.text}</code>\n`;
      msg += `⏰ <b>کاتی بازاڕ:</b> ${localTimeStr}\n`;
      msg += `📢 <b>سەرچاوە:</b> کەناڵی بازاڕی دۆلارەکە (@bazari_dolaraka)\n`;
      
      if (zohoSynced && parsedRate) {
        msg += `\n🔄 <b>سیستەمی Zoho Books نوێکرایەوە:</b>\n`;
        msg += `   • نرخی فەرمی IQD دانرا: <b>1$ = ${(parsedRate / 100).toLocaleString()} دینار</b>\n`;
      }

      msg += `\n🤖 <i>نێردراوە لە ڕێگەی vertex_ads_bot</i>`;

      await sendTelegramMessage(msg);
      console.log('Telegram message sent successfully!');

      fs.writeFileSync(STATE_FILE, JSON.stringify({
        channel: 'bazari_dolaraka',
        text: latest.text,
        rate: parsedRate,
        zoho_synced: zohoSynced,
        time: latest.time,
        updated_at: new Date().toISOString()
      }, null, 2), 'utf8');

    } else {
      console.log('No new dollar price update since last check. Skipping alert.');
    }

  } catch (err) {
    console.error('Error during monitoring run:', err);
    process.exit(1);
  }
}

run();

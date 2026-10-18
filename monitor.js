const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const STATE_FILE = path.join(__dirname, 'last_state.json');

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

    // Filter posts for dollar updates
    const dollarPosts = posts.filter(p => {
      return p.text.includes('100=') || p.text.includes('100 =') || (p.text.includes('100') && p.text.includes('دۆلار'));
    });

    if (dollarPosts.length === 0) {
      console.log('No dollar rate posts found.');
      return;
    }

    const latest = dollarPosts[dollarPosts.length - 1];
    console.log(`Latest rate post: "${latest.text}" (${latest.time})`);

    // Load last state
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
      console.log('Detected update! Sending Telegram alert...');
      
      const dateObj = new Date(latest.time);
      const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
      const localTimeStr = dateObj.toLocaleString('en-GB', options);

      let msg = `🔔 <b>ئاگاداری نرخی نوێی دۆلار</b>\n\n`;
      msg += `💵 <b>نرخ:</b> <code>${latest.text}</code>\n`;
      msg += `⏰ <b>کاتی بازاڕ:</b> ${localTimeStr}\n`;
      msg += `📢 <b>سەرچاوە:</b> کەناڵی بازاڕی دۆلارەکە (@bazari_dolaraka)\n`;
      msg += `🤖 <i>نێردراوە لە ڕێگەی vertex_ads_bot</i>`;

      await sendTelegramMessage(msg);
      console.log('Telegram message sent successfully!');

      // Save new state
      fs.writeFileSync(STATE_FILE, JSON.stringify({
        channel: 'bazari_dolaraka',
        text: latest.text,
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

const https = require('https');

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

function parseDollarRate(text) {
  // Supports: $100=168,450, 100$=168,450, 100 $ = 168,450, 100=168,450, 100 دۆلار = 168,450
  const match = text.match(/(?:100\s*[\$دۆلار]*\s*=\s*|\$100\s*=\s*|دۆلار.*?)([\d,.]+)/);
  if (match) {
    const cleaned = match[1].replace(/,/g, '').replace(/\./g, '');
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 100000 && num < 300000) {
      return num; // e.g. 168450
    }
  }
  return null;
}

async function getLatestMarketRate() {
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
    return null;
  }

  const latest = dollarPosts[dollarPosts.length - 1];
  const parsedRate = parseDollarRate(latest.text);

  return {
    rawText: latest.text,
    time: latest.time,
    ratePer100: parsedRate,
    ratePerDollar: parsedRate ? parsedRate / 100 : null
  };
}

module.exports = {
  getLatestMarketRate,
  parseDollarRate
};

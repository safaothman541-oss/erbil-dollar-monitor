const fs = require('fs');
const path = require('path');
const config = require('./config');
const dollarScraper = require('./services/dollarScraper');
const zohoService = require('./services/zohoService');
const telegramService = require('./services/telegramService');

const STATE_FILE = path.join(__dirname, 'last_state.json');
const isForce = process.argv.includes('--force');

async function run() {
  console.log(`[${new Date().toISOString()}] Checking bazari_dolaraka channel...`);

  try {
    const market = await dollarScraper.getLatestMarketRate();
    if (!market || !market.ratePer100) {
      console.log('No valid dollar rate found in channel.');
      return;
    }

    console.log(`Latest rate post: "${market.rawText}" (${market.time})`);

    let lastState = null;
    if (fs.existsSync(STATE_FILE)) {
      try {
        lastState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      } catch (e) {
        console.error('Failed to parse last_state.json:', e.message);
      }
    }

    const isNew = !lastState || lastState.text !== market.rawText;

    if (isNew || isForce) {
      console.log('Detected update! Syncing with Zoho and sending Telegram alert to Topic 3...');

      let zohoSynced = false;
      let zohoInfo = null;
      try {
        zohoInfo = await zohoService.updateExchangeRate(market.ratePer100);
        zohoSynced = true;
        console.log(`Successfully updated Zoho Books rate: 1$ = ${zohoInfo.ratePerDollar} IQD`);
      } catch (e) {
        console.error('Zoho update failed or skipped:', e.message);
      }

      const dateObj = new Date(market.time);
      const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
      const localTimeStr = dateObj.toLocaleString('en-GB', options);

      let msg = `🔔 <b>ئاگاداری نرخی نوێی دۆلار لە بازاڕ</b>\n\n`;
      msg += `💵 <b>نرخ لە بازاڕ:</b> <code>${market.rawText}</code>\n`;
      msg += `⏰ <b>کاتی بازاڕ:</b> ${localTimeStr}\n`;
      msg += `📢 <b>سەرچاوە:</b> کەناڵی بازاڕی دۆلارەکە (@bazari_dolaraka)\n`;

      if (zohoSynced && zohoInfo) {
        msg += `\n🔄 <b>سیستەمی Zoho Books نوێکرایەوە:</b>\n`;
        msg += `   • نرخی فەرمی دانرا: <b>1$ = ${zohoInfo.ratePerDollar.toLocaleString()} دینار</b>\n`;
      }

      msg += `\n🤖 <i>سیستەمی یەکگرتووی Vertex Company</i>`;

      // 1. Post to Topic 3 (💵 نرخی دۆلاری بازاڕ)
      await telegramService.sendMessage(msg, {
        threadId: config.TOPICS.DOLLAR
      });
      console.log('Telegram message sent to Topic 3 successfully!');

      // Also notify admin private chat if different
      if (config.ADMIN_USER_ID && config.ADMIN_USER_ID !== config.GROUP_CHAT_ID) {
        try {
          await telegramService.sendMessage(msg, { chatId: config.ADMIN_USER_ID });
        } catch (e) {}
      }

      fs.writeFileSync(STATE_FILE, JSON.stringify({
        channel: 'bazari_dolaraka',
        text: market.rawText,
        rate: market.ratePer100,
        zoho_synced: zohoSynced,
        time: market.time,
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

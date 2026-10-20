const fs = require('fs');
const path = require('path');
const config = require('./config');
const dollarScraper = require('./services/dollarScraper');
const zohoService = require('./services/zohoService');
const telegramService = require('./services/telegramService');
const salesWatcher = require('./modules/salesWatcher');
const stockAuditor = require('./modules/stockAuditor');
const dailyReporter = require('./modules/dailyReporter');
const channelPublisher = require('./modules/channelPublisher');

async function runCloudCycle() {
  console.log(`[${new Date().toISOString()}] === Running Vertex Cloud Cycle on GitHub Actions Server ===`);

  // 1. Dollar Rate & Zoho Currency Exchange Sync
  try {
    const market = await dollarScraper.getLatestMarketRate();
    if (market && market.ratePer100) {
      const stateFile = path.join(__dirname, 'last_state.json');
      let lastText = '';
      if (fs.existsSync(stateFile)) {
        try { lastText = JSON.parse(fs.readFileSync(stateFile, 'utf8')).text; } catch (e) {}
      }

      if (lastText !== market.rawText || process.argv.includes('--force')) {
        console.log('[CloudCycle] Rate update detected:', market.rawText);
        let zohoSynced = false;
        let zohoInfo = null;

        try {
          zohoInfo = await zohoService.updateExchangeRate(market.ratePer100);
          zohoSynced = true;
          console.log(`[CloudCycle] Zoho Books exchange rate updated: 1$ = ${zohoInfo.ratePerDollar} IQD`);
        } catch (e) {
          console.error('[CloudCycle] Zoho update failed:', e.message);
        }

        const dateObj = new Date(market.time);
        const options = { timeZone: 'Asia/Baghdad', hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' };
        const localTimeStr = dateObj.toLocaleString('en-GB', options);

        let msg = `🔔 <b>ئاگاداری نرخی نوێی دۆلار لە بازاڕ</b>\n\n`;
        msg += `💵 <b>نرخ:</b> <code>${market.rawText}</code>\n`;
        msg += `⏰ <b>کات:</b> ${localTimeStr}\n`;
        msg += `📢 <b>سەرچاوە:</b> @bazari_dolaraka\n`;

        if (zohoSynced && zohoInfo) {
          msg += `\n🔄 <b>سیستەمی Zoho Books نوێکرایەوە:</b>\n`;
          msg += `   • 1$ = <b>${zohoInfo.ratePerDollar.toLocaleString()} دینار</b>\n`;
        }

        msg += `\n☁️ <i>ئەم ئاگادارییە لە سێرڤەری کلاودی GitHub Actionsـەوە نێردراوە</i>`;

        await telegramService.sendMessage(msg, { threadId: config.TOPICS.DOLLAR });

        // Also broadcast to public channel @vertexiqzone
        try {
          let channelMsg = `💵 <b>نوێترین نرخی کاتیی دۆلاری بازاڕ</b>\n\n`;
          channelMsg += `• <b>نرخی بازاڕ:</b> <code>${market.rawText}</code>\n`;
          channelMsg += `• <b>نرخی هەر یەک دۆلار:</b> <b>${(market.ratePer100 / 100).toLocaleString()} دینار</b>\n`;
          channelMsg += `• <b>کاتی تۆمارکردن:</b> ${localTimeStr}\n\n`;
          channelMsg += `🏢 <b>کۆمپانیای VERTEX بۆ کەرەستەی کاشێر و مارکێت</b>\n`;
          channelMsg += `🚗 گەیاندن بەردەستە بۆ هەموو شارەکان\n`;
          channelMsg += `📞 فرۆشتن: 0750 758 6992 | 0751 949 6848`;

          const channelKeyboard = {
            inline_keyboard: [
              [
                { text: '🌐 وێبسایتی فەرمی (vertex1.tech)', url: 'https://vertex1.tech' },
                { text: '💬 پەیوەندی لە واتسئاپ', url: 'https://wa.me/9647519496848' }
              ]
            ]
          };

          await telegramService.sendMessage(channelMsg, {
            chatId: config.CHANNEL_ID,
            replyMarkup: channelKeyboard
          });
        } catch (cErr) {
          console.warn('[CloudCycle] Channel dollar post note:', cErr.message);
        }

        fs.writeFileSync(stateFile, JSON.stringify({
          channel: 'bazari_dolaraka',
          text: market.rawText,
          rate: market.ratePer100,
          zoho_synced: zohoSynced,
          time: market.time,
          updated_at: new Date().toISOString()
        }, null, 2), 'utf8');
      } else {
        console.log('[CloudCycle] Dollar rate unchanged.');
      }
    }
  } catch (err) {
    console.error('[CloudCycle] Dollar check error:', err.message);
  }

  // 2. Check for New Invoices in Zoho Books
  try {
    await salesWatcher.checkNewInvoices();
  } catch (err) {
    console.error('[CloudCycle] Sales check error:', err.message);
  }

  // 3. Stock Level Audit
  try {
    await stockAuditor.auditStock();
  } catch (err) {
    console.error('[CloudCycle] Stock audit error:', err.message);
  }

  // 4. Evening Report Check (8:00 PM Baghdad Time = 17:00 UTC)
  try {
    const now = new Date();
    const baghdadFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const baghdadHour = parseInt(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      hour: 'numeric',
      hour12: false
    }).format(now), 10);
    const todayBaghdad = baghdadFormatter.format(now);

    const reportStateFile = path.join(__dirname, 'state', 'report_state.json');
    let lastReportDate = null;
    if (fs.existsSync(reportStateFile)) {
      try {
        lastReportDate = JSON.parse(fs.readFileSync(reportStateFile, 'utf8')).lastReportDate;
      } catch (e) {}
    }

    const isForce = process.argv.includes('--report') || process.argv.includes('--force-report');
    if ((baghdadHour === 20 && lastReportDate !== todayBaghdad) || isForce) {
      console.log(`[CloudCycle] Generating Evening Report for ${todayBaghdad}...`);
      await dailyReporter.generateDailyReport();

      if (!fs.existsSync(path.dirname(reportStateFile))) {
        fs.mkdirSync(path.dirname(reportStateFile), { recursive: true });
      }
      fs.writeFileSync(reportStateFile, JSON.stringify({
        lastReportDate: todayBaghdad,
        generatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
      console.log('[CloudCycle] Evening Report successfully sent and state recorded.');
    } else {
      console.log(`[CloudCycle] Evening report check: baghdadHour=${baghdadHour}, alreadyReported=${lastReportDate === todayBaghdad}`);
    }
  } catch (err) {
    console.error('[CloudCycle] Daily report error:', err.message);
  }

  // 5. Daily Channel Price Sheet Publication (Automated once a day in English, no stock)
  try {
    const channelStateFile = path.join(__dirname, 'state', 'channel_state.json');
    let lastChannelDate = null;
    if (fs.existsSync(channelStateFile)) {
      try {
        lastChannelDate = JSON.parse(fs.readFileSync(channelStateFile, 'utf8')).lastPriceListDate;
      } catch (e) {}
    }

    const now = new Date();
    const baghdadFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const baghdadHour = parseInt(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      hour: 'numeric',
      hour12: false
    }).format(now), 10);
    const todayBaghdad = baghdadFormatter.format(now);

    const isPublishRequested = process.argv.includes('--publish') || (baghdadHour >= 10 && baghdadHour <= 11 && lastChannelDate !== todayBaghdad);

    if (isPublishRequested) {
      console.log(`[CloudCycle] Publishing daily English price list to channel for ${todayBaghdad}...`);
      const market = await dollarScraper.getLatestMarketRate();
      const currentRate = market && market.ratePerDollar ? market.ratePerDollar : 1684;
      await channelPublisher.publishDailyPriceList(config.CHANNEL_ID, currentRate);

      if (!fs.existsSync(path.dirname(channelStateFile))) {
        fs.mkdirSync(path.dirname(channelStateFile), { recursive: true });
      }
      fs.writeFileSync(channelStateFile, JSON.stringify({
        lastPriceListDate: todayBaghdad,
        publishedAt: new Date().toISOString()
      }, null, 2), 'utf8');
      console.log('[CloudCycle] Daily price list published to channel and recorded.');
    } else {
      console.log(`[CloudCycle] Channel price sheet check: baghdadHour=${baghdadHour}, alreadyPublished=${lastChannelDate === todayBaghdad}`);
    }
  } catch (err) {
    console.error('[CloudCycle] Channel publication error:', err.message);
  }

  // 6. 24/7 Keep-Alive Sentinel Ping for AlwaysData Server & WhatsApp Hub
  try {
    const res = await fetch('https://safaothman.alwaysdata.net/api/status', {
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[CloudCycle] ✅ AlwaysData Sentinel Ping OK: WhatsApp connected=${data.connected}, user=${data.user || 'None'}`);
    } else {
      console.warn(`[CloudCycle] ⚠️ AlwaysData returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn('[CloudCycle] AlwaysData keep-alive ping note:', err.message);
  }

  console.log(`[${new Date().toISOString()}] === Vertex Cloud Cycle Completed Successfully ===`);
}

runCloudCycle();

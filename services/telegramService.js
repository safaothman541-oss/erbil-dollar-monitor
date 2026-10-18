const https = require('https');
const config = require('../config');

class TelegramService {
  constructor() {
    this.token = config.BOT_TOKEN;
    this.defaultChatId = config.GROUP_CHAT_ID;
  }

  apiCall(method, params) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(params);
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${this.token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.ok) {
              resolve(json.result);
            } else {
              reject(new Error(`Telegram Error: ${json.description}`));
            }
          } catch (e) {
            reject(new Error(`Telegram JSON parse error: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  sendMessage(text, options = {}) {
    const params = {
      chat_id: options.chatId || this.defaultChatId,
      text: text,
      parse_mode: options.parseMode || 'HTML'
    };

    if (options.threadId) {
      params.message_thread_id = options.threadId;
    }

    if (options.replyMarkup) {
      params.reply_markup = options.replyMarkup;
    }

    return this.apiCall('sendMessage', params);
  }

  editMessageText(text, options = {}) {
    const params = {
      chat_id: options.chatId || this.defaultChatId,
      message_id: options.messageId,
      text: text,
      parse_mode: options.parseMode || 'HTML'
    };

    if (options.replyMarkup) {
      params.reply_markup = options.replyMarkup;
    }

    return this.apiCall('editMessageText', params);
  }

  answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this.apiCall('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    });
  }

  getUpdates(offset = 0, timeout = 30) {
    return this.apiCall('getUpdates', {
      offset: offset,
      timeout: timeout,
      allowed_updates: ['message', 'callback_query']
    });
  }
}

module.exports = new TelegramService();

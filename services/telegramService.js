const https = require('https');
const config = require('../config');

class TelegramService {
  constructor() {
    this.token = config.BOT_TOKEN;
    this.defaultChatId = config.GROUP_CHAT_ID;
  }

  apiCall(method, params, timeoutMs = 40000) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(params);
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${this.token}/${method}`,
        method: 'POST',
        timeout: timeoutMs,
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

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Telegram request timeout'));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async sendMessage(text, options = {}) {
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

    try {
      return await this.apiCall('sendMessage', params);
    } catch (err) {
      if (params.parse_mode === 'HTML' && err.message && err.message.includes("can't parse entities")) {
        console.warn('[Telegram] HTML parse error detected, retrying as plain text:', err.message);
        params.text = text.replace(/<[^>]*>/g, '');
        delete params.parse_mode;
        return await this.apiCall('sendMessage', params);
      }
      throw err;
    }
  }

  async editMessageText(text, options = {}) {
    const params = {
      chat_id: options.chatId || this.defaultChatId,
      message_id: options.messageId,
      text: text,
      parse_mode: options.parseMode || 'HTML'
    };

    if (options.replyMarkup) {
      params.reply_markup = options.replyMarkup;
    }

    try {
      return await this.apiCall('editMessageText', params);
    } catch (err) {
      if (params.parse_mode === 'HTML' && err.message && err.message.includes("can't parse entities")) {
        console.warn('[Telegram] HTML parse error in edit, retrying as plain text:', err.message);
        params.text = text.replace(/<[^>]*>/g, '');
        delete params.parse_mode;
        return await this.apiCall('editMessageText', params);
      }
      throw err;
    }
  }

  answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this.apiCall('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    });
  }

  async sendDocument(filePath, options = {}) {
    const fs = require('fs');
    const path = require('path');
    const formData = new FormData();
    formData.append('chat_id', options.chatId || this.defaultChatId);
    if (options.threadId) {
      formData.append('message_thread_id', options.threadId);
    }
    if (options.caption) {
      formData.append('caption', options.caption);
      formData.append('parse_mode', options.parseMode || 'HTML');
    }
    const fileBytes = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    formData.append('document', new Blob([fileBytes]), fileName);

    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (!json.ok) throw new Error(`Telegram sendDocument error: ${json.description}`);
    return json.result;
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

const fs = require('fs');
const path = require('path');
const config = require('../config');
const groqService = require('./groqService');
const secondBrain = require('../modules/secondBrain');
const emailCalendarHub = require('../modules/emailCalendarHub');

const HISTORY_FILE = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'conversation_history.json');
const MAX_HISTORY_TURNS = 16;

class ConversationManager {
  constructor() {
    this.history = [];
    this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        this.history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      }
    } catch (e) {
      this.history = [];
    }
  }

  saveHistory() {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history.slice(-MAX_HISTORY_TURNS), null, 2), 'utf8');
    } catch (e) {
      console.warn('[ConversationManager] Failed to save history:', e.message);
    }
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  async chat(userMessage) {
    // Append user turn
    this.history.push({ role: 'user', content: userMessage });
    if (this.history.length > MAX_HISTORY_TURNS) {
      this.history = this.history.slice(-MAX_HISTORY_TURNS);
    }

    const systemPrompt = `تۆ سەرۆکی دیوان و هاوبەشی ژیریی دەستکردی باڵای کاکە سەفایت (Safa OS Chief of Staff).
سەفا ئەندازیاری دەرچووی بەشی ICT لە زانکۆی پۆلیتەکنیکی هەولێرە، خاوەن بیزنس و پسپۆڕی ئۆتۆمەیشنە.

ڕێنماییە یەکلاکەرەوەکان بۆ کەسایەتی و هەڵسوکەوتت:
١. بە هیچ جۆرێک وەکو بۆتێکی سارد و تەنها تۆمارکەری تاسک مامەڵە مەکە! هەڵەیە ئەگەر سەفا شتێکی وت یەکسەر بیکەیتە تاسک. سەفا پێویستی بە هاوبەشێکی هزر، ڕاوێژکاری ستراتیجی و دەستێکی ڕاستی هۆشمەندە کە قسەی لەگەڵدا بکات.
٢. هەمیشە پێش هەموو شتێک بە وردی گوێ بگرە و پرسیار بکە کە ئایا چی دەوێت. ئەگەر بابەتێک ناڕوون بوو، پرسیاری ڕوونکردنەوەی لێ بکە و بژاردەی بخەرە بەردەم: "کاک سەفا گیان، پێت باشە کام لەم ڕێگایانە بگرینە بەر؟".
٣. تۆ دەستی ڕاستی سەفایت بۆ بەڕێوەبردنی تەواوی ژیانی لەسەر مۆبایل و کلاود (کالێندەر، ئیمەیڵ، خەرجی، بیزنس و سۆشیال میدیا).
٤. تەنها کاتێک کردار (Action) جێبەجێ بکە کە سەفا ڕاستەوخۆ داوای کردبێت (وەک تۆمارکردنی خەرجی دیاریکراو، یان داواکردنی ڕاستەوخۆی زیادکردنی مەوعید لە کالێندەر). ئەگەر تەنها بیرۆکە یان قسەکردن بوو، لەگەڵیدا بکەوە و تاوتوێی بکە.
٥. ئەگەر کرداری فەرمی داواکرابوو، لە کۆتایی پەیامەکەتدا ئەم تاگانە بەکاربهێنە تا خۆکارانە لە سیستەمەکە جێبەجێ بکرێن:
   - بۆ خەرجی: [ACTION:EXPENSE:{"amount":25000,"currency":"IQD","category":"خۆراک|سوتەمەنی|تەکنەلۆژیا|کار|کەسی","note":"تێبینی"}]
   - بۆ ئەرکی فەرمی (تەنها کاتێک داوای کرد): [ACTION:TASK:{"task":"ناوی ئەرک","dueDate":"کات","priority":"بەپەلە|ئاسایی"}]
   - بۆ بیرۆکەی نوێ: [ACTION:IDEA:{"title":"سەردێڕ","analysis":"شیکاری","tags":["تاگ1"]}]
   - بۆ کالێندەر و مەوعید: [ACTION:CALENDAR:{"title":"ناونیشانی مەوعید","time":"2026-10-22T14:00:00","duration":60,"description":"تێبینی"}]
   - بۆ ڕەشنووسی ئیمەیڵ: [ACTION:EMAIL:{"to":"ناونیشان","subject":"سەردێڕ","body":"دەقی نامە"}]

شێوازی گفتوگۆ: زۆر ڕێزدار، براوانە، ئەندازیارانە، هاندەر، بە زمانی کوردیی سۆرانییەکی زۆر جوان و بێ کەمین.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.history
    ];

    try {
      const reply = await groqService.fastChat(messages, { temperature: 0.6, max_tokens: 1500 });

      // Append assistant turn
      this.history.push({ role: 'assistant', content: reply });
      this.saveHistory();

      // Check and execute actions if present
      const actionsExecuted = this.executeEmbeddedActions(reply);

      // Clean reply for user display (strip raw action tags)
      const cleanReply = reply.replace(/\[ACTION:[^\]]+\]/g, '').trim();

      return {
        reply: cleanReply,
        actions: actionsExecuted
      };
    } catch (err) {
      console.error('[ConversationManager] Error:', err.message);
      return {
        reply: `سڵاو کاک سەفا گیان، کێشەیەکی کاتی لە هێڵی پەیوەندیی AI دروست بوو (${err.message}). تکایە پەیامەکەت دووبارە بنێرەوە تا قسە بکەین.`,
        actions: []
      };
    }
  }

  executeEmbeddedActions(rawReply) {
    const executed = [];
    const regex = /\[ACTION:([A-Z_]+):(\{.*?\})\]/g;
    let match;

    while ((match = regex.exec(rawReply)) !== null) {
      const type = match[1];
      try {
        const payload = JSON.parse(match[2]);
        if (type === 'EXPENSE') {
          const saved = secondBrain.addExpense(payload);
          executed.push({ type: 'EXPENSE', item: saved });
        } else if (type === 'TASK') {
          const saved = secondBrain.addTask(payload);
          executed.push({ type: 'TASK', item: saved });
        } else if (type === 'IDEA') {
          const saved = secondBrain.addIdea(payload);
          executed.push({ type: 'IDEA', item: saved });
        } else if (type === 'CALENDAR') {
          const calResult = emailCalendarHub.generateIcsFile(payload.title, payload.time || payload.date, payload.duration || 60, payload.description);
          executed.push({ type: 'CALENDAR', item: calResult });
        } else if (type === 'EMAIL') {
          const composeUrl = emailCalendarHub.getGmailComposeUrl(payload.to, payload.subject, payload.body);
          executed.push({ type: 'EMAIL', item: { ...payload, composeUrl } });
        }
      } catch (e) {
        console.warn('[ConversationManager] Action parse error:', e.message);
      }
    }

    return executed;
  }
}

module.exports = new ConversationManager();

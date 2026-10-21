const fs = require('fs');
const path = require('path');
const config = require('../config');
const groqService = require('./groqService');
const secondBrain = require('../modules/secondBrain');
const emailCalendarHub = require('../modules/emailCalendarHub');
const androidBridge = require('../modules/androidBridge');

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
      } else {
        this.history = [];
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

  // Fast-Path Instant Device Command Matcher (Zero latency, Zero questions)
  checkDirectDeviceCommand(text) {
    const clean = text.trim();

    // 0. SCREENSHOT & VISION: دەتوانی شاشەکە ببینی؟ / وێنەی شاشە / شاشەم ببینە
    if (/(?:دەتوانیت|دەتوانی|ئەتوانی)?\s*(?:شاشەکەم|شاشەکە|شاشە|سکرین|screenshot)\s*(?:ببینیت|ببینی|سەیر بکە|بگرە|پیشان بدە|دیارە)?/i.test(clean) ||
        /(?:وێنەی شاشە|ڕەسمی شاشە|سەیری شاشەکەم بکە|شاشەکەم پیشان بدە)/i.test(clean)) {
      const cmd = androidBridge.queueCommand('SCREENSHOT', {});
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ وێنەی ڕاستەوخۆی شاشەی مۆبایلەکەت دەگیرێت، بۆت دەنێردرێت و لە ڕێگەی زیرەکی دەستکردەوە شرۆڤە دەکرێت 👁️📱`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 0.1 WHATSAPP MULTI-STEP: سەرەتا بەرنامەی واتسئاپ بکەرەوە، دواتر [ناو] بدۆزەوە، دواتر [نامە] بۆ بنێرە
    const waMultiMatch = clean.match(/(?:واتسئاپ|واتساب|whatsapp).*(?:دواتر|پاشان)?\s*([^\s،,]+)\s*(?:بدۆزەوە|ببینەوە).*(?:دواتر|پاشان)?\s*(?:نامەی|سڵاوی|دەقی)?\s*[:«"“]?\s*([^«"”]+?)\s*(?:بۆ بنێرە|بنێرە|بکە)/i) ||
                         clean.match(/(?:لە واتسئاپ|بە واتسئاپ|واتسئاپ)\s*(?:نامە|سڵاو|مەسج)\s*(?:بنێرە|بکە)?\s*(?:بۆ|بە)\s*([^\s،,]+)\s*(?:و\s*بڵێ|دەقی|:)??\s*(.*)/i);
    if (waMultiMatch) {
      const contact = waMultiMatch[1].replace(/[»"”]/g, '').trim();
      const textToSend = (waMultiMatch[2] || 'سڵاو').replace(/[»"”]/g, '').trim();
      const cmd = androidBridge.queueCommand('WHATSAPP_SEND', { target: contact, message: textToSend });
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ ئەپی واتسئاپ لەسەر شاشە دەکرێتەوە، ناو یان ژمارەی <b>${contact}</b> دەدۆزرێتەوە و نامەی <i>«${textToSend}»</i> ـی بۆ دەنێردرێت 💬📱`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 1. CALL: پەیوەندی بکە / تەلەفۆن بکە / تێل بکە
    const callMatch = clean.match(/(?:تەلەفۆن|پەیوەندی|تێل|call)\s*(?:بکە|بگرە|لێبدە)?\s*(?:بە|بۆ)?\s*(07\d{8,9}|\+?964\d{9,10})/i);
    if (callMatch) {
      const target = callMatch[1];
      const cmd = androidBridge.queueCommand('CALL', { target, number: target });
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ پەیوەندی بە ژمارەی <b>${target}</b> دەبەسترێت لەسەر مۆبایلەکەت 📲`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 2. SPEAK: لە بڵندگۆ بڵێ / بە دەنگ بڵێ / قسە بکە
    const speakMatch = clean.match(/(?:لە بڵندگۆ|بە دەنگ|بڵندگۆ|speak|دەنگ)\s*(?:بڵێ|دەڵێ|قسە بکە)?\s*[:«"“]?\s*(.*)/i);
    if (speakMatch && speakMatch[1] && speakMatch[1].length > 1) {
      let msg = speakMatch[1].replace(/[»"”]/g, '').trim();
      if (msg) {
        const cmd = androidBridge.queueCommand('SPEAK', { text: msg, message: msg });
        return {
          reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ لە بڵندگۆی مۆبایلەکەتەوە دەخوێندرێتەوە: <i>«${msg}»</i> 🔊`,
          actions: [{ type: 'DEVICE', item: cmd }]
        };
      }
    }

    // 3. SMS: نامە بنێرە / کورتەنامە / مەسج
    const smsMatch = clean.match(/(?:نامە|کورتەنامە|مەسج|sms)\s*(?:بنێرە|بکە)?\s*(?:بە|بۆ)?\s*(07\d{8,9}|\+?964\d{9,10})\s*(?:و\s*بڵێ|دەقی|:)??\s*(.*)/i);
    if (smsMatch) {
      const target = smsMatch[1];
      const body = (smsMatch[2] || '').trim();
      const cmd = androidBridge.queueCommand('SMS', { target, number: target, message: body });
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ نامەی کورت (SMS) دەنێردرێت بۆ <b>${target}</b> ✉️\n${body ? `• دەق: <i>${body}</i>` : ''}`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 4. GPS / Location: شوێنەکەم / لۆکەیشن
    if (/(?:شوێنەکەم|شوێنی ئێستا|لۆکەیشن|جی پی ئێس|gps|location)/i.test(clean)) {
      const cmd = androidBridge.queueCommand('GPS', {});
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، خەریکی دەرهێنانی نوێترین شوێنی GPS ـی مۆبایلەکەتە 📍`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 5. TORCH / Flash: فلاش
    if (/(?:فلاش|لایت|torch|flashlight)/i.test(clean)) {
      const isOff = /(?:بکوژێنەوە|کوژانەوە|off)/i.test(clean);
      const state = isOff ? 'off' : 'on';
      const cmd = androidBridge.queueCommand('TORCH', { state });
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، فلاشی مۆبایلەکەت ${state === 'on' ? 'داگیرسا 💡' : 'کوژایەوە 🌑'}`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 6. VIBRATE: لەرینەوە / ڤایبرەیشن
    if (/(?:ڤایبرەیشن|لەرینەوە|بلەرێنەوە|vibrate)/i.test(clean)) {
      const cmd = androidBridge.queueCommand('VIBRATE', { duration: 1500 });
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، مۆبایلەکەت لەرینەوەی (Vibrate) کرد 📳`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 7. CAMERA: کامێرا لەسەر شاشە / وێنەگرتن
    if (/(?:کامێرا|کامێرای|وێنە|وێنەیەک|camera|photo)/i.test(clean)) {
      const cmd = androidBridge.queueCommand('CAMERA', {});
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ ئەپی کامێرای مۆبایلت لەسەر شاشە دەکرێتەوە و وێنە دەگرێت 📸`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    // 8. TYPE: نووسین لەسەر شاشە / کیبۆرد
    const typeMatch = clean.match(/(?:لەسەر کیبۆرد|لەسەر شاشە|تایپ بکە|بنووسە|بنوسە|type)\s*(?:ئەو شتە|ئەم دەقە|دەقی|بنوسە|بنووسە)?\s*[:«"“]?\s*(.*)/i);
    if (typeMatch && typeMatch[1] && typeMatch[1].length > 0) {
      let textToType = typeMatch[1].replace(/^(?:بنوسە|بنووسە|type)\s*[:«"“]?\s*/i, '').replace(/[»"”]/g, '').trim();
      if (textToType) {
        const cmd = androidBridge.queueCommand('TYPE', { message: textToType, text: textToType });
        return {
          reply: `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ دەقی <i>«${textToType}»</i> لەسەر شاشەی مۆبایلەکەت دەنووسرێت ⌨️`,
          actions: [{ type: 'DEVICE', item: cmd }]
        };
      }
    }

    // 9. APP: کردنەوەی هەر بەرنامەیەک لەسەر شاشە (Dynamic Any-App Launcher)
    const appMatch = clean.match(/(?:ئەپی|بەرنامەی|بڕۆ ناو|بڕۆ بۆ ناو|ئەپڵیکەیشنی)\s*[:«"“]?\s*([^\s«"”]+)/i) ||
                     clean.match(/([^\s«"”]+)\s*(?:بکەرەوە|بکەوە|open)/i);
    if (appMatch) {
      let targetApp = appMatch[1].replace(/[»"”]/g, '').trim();
      // Ignore if targetApp is already handled
      if (targetApp && !/(?:کامێرا|فلاش|ڤایبرەیشن|دەنگ|sms|نامە|تەلەفۆن|پەیوەندی|ئەم|ئەو|تکایە)/i.test(targetApp)) {
        const cmd = androidBridge.queueCommand('APP', { target: targetApp });
        return {
          reply: `فەرمانت بەسەر چاو کاکە سەفا، خەریکی کردنەوە و پشکنینی ئەپی <b>${targetApp}</b>ە لەسەر شاشەی مۆبایلەکەت 📱`,
          actions: [{ type: 'DEVICE', item: cmd }]
        };
      }
    }

    // 10. HOME: پەڕەی سەرەکی
    if (/(?:بڕۆ بۆ سەر شاشە|پەڕەی سەرەکی|home screen|home)/i.test(clean)) {
      const cmd = androidBridge.queueCommand('HOME', {});
      return {
        reply: `فەرمانت بەسەر چاو کاکە سەفا، مۆبایلەکەت دەچێتە سەر پەڕەی سەرەکی 🏠`,
        actions: [{ type: 'DEVICE', item: cmd }]
      };
    }

    return null;
  }

  async chat(userMessage) {
    // 1. Check direct instant fast-path (Zero questions, Zero latency)
    const fastPath = this.checkDirectDeviceCommand(userMessage);
    if (fastPath) {
      this.history.push({ role: 'user', content: userMessage });
      this.history.push({ role: 'assistant', content: fastPath.reply });
      this.saveHistory();
      return fastPath;
    }

    // 2. Append user turn
    this.history.push({ role: 'user', content: userMessage });
    if (this.history.length > MAX_HISTORY_TURNS) {
      this.history = this.history.slice(-MAX_HISTORY_TURNS);
    }

    const systemPrompt = `تۆ سەرۆکی دیوان و جێبەجێکاری باڵای کاکە سەفایت (Safa OS Executive Doer).
سەفا ئەندازیاری دەرچووی بەشی ICT لە زانکۆی پۆلیتەکنیکی هەولێرە و خاوەن بیزنسە. کاتی زۆر کەمە و ڕقی لە فەلسەفە و پرسیارکردنی بێسوودە!

یاسا و ڕێساکانی جێبەجێکردن (زۆر گرنگ):
١. هەر فەرمان یان داواکارییەکت پێدەدرێت، یەکسەر، دەستبەجێ و بێ هیچ پرسیارێکی زیادە جێبەجێی بکە!
   - بە هیچ جۆرێک مەکەوەرە پرسیارکردن و سەرقاڵکردنی سەفا. کارەکە بکە و کۆتایی پێ بهێنە.
   - ئەگەر باسی خەرجی، ئەرک، بیرۆکە، پۆست، کالێندەر، یان مۆبایل کرا، یەکسەر تاگی کردار دابنێ تا سیستمەکە جێبەجێی بکات.
٢. تەنها و تەنها کاتێک بۆچوون یان پرسیار بکە کە سەفا خۆی ڕاستەوخۆ داوای ڕاوێژی لێ کردبیت (وەک "ڕات چییە؟"، "پێشنیارت چییە؟"). لە غەیری ئەوەدا هەرگیز پرسیار مەکە!
٣. تاگە فەرمییەکان بۆ جێبەجێکردن لە کۆتایی وەڵامەکەتدا:
   - بۆ فەرمانی مۆبایل: [ACTION:DEVICE:{"action":"CALL|SMS|GPS|PHOTO|VIBRATE|TORCH|SPEAK","target":"ژمارە یان دەق","message":"دەق"}]
   - بۆ خەرجی: [ACTION:EXPENSE:{"amount":25000,"currency":"IQD","category":"خۆراک|سوتەمەنی|تەکنەلۆژیا|کار|کەسی","note":"تێبینی"}]
   - بۆ ئەرک: [ACTION:TASK:{"task":"ناوی ئەرک","dueDate":"کات","priority":"بەپەلە|ئاسایی"}]
   - بۆ بیرۆکە: [ACTION:IDEA:{"title":"سەردێڕ","analysis":"شیکاری","tags":["تاگ1"]}]
   - بۆ کالێندەر: [ACTION:CALENDAR:{"title":"مەوعید","time":"2026-10-22T14:00:00","duration":60,"description":"تێبینی"}]
   - بۆ ئیمەیڵ: [ACTION:EMAIL:{"to":"ناونیشان","subject":"سەردێڕ","body":"دەقی نامە"}]

شێوازی قسەکردن: زۆر کورت، بڕیاردەر، بەڕێز، ئەندازیارانە بە کوردیی سۆرانی پوخت. ئەگەر کارەکەت کرد تەنها بڵێ فەرمانت جێبەجێ کرا!`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.history
    ];

    try {
      const reply = await groqService.fastChat(messages, { temperature: 0.4, max_tokens: 1200 });

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
        reply: `کێشەیەک ڕوویدا لە پەیوەندی (${err.message}). تکایە دووبارەی بکەرەوە.`,
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
        } else if (type === 'DEVICE') {
          const cmd = androidBridge.queueCommand(payload.action, payload);
          executed.push({ type: 'DEVICE', item: cmd });
        }
      } catch (e) {
        console.warn('[ConversationManager] Action parse error:', e.message);
      }
    }

    return executed;
  }
}

module.exports = new ConversationManager();

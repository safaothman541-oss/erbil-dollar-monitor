const fs = require('fs');
const path = require('path');
const config = require('../config');
const groqService = require('./groqService');
const secondBrain = require('../modules/secondBrain');
const emailCalendarHub = require('../modules/emailCalendarHub');
const androidBridge = require('../modules/androidBridge');

const HISTORY_FILE = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'conversation_history.json');
const MAX_HISTORY_TURNS = 16;

// Native AI Tools Definition (Pure LLM Function Calling)
const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'whatsapp_send',
      description: 'Send a WhatsApp message or greeting directly to a person, contact, or phone number. Always use this whenever Safa wants to message, greet, or contact anyone on WhatsApp, even if he says first open WhatsApp then find someone and send.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Name of the contact (e.g. ئاشنا, Ashna, دایکم, Suhaib) or phone number' },
          message: { type: 'string', description: 'The greeting or message text to send' }
        },
        required: ['recipient', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Launch an application on Android just to view it (e.g., youtube, chrome, telegram, settings, camera, calculator, fib, fastpay). Do NOT call this if the goal is sending a WhatsApp message or making a call.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Name of app or package' }
        },
        required: ['app_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'make_call',
      description: 'Place a direct phone call to a phone number or contact',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Phone number or contact name' }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_sms',
      description: 'Send an SMS text message to a phone number',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Phone number' },
          message: { type: 'string', description: 'SMS message text' }
        },
        required: ['target', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'take_screenshot',
      description: 'Capture and view the live screen ONLY when Safa explicitly asks to see his screen or take a screenshot (e.g., دەتوانی شاشەکەم ببینی؟, شاشەم ببینە, ڕەسمی شاشە بگرە).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'device_control',
      description: 'Hardware controls: torch/flashlight on or off, vibration, go to home screen, or get GPS location',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['torch_on', 'torch_off', 'vibrate', 'home_screen', 'gps_location']
          }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'record_expense',
      description: 'Record an expense when Safa mentions spending money or buying something',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount of money' },
          currency: { type: 'string', enum: ['IQD', 'USD'] },
          category: { type: 'string', description: 'Category of expense' },
          note: { type: 'string', description: 'Description' }
        },
        required: ['amount', 'currency', 'category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'record_task',
      description: 'Record an agenda task or todo item',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Task title' },
          priority: { type: 'string', enum: ['high', 'medium'] },
          due_date: { type: 'string' }
        },
        required: ['task']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_shell',
      description: 'Execute an advanced bash or ADB shell command on Android',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' }
        },
        required: ['command']
      }
    }
  }
];

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

  async chat(userMessage) {
    this.history.push({ role: 'user', content: userMessage });
    if (this.history.length > MAX_HISTORY_TURNS) {
      this.history = this.history.slice(-MAX_HISTORY_TURNS);
    }

    const systemPrompt = `تۆ سەرۆکی دیوان و جێبەجێکاری باڵای کاکە سەفایت (Safa OS Executive Doer).
سەفا ئەندازیاری دەرچووی بەشی ICT لە زانکۆی پۆلیتەکنیکی هەولێرە و خاوەن بیزنسە. کاتی زۆر کەمە و ڕقی لە فەلسەفە و پرسیارکردنی بێسوودە!

یاسا گرنگەکان:
١. کاتێک سەفا داوای هەر کردارێک دەکات (وەک ناردنی نامەی واتسئاپ، پەیوەندی، کردنەوەی ئەپ، یان سکرینشۆت)، دەستبەجێ فەنکشن و تووڵە گونجاوەکە (Tool Call) بانگ بکە بێ ئەوەی یەک پرسیار بکەیت.
٢. وشەکانی وەک (ئاشنا، سوهەیب، کاوان، ڕێکان) ناوی کەس و هاوڕێن، بۆیە ئەگەر وتی بۆ ئاشنا نامە بنێرە ڕاستەوخۆ فەنکشنی whatsapp_send بانگ بکە لەگەڵ recipient: ئاشنا.
٣. هەرگیز لە لای خۆتەوە سکرینشۆت مەگرە مەگەر سەفا خۆی بە دەمی خۆی بڵێت «شاشەم ببینە» یان «دەتوانی شاشەکە ببینی؟».
٤. کورتترین، بڕیاردەرترین و بەڕێزترین وەڵام بە کوردیی سۆرانی بدەرەوە.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.history
    ];

    try {
      const response = await groqService.chatWithTools(messages, AI_TOOLS);
      const actionsExecuted = [];
      let replyText = response.content || '';

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          const fn = tc.function.name;
          let args = {};
          try { args = JSON.parse(tc.function.arguments); } catch (_) {}

          if (fn === 'whatsapp_send') {
            const recipient = args.recipient || 'هاوڕێ';
            const msg = args.message || 'سڵاو';
            const cmd = androidBridge.queueCommand('WHATSAPP_SEND', { target: recipient, message: msg });
            actionsExecuted.push({ type: 'DEVICE', item: cmd });
            if (!replyText) {
              replyText = `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ ئەپی واتسئاپ دەکرێتەوە و نامەی «${msg}» بۆ <b>${recipient}</b> دەنێردرێت 💬📱`;
            }
          } else if (fn === 'open_app') {
            const app = args.app_name || 'app';
            const cmd = androidBridge.queueCommand('APP', { target: app });
            actionsExecuted.push({ type: 'DEVICE', item: cmd });
            if (!replyText) {
              replyText = `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ ئەپی <b>${app}</b> لەسەر شاشەی مۆبایلەکەت دەکرێتەوە 📱`;
            }
          } else if (fn === 'make_call') {
            const target = args.target;
            const cmd = androidBridge.queueCommand('CALL', { target });
            actionsExecuted.push({ type: 'DEVICE', item: cmd });
            if (!replyText) {
              replyText = `فەرمانت بەسەر چاو کاکە سەفا، دەستبەجێ پەیوەندی بە <b>${target}</b> دەبەسترێت 📲`;
            }
          } else if (fn === 'send_sms') {
            const cmd = androidBridge.queueCommand('SMS', { target: args.target, message: args.message });
            actionsExecuted.push({ type: 'DEVICE', item: cmd });
            if (!replyText) {
              replyText = `فەرمانت بەسەر چاو کاکە سەفا، نامەی کورت بۆ <b>${args.target}</b> دەنێردرێت ✉️`;
            }
          } else if (fn === 'take_screenshot') {
            const cmd = androidBridge.queueCommand('SCREENSHOT', {});
            actionsExecuted.push({ type: 'DEVICE', item: cmd });
            if (!replyText) {
              replyText = `بەڵێ کاکە سەفا! وێنەی ڕاستەوخۆی شاشەی مۆبایلەکەت گیرا و ڕاستەوخۆ بۆت نێردرا 👁️📱`;
            }
          } else if (fn === 'device_control') {
            const act = args.action;
            if (act === 'torch_on') {
              const cmd = androidBridge.queueCommand('TORCH', { state: 'on' });
              actionsExecuted.push({ type: 'DEVICE', item: cmd });
              if (!replyText) replyText = `فلاشی مۆبایلەکەت داگیرسا 💡`;
            } else if (act === 'torch_off') {
              const cmd = androidBridge.queueCommand('TORCH', { state: 'off' });
              actionsExecuted.push({ type: 'DEVICE', item: cmd });
              if (!replyText) replyText = `فلاشی مۆبایلەکەت کوژایەوە 🌑`;
            } else if (act === 'vibrate') {
              const cmd = androidBridge.queueCommand('VIBRATE', { duration: 1500 });
              actionsExecuted.push({ type: 'DEVICE', item: cmd });
              if (!replyText) replyText = `مۆبایلەکەت لەرینەوەی کرد 📳`;
            } else if (act === 'home_screen') {
              const cmd = androidBridge.queueCommand('HOME', {});
              actionsExecuted.push({ type: 'DEVICE', item: cmd });
              if (!replyText) replyText = `مۆبایلەکە گەڕایەوە سەر پەڕەی سەرەکی 🏠`;
            } else if (act === 'gps_location') {
              const cmd = androidBridge.queueCommand('GPS', {});
              actionsExecuted.push({ type: 'DEVICE', item: cmd });
              if (!replyText) replyText = `خەریکی دەرهێنانی نوێترین شوێنی GPS ـی مۆبایلەکەتە 📍`;
            }
          } else if (fn === 'record_expense') {
            const saved = secondBrain.addExpense(args);
            actionsExecuted.push({ type: 'EXPENSE', item: saved });
            if (!replyText) replyText = `خەرجی ${args.amount} ${args.currency} بۆ ${args.category} بە سەرکەوتوویی تۆمارکرا 💳`;
          } else if (fn === 'record_task') {
            const saved = secondBrain.addTask(args);
            actionsExecuted.push({ type: 'TASK', item: saved });
            if (!replyText) replyText = `ئەرکی «${args.task}» بە سەرکەوتوویی خرایە کارنامەکەتەوە 📝`;
          } else if (fn === 'run_shell') {
            const cmd = androidBridge.queueCommand('SHELL', { message: args.command });
            actionsExecuted.push({ type: 'DEVICE', item: cmd });
            if (!replyText) replyText = `فەرمانی سیستەم جێبەجێ کرا ⚙️`;
          }
        }
      }

      if (!replyText) {
        replyText = 'فەرمانت جێبەجێ کرا کاکە سەفا 🫡';
      }

      this.history.push({ role: 'assistant', content: replyText });
      this.saveHistory();

      return {
        reply: replyText,
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
}

module.exports = new ConversationManager();

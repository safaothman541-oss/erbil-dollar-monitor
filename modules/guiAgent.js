const fs = require('fs');
const path = require('path');
const config = require('../config');
const androidBridge = require('./androidBridge');
const groqService = require('../services/groqService');
const telegramService = require('../services/telegramService');

const STATE_DIR = config.STATE_DIR || path.join(__dirname, '..', 'state');
const UI_DUMP_FILE = path.join(STATE_DIR, 'latest_ui_dump.xml');

class GuiAgent {
  constructor() {
    this.isBusy = false;
  }

  // Parse raw Android UI XML into clean, token-efficient interactive elements
  parseUiElements(xmlString) {
    if (!xmlString) return [];
    const elements = [];
    const nodeRegex = /<node\s+([^>]+)>/g;
    let match;
    let id = 1;

    while ((match = nodeRegex.exec(xmlString)) !== null) {
      const attrs = match[1];
      const text = (attrs.match(/text="([^"]*)"/) || [])[1] || '';
      const desc = (attrs.match(/content-desc="([^"]*)"/) || [])[1] || '';
      const resId = (attrs.match(/resource-id="([^"]*)"/) || [])[1] || '';
      const boundsStr = (attrs.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || []);
      const clickable = /clickable="true"/.test(attrs);
      const focusable = /focusable="true"/.test(attrs);

      const label = text.trim() || desc.trim();
      const shortId = resId ? resId.split('/').pop() : '';

      if ((label || shortId || clickable) && boundsStr.length === 5) {
        const x1 = parseInt(boundsStr[1], 10);
        const y1 = parseInt(boundsStr[2], 10);
        const x2 = parseInt(boundsStr[3], 10);
        const y2 = parseInt(boundsStr[4], 10);
        const width = x2 - x1;
        const height = y2 - y1;

        // Filter out zero-size or full-screen root containers
        if (width > 20 && height > 20 && (width < 1070 || height < 2300)) {
          const centerX = Math.round((x1 + x2) / 2);
          const centerY = Math.round((y1 + y2) / 2);

          elements.push({
            index: id++,
            label: label || shortId,
            resourceId: shortId,
            bounds: [x1, y1, x2, y2],
            center: [centerX, centerY],
            clickable: clickable || focusable
          });
        }
      }
    }

    return elements.slice(0, 45); // Keep top 45 meaningful interactive elements
  }

  // Request fresh UI dump from phone and wait for upload (Zero stale cache)
  async fetchLiveUi() {
    // 1. Delete any old cached dump so we NEVER act on stale screen data
    try {
      if (fs.existsSync(UI_DUMP_FILE)) fs.unlinkSync(UI_DUMP_FILE);
    } catch (_) {}

    // 2. Queue UI_DUMP or Shell uiautomator dump on phone
    androidBridge.queueCommand('UI_DUMP', {});
    // Also send shell fallback just in case phone daemon is on older version
    androidBridge.queueCommand('SHELL', { message: 'uiautomator dump /sdcard/Download/window_dump.xml' });

    // 3. Poll for fresh UI_DUMP_FILE up to 4 seconds
    const start = Date.now();
    while (Date.now() - start < 4000) {
      await new Promise(r => setTimeout(r, 250));
      if (fs.existsSync(UI_DUMP_FILE)) {
        const xml = fs.readFileSync(UI_DUMP_FILE, 'utf8');
        if (xml && xml.length > 100) return xml;
      }
    }

    return '';
  }

  // Main ReAct Autonomous Execution Loop
  async executeAutonomousTask(userGoal, options = {}) {
    if (this.isBusy) {
      return { success: false, message: 'سیستەم خەریکی جێبەجێکردنی ئەرکێکی ترە لەسەر مۆبایل.' };
    }

    this.isBusy = true;
    const chatId = options.chatId || config.ADMIN_USER_ID;
    const maxSteps = options.maxSteps || 8;
    const history = [];

    try {
      await telegramService.sendMessage(`🤖 <b>[بریکاری سەربەخۆ - Safa Autonomous Agent]:</b>\nدەستکرا بە جێبەجێکردنی فەرمانەکە: <i>«${userGoal}»</i>...`, { chatId });

      for (let step = 1; step <= maxSteps; step++) {
        console.log(`[GuiAgent] === Step ${step}/${maxSteps} for Goal: "${userGoal}" ===`);

        // 1. Fetch real-time UI structure
        const xml = await this.fetchLiveUi();
        const elements = this.parseUiElements(xml);

        // 2. Format UI element list for the LLM
        const elementsList = elements.map(e => 
          `[#${e.index}] "${e.label}" (id: ${e.resourceId || 'none'}) -> Center: (${e.center[0]}, ${e.center[1]})${e.clickable ? ' [CLICKABLE]' : ''}`
        ).join('\n') || 'No clickable elements detected.';

        // 3. Prompt the LLM to inspect, reason, and choose the next action
        const systemPrompt = `You are Safa OS Autonomous Android GUI Agent.
You directly control Safa's Android smartphone using live screen inspection and input actions.
Your goal is to fulfill the user's objective step-by-step.

User's Ultimate Goal: "${userGoal}"
Current Step: ${step}/${maxSteps}

Actions Taken So Far:
${history.map(h => `- Step ${h.step}: [${h.action}] -> Thought: ${h.thought}`).join('\n') || 'None (starting now).'}

Visible Interactive Elements on Screen Right Now:
${elementsList}

Instructions:
1. Examine the visible elements carefully. Find the button, search box, app icon, or field relevant to the goal.
2. If you need to tap an element, pick its [#index] or provide (x, y).
3. If you need to type, specify the text.
4. If you need to open an app (like playstore, youtube, settings), use action "open_app".
5. If the goal is completed, choose action "finish" and set "isFinished": true.
6. Provide a concise status update in Kurdish Sorani for Safa.

Output strictly valid JSON with this exact schema:
{
  "thought": "Your reasoning in English",
  "action": "tap" | "type" | "key" | "open_app" | "finish",
  "targetIndex": number or null,
  "x": number or null,
  "y": number or null,
  "text": string or null,
  "keyCode": number or null (3=Home, 4=Back, 66=Enter),
  "isFinished": boolean,
  "kurdishUpdate": "Short 1-sentence update in Kurdish Sorani for Safa"
}`;

        const decisionRaw = await groqService.fastChat([
          { role: 'system', content: 'You are an autonomous Android agent. Output strictly valid JSON.' },
          { role: 'user', content: systemPrompt }
        ], { json: true, temperature: 0.1 });

        let decision = {};
        try {
          decision = JSON.parse(decisionRaw);
        } catch (pe) {
          console.error('[GuiAgent] Decision parse error:', pe.message);
          continue;
        }

        console.log(`[GuiAgent] Decision Step ${step}:`, decision.thought, `Action: ${decision.action}`);
        history.push({ step, action: decision.action, thought: decision.thought });

        // Check if finished
        if (decision.isFinished || decision.action === 'finish') {
          await telegramService.sendMessage(`✅ <b>فەرمان بە سەرکەوتوویی تەواو بوو کاکە سەفا!</b>\nئامانج: <i>${userGoal}</i>`, { chatId });
          this.isBusy = false;
          return { success: true, message: 'Goal completed successfully' };
        }

        // Execute action on phone and WAIT for real device confirmation
        let execRes = { success: false, message: 'هیچ کردارێک دیاری نەکراوە' };

        if (decision.action === 'tap') {
          let tapX = decision.x;
          let tapY = decision.y;
          if ((!tapX || !tapY) && decision.targetIndex) {
            const el = elements.find(e => e.index === decision.targetIndex);
            if (el) {
              tapX = el.center[0];
              tapY = el.center[1];
            }
          }
          if (tapX && tapY) {
            execRes = await androidBridge.executeDeviceAction('tap', { x: tapX, y: tapY }, 7000);
          } else {
            execRes = { success: false, message: 'شوێنی کلیک دیاری نەکراوە لەسەر شاشە' };
          }
        } else if (decision.action === 'type') {
          if (decision.text) {
            execRes = await androidBridge.executeDeviceAction('type', { text: decision.text }, 7000);
          }
        } else if (decision.action === 'key') {
          const code = decision.keyCode || 66;
          execRes = await androidBridge.executeDeviceAction('key', { code }, 7000);
        } else if (decision.action === 'open_app') {
          let app = decision.target || decision.text || decision.app;
          if (!app) {
            if (/youtube|یوتیوب/i.test(userGoal)) app = 'youtube';
            else if (/whatsapp|واتس/i.test(userGoal)) app = 'whatsapp';
            else if (/play\s*store|پلەی/i.test(userGoal)) app = 'playstore';
            else app = 'settings';
          }
          execRes = await androidBridge.executeDeviceAction('open_app', { app }, 7000);
        }

        // Strictly verify execution outcome before reporting progress to user
        if (execRes && execRes.success) {
          const msg = decision.kurdishUpdate || execRes.message;
          await telegramService.sendMessage(`⚡ <b>هەنگاوی ${step}:</b> ${msg}`, { chatId }).catch(() => {});
        } else {
          const errMsg = execRes ? execRes.message : 'نەتوانرا لەسەر مۆبایل جێبەجێ بکرێت';
          await telegramService.sendMessage(`⚠️ <b>هەنگاوی ${step} شکستی هێنا:</b> ${errMsg}\nپرۆسەکە دەستبەجێ ڕاگیرا تا زانیاری هەڵە دروست نەبێت.`, { chatId }).catch(() => {});
          this.isBusy = false;
          return { success: false, message: errMsg };
        }

        // Screen transition settle time
        await new Promise(r => setTimeout(r, 1200));
      }

      await telegramService.sendMessage(`⚠️ بە ئەوپەڕی توانای هەنگاوەکان (${maxSteps} هەنگاو) هەوڵدرا، پرۆسەکە وەستا تا ڕێنمایی نوێ بدەیت.`, { chatId });
      this.isBusy = false;
      return { success: false, message: 'Reached maximum steps' };
    } catch (err) {
      this.isBusy = false;
      console.error('[GuiAgent] Error:', err);
      await telegramService.sendMessage(`❌ هەڵەیەک ڕوویدا لە بریکاری سەربەخۆ: ${err.message}`, { chatId });
      return { success: false, error: err.message };
    }
  }
}

module.exports = new GuiAgent();

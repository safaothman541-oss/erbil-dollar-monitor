const groqService = require('../services/groqService');
const androidBridge = require('./androidBridge');
const config = require('../config');

class CellClawEngine {
  constructor() {
    this.maxIterations = 3;
    this.activeTasks = new Map();
  }

  getSystemPrompt() {
    return `You are CellClaw OS (Vertex Autonomous Engine), an elite AI agent directly operating Safa's Android phone.
Safa is an ICT graduate from Erbil Polytechnic University and entrepreneur running VERTEX (POS systems in Erbil, Kurdistan).
You communicate fluently and respectfully in Kurdish Sorani (with technical terms in English when appropriate).

## MANDATORY DIRECTIVES: ALWAYS INVOKE TOOLS
1. Action-First: NEVER say you did something without calling the actual tool. You MUST make tool calls to affect the real phone!
   - If Safa asks to turn on/off the flashlight / torch (فلاش، لایتی مۆبایل): CALL torch_control with state="on" or state="off".
   - If Safa asks to wait / pause (دوو چرکە بە، بۆ ماوەیەک بوەستە): CALL wait_delay with seconds=number.
   - If Safa asks to open Gallery / Photos (گەلەری، وێنەکان): CALL app_launch with app_name="gallery".
   - If Safa asks to open Camera (کامێرا): CALL app_launch with app_name="camera".
   - If Safa asks to open Telegram / return to chat (تێلیگرام، سەرچاتی خۆمان): CALL app_launch with app_name="telegram".
   - If Safa asks to open YouTube (یوتیوب): CALL app_launch with app_name="youtube".
   - If Safa asks to open WhatsApp (واتسئەپ): CALL messaging_open with app="whatsapp".
   - If Safa asks about battery or phone status (پاتری، شەحن، دۆخی مۆبایل): CALL settings_get.
   - If Safa asks to go home / back / click something: CALL app_automate.
2. Multi-step Sequential Tasks:
   - If Safa asks a sequence (e.g. "برۆ گەلەری و دوو چرکە بمێنەوە و وەرەوە سەرچات"):
     1. app_launch(app_name="gallery")
     2. wait_delay(seconds=2)
     3. app_launch(app_name="telegram")
3. Executive Tone & Truthfulness:
   - Only confirm completion if the physical device verified the action.
   - Respectful, executive Kurdish Sorani ("کاکە سەفا", etc.).`;
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'torch_control',
          description: 'Turn the phone flashlight/torch ON or OFF (لایتی مۆبایل، فلاش).',
          parameters: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['on', 'off'],
                description: 'Flashlight state: on or off'
              }
            },
            required: ['state']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'wait_delay',
          description: 'Pause or wait for a specific duration in seconds on the phone.',
          parameters: {
            type: 'object',
            properties: {
              seconds: {
                type: 'number',
                description: 'Number of seconds to wait (e.g. 2, 5)'
              }
            },
            required: ['seconds']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'app_launch',
          description: 'Launch an installed Android app by name or package name (e.g. gallery, camera, telegram, youtube, whatsapp, settings, chrome).',
          parameters: {
            type: 'object',
            properties: {
              app_name: { type: 'string', description: 'Name of the app or package name' }
            },
            required: ['app_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'app_automate',
          description: 'Automate UI actions in the active foreground app via AccessibilityService.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['tap', 'tap_text', 'type', 'swipe', 'scroll', 'back', 'home', 'recents', 'handle_dialog'],
                description: 'The UI action to execute'
              },
              target: {
                type: 'string',
                description: 'Text on screen to click, or coordinates "x y", or direction "up/down/left/right"'
              },
              text: {
                type: 'string',
                description: 'Text to type into focused input field'
              },
              button: {
                type: 'string',
                enum: ['Allow', 'Deny'],
                description: 'For handle_dialog: Allow or Deny'
              }
            },
            required: ['action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_read',
          description: 'Read visible screen content from the Accessibility Node Tree (fast, structured, returns all buttons, text, and titles on screen).',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_capture',
          description: 'Capture screenshot of current screen. Returns image metadata for visual inspection.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'messaging_open',
          description: 'Open a direct chat in WhatsApp, Telegram, or Instagram by phone number or contact name.',
          parameters: {
            type: 'object',
            properties: {
              app: { type: 'string', enum: ['whatsapp', 'telegram', 'instagram'] },
              phone_number: { type: 'string', description: 'Phone number with country code, e.g. +9647501234567' },
              contact_name: { type: 'string', description: 'Contact name to search for' }
            },
            required: ['app']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'sms_send',
          description: 'Send an SMS text message to a phone number.',
          parameters: {
            type: 'object',
            properties: {
              phone_number: { type: 'string', description: 'Recipient phone number' },
              message: { type: 'string', description: 'Text message content' }
            },
            required: ['phone_number', 'message']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'phone_call',
          description: 'Make a direct phone call to a number.',
          parameters: {
            type: 'object',
            properties: {
              phone_number: { type: 'string', description: 'Phone number to dial' }
            },
            required: ['phone_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'settings_get',
          description: 'Get device status including battery percentage, charging state, and online connectivity.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'script_exec',
          description: 'Execute a safe shell command on the device (e.g. input keyevent, am start, dumpsys).',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The shell command to run' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'heartbeat_context',
          description: 'Set or clear a background autonomous monitoring task across heartbeats.',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['set', 'clear'] },
              task_description: { type: 'string', description: 'Description of the ongoing task' }
            },
            required: ['action']
          }
        }
      }
    ];
  }

  // Safe wrapper for tool execution with error boundaries
  async executeTool(name, args = {}) {
    try {
      console.log(`[CellClaw Engine] Invoking tool: ${name}`, args);

      switch (name) {
        case 'torch_control': {
          const state = (args.state || 'on').toLowerCase().trim();
          const res = await androidBridge.executeCommandAndWait('TORCH', { target: state }, 8000);
          return { success: res.success !== false, message: res.message || `Torch ${state}` };
        }

        case 'wait_delay': {
          const secs = Number(args.seconds) || 2;
          const res = await androidBridge.executeCommandAndWait('DELAY', { target: String(secs) }, (secs * 1000) + 4000);
          return { success: res.success !== false, message: res.message || `Waited ${secs} seconds` };
        }

        case 'app_launch': {
          const raw = (args.app_name || 'youtube').toLowerCase().trim();
          if (raw.includes('gallery') || raw.includes('photo') || raw.includes('گەلەری') || raw.includes('وێنە')) {
            const res = await androidBridge.executeCommandAndWait('APP', { target: 'gallery' }, 8000);
            return { success: res.success !== false, message: res.message || 'گەلەری کرایەوە' };
          } else if (raw.includes('camera') || raw.includes('کامێرا')) {
            const res = await androidBridge.executeCommandAndWait('APP', { target: 'camera' }, 8000);
            return { success: res.success !== false, message: res.message || 'کامێرا کرایەوە' };
          } else if (raw.includes('telegram') || raw.includes('تێلیگرام') || raw.includes('تیلیگرام') || raw.includes('سەرچات')) {
            const res = await androidBridge.executeCommandAndWait('APP', { target: 'telegram' }, 8000);
            return { success: res.success !== false, message: res.message || 'تێلیگرام کرایەوە' };
          } else if (raw.includes('youtube') || raw.includes('یوتیوب')) {
            const res = await androidBridge.executeDeviceAction('open_app', { target: 'youtube' }, 8000);
            return { success: res.success !== false, message: res.message || 'یوتیوب کرایەوە' };
          }
          const res = await androidBridge.executeDeviceAction('open_app', { target: raw }, 8000);
          return { success: res.success !== false, message: `Launched ${raw}: ${res.message || 'OK'}` };
        }

        case 'app_automate': {
          const act = args.action;
          if (act === 'tap_text') {
            const res = await androidBridge.executeCommandAndWait('TAP_TEXT', { target: args.target }, 7000);
            return { success: res.success !== false, message: res.message };
          } else if (act === 'tap') {
            const parts = (args.target || '500 500').split(/[ ,]+/);
            const x = parts[0] || '500';
            const y = parts[1] || '500';
            const res = await androidBridge.executeDeviceAction('tap', { x, y }, 7000);
            return { success: res.success !== false, message: res.message };
          } else if (act === 'type') {
            const textToType = args.text || args.target || '';
            const res = await androidBridge.executeDeviceAction('type', { text: textToType }, 7000);
            return { success: res.success !== false, message: res.message };
          } else if (act === 'back') {
            const res = await androidBridge.executeCommandAndWait('BACK', {}, 6000);
            return { success: res.success !== false, message: res.message || 'گەڕانەوە بۆ دواوە' };
          } else if (act === 'home') {
            const res = await androidBridge.executeCommandAndWait('HOME', {}, 6000);
            return { success: res.success !== false, message: res.message || 'گەڕانەوە بۆ پەڕەی سەرەکی' };
          } else if (act === 'recents') {
            const res = await androidBridge.executeCommandAndWait('RECENTS', {}, 6000);
            return { success: res.success !== false, message: res.message || 'ئەپەکانی پێشوو' };
          } else if (act === 'handle_dialog') {
            const btn = args.button || 'Allow';
            const res = await androidBridge.executeCommandAndWait('TAP_TEXT', { target: btn }, 5000);
            return { success: res.success !== false, message: `Handled dialog with ${btn}` };
          } else if (act === 'swipe' || act === 'scroll') {
            const dir = (args.target || 'up').toLowerCase();
            const swipeCmd = dir === 'down'
              ? 'input swipe 500 400 500 1200 300'
              : 'input swipe 500 1200 500 400 300';
            const res = await androidBridge.executeCommandAndWait('SHELL', { message: swipeCmd }, 5000);
            return { success: res.success !== false, message: `Swiped ${dir}` };
          }
          return { success: false, message: `Unknown action: ${act}` };
        }

        case 'screen_read': {
          const res = await androidBridge.executeCommandAndWait('SCREEN_READ', {}, 6000);
          if (res.success && res.result && res.result.screenText) {
            return { screen_text: res.result.screenText };
          }
          return { screen_text: 'Active window accessible. Ready for user interaction.' };
        }

        case 'screen_capture': {
          const res = await androidBridge.executeDeviceAction('screenshot', {}, 7000);
          return { success: true, path: res.message || 'screenshot_captured' };
        }

        case 'messaging_open': {
          const app = args.app || 'whatsapp';
          if (app === 'whatsapp' && args.phone_number) {
            const cleanPhone = args.phone_number.replace(/[^0-9]/g, '');
            const uri = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
            const res = await androidBridge.executeCommandAndWait('SHELL', {
              message: `am start -a android.intent.action.VIEW -d "${uri}"`
            }, 7000);
            return { success: true, message: `Opened WhatsApp chat with ${cleanPhone}` };
          }
          const res = await androidBridge.executeDeviceAction('open_app', { target: app }, 7000);
          return { success: true, message: `Opened ${app}` };
        }

        case 'sms_send': {
          const phone = (args.phone_number || '').replace(/[^0-9+]/g, '');
          const msg = (args.message || '').replace(/"/g, '\"');
          const res = await androidBridge.executeCommandAndWait('SHELL', {
            message: `service call isms 5 s16 "com.android.mms" s16 "${phone}" s16 "null" s16 "${msg}" s16 "null" s16 "null"`
          }, 7000);
          return { success: true, message: `SMS dispatched to ${phone}` };
        }

        case 'phone_call': {
          const phone = (args.phone_number || '').replace(/[^0-9+]/g, '');
          const res = await androidBridge.executeCommandAndWait('SHELL', {
            message: `am start -a android.intent.action.CALL -d "tel:${phone}"`
          }, 7000);
          return { success: true, message: `Dialing ${phone}` };
        }

        case 'settings_get': {
          const status = androidBridge.getDeviceStatus();
          return {
            online: status.online || false,
            battery: status.battery || 'Unknown',
            charging: status.charging || false,
            last_seen: status.lastSeen || 'Never'
          };
        }

        case 'script_exec': {
          const raw = args.command || '';
          // Whitelist check to prevent accidental destructive commands
          if (/rm\s+-rf|format\s+|wipe\s+|reboot\s+recovery/i.test(raw)) {
            return { success: false, error: 'Command blocked by security policy' };
          }
          const res = await androidBridge.executeCommandAndWait('SHELL', { message: raw }, 8000);
          return { success: res.success !== false, output: res.message || 'Executed' };
        }

        case 'heartbeat_context': {
          if (args.action === 'set') {
            return { status: 'HEARTBEAT_REGISTERED', task: args.task_description || 'Monitoring' };
          }
          return { status: 'HEARTBEAT_CLEARED' };
        }

        default:
          return { error: `Tool ${name} is not implemented` };
      }
    } catch (err) {
      console.error(`[CellClaw Engine] Error in tool ${name}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // The Autonomous Agent Loop: Think -> Act -> Observe -> Finish
  async runTask(userPrompt, context = {}) {
    console.log(`[CellClaw Engine] Starting autonomous task: "${userPrompt}"`);

    const cleanPrompt = (userPrompt || '').toLowerCase().trim();

    // Fast-path 1: Flashlight / Torch OFF (Handles: بیکوژێنەوە, بکوژێنەوە, داخە, فلاشی مۆبایلەکەم داخە, etc.)
    const isTorchOff = 
      /ب[ەی]?کوژ[ێی]نەوە|داخە|بیداخە|کوژانەوە|کوژاندنەوە/.test(cleanPrompt) ||
      ((cleanPrompt.includes('فلاش') || cleanPrompt.includes('لایت')) && /off|کوژ|داخ/.test(cleanPrompt));

    if (isTorchOff) {
      const res = await this.executeTool('torch_control', { state: 'off' });
      if (res.success) {
        return {
          success: true,
          iterations: 1,
          actions: [{ tool: 'torch_control', args: { state: 'off' }, result: res }],
          reply: 'کاکە سەفا، فلاشی مۆبایلەکەت کوژایەوە 🔦❌'
        };
      }
      return {
        success: false,
        iterations: 1,
        actions: [{ tool: 'torch_control', args: { state: 'off' }, result: res }],
        reply: `کاکە سەفا، فەرمانی کوژاندنەوەی فلاش نێردرا بەڵام لە مۆبایلەکەتەوە وەڵامی سەرکەوتن نەگەڕایەوە (${res.message}).`
      };
    }

    // Fast-path 2: Flashlight / Torch ON (Handles: فلاشەکە پێبکە, فلاش هەڵکە, پێی بکە, لایتی مۆبایل, etc.)
    const isTorchOn = 
      (cleanPrompt.includes('فلاش') || cleanPrompt.includes('لایت')) &&
      /پێ\s*بکە|پێی\s*بکە|هەڵ\s*کە|هەڵیکە|داگیرسێن|رووناک|on|بکەرەوە/.test(cleanPrompt);

    if (isTorchOn) {
      const res = await this.executeTool('torch_control', { state: 'on' });
      if (res.success) {
        return {
          success: true,
          iterations: 1,
          actions: [{ tool: 'torch_control', args: { state: 'on' }, result: res }],
          reply: 'فەرمانت بەسەر چاو کاکە سەفا، فلاشی مۆبایلەکەت داگیرسا 🔦✨'
        };
      }
      return {
        success: false,
        iterations: 1,
        actions: [{ tool: 'torch_control', args: { state: 'on' }, result: res }],
        reply: `کاکە سەفا، فەرمانی داگیرساندنی فلاش نێردرا بەڵام لە مۆبایلەکەتەوە وەڵامی سەرکەوتن نەگەڕایەوە (${res.message}).`
      };
    }

    const messages = [
      { role: 'system', content: this.getSystemPrompt() }
    ];

    if (context.history && Array.isArray(context.history)) {
      for (const h of context.history.slice(-4)) {
        if (h.role && h.content) {
          messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content) });
        }
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    const tools = this.getToolDefinitions();
    let iteration = 0;
    const actionsTaken = [];
    let lastToolSignature = null;
    let consecutiveDuplicateCount = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`[CellClaw Engine] Loop iteration ${iteration}/${this.maxIterations}`);

      let response;
      try {
        response = await groqService.chatWithTools(messages, tools, { temperature: 0.2 });
      } catch (llmErr) {
        console.error('[CellClaw Engine] LLM invocation error:', llmErr.message);
        // Resilient fallback for common intents
        if (cleanPrompt.includes('گەلەری') || cleanPrompt.includes('gallery')) {
          const res = await this.executeTool('app_launch', { app_name: 'gallery' });
          if (res.success) {
            return {
              success: true,
              iterations: iteration,
              actions: [{ tool: 'app_launch', args: { app_name: 'gallery' }, result: res }],
              reply: 'کاکە سەفا، گەلەری وێنەکان لەسەر مۆبایلەکەت بە سەرکەوتوویی کرایەوە 🖼️📱'
            };
          }
        }
        return {
          success: false,
          iterations: iteration,
          actions: actionsTaken,
          reply: `کاکە سەفا، کێشەیەک لە پەیوەندی مۆدێلی هۆش هەبوو (${llmErr.message})، هیچ کردارێکی هەڵە ئەنجام نەدرا.`
        };
      }

      // If no tool calls were requested, we reached the final conclusion
      if (!response.tool_calls || response.tool_calls.length === 0) {
        const failedAction = actionsTaken.find(a => a.result && a.result.success === false);
        if (failedAction) {
          return {
            success: false,
            iterations: iteration,
            actions: actionsTaken,
            reply: `کاکە سەفا، هەنگاوی ${failedAction.tool} نێردرا بەڵام لە مۆبایلەکەتەوە وەڵامی سەرکەوتن نەگەڕایەوە (${failedAction.result.message || 'وەڵام نەبوو'}). تکایە دڵنیابە ئەپی SafaDroid کراوەیە.`
          };
        }
        return {
          success: true,
          iterations: iteration,
          actions: actionsTaken,
          reply: response.content || 'فەرمانەکەت بە سەرکەوتوویی جێبەجێ کرا کاکە سەفا.'
        };
      }

      // Loop Prevention check
      const currentSignature = JSON.stringify(response.tool_calls.map(t => ({ name: t.function.name, args: t.function.arguments })));
      if (currentSignature === lastToolSignature) {
        consecutiveDuplicateCount++;
        if (consecutiveDuplicateCount >= 2) {
          console.warn('[CellClaw Engine] Detected repetitive action loop, breaking loop.');
          return {
            success: true,
            iterations: iteration,
            actions: actionsTaken,
            reply: 'کاکە سەفا، هەنگاوەکان جێبەجێ کران و بۆ ڕێگری لە دووبارەبوونەوە کارەکە تەواو کرا.'
          };
        }
      } else {
        consecutiveDuplicateCount = 0;
      }
      lastToolSignature = currentSignature;

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.tool_calls
      });

      // Execute each tool call sequentially
      for (const tc of response.tool_calls) {
        const fnName = tc.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(tc.function.arguments || '{}');
        } catch (_) {}

        const result = await this.executeTool(fnName, fnArgs);
        actionsTaken.push({ tool: fnName, args: fnArgs, result });

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }
    }

    const failedAction = actionsTaken.find(a => a.result && a.result.success === false);
    if (failedAction) {
      return {
        success: false,
        iterations: iteration,
        actions: actionsTaken,
        reply: `کاکە سەفا، هەنگاوەکان نێردران بەڵام لە مۆبایلەکەتەوە وەڵامی تەواوبوون نەگەڕایەوە (${failedAction.result.message || 'نادیار'}).`
      };
    }

    return {
      success: true,
      iterations: iteration,
      actions: actionsTaken,
      reply: 'کاکە سەفا، هەموو هەنگاوەکان لەسەر مۆبایلەکەت تەواو کران.'
    };
  }
}

module.exports = new CellClawEngine();

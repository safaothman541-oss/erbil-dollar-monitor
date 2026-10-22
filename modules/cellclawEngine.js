const groqService = require('../services/groqService');
const androidBridge = require('./androidBridge');
const config = require('../config');

class CellClawEngine {
  constructor() {
    this.maxIterations = 8;
    this.activeTasks = new Map(); // chatId -> current heartbeat task
  }

  getSystemPrompt() {
    return `You are CellClaw OS (Vertex Autonomous Engine), an elite AI agent directly operating Safa's Android phone.
Safa is an ICT graduate from Erbil Polytechnic University and entrepreneur running VERTEX (POS systems in Erbil, Kurdistan).
You communicate fluently and respectfully in Kurdish Sorani (with technical terms in English when appropriate).

## Core Directives
1. Action-Oriented: Never stall by asking unnecessary clarifying questions. If the user's intent is clear enough to act on, act immediately by invoking tool calls.
2. App Automation Strategy:
   - To interact with any app: 1) app_launch, 2) screen_read to inspect visible UI nodes, 3) app_automate to tap, type, swipe, or scroll.
   - Always read the screen after major screen changes to verify state.
3. System Dialog Handling:
   - If a permission dialog blocks the screen ("Allow", "Deny"), use app_automate with action="handle_dialog" and button="Allow".
4. Error Recovery & Loop Avoidance:
   - If an action hits an ad, paywall, or failure, NEVER repeat the identical action. Use action="back" or action="swipe" or tap an alternate element.
5. Tone:
   - Respectful, executive Kurdish Sorani ("کاکە سەفا", "فەرمانەکە جێبەجێکرا", etc.).`;
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'app_launch',
          description: 'Launch an installed Android app by name or package name (e.g. youtube, whatsapp, telegram, settings, chrome, camera).',
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
          description: 'Execute a raw shell/ADB command on the device (e.g. input keyevent, am start).',
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

  // Execute a single tool call through androidBridge
  async executeTool(name, args) {
    console.log(`[CellClaw Engine] Invoking tool: ${name}`, args);

    switch (name) {
      case 'app_launch': {
        const app = args.app_name || 'youtube';
        const res = await androidBridge.executeDeviceAction('open_app', { target: app }, 9000);
        return { success: res.success, message: `Launched ${app}: ${res.message || 'OK'}` };
      }

      case 'app_automate': {
        const act = args.action;
        if (act === 'tap_text') {
          const res = await androidBridge.executeCommandAndWait('TAP_TEXT', { target: args.target }, 8000);
          return { success: res.success, message: res.message };
        } else if (act === 'tap') {
          const parts = (args.target || '500 500').split(' ');
          const x = parts[0] || '500';
          const y = parts[1] || '500';
          const res = await androidBridge.executeDeviceAction('tap', { x, y }, 8000);
          return { success: res.success, message: res.message };
        } else if (act === 'type') {
          const res = await androidBridge.executeDeviceAction('type', { text: args.text || args.target }, 8000);
          return { success: res.success, message: res.message };
        } else if (act === 'back') {
          const res = await androidBridge.executeCommandAndWait('BACK', {}, 6000);
          return { success: res.success, message: 'Pressed back' };
        } else if (act === 'home') {
          const res = await androidBridge.executeCommandAndWait('HOME', {}, 6000);
          return { success: res.success, message: 'Pressed home' };
        } else if (act === 'recents') {
          const res = await androidBridge.executeCommandAndWait('RECENTS', {}, 6000);
          return { success: res.success, message: 'Opened recents' };
        } else if (act === 'handle_dialog') {
          const btn = args.button || 'Allow';
          const res = await androidBridge.executeCommandAndWait('TAP_TEXT', { target: btn }, 6000);
          return { success: res.success, message: `Handled dialog with ${btn}` };
        } else if (act === 'swipe' || act === 'scroll') {
          const dir = args.target || 'up';
          // Simulate swipe via input swipe
          const swipeCmd = dir === 'down' ? 'input swipe 500 400 500 1200 300' : 'input swipe 500 1200 500 400 300';
          const res = await androidBridge.executeCommandAndWait('SHELL', { message: swipeCmd }, 6000);
          return { success: res.success, message: `Swiped ${dir}` };
        }
        return { success: false, message: `Unknown automation action: ${act}` };
      }

      case 'screen_read': {
        const res = await androidBridge.executeCommandAndWait('SCREEN_READ', {}, 8000);
        if (res.success && res.result && res.result.screenText) {
          return { screen_text: res.result.screenText };
        }
        return { screen_text: 'Current foreground window active. Tap or navigate to continue.' };
      }

      case 'screen_capture': {
        const res = await androidBridge.executeDeviceAction('screenshot', {}, 9000);
        return { success: res.success, path: res.message || 'screenshot captured' };
      }

      case 'messaging_open': {
        const app = args.app || 'whatsapp';
        if (app === 'whatsapp' && args.phone_number) {
          const cleanPhone = args.phone_number.replace(/[^0-9]/g, '');
          const uri = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
          const res = await androidBridge.executeCommandAndWait('SHELL', { message: `am start -a android.intent.action.VIEW -d "${uri}"` }, 8000);
          return { success: res.success, message: `Opened WhatsApp chat with ${cleanPhone}` };
        }
        const res = await androidBridge.executeDeviceAction('open_app', { target: app }, 8000);
        return { success: res.success, message: `Opened ${app}` };
      }

      case 'sms_send': {
        const phone = args.phone_number;
        const msg = args.message;
        const res = await androidBridge.executeCommandAndWait('SHELL', {
          message: `service call isms 5 s16 "com.android.mms" s16 "${phone}" s16 "null" s16 "${msg}" s16 "null" s16 "null"`
        }, 8000);
        return { success: res.success, message: `Sent SMS to ${phone}` };
      }

      case 'phone_call': {
        const phone = args.phone_number;
        const res = await androidBridge.executeCommandAndWait('SHELL', {
          message: `am start -a android.intent.action.CALL -d "tel:${phone}"`
        }, 8000);
        return { success: res.success, message: `Calling ${phone}` };
      }

      case 'settings_get': {
        const status = androidBridge.getDeviceStatus();
        return {
          online: status.online,
          battery: status.battery || 'Unknown',
          charging: status.charging || false,
          last_seen: status.lastSeen
        };
      }

      case 'script_exec': {
        const res = await androidBridge.executeCommandAndWait('SHELL', { message: args.command }, 9000);
        return { success: res.success, output: res.message };
      }

      case 'heartbeat_context': {
        if (args.action === 'set') {
          return { status: 'HEARTBEAT_REGISTERED', task: args.task_description };
        }
        return { status: 'HEARTBEAT_CLEARED' };
      }

      default:
        return { error: `Tool ${name} is not implemented` };
    }
  }

  // The Autonomous Agent Loop: Think -> Act -> Observe -> Finish
  async runTask(userPrompt, context = {}) {
    console.log(`[CellClaw Engine] Starting autonomous task: "${userPrompt}"`);

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: userPrompt }
    ];

    const tools = this.getToolDefinitions();
    let iteration = 0;
    const actionsTaken = [];

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`[CellClaw Engine] Loop iteration ${iteration}/${this.maxIterations}`);

      const response = await groqService.chatWithTools(messages, tools, { temperature: 0.2 });

      // If no tool calls were requested, we have reached the final conclusion
      if (!response.tool_calls || response.tool_calls.length === 0) {
        return {
          success: true,
          iterations: iteration,
          actions: actionsTaken,
          reply: response.content || 'فەرمانەکەت بە سەرکەوتوویی لەسەر مۆبایلەکە جێبەجێ کرا کاکە سەفا.'
        };
      }

      // Add the assistant message with tool calls to history
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

        actionsTaken.push({ tool: fnName, args: fnArgs });

        const result = await this.executeTool(fnName, fnArgs);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }
    }

    return {
      success: true,
      iterations: iteration,
      actions: actionsTaken,
      reply: 'کاکە سەفا، هەنگاوەکانی فەرمانەکە لەسەر مۆبایلەکەت ئەنجامدران.'
    };
  }
}

module.exports = new CellClawEngine();

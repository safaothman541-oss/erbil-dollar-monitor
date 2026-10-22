const path = require('path');
const { exec } = require('child_process');
const config = require('../config');
const androidBridge = require('../modules/androidBridge');
const groqService = require('./groqService');

class CodeActAgent {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY || '';
    this.geminiModel = 'gemini-3.5-flash';
    this.maxIterations = 5;
  }

  setApiKey(key) {
    this.geminiApiKey = key.trim();
  }

  // Pure Code-Act tools definition
  getToolsDefinition() {
    return [
      {
        type: 'function',
        function: {
          name: 'execute_phone_ui_action',
          description: 'Natively control Safa\'s Android phone via SafaDroid Accessibility Service (OpenRing Architecture). Use this for all phone GUI operations: open apps, search/play YouTube, click text on screen, tap coordinates, type text, go home, go back, show recent apps, pull down notifications.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['APP', 'YOUTUBE', 'TAP_TEXT', 'TAP', 'TYPE', 'HOME', 'BACK', 'RECENTS', 'NOTIFICATIONS'],
                description: 'The native Accessibility UI action'
              },
              target: {
                type: 'string',
                description: 'Target app name (youtube, whatsapp, telegram, chrome, etc.), text string to click on screen, query to search on youtube, or x y coordinates'
              },
              message: {
                type: 'string',
                description: 'Text to type into input field, or additional parameter'
              }
            },
            required: ['action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'execute_phone_shell',
          description: 'Execute any raw ADB / Linux shell command on Safa\'s Android phone via root/Shizuku. Automatically mapped to native actions when possible.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The exact raw shell command string to execute on Android'
              }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'execute_server_shell',
          description: 'Execute any bash command on the cloud Linux server (e.g. node -e, python3, curl, jq, cat, ls, find, git, etc.). Use this for server-side logic, data processing, web queries, or file generation.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The exact bash command to execute on the Linux server'
              }
            },
            required: ['command']
          }
        }
      }
    ];
  }

  // Execute native UI action on Android phone via SafaDroid Accessibility Engine
  async runPhoneUIAction(action, target = '', message = '') {
    try {
      console.log(`[CodeAct Agent] 📱 SafaDroid UI Action: ${action} (target=${target}, msg=${message})`);
      const res = await androidBridge.executeCommandAndWait(action, { target, message }, 10000);
      return {
        success: res.success,
        output: res.message || (res.success ? 'SafaDroid action completed.' : 'Action failed.')
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Execute shell command on Android phone via androidBridge
  async runPhoneShell(command) {
    try {
      console.log(`[CodeAct Agent] 📱 Executing on phone: ${command}`);
      // Ensure phone screen is awake (KEYCODE_WAKEUP 224) and dismissed keyguard
      const fullCmd = `input keyevent 224; wm dismiss-keyguard 2>/dev/null; ${command}`;
      const res = await androidBridge.executeCommandAndWait('SHELL', { message: fullCmd }, 9000);
      return {
        success: res.success,
        output: res.message || (res.success ? 'Command executed successfully.' : 'No output returned.')
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Execute shell command on Linux/Windows server
  async runServerShell(command) {
    return new Promise((resolve) => {
      console.log(`[CodeAct Agent] 🖥️ Executing on server: ${command}`);
      const isWin = process.platform === 'win32';
      const shellCmd = isWin ? `powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '`"')}"` : command;
      exec(shellCmd, { timeout: 10000, cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            exitCode: error.code,
            error: stderr ? stderr.trim() : error.message
          });
        } else {
          resolve({
            success: true,
            output: stdout ? stdout.trim() : (stderr ? stderr.trim() : 'Command executed with 0 output.')
          });
        }
      });
    });
  }

  // Run the autonomous agent loop using CellClaw Engine (Vertex SRE Architecture)
  async run(userGoal, conversationHistory = []) {
    try {
      const cellclawEngine = require("../modules/cellclawEngine");
      const result = await cellclawEngine.runTask(userGoal, { history: conversationHistory });
      return {
        reply: result.reply,
        actions: result.actions || []
      };
    } catch (err) {
      console.warn("[CodeActAgent] CellClaw error:", err.message);
      return this.runWithGroq(userGoal, "", conversationHistory);
    }
  }

  // Implementation with Google Gemini 2.0 Flash Native REST API
  async runWithGemini(userGoal, systemPrompt, conversationHistory) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const toolsDeclaration = [
      {
        functionDeclarations: [
          {
            name: 'execute_phone_ui_action',
            description: 'Natively control Safa\'s Android phone via SafaDroid Accessibility Service (OpenRing Architecture). Use this for all phone GUI operations: open apps, search/play YouTube, click text on screen, tap coordinates, type text, go home, go back, show recent apps, pull down notifications.',
            parameters: {
              type: 'OBJECT',
              properties: {
                action: { type: 'STRING', description: 'The UI action: APP, YOUTUBE, TAP_TEXT, TAP, TYPE, HOME, BACK, RECENTS, NOTIFICATIONS' },
                target: { type: 'STRING', description: 'Target app name, text to click, query for youtube, or x y coordinates' },
                message: { type: 'STRING', description: 'Text to type into focused input or extra parameter' }
              },
              required: ['action']
            }
          },
          {
            name: 'execute_phone_shell',
            description: 'Execute raw ADB/Linux shell command on Safa\'s Android phone via root/Shizuku',
            parameters: {
              type: 'OBJECT',
              properties: {
                command: { type: 'STRING', description: 'The exact shell command string' }
              },
              required: ['command']
            }
          },
          {
            name: 'execute_server_shell',
            description: 'Execute bash command on Safa\'s cloud Linux server',
            parameters: {
              type: 'OBJECT',
              properties: {
                command: { type: 'STRING', description: 'The exact bash command string' }
              },
              required: ['command']
            }
          }
        ]
      }
    ];

    const contents = [];
    // Append conversation history
    for (const h of conversationHistory.slice(-6)) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: userGoal }]
    });

    let currentIteration = 0;
    const executedActions = [];

    while (currentIteration < this.maxIterations) {
      currentIteration++;

      const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: toolsDeclaration
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[CodeAct Agent] Gemini API error ${res.status}. Seamlessly falling back to Groq 120B... (${errText.slice(0, 100)})`);
        return this.runWithGroq(userGoal, systemPrompt, conversationHistory);
      }

      const data = await res.json();
      const candidate = data.candidates && data.candidates[0];
      if (!candidate || !candidate.content) {
        return { reply: 'وەڵامێک لە مۆدێلەوە وەرنەگیرا.', actions: executedActions };
      }

      const parts = candidate.content.parts || [];
      let functionCallPart = parts.find(p => p.functionCall);
      let textPart = parts.find(p => p.text);

      // Append model response to conversation
      contents.push(candidate.content);

      if (!functionCallPart) {
        // Model has completed its reasoning and returned the final answer!
        return {
          reply: textPart ? textPart.text : 'فەرمانەکەت ئەنجامدرا کاکە سەفا.',
          actions: executedActions
        };
      }

      // Execute tool call
      const fn = functionCallPart.functionCall.name;
      const args = functionCallPart.functionCall.args || {};
      let execResult = null;

      if (fn === 'execute_phone_ui_action') {
        execResult = await this.runPhoneUIAction(args.action, args.target, args.message);
        executedActions.push({ type: 'PHONE_UI', action: args.action, target: args.target, message: args.message, result: execResult });
      } else if (fn === 'execute_phone_shell') {
        execResult = await this.runPhoneShell(args.command);
        executedActions.push({ type: 'PHONE_SHELL', command: args.command, result: execResult });
      } else if (fn === 'execute_server_shell') {
        execResult = await this.runServerShell(args.command);
        executedActions.push({ type: 'SERVER_SHELL', command: args.command, result: execResult });
      }

      // Feed tool result back to Gemini
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: fn,
              response: { content: JSON.stringify(execResult) }
            }
          }
        ]
      });
    }

    return {
      reply: 'کردارەکان ئەنجامدران کاکە سەفا، بەڵام ژمارەی هەنگاوەکان زۆر بوو بۆیە ڕاگیرا.',
      actions: executedActions
    };
  }

  // Implementation with Groq (OpenAI-compatible format)
  async runWithGroq(userGoal, systemPrompt, conversationHistory) {
    const tools = this.getToolsDefinition();
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6),
      { role: 'user', content: userGoal }
    ];

    let currentIteration = 0;
    const executedActions = [];

    while (currentIteration < this.maxIterations) {
      currentIteration++;

      const response = await groqService.chatWithTools(messages, tools, {
        temperature: 0.2
      });

      if (!response.tool_calls || response.tool_calls.length === 0) {
        return {
          reply: response.content || 'فەرمانەکەت ئەنجامدرا کاکە سەفا 🫡',
          actions: executedActions
        };
      }

      for (const tc of response.tool_calls) {
        const fn = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch (_) {}

        let execResult = null;
        if (fn === 'execute_phone_ui_action') {
          execResult = await this.runPhoneUIAction(args.action, args.target, args.message);
          executedActions.push({ type: 'PHONE_UI', action: args.action, target: args.target, message: args.message, result: execResult });
        } else if (fn === 'execute_phone_shell') {
          execResult = await this.runPhoneShell(args.command);
          executedActions.push({ type: 'PHONE_SHELL', command: args.command, result: execResult });
        } else if (fn === 'execute_server_shell') {
          execResult = await this.runServerShell(args.command);
          executedActions.push({ type: 'SERVER_SHELL', command: args.command, result: execResult });
        }

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [tc]
        });

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(execResult)
        });
      }
    }

    return {
      reply: 'کردارەکان ئەنجامدران کاکە سەفا 🫡',
      actions: executedActions
    };
  }
}

module.exports = new CodeActAgent();

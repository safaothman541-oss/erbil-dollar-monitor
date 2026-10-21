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
          name: 'execute_phone_shell',
          description: 'Execute any raw ADB / Linux shell command on Safa\'s Android phone via root/Shizuku (e.g. am start, input tap X Y, input keyevent, pm, dumpsys, settings, screencap, etc.). Use this for ANY phone action.',
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

  // Run the autonomous agent loop using Gemini 2.0 Flash or Fallback
  async run(userGoal, conversationHistory = []) {
    const systemPrompt = `تۆ بریکاری سەربەخۆی کۆد و تێرمیناڵیت لە سیستەمی Safa OS (Autonomous Code-Act & Shell Agent).
خاوەنی سیستەمەکە کاکە سەفایە (ئەندازیاری ICT).
تۆ فێری هیچ یاسایەکی دیاریکراو نەکراویت. تۆ تەواوی مێشک و ژیری خۆت بەکاردێنیت و بە بیرکردنەوە و لێکدانەوەی خۆت (Reasoning) فەرمانەکان جێبەجێ دەکەیت بە لێدانی کۆماندی شێڵ:

ئەم دوو توانایەت لە بەردەستە:
١. execute_phone_shell(command): فەرمانی شێڵی ئەندرۆید (ADB/Linux) لەسەر مۆبایلی سەفا لێدەدات (وەک: am start, input tap, input text, input keyevent, pm, dumpsys, settings...).
٢. execute_server_shell(command): فەرمانی لینوکس/بەش لەسەر سێرڤەرەکەی سەفا لێدەدات (وەک: node, python3, curl, jq, git, بەستنەوە بە زۆهۆ و فایلەکان...).

یاساکانی کارکردنی سەربەخۆ:
- کاتێک سەفا هەر فەرمانێک دەدات (هەرچییەک بێت: یوتیوب، مۆسیقا، داتابەیس، سێرڤەر، فایلی نوێ، وێنە، فایل، تاقیکردنەوە):
  ١. بە ثینکئنگی خۆت بیر بکەوە چ کۆماندێکی لینوکس یان ئەندرۆید پێویستە.
  ٢. کۆماندەکە ڕەن بکە بە execute_phone_shell یان execute_server_shell.
  ٣. سەیری دەرئەنجام (stdout / stderr) بکە. ئەگەر هەڵەیەک هەبوو، خۆت چاکی بکەرەوە.
  ٤. لە کۆتاییدا بە زمانی کوردیی سۆرانیی کورت، بڕیاردەر و بەڕێز وەڵامی کاکە سەفا بدەرەوە.
- هەرگیز درۆ مەکە؛ تەنیا کاتێک بڵێ کارەکە کرا کە بە چاوی خۆت بینی کۆماندەکە سەرکەوتووانە تەواو بوو.
- بۆ فەرمانەکانی مۆبایل و کردنەوەی ئەپەکان، هەمیشە پاکێجی ڕاستەقینە دیاری بکە (بۆ نموونە بۆ یوتیوب: am start -a android.intent.action.VIEW -d "https://www.youtube.com/results?search_query=..." com.google.android.youtube) تا ڕاستەوخۆ ئەپەکە لەسەر شاشە دەربکەوێت.`;

    // 1. If Gemini API Key is available, use Google Gemini 2.0 Flash natively
    if (this.geminiApiKey) {
      return this.runWithGemini(userGoal, systemPrompt, conversationHistory);
    }

    // 2. Otherwise fallback to Groq with native tool calling
    return this.runWithGroq(userGoal, systemPrompt, conversationHistory);
  }

  // Implementation with Google Gemini 2.0 Flash Native REST API
  async runWithGemini(userGoal, systemPrompt, conversationHistory) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const toolsDeclaration = [
      {
        functionDeclarations: [
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

      if (fn === 'execute_phone_shell') {
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
        if (fn === 'execute_phone_shell') {
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

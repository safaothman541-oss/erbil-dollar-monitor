const groqService = require('./groqService');
const config = require('../config');

class AIRouter {
  async classifyAndProcess(userText) {
    const systemPrompt = `You are the executive AI intelligence behind "Safa OS", the personal autonomous operating system for Safa (an ICT engineer from Erbil Polytechnic University, entrepreneur, and automation builder in Kurdistan).

Your job is to analyze incoming messages (which could be transcribed voice notes or typed text in Kurdish, English, or Arabic) and determine the exact category and structured data.

Output strictly valid JSON with this schema:
{
  "type": "EXPENSE" | "TASK" | "IDEA" | "CONTENT" | "QUERY",
  "kurdishSummary": "A concise, respectful 1-2 sentence response/acknowledgment in Kurdish Sorani addressed to Safa",
  "data": {
    // If EXPENSE:
    "amount": number,
    "currency": "IQD" or "USD",
    "category": "خۆراک (Food)" | "سوتەمەنی و گواستنەوە (Fuel/Transit)" | "تەکنەلۆژیا و سێرڤەر (Tech)" | "کار و بیزنس (Business)" | "کەسی و جۆراوجۆر (Personal)",
    "note": "detailed description"

    // If TASK:
    "task": "title of task",
    "dueDate": "date/time string if mentioned, or null",
    "priority": "بەپەلە (High)" | "ئاسایی (Medium)"

    // If IDEA:
    "title": "Clear punchy title",
    "analysis": "2-3 sentences evaluating why this idea is valuable and how to execute it",
    "tags": ["tag1", "tag2"]

    // If CONTENT:
    "topic": "core topic",
    "angle": "the hook or perspective to take"

    // If QUERY:
    "answer": "Comprehensive, highly intelligent, insightful executive answer in Kurdish Sorani"
  }
}

Important rules:
- Prices in Kurdistan: if user says "٢٥ هەزار" or "25 hezar", that is 25000 IQD. If they say "١٠ دۆلار", that is 10 USD.
- Maintain a sharp, respectful, executive partner tone.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ];

    try {
      const raw = await groqService.fastChat(messages, { json: true, temperature: 0.2 });
      return JSON.parse(raw);
    } catch (err) {
      // Fallback via OpenRouter if needed
      console.warn('[AIRouter] Groq parsing error, attempting fallback:', err.message);
      return this.fallbackOpenRouter(userText, systemPrompt);
    }
  }

  async fallbackOpenRouter(userText, systemPrompt) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        response_format: { type: 'json_object' }
      })
    });
    const json = await res.json();
    return JSON.parse(json.choices[0].message.content);
  }
}

module.exports = new AIRouter();

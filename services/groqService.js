const config = require('../config');

class GroqService {
  constructor() {
    this.apiKey = config.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  // Fast transcription using whisper-large-v3
  async transcribeAudio(audioBuffer, filename = 'voice.oga') {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is missing.');

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-large-v3');
    formData.append('prompt', 'کوردی، تێکستی کوردی، هەولێر، سلێمانی، دۆلار، دینار، خەرجی، کار، بەنزین، کۆد، زانکۆ');
    formData.append('temperature', '0.0');

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq Whisper error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.text ? data.text.trim() : '';
  }

  // Fast reasoning / structured extraction using Groq models
  async fastChat(messages, options = {}) {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is missing.');

    const model = options.model || 'openai/gpt-oss-120b';
    const payload = {
      model,
      messages,
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      max_tokens: options.max_tokens || 1024,
      response_format: options.json ? { type: 'json_object' } : undefined
    };

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq Chat error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
    } catch (err) {
      // Fallback to openai/gpt-oss-20b if 120b fails
      if (model !== 'openai/gpt-oss-20b') {
        return this.fastChat(messages, { ...options, model: 'openai/gpt-oss-20b' });
      }
      throw err;
    }
  }

  // Native LLM Tool Calling (Function Calling)
  async chatWithTools(messages, tools, options = {}) {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is missing.');

    const model = options.model || 'openai/gpt-oss-120b';
    const payload = {
      model,
      messages,
      tools,
      tool_choice: options.tool_choice || 'auto',
      temperature: options.temperature !== undefined ? options.temperature : 0.2,
      max_tokens: options.max_tokens || 1024
    };

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq Tools error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices && data.choices[0] ? data.choices[0] : null;
      if (!choice || !choice.message) {
        return { content: '', tool_calls: [] };
      }
      return {
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls || []
      };
    } catch (err) {
      if (model !== 'openai/gpt-oss-20b') {
        return this.chatWithTools(messages, tools, { ...options, model: 'openai/gpt-oss-20b' });
      }
      throw err;
    }
  }

  // Vision Perception: Analyze Android Screen Image
  async analyzeScreenImage(imageBuffer) {
    if (!this.apiKey) return null;
    try {
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'تۆ سیستەمی بینینی زیرەکی دیوانی کاکە سەفایت (Safa OS Vision). ئەمە وێنەی ڕاستەوخۆی شاشەی مۆبایلی ئەندرۆیدی کاکە سەفایە. بە زمانی کوردی سۆرانی، زۆر پوخت و پرۆفیشناڵ پێناسەی بکە: چ ئەپێک کراوەیە؟ چ ناوەڕۆک، نامە، دوگمە، یان پەنجەرەیەک دیارە؟ بەبێ زیادەبێژی و بە ڕوونی باسی بکە.'
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ];

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages,
          temperature: 0.2,
          max_tokens: 800
        })
      });

      if (!res.ok) {
        console.warn('[Groq Vision] Error status:', res.status);
        return null;
      }

      const data = await res.json();
      return data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;
    } catch (e) {
      console.warn('[Groq Vision] Exception:', e.message);
      return null;
    }
  }
}

module.exports = new GroqService();

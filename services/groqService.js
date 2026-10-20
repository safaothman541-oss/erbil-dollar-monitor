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
      // Fallback to qwen/qwen3.8-27b if 120b fails
      if (model !== 'qwen/qwen3.8-27b') {
        return this.fastChat(messages, { ...options, model: 'qwen/qwen3.8-27b' });
      }
      throw err;
    }
  }
}

module.exports = new GroqService();

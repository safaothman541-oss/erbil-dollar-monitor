const groqService = require('../services/groqService');

class SocialContentEngine {
  async generateOmniContent(topicOrDraft) {
    const prompt = `You are the master content strategist and ghostwriter for Safa Othman, an ICT engineer from Erbil Polytechnic University and tech entrepreneur in Kurdistan who builds autonomous AI systems and businesses.

User input/idea:
"${topicOrDraft}"

Generate a complete, viral, high-value 4-platform content package in strictly valid JSON:
{
  "title": "Engaging concept title",
  "linkedin": {
    "language": "Kurdish or English (make it inspiring professional)",
    "text": "Full LinkedIn post with powerful hook, whitespace, bullet points, lessons learned, and 4-5 relevant hashtags"
  },
  "twitter": {
    "thread": [
      "Tweet 1 (Hook that stops scrolling)",
      "Tweet 2 (The breakdown/process)",
      "Tweet 3 (Key insight or metrics)",
      "Tweet 4 (Takeaway & call to follow/discuss)"
    ]
  },
  "shortVideoScript": {
    "hook": "What Safa says in the first 3 seconds to camera",
    "visualCue": "What is shown on screen (e.g. pointing to terminal running code, showing phone receiving automated order)",
    "body": "30-second speech explaining the hack simply",
    "callToAction": "Follow for more real AI engineering"
  },
  "telegramPost": "Clean HTML-formatted post ready to broadcast to Safa's personal Telegram channel or tech group"
}`;

    const messages = [
      { role: 'system', content: 'You are an elite Silicon Valley / European tech personal branding strategist.' },
      { role: 'user', content: prompt }
    ];

    const raw = await groqService.fastChat(messages, { json: true, temperature: 0.6, max_tokens: 2048 });
    return JSON.parse(raw);
  }
}

module.exports = new SocialContentEngine();

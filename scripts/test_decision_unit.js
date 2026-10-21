const config = require('../config.js');

async function testDecision() {
  const elements = [
    { index: 1, label: "Search apps", resourceId: "search_box", center: [475, 140], clickable: true },
    { index: 2, label: "Install", resourceId: "install_button", center: [850, 500], clickable: true },
    { index: 3, label: "Telegram", resourceId: "app_title", center: [375, 500], clickable: true }
  ];

  const systemPrompt = `You are Safa OS Autonomous Android GUI Agent.
User's Ultimate Goal: "تێلیگرام دابەزێنە" (Download/Install Telegram)
Current Step: 1/8

Visible Elements on Screen:
${elements.map(e => `[#${e.index}] "${e.label}" (id: ${e.resourceId}) -> Center: (${e.center[0]}, ${e.center[1]}) [CLICKABLE]`).join('\n')}

Decide the single next action to take to advance towards the goal.
Output strictly valid JSON:
{
  "thought": "Your reasoning in English",
  "action": "tap",
  "targetIndex": number,
  "x": number,
  "y": number,
  "isFinished": boolean,
  "kurdishUpdate": "Short 1-sentence update in Kurdish Sorani for Safa"
}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + config.GROQ_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'You are an autonomous GUI agent. Output strictly valid JSON.' },
        { role: 'user', content: systemPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  const data = await res.json();
  console.log('LLM DECISION:', data.choices[0].message.content);
}

testDecision();

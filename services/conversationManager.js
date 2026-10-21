const fs = require('fs');
const path = require('path');
const config = require('../config');
const codeActAgent = require('./codeActAgent');

const HISTORY_FILE = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'conversation_history.json');
const MAX_HISTORY_TURNS = 16;

class ConversationManager {
  constructor() {
    this.history = [];
    this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        this.history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      } else {
        this.history = [];
      }
    } catch (e) {
      this.history = [];
    }
  }

  saveHistory() {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history.slice(-MAX_HISTORY_TURNS), null, 2), 'utf8');
    } catch (e) {
      console.warn('[ConversationManager] Failed to save history:', e.message);
    }
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  // Pure Code-Act / Shell Agent execution
  async chat(userMessage) {
    try {
      const result = await codeActAgent.run(userMessage, this.history);

      this.history.push({ role: 'user', content: userMessage });
      this.history.push({ role: 'assistant', content: result.reply });
      if (this.history.length > MAX_HISTORY_TURNS) {
        this.history = this.history.slice(-MAX_HISTORY_TURNS);
      }
      this.saveHistory();

      return {
        reply: result.reply,
        actions: result.actions || []
      };
    } catch (err) {
      console.error('[ConversationManager] CodeAct Error:', err.message);
      return {
        reply: `کێشەیەک ڕوویدا لە کاتی جێبەجێکردنی سەربەخۆدا: ${err.message}`,
        actions: []
      };
    }
  }
}

module.exports = new ConversationManager();


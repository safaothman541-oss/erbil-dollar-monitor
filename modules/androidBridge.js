const fs = require('fs');
const path = require('path');
const config = require('../config');

class AndroidBridge {
  constructor() {
    this.queueFile = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'android_queue.json');
    this.statusFile = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'device_status.json');
    this.deviceToken = 'safa_droid_secret_2026';
    this.loadQueue();
  }

  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        this.queue = JSON.parse(fs.readFileSync(this.queueFile, 'utf8'));
      } else {
        this.queue = [];
      }
    } catch (e) {
      this.queue = [];
    }
  }

  saveQueue() {
    try {
      const dir = path.dirname(this.queueFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.queueFile, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (e) {}
  }

  recordHeartbeat(data = {}) {
    const status = {
      online: true,
      lastSeen: new Date().toISOString(),
      battery: data.battery || null,
      charging: data.charging || null,
      ip: data.ip || null
    };
    try {
      const dir = path.dirname(this.statusFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.statusFile, JSON.stringify(status, null, 2), 'utf8');
    } catch (e) {}
    return status;
  }

  getDeviceStatus() {
    try {
      if (fs.existsSync(this.statusFile)) {
        const s = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
        const diffMs = Date.now() - new Date(s.lastSeen).getTime();
        s.online = diffMs < 45000; // online if seen within 45s
        s.secondsAgo = Math.round(diffMs / 1000);
        return s;
      }
    } catch (e) {}
    return { online: false, lastSeen: null, secondsAgo: null };
  }

  queueCommand(type, payload = {}) {
    this.loadQueue();
    // Auto-expire commands older than 3 minutes to keep the queue clean
    const now = Date.now();
    this.queue.forEach(c => {
      if (c.status === 'PENDING' && (now - new Date(c.createdAt).getTime()) > 180000) {
        c.status = 'EXPIRED';
      }
    });

    const cmd = {
      id: 'cmd_' + now,
      type: type.toUpperCase(),
      payload,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.queue.push(cmd);
    this.saveQueue();
    return cmd;
  }

  getPendingCommands() {
    this.loadQueue();
    const now = Date.now();
    // Expire commands older than 2.5 minutes
    this.queue.forEach(c => {
      if (c.status === 'PENDING' && (now - new Date(c.createdAt).getTime()) > 150000) {
        c.status = 'EXPIRED';
      }
    });
    this.saveQueue();
    return this.queue.filter(c => c.status === 'PENDING');
  }

  resolveCommand(cmdId, result) {
    this.loadQueue();
    const cmd = this.queue.find(c => c.id === cmdId);
    if (cmd) {
      cmd.status = 'COMPLETED';
      cmd.result = result;
      cmd.completedAt = new Date().toISOString();
      this.saveQueue();
      return cmd;
    }
    return null;
  }

  async executeCommandAndWait(type, payload = {}, timeoutMs = 8000) {
    const cmd = this.queueCommand(type, payload);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 200));
      this.loadQueue();
      const current = this.queue.find(c => c.id === cmd.id);
      if (current && current.status === 'COMPLETED') {
        const isOk = current.result && current.result.success !== false;
        let resMsg = 'فەرمان بە سەرکەوتوویی جێبەجێ کرا';
        if (current.result) {
          if (current.result.b64message) {
            try {
              resMsg = Buffer.from(current.result.b64message, 'base64').toString('utf8');
            } catch (_) {
              resMsg = current.result.message || resMsg;
            }
          } else if (current.result.message) {
            resMsg = current.result.message;
          }
        }
        return { success: isOk, message: resMsg, result: current.result };
      }
    }

    return { success: false, message: 'مۆبایل لە ماوەی دیاریکراودا وەڵامی نەدایەوە (Timeout)' };
  }

  // Universal action dispatcher compatible with both old and new phone agent daemons
  async executeDeviceAction(action, params = {}, timeoutMs = 8000) {
    if (action === 'tap') {
      const x = params.x;
      const y = params.y;
      return this.executeCommandAndWait('SHELL', { message: `input tap ${x} ${y}` }, timeoutMs);
    }
    if (action === 'key') {
      const code = params.code || params.keyCode || 66;
      return this.executeCommandAndWait('SHELL', { message: `input keyevent ${code}` }, timeoutMs);
    }
    if (action === 'type') {
      const text = params.text || '';
      return this.executeCommandAndWait('TYPE', { message: text, target: text }, timeoutMs);
    }
    if (action === 'open_app') {
      const app = params.app || params.target || 'youtube';
      return this.executeCommandAndWait('APP', { target: app }, timeoutMs);
    }
    if (action === 'screenshot') {
      return this.executeCommandAndWait('SCREENSHOT', {}, timeoutMs);
    }
    return { success: false, message: `کرداری نەناسراو: ${action}` };
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }
}

module.exports = new AndroidBridge();

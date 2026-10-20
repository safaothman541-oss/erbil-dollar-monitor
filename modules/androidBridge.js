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
        s.online = diffMs < 60000; // online if seen within 60s
        s.secondsAgo = Math.round(diffMs / 1000);
        return s;
      }
    } catch (e) {}
    return { online: false, lastSeen: null, secondsAgo: null };
  }

  queueCommand(type, payload = {}) {
    const cmd = {
      id: 'cmd_' + Date.now(),
      type: type.toUpperCase(), // CALL, SMS, GPS, PHOTO, VIBRATE, TORCH, CLIPBOARD, SPEAK, SHELL
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
}

module.exports = new AndroidBridge();

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

  async mirrorToDualCloud(type, payload) {
    const bodyStr = JSON.stringify({
      token: 'safa_droid_secret_2026',
      type,
      payload
    });

    // 1. Mirror to Zoho Catalyst Enterprise
    try {
      fetch('https://project-rainfall-943399015.development.catalystserverless.com/server/vertexwebhook/api/mobile/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        signal: AbortSignal.timeout(3500)
      }).catch(() => {});
    } catch (_) {}

    // 2. Mirror to AlwaysData Cloud
    try {
      fetch('https://safaothman.alwaysdata.net/api/mobile/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        signal: AbortSignal.timeout(3500)
      }).catch(() => {});
    } catch (_) {}
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

    let effectiveType = (type || 'SHELL').toUpperCase();
    const cleanPayload = (typeof payload === 'object' && payload !== null) ? { ...payload } : { message: String(payload || '') };

    // Smart intent mapping: translate raw shell commands to Accessibility Actions
    if (effectiveType === 'SHELL' && cleanPayload.message) {
      const msg = cleanPayload.message;
      if (msg.includes('search_query=')) {
        try {
          const match = msg.match(/search_query=([^"&'\s]+)/);
          if (match && match[1]) {
            effectiveType = 'YOUTUBE';
            const q = decodeURIComponent(match[1]);
            cleanPayload.target = q;
            cleanPayload.message = q;
          }
        } catch (_) {}
      } else if (/keyevent\s+(3|KEYCODE_HOME)/i.test(msg)) {
        effectiveType = 'HOME';
      } else if (/keyevent\s+(4|KEYCODE_BACK)/i.test(msg)) {
        effectiveType = 'BACK';
      } else if (/keyevent\s+(187|KEYCODE_APP_SWITCH)/i.test(msg)) {
        effectiveType = 'RECENTS';
      } else if (/input\s+tap\s+(\d+)\s+(\d+)/i.test(msg)) {
        const m = msg.match(/input\s+tap\s+(\d+)\s+(\d+)/i);
        if (m) {
          effectiveType = 'TAP';
          cleanPayload.target = `${m[1]} ${m[2]}`;
        }
      } else if (/am\s+start.*(?:-p|-n)\s+([a-zA-Z0-9._]+)/i.test(msg)) {
        const m = msg.match(/am\s+start.*(?:-p|-n)\s+([a-zA-Z0-9._]+)/i);
        if (m && m[1]) {
          effectiveType = 'APP';
          cleanPayload.target = m[1].split('/')[0];
        }
      }
    }

    if (!cleanPayload.target && cleanPayload.message) {
      cleanPayload.target = cleanPayload.message;
    }
    if (!cleanPayload.message && cleanPayload.target) {
      cleanPayload.message = cleanPayload.target;
    }

    const cmd = {
      id: 'cmd_' + now,
      type: effectiveType,
      payload: cleanPayload,
      target: cleanPayload.target || '',
      message: cleanPayload.message || '',
      ...cleanPayload,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.queue.push(cmd);
    this.saveQueue();
    this.mirrorToDualCloud(effectiveType, cleanPayload).catch(() => {});
    return cmd;
  }

  getPendingCommands() {
    this.loadQueue();
    const now = Date.now();
    // Expire commands older than 45 seconds to keep queue fresh
    this.queue.forEach(c => {
      if (c.status === 'PENDING' && (now - new Date(c.createdAt).getTime()) > 45000) {
        c.status = 'EXPIRED';
      }
    });
    const pending = this.queue.filter(c => c.status === 'PENDING');
    // Flood prevention: if multiple pending, keep only the latest 1 and expire older ones
    if (pending.length > 1) {
      pending.slice(0, -1).forEach(c => c.status = 'EXPIRED');
      this.saveQueue();
      return [pending[pending.length - 1]];
    }
    this.saveQueue();
    return pending;
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
    const status = this.getDeviceStatus();
    // Resilient timeout: if device is offline, allow quick 1.2s poll window then gracefully queue
    const effectiveTimeout = status.online ? timeoutMs : Math.min(timeoutMs, 1200);
    const start = Date.now();

    while (Date.now() - start < effectiveTimeout) {
      await new Promise(r => setTimeout(r, 200));
      this.loadQueue();
      let current = this.queue.find(c => c.id === cmd.id);

      // Also check Catalyst cloud status if not resolved locally yet
      if ((!current || current.status !== 'COMPLETED') && (Date.now() - start) > 1200) {
        try {
          const catRes = await fetch(`https://project-rainfall-943399015.development.catalystserverless.com/server/vertexwebhook/api/mobile/status?token=safa_droid_secret_2026&cmdId=${cmd.id}`, { signal: AbortSignal.timeout(1000) });
          if (catRes.ok) {
            const catData = await catRes.json();
            if (catData && catData.status === 'COMPLETED') {
              this.resolveCommand(cmd.id, catData.result || { success: true });
              current = this.queue.find(c => c.id === cmd.id);
            }
          }
        } catch (_) {}
      }

      if (current && current.status === 'COMPLETED') {
        const isOk = current.result && current.result.success !== false;
        let resMsg = 'فەرمانەکە بە سەرکەوتوویی جێبەجێ کرا';
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

    if (!status.online) {
      return {
        success: false,
        queued: true,
        message: `مۆبایل لەم ساتەدا بەردەست نییە، فەرمانی ${type} خرایە ڕیزەوە تا ئەوکاتەی پەیوەست دەبێتەوە`
      };
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

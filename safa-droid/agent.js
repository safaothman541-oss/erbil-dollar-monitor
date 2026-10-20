#!/usr/bin/env node
/**
 * Safa OS - Android Autonomous Agent (SafaDroid)
 * Runs locally on Android via Termux to give Safa OS complete hardware & OS control!
 */

const { exec } = require('child_process');
const https = require('https');

const SERVER_URL = 'https://safaothman.alwaysdata.net';
const TOKEN = 'safa_droid_secret_2026';
const POLL_INTERVAL_MS = 2500;

console.log('🤖 [SafaDroid] Starting Android Autonomous Agent for Safa OS...');
console.log(`📡 Connected to Cloud Core: ${SERVER_URL}`);

function runShell(command) {
  return new Promise((resolve) => {
    exec(command, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return resolve({ success: false, error: err.message, stderr });
      resolve({ success: true, output: (stdout || '').trim() });
    });
  });
}

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

async function getBatteryInfo() {
  const res = await runShell('termux-battery-status');
  if (res.success) {
    try {
      const parsed = JSON.parse(res.output);
      return {
        battery: parsed.percentage,
        charging: parsed.status === 'CHARGING'
      };
    } catch (e) {}
  }
  return { battery: null, charging: null };
}

async function executeCommand(cmd) {
  console.log(`⚡ [SafaDroid] Executing Command #${cmd.id} (${cmd.type})...`);
  const { type, payload } = cmd;
  let result = {};

  try {
    switch (type) {
      case 'CALL': {
        const number = payload.number || payload.target;
        await runShell(`termux-telephony-call ${number}`);
        result = { success: true, message: `پەیوەندی بەسترا بە ${number}` };
        break;
      }
      case 'SMS': {
        const number = payload.number || payload.target;
        const msg = (payload.message || payload.text || '').replace(/"/g, '\\"');
        await runShell(`termux-sms-send -n ${number} "${msg}"`);
        result = { success: true, message: `نامەی کورت (SMS) نێردرا بۆ ${number}` };
        break;
      }
      case 'SPEAK': {
        const text = (payload.text || payload.message || '').replace(/"/g, '\\"');
        await runShell(`termux-tts-speak "${text}"`);
        result = { success: true, message: 'دەنگ لە بڵندگۆی مۆبایلەکەوە خوێندرایەوە.' };
        break;
      }
      case 'GPS': {
        const loc = await runShell('termux-location -p network');
        result = { success: true, location: loc.output };
        break;
      }
      case 'VIBRATE': {
        const dur = payload.duration || 1000;
        await runShell(`termux-vibrate -d ${dur}`);
        result = { success: true, message: 'مۆبایلەکە لەرینەوەی (Vibrate) کرد.' };
        break;
      }
      case 'TORCH': {
        const state = payload.state === 'off' ? 'off' : 'on';
        await runShell(`termux-torch ${state}`);
        result = { success: true, message: `فلاشی مۆبایل ${state} کرا.` };
        break;
      }
      case 'CLIPBOARD': {
        if (payload.text) {
          await runShell(`termux-clipboard-set "${payload.text.replace(/"/g, '\\"')}"`);
          result = { success: true, message: 'دەق خرایە ناو کلیپبۆردی مۆبایل.' };
        } else {
          const clip = await runShell('termux-clipboard-get');
          result = { success: true, clipboard: clip.output };
        }
        break;
      }
      case 'PHOTO': {
        await runShell('termux-camera-photo -c 0 safa_cam.jpg');
        result = { success: true, message: 'وێنە گیرا و پارێزرا.' };
        break;
      }
      case 'SHELL': {
        const out = await runShell(payload.command);
        result = { success: out.success, output: out.output || out.error };
        break;
      }
      default:
        result = { success: false, error: 'Unknown command type: ' + type };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  // Report back to Cloud Core
  await postJson(`${SERVER_URL}/api/mobile/result`, {
    token: TOKEN,
    cmdId: cmd.id,
    result
  }).catch(e => console.error('[SafaDroid] Result report error:', e.message));

  console.log(`✅ [SafaDroid] Finished Command #${cmd.id}`);
}

async function loop() {
  try {
    const batt = await getBatteryInfo();
    const pollUrl = `${SERVER_URL}/api/mobile/poll?token=${TOKEN}&battery=${batt.battery || ''}&charging=${batt.charging !== null ? batt.charging : ''}`;
    const res = await getJson(pollUrl);

    if (res && res.commands && res.commands.length > 0) {
      for (const cmd of res.commands) {
        await executeCommand(cmd);
      }
    }
  } catch (e) {
    // Ignore network hiccups
  }

  setTimeout(loop, POLL_INTERVAL_MS);
}

// Start polling
loop();

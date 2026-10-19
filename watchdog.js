const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🛡️ [Watchdog] Starting Vertex Hub Bot Supervisor (24/7 Auto-Respawn)...');

let currentChild = null;

function startProcess() {
  currentChild = spawn(process.execPath, [path.join(__dirname, 'bot_interactive.js')], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });

  currentChild.on('exit', (code, signal) => {
    console.warn(`⚠️ [Watchdog] bot_interactive.js exited with code ${code} / signal ${signal}.`);
    console.log('🔄 [Watchdog] Respawning bot in 3 seconds...');
    currentChild = null;
    setTimeout(startProcess, 3000);
  });

  currentChild.on('error', (err) => {
    console.error('❌ [Watchdog] Child process error:', err.message);
  });
}

// Watch tmp/restart.txt for touch restarts
const restartFile = path.join(__dirname, 'tmp', 'restart.txt');
try {
  if (!fs.existsSync(path.dirname(restartFile))) {
    fs.mkdirSync(path.dirname(restartFile), { recursive: true });
  }
  if (!fs.existsSync(restartFile)) {
    fs.writeFileSync(restartFile, Date.now().toString());
  }
  fs.watchFile(restartFile, { interval: 1000 }, () => {
    console.log('🔄 [Watchdog] Detected change in restart.txt. Restarting bot_interactive.js...');
    if (currentChild) {
      currentChild.kill('SIGTERM');
    }
  });
} catch (e) {
  console.warn('[Watchdog] Could not setup file watcher on restart.txt:', e.message);
}

startProcess();

const { spawn } = require('child_process');
const path = require('path');

console.log('🛡️ [Watchdog] Starting Vertex Hub Bot Supervisor (24/7 Auto-Respawn)...');

function startProcess() {
  const child = spawn(process.execPath, [path.join(__dirname, 'bot_interactive.js')], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code, signal) => {
    console.warn(`⚠️ [Watchdog] bot_interactive.js exited with code ${code} / signal ${signal}.`);
    console.log('🔄 [Watchdog] Respawning bot in 3 seconds...');
    setTimeout(startProcess, 3000);
  });

  child.on('error', (err) => {
    console.error('❌ [Watchdog] Child process error:', err.message);
  });
}

startProcess();

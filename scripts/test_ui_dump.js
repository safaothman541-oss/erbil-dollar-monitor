const fs = require('fs');
const https = require('https');

const SERVER_URL = 'https://safaothman.alwaysdata.net';
const TOKEN = 'safa_droid_secret_2026';

// Queue a command on the server
async function test() {
  const cmd = {
    id: 'test_dump_' + Date.now(),
    type: 'SHELL',
    payload: {
      message: 'export RISH_APPLICATION_ID="com.termux"; rish -c "uiautomator dump /sdcard/Download/test_ui.xml" && ls -lh /sdcard/Download/test_ui.xml'
    },
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  // Push directly to AlwaysData state via ssh or queue helper
  console.log('Command payload ready');
}

test();

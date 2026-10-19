let lastWebhookData = null;
let lastWebhookError = null;
let lastWebhookLogs = [];

function log(msg) {
  lastWebhookLogs.push({ time: new Date().toISOString(), msg });
  if (lastWebhookLogs.length > 20) lastWebhookLogs.shift();
  console.log(msg);
}

module.exports = {
  recordWebhook: (data, err = null) => {
    lastWebhookData = data;
    lastWebhookError = err ? err.message || String(err) : null;
  },
  getDebugInfo: () => ({
    lastWebhookData,
    lastWebhookError,
    lastWebhookLogs
  }),
  log
};

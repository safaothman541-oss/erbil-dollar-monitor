const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const whatsappServer = require('./services/whatsappServer');

async function main() {
  console.log('🚀 Starting Vertex WhatsApp Server on port ' + config.WHATSAPP.PORT + '...');
  const server = whatsappServer.start();

  console.log('🌐 Launching Cloudflare Tunnel for http://localhost:' + config.WHATSAPP.PORT + '...');
  const cf = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${config.WHATSAPP.PORT}`]);

  let publicUrl = null;

  cf.stderr.on('data', async (chunk) => {
    const text = chunk.toString();
    // Look for trycloudflare.com URL
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicUrl) {
      publicUrl = match[0];
      const webhookUrl = `${publicUrl}/webhook`;
      console.log('\n======================================================');
      console.log('🎉 CLOUDFLARE TUNNEL IS LIVE & CONNECTED!');
      console.log(`🔗 Public Webhook URL : ${webhookUrl}`);
      console.log(`🔑 Verify Token        : ${config.WHATSAPP.VERIFY_TOKEN}`);
      console.log('======================================================\n');

      // Save to state file
      const stateDir = path.join(__dirname, 'state');
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(path.join(stateDir, 'tunnel_url.json'), JSON.stringify({
        url: publicUrl,
        webhookUrl: webhookUrl,
        verifyToken: config.WHATSAPP.VERIFY_TOKEN,
        startedAt: new Date().toISOString()
      }, null, 2), 'utf8');

      // Test verification through public tunnel
      try {
        console.log('🧪 Testing public Webhook verification through Cloudflare...');
        const testRes = await fetch(`${webhookUrl}?hub.mode=subscribe&hub.verify_token=${config.WHATSAPP.VERIFY_TOKEN}&hub.challenge=VERTEX_VERIFIED`);
        const testText = await testRes.text();
        if (testText === 'VERTEX_VERIFIED') {
          console.log('✅ Webhook verification test PASSED 100%! Ready for Meta Dashboard configuration.\n');
        } else {
          console.log('⚠️ Verification response:', testText);
        }
      } catch (e) {
        console.error('Test error:', e.message);
      }
    }
  });

  cf.on('close', (code) => {
    console.log(`Cloudflare process exited with code ${code}`);
  });
}

main().catch(console.error);

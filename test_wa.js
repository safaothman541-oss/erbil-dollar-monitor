const token = 'EAAHLzAavh1EBS9VllZBub6vCMK8FKVbNu1F90Dl8rFwU1lvD3ZBqABrezycXVc6oNVzsRZBhc1iocb2ZBFn127uaDAbconB835AoAO3VCnwAEvZCzrPLWpC7Pn3YqFmZCzR8T1o5SevMAs6F6yG2I5kaC96xrzvnbnWjCHsDjBDoNaHbqRsKHzFO7S3uu1Bs1RwqO61RwDadgO5ZBPbc14KLp8Jm8JEjKQ2lYvt4DDiZAFX3HxOtMN24ZASbjilROrlsCckMbKMQPMxfssKFVxSGfOqZBOZCtn0YW8mqJqLDfgZD';
const phoneId = '1411075905419124';

async function sendTest() {
  const payload = {
    messaging_product: 'whatsapp',
    to: '9647507586992',
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' }
    }
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    console.log('Send result:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

sendTest();

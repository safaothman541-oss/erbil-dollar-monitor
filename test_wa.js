const token = 'EAAHLzAavh1EBS58yuNbEXhjTFqqNpwPiv4LNRBgja2W3ARHfUZBBcuobVLmzd6pOYCPNGm5rZCrQZAZAdU4mmfrku180IC8EmqGEDF8wYtGm82oxIUipSELiYLmegKSimBb0okjBrSOO1l15fZAKJiVlOVQOzyuBRbZBMeTclZBqr2lLhoHWyU2VtrmZAVHFxLOmigZDZD';
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

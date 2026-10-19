const http = require('http');
const fs = require('fs');
const path = require('path');

http.get('http://localhost:3000/', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const match = d.match(/data:image\/png;base64,([^"']+)/);
    if (match) {
      const outPath = path.join(__dirname, '..', 'state', 'current_qr.png');
      fs.writeFileSync(outPath, Buffer.from(match[1], 'base64'));
      console.log('Saved QR image to:', outPath);
    } else {
      console.log('No QR image found yet in HTML');
    }
  });
});

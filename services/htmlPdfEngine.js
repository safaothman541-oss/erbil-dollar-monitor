const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getBrowserPath() {
  if (os.platform() === 'win32') {
    const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    if (fs.existsSync(edge)) return edge;
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(chrome)) return chrome;
  } else {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/microsoft-edge'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

function convertHtmlToPdf(htmlContent, outputPath) {
  const browser = getBrowserPath();
  if (!browser) {
    throw new Error('No Chromium-based browser found for PDF rendering.');
  }

  const tempHtml = path.join(os.tmpdir(), `temp_pdf_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
  fs.writeFileSync(tempHtml, htmlContent, 'utf8');

  try {
    const cmd = `"${browser}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPath}" "file://${tempHtml.replace(/\\/g, '/')}"`;
    execSync(cmd, { timeout: 30000, stdio: 'ignore' });
  } finally {
    try { fs.unlinkSync(tempHtml); } catch (e) {}
  }

  return outputPath;
}

module.exports = {
  convertHtmlToPdf,
  getBrowserPath
};

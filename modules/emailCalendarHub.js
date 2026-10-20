const fs = require('fs');
const path = require('path');
const tls = require('tls');
const config = require('../config');

class EmailCalendarHub {
  constructor() {
    this.configFile = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'email_calendar_config.json');
    this.eventsFile = path.join(config.STATE_DIR || path.join(__dirname, '..', 'state'), 'calendar_events.json');
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        this.config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
      } else {
        this.config = {
          emailAddress: '',
          emailProvider: 'gmail', // gmail, outlook, custom
          appPassword: '',
          lastChecked: null
        };
      }
    } catch (e) {
      this.config = {};
    }
  }

  saveConfig() {
    try {
      const dir = path.dirname(this.configFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {}
  }

  // --- Calendar Engine ---

  // Generate universal .ics iCalendar file that iOS and Android tap to add in 1 click!
  generateIcsFile(title, startDateStr, durationMinutes = 60, description = '') {
    let startDate;
    try {
      startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() + 3600000);
      if (isNaN(startDate.getTime())) startDate = new Date(Date.now() + 3600000);
    } catch (e) {
      startDate = new Date(Date.now() + 3600000);
    }

    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');
    const toIcsDate = (d) => {
      return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
      );
    };

    const uid = 'safa-os-' + Date.now() + '@safa.iq';
    const nowStr = toIcsDate(new Date());
    const startStr = toIcsDate(startDate);
    const endStr = toIcsDate(endDate);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Safa OS//Autonomous Chief of Staff//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${title.replace(/[\r\n]+/g, ' ')}`,
      `DESCRIPTION:${(description || 'تۆمارکراوە لەلایەن Safa OS (Chief of Staff)').replace(/[\r\n]+/g, '\\n')}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const outDir = config.STATE_DIR || path.join(__dirname, '..', 'state');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `event_${Date.now()}.ics`);
    fs.writeFileSync(outPath, icsContent, 'utf8');

    // Also record in local calendar state
    const events = this.loadEvents();
    events.unshift({
      id: events.length + 1,
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      description: description || '',
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(this.eventsFile, JSON.stringify(events, null, 2), 'utf8');

    return {
      filePath: outPath,
      event: events[0],
      googleCalendarUrl: this.getGoogleCalendarUrl(title, startDate, endDate, description)
    };
  }

  // Google Calendar 1-Click URL (Opens Web/App directly with prefilled event)
  getGoogleCalendarUrl(title, startDate, endDate, description = '') {
    const pad = (n) => String(n).padStart(2, '0');
    const toGCalDate = (d) => {
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      return (
        dateObj.getUTCFullYear() +
        pad(dateObj.getUTCMonth() + 1) +
        pad(dateObj.getUTCDate()) +
        'T' +
        pad(dateObj.getUTCHours()) +
        pad(dateObj.getUTCMinutes()) +
        pad(dateObj.getUTCSeconds()) +
        'Z'
      );
    };

    const startStr = toGCalDate(startDate);
    const endStr = toGCalDate(endDate);
    const encodedTitle = encodeURIComponent(title);
    const encodedDetails = encodeURIComponent(description || 'تۆمارکراوە لەلایەن Safa OS');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${startStr}/${endStr}&details=${encodedDetails}`;
  }

  // Gmail 1-Click Direct Compose URL
  getGmailComposeUrl(to, subject, body) {
    const encodedTo = encodeURIComponent(to || '');
    const encodedSub = encodeURIComponent(subject || '');
    const encodedBody = encodeURIComponent(body || '');
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSub}&body=${encodedBody}`;
  }

  loadEvents() {
    try {
      if (fs.existsSync(this.eventsFile)) {
        return JSON.parse(fs.readFileSync(this.eventsFile, 'utf8'));
      }
    } catch (e) {}
    return [];
  }

  getUpcomingEvents() {
    const events = this.loadEvents();
    const now = new Date();
    return events.filter(e => new Date(e.end || e.start) >= now).slice(0, 10);
  }

  // --- Email Status & Config ---
  getStatus() {
    const isConfigured = !!(this.config.emailAddress && this.config.appPassword);
    return {
      emailConfigured: isConfigured,
      emailAddress: this.config.emailAddress || 'دیاری نەکراوە',
      provider: this.config.emailProvider || 'Gmail',
      upcomingEventsCount: this.getUpcomingEvents().length,
      events: this.getUpcomingEvents()
    };
  }

  configureEmail(email, appPassword, provider = 'gmail') {
    this.config.emailAddress = (email || '').trim().toLowerCase();
    this.config.appPassword = (appPassword || '').trim().replace(/\s+/g, '');
    this.config.emailProvider = provider.toLowerCase();
    this.saveConfig();
    return true;
  }

  // Direct IMAP Fetch via TLS (Pure Node.js - Zero external npm packages required)
  async fetchRecentUnreadEmails(limit = 5) {
    if (!this.config.emailAddress || !this.config.appPassword) {
      return {
        success: false,
        message: 'ئیمەیڵ و App Password ڕێک نەخراون. تکایە بە فەرمانی /connect_email ڕێکی بخە.'
      };
    }

    const host = this.config.emailProvider === 'outlook' ? 'outlook.office365.com' : 'imap.gmail.com';
    const port = 993;

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { socket.destroy(); } catch (e) {}
          resolve({ success: false, message: 'کاتی چاوەڕوانی تێپەڕی (Connection Timeout).' });
        }
      }, 10000);

      const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {
        let step = 'WELCOME';
        let buffer = '';
        const emails = [];

        socket.on('data', (data) => {
          buffer += data.toString('utf8');

          if (step === 'WELCOME' && buffer.includes('* OK')) {
            buffer = '';
            step = 'LOGIN';
            socket.write(`A1 LOGIN "${this.config.emailAddress}" "${this.config.appPassword}"\r\n`);
          } else if (step === 'LOGIN') {
            if (buffer.includes('A1 OK')) {
              buffer = '';
              step = 'SELECT';
              socket.write(`A2 SELECT INBOX\r\n`);
            } else if (buffer.includes('A1 NO') || buffer.includes('A1 BAD')) {
              cleanup({ success: false, message: 'تێپەڕەوشە یان ئەپ پاcloud ڕەتکرایەوە (Authentication Failed).' });
            }
          } else if (step === 'SELECT' && buffer.includes('A2 OK')) {
            buffer = '';
            step = 'SEARCH';
            socket.write(`A3 SEARCH UNSEEN\r\n`);
          } else if (step === 'SEARCH' && buffer.includes('A3 OK')) {
            const match = buffer.match(/\* SEARCH ([\d\s]+)/);
            buffer = '';
            if (!match || !match[1].trim()) {
              // No unread emails
              cleanup({ success: true, count: 0, emails: [] });
            } else {
              const ids = match[1].trim().split(/\s+/).slice(-limit).join(',');
              step = 'FETCH';
              socket.write(`A4 FETCH ${ids} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])\r\n`);
            }
          } else if (step === 'FETCH' && buffer.includes('A4 OK')) {
            // Parse headers
            const rawItems = buffer.split(/\* \d+ FETCH/);
            for (const item of rawItems) {
              const fromMatch = item.match(/From:\s*([^\r\n]+)/i);
              const subjectMatch = item.match(/Subject:\s*([^\r\n]+)/i);
              const dateMatch = item.match(/Date:\s*([^\r\n]+)/i);
              if (fromMatch || subjectMatch) {
                emails.push({
                  from: fromMatch ? fromMatch[1].trim() : 'نەزانراو',
                  subject: subjectMatch ? subjectMatch[1].trim() : '(بێ سەردێڕ)',
                  date: dateMatch ? dateMatch[1].trim() : ''
                });
              }
            }
            cleanup({ success: true, count: emails.length, emails });
          }
        });

        socket.on('error', (err) => {
          cleanup({ success: false, message: err.message });
        });

        function cleanup(result) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          try {
            socket.write('A5 LOGOUT\r\n');
            socket.end();
          } catch (e) {}
          resolve(result);
        }
      });
    });
  }
}

module.exports = new EmailCalendarHub();

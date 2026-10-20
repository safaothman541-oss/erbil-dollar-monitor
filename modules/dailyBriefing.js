const config = require('../config');
const secondBrain = require('./secondBrain');

class DailyBriefing {
  // Weather code to Kurdish description & emoji
  decodeWeather(code) {
    if (code === 0) return '☀️ ساماڵ و ئارام';
    if (code === 1 || code === 2) return '🌤 کەمێک هەور';
    if (code === 3) return '☁️ هەور';
    if (code >= 45 && code <= 48) return '🌫 تەمومژ';
    if (code >= 51 && code <= 67) return '🌧 باراناوی';
    if (code >= 71 && code <= 77) return '❄️ بەفراوی';
    if (code >= 80 && code <= 82) return '🌦 بارانی بەخوڕ';
    if (code >= 95) return '⛈ بروسکە و باران';
    return '🌤 ئاسایی';
  }

  async getErbilWeather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${config.LOCATION.LATITUDE}&longitude=${config.LOCATION.LONGITUDE}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia%2FBaghdad`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const data = await res.json();
      const cur = data.current;
      return {
        temp: Math.round(cur.temperature_2m),
        feelsLike: Math.round(cur.apparent_temperature),
        condition: this.decodeWeather(cur.weather_code),
        wind: cur.wind_speed_10m
      };
    } catch (e) {
      return null;
    }
  }

  async getVertexStatus() {
    try {
      const res = await fetch(config.VERTEX.ALWAYSDATA_STATUS_URL, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return { server: 'offline', wa: false };
      const data = await res.json();
      return {
        server: 'online',
        wa: data.connected === true,
        user: data.user || null
      };
    } catch (e) {
      return { server: 'offline', wa: false };
    }
  }

  async generateExecutiveBriefing() {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('ku-IQ', {
      timeZone: config.LOCATION.TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const [weather, vertex] = await Promise.all([
      this.getErbilWeather(),
      this.getVertexStatus()
    ]);

    const pendingTasks = secondBrain.getPendingTasks();
    const expenses = secondBrain.getExpensesSummary();

    let msg = `🌅 <b>ڕاپۆرتی بەیانیانی سەرکردایەتی - Safa OS</b>\n`;
    msg += `📅 <b>بەروار:</b> ${dateFormatted}\n`;
    msg += `📍 <b>شوێن:</b> هەولێری پایتەخت\n\n`;

    // 1. Weather
    if (weather) {
      msg += `🌤 <b>کەشوهەوای هەولێر:</b> ${weather.temp}°C (${weather.condition}) | هەستپێکراو: ${weather.feelsLike}°C\n\n`;
    }

    // 2. Vertex Business & Infrastructure Health
    msg += `🏢 <b>دۆخی سێرڤەر و کۆمپانیای VERTEX:</b>\n`;
    msg += `• سێرڤەری کلاود: ${vertex.server === 'online' ? '🟢 چالاکە (Online)' : '🔴 ناچالاکە'}\n`;
    msg += `• واتسئاپ بزنس: ${vertex.wa ? `🟢 بەستراوە (${vertex.user})` : '⚠️ پچڕاوە'}\n`;
    msg += `• وێبسایت: 🟢 <a href="${config.VERTEX.WEB_PORTAL_URL}">پۆرتاڵی کاشێر و مارکێت</a>\n\n`;

    // 3. Tasks & Operations
    msg += `📋 <b>ئەرک و کارە چاوەڕوانکراوەکانی ئەمڕۆ:</b>\n`;
    if (pendingTasks.length === 0) {
      msg += `• هەموو ئەرکەکانت تەواو کراون! دەتوانیت سەرنج بخەیتە سەر پەرەپێدانی نوێ 🎯\n\n`;
    } else {
      pendingTasks.slice(0, 4).forEach((t, i) => {
        const priorityBadge = t.priority.includes('High') || t.priority.includes('بەپەلە') ? '🔴' : '🟡';
        msg += `${i + 1}. ${priorityBadge} <b>${t.task}</b> ${t.dueDate ? `(${t.dueDate})` : ''}\n`;
      });
      if (pendingTasks.length > 4) {
        msg += `... وە ${pendingTasks.length - 4} ئەرکی تر لە چاوەڕوانیدان.\n\n`;
      } else {
        msg += `\n`;
      }
    }

    // 4. Financial Pulse
    msg += `💰 <b>پووختەی دارایی ئەم مانگە:</b>\n`;
    msg += `• کۆی خەرجی تۆمارکراو: <b>${expenses.totalIQD.toLocaleString()} د.ع</b>`;
    if (expenses.totalUSD > 0) msg += ` + <b>$${expenses.totalUSD.toLocaleString()}</b>`;
    msg += `\n\n`;

    msg += `💡 <i>«هێزی تۆ لە کۆدنوسین نییە تەنها، لەوەدایە کە کۆدەکەت ژیانت و بیزنسەکەت بە تەواوی ئۆتۆماتیک بکات.»</i>`;

    return msg;
  }
}

module.exports = new DailyBriefing();

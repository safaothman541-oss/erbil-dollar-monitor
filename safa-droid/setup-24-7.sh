#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️ Safa OS - 24/7 Background Auto-Installer"
echo "👑 بۆ ئەندازیار کاکە سەفا"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Acquire Wake Lock (Prevents Android CPU sleep)
echo "⚡ چالاککردنی ڕاگرتنی خەوی پڕۆسێسەر (Wake Lock)..."
termux-wake-lock 2>/dev/null || true

# 2. Download latest agent.sh
echo "📥 دابەزاندنی دوایین بریکاری فەرمی..."
curl -s https://safaothman.alwaysdata.net/safa-droid.sh -o $HOME/agent.sh
chmod +x $HOME/agent.sh

# 3. Create auto-boot script directory (Termux:Boot standard)
mkdir -p $HOME/.termux/boot

cat << 'EOF' > $HOME/.termux/boot/start-safa-os.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
while true; do
  bash $HOME/agent.sh
  sleep 3
done
EOF
chmod +x $HOME/.termux/boot/start-safa-os.sh

# 4. Create persistent background supervisor
cat << 'EOF' > $HOME/run-daemon.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
pkill -9 -f "agent.sh" 2>/dev/null || true
pkill -9 -f "start-safa-os.sh" 2>/dev/null || true
pkill -9 -f "termux-tts-speak" 2>/dev/null || true
sleep 1
nohup bash $HOME/.termux/boot/start-safa-os.sh >/dev/null 2>&1 &
echo "🟢 بریکاری SafaDroid بە سەرکەوتوویی لە پاشبنەما (Background) کەوتە کار بۆ ۲٤/۷!"
EOF
chmod +x $HOME/run-daemon.sh

# 5. Launch immediately
bash $HOME/run-daemon.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 پیرۆزە! سیستەمەکە ئێستا لە باکگراوند کار دەکات."
echo "📌 هەنگاوی کۆتایی لە سێتینگی مۆبایلت:"
echo "   بڕۆ بۆ Settings -> Apps -> Termux -> Battery"
echo "   و بیکە بە Unrestricted (بێ سنووردارکردن)."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

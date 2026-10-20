#!/data/data/com.termux/files/usr/bin/bash
# Safa OS - Pure Bash Android Autonomous Agent
SERVER_URL="https://safaothman.alwaysdata.net"
TOKEN="safa_droid_secret_2026"
POLL_INTERVAL=2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Safa OS - Android Agent (Bash Native)"
echo "👑 خاوەن: کاکە سەفا (Chief of Staff)"
echo "🟢 بە سەرکەوتوویی پەیوەست بوو بە Safa OS!"
echo "📡 چاوەڕوانی فەرمانە لە تێلیگرامەوە..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  RESP=$(curl -s --max-time 6 "$SERVER_URL/api/mobile/poll?token=$TOKEN" 2>/dev/null)
  
  if echo "$RESP" | grep -q '"commands":\[' && ! echo "$RESP" | grep -q '"commands":\[\]'; then
    # Extract command type and id using grep/sed
    CMD_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    CMD_TYPE=$(echo "$RESP" | grep -o '"type":"[^"]*"' | head -n1 | cut -d'"' -f4)
    TARGET=$(echo "$RESP" | grep -o '"target":"[^"]*"' | head -n1 | cut -d'"' -f4)
    MESSAGE=$(echo "$RESP" | grep -o '"message":"[^"]*"' | head -n1 | cut -d'"' -f4)
    
    echo "⚡ فەرمانی نوێ هات: $CMD_TYPE بۆ $CMD_ID"
    MSG_OUT="فەرمان جێبەجێ کرا"

    case "$CMD_TYPE" in
      CALL)
        if [ -n "$TARGET" ]; then
          termux-telephony-call "$TARGET" 2>/dev/null
          MSG_OUT="پەیوەندی تەلەفۆنی بەسترا بە $TARGET"
        fi
        ;;
      SMS)
        termux-sms-send -n "$TARGET" "$MESSAGE" 2>/dev/null
        MSG_OUT="نامەی کورت نێردرا بۆ $TARGET"
        ;;
      SPEAK)
        termux-tts-speak "$MESSAGE" 2>/dev/null
        MSG_OUT="دەنگ خوێندرایەوە لە بڵندگۆ: $MESSAGE"
        ;;
      VIBRATE)
        termux-vibrate -d 1000 2>/dev/null
        MSG_OUT="مۆبایلەکە لەرینەوەی کرد"
        ;;
      TORCH)
        termux-torch on 2>/dev/null
        sleep 2
        termux-torch off 2>/dev/null
        MSG_OUT="فلاشی مۆبایل داگیرسا و کوژایەوە"
        ;;
      GPS)
        LOC=$(termux-location -p network 2>/dev/null)
        MSG_OUT="شوێنی GPS: $LOC"
        ;;
      *)
        MSG_OUT="فەرمانی $CMD_TYPE جێبەجێ کرا"
        ;;
    esac

    # Report back
    curl -s --max-time 6 -X POST "$SERVER_URL/api/mobile/result" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"$TOKEN\",\"cmdId\":\"$CMD_ID\",\"result\":{\"success\":true,\"message\":\"$MSG_OUT\"}}" >/dev/null 2>&1
    
    echo "✅ فەرمان بە سەرکەوتوویی تەواو بوو: $MSG_OUT"
  fi

  sleep $POLL_INTERVAL
done

#!/data/data/com.termux/files/usr/bin/bash
# Safa OS - Advanced Android Screen & Hardware Agent
SERVER_URL="https://safaothman.alwaysdata.net"
TOKEN="safa_droid_secret_2026"
POLL_INTERVAL=2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Safa OS - Android UI & Screen Agent"
echo "👑 خاوەن: ئەندازیار کاکە سەفا"
echo "🟢 بە سەرکەوتوویی پەیوەست بوو بە Safa OS!"
echo "📡 چاوەڕوانی فەرمانی شاشە و دەنگە..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  RESP=$(curl -s --max-time 6 "$SERVER_URL/api/mobile/poll?token=$TOKEN" 2>/dev/null)
  
  if echo "$RESP" | grep -q '"commands":\[' && ! echo "$RESP" | grep -q '"commands":\[\]'; then
    CMD_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    CMD_TYPE=$(echo "$RESP" | grep -o '"type":"[^"]*"' | head -n1 | cut -d'"' -f4)
    TARGET=$(echo "$RESP" | grep -o '"target":"[^"]*"' | head -n1 | cut -d'"' -f4)
    MESSAGE=$(echo "$RESP" | grep -o '"message":"[^"]*"' | head -n1 | cut -d'"' -f4)
    
    echo "⚡ جێبەجێکردنی فەرمانی سەر شاشە: $CMD_TYPE"
    MSG_OUT="فەرمان جێبەجێ کرا"

    case "$CMD_TYPE" in
      CAMERA)
        # 1. Open the real Camera app right on screen in front of Safa's eyes!
        am start -a android.media.action.STILL_IMAGE_CAMERA >/dev/null 2>&1
        sleep 2
        # 2. Press shutter key to take picture
        input keyevent 27 2>/dev/null || input keyevent 24 2>/dev/null || true
        # 3. Also capture directly to DCIM
        termux-camera-photo -c 0 /sdcard/DCIM/Camera/safa_$(date +%s).jpg 2>/dev/null || true
        MSG_OUT="کامێرای مۆبایلەکەت لەسەر شاشە کرایەوە و وێنە گیرا 📸"
        ;;

      TYPE)
        # Type directly onto whatever input box is active on screen!
        if [ -n "$MESSAGE" ]; then
          # Set to clipboard first
          termux-clipboard-set "$MESSAGE" 2>/dev/null || true
          # Android input text uses %s for space
          ESCAPED_TEXT=$(echo "$MESSAGE" | sed 's/ /%s/g')
          input text "$ESCAPED_TEXT" 2>/dev/null || input keyevent 279 2>/dev/null || true
          MSG_OUT="دەقی «$MESSAGE» لەسەر شاشەی مۆبایلت نووسرا ⌨️"
        fi
        ;;

      APP)
        # Open apps directly on screen
        APP_NAME=$(echo "$TARGET" | tr '[:upper:]' '[:lower:]')
        case "$APP_NAME" in
          youtube|یوتیوب)
            monkey -p com.google.android.youtube 1 >/dev/null 2>&1 || am start -a android.intent.action.VIEW -d "vnd.youtube:" >/dev/null 2>&1
            MSG_OUT="ئەپی YouTube لەسەر شاشە کرایەوە 🎬"
            ;;
          whatsapp|واتسئاپ|واتساب)
            monkey -p com.whatsapp 1 >/dev/null 2>&1
            MSG_OUT="ئەپی WhatsApp لەسەر شاشە کرایەوە 💬"
            ;;
          chrome|کرۆم|گووگڵ)
            am start -n com.android.chrome/com.google.android.apps.chrome.Main >/dev/null 2>&1 || monkey -p com.android.chrome 1 >/dev/null 2>&1
            MSG_OUT="وێبگەڕی Chrome لەسەر شاشە کرایەوە 🌐"
            ;;
          settings|سێتینگ|ڕێکخستن)
            am start -a android.settings.SETTINGS >/dev/null 2>&1
            MSG_OUT="سێتینگی مۆبایل لەسەر شاشە کرایەوە ⚙️"
            ;;
          calculator|کالکۆلەیتەر|حاسیبە)
            am start -a android.intent.action.MAIN -c android.intent.category.APP_CALCULATOR >/dev/null 2>&1 || monkey -p com.google.android.calculator 1 >/dev/null 2>&1
            MSG_OUT="ئەپی حاسیبە لەسەر شاشە کرایەوە 🔢"
            ;;
          *)
            monkey -p "$TARGET" 1 >/dev/null 2>&1 || am start -a android.intent.action.VIEW -d "$TARGET" >/dev/null 2>&1
            MSG_OUT="ئەپی $TARGET لەسەر شاشە کرایەوە 📱"
            ;;
        esac
        ;;

      HOME)
        # Press Home button
        input keyevent 3 2>/dev/null
        MSG_OUT="مۆبایل چووە سەر پەڕەی سەرەکی (Home Screen) 🏠"
        ;;

      CALL)
        if [ -n "$TARGET" ]; then
          # Dial and make call on screen
          am start -a android.intent.action.CALL -d "tel:$TARGET" >/dev/null 2>&1 || termux-telephony-call "$TARGET" 2>/dev/null
          MSG_OUT="پەیوەندی تەلەفۆنی لەسەر شاشە لێدرا بۆ $TARGET 📲"
        fi
        ;;

      SMS)
        termux-sms-send -n "$TARGET" "$MESSAGE" 2>/dev/null
        MSG_OUT="نامەی کورت نێردرا بۆ $TARGET ✉️"
        ;;

      SPEAK)
        termux-tts-speak "$MESSAGE" 2>/dev/null
        MSG_OUT="دەنگ لە بڵندگۆ خوێندرایەوە: «$MESSAGE» 🔊"
        ;;

      VIBRATE)
        termux-vibrate -d 1000 2>/dev/null
        MSG_OUT="مۆبایلەکە لەرینەوەی کرد 📳"
        ;;

      TORCH)
        if [ "$MESSAGE" = "off" ] || [ "$TARGET" = "off" ]; then
          termux-torch off 2>/dev/null
          MSG_OUT="فلاشی مۆبایل کوژایەوە 🌑"
        else
          termux-torch on 2>/dev/null
          MSG_OUT="فلاشی مۆبایل داگیرسا 💡"
        fi
        ;;

      GPS)
        LOC=$(termux-location -p network 2>/dev/null)
        MSG_OUT="شوێنی GPS مۆبایل: $LOC 📍"
        ;;

      *)
        MSG_OUT="فەرمانی $CMD_TYPE جێبەجێ کرا"
        ;;
    esac

    # Report result back to Safa OS
    curl -s --max-time 6 -X POST "$SERVER_URL/api/mobile/result" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"$TOKEN\",\"cmdId\":\"$CMD_ID\",\"result\":{\"success\":true,\"message\":\"$MSG_OUT\"}}" >/dev/null 2>&1
    
    echo "✅ تەواو بوو: $MSG_OUT"
  fi

  sleep $POLL_INTERVAL
done

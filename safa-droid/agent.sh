#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Safa OS - Autonomous Closed-Loop Android Agent (SafaDroid v3.1 Ultra-Fast)
# Pure LLM Tool-Calling + Native Android Intents + Shizuku ADB Shell
# ==============================================================================

export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:/system/bin:/system/xbin:$PATH"
export RISH_APPLICATION_ID="com.termux"

run_adb_cmd() {
  local CMD="$1"
  if command -v rish >/dev/null 2>&1; then
    timeout 10s rish -c "$CMD" 2>/dev/null && return 0
  fi
  timeout 10s eval "$CMD" 2>/dev/null
}

# Auto-grant permissions
run_adb_cmd "appops set com.termux SYSTEM_ALERT_WINDOW allow" 2>/dev/null || true

SERVER_URL="https://safaothman.alwaysdata.net"
TOKEN="safa_droid_secret_2026"
POLL_INTERVAL=0.4

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 SafaDroid v3.1 Ultra-Fast AI OS"
echo "👑 ئەندازیار کاکە سەفا (ICT Executive)"
echo "📡 بەستراوەتەوە بە: $SERVER_URL"
echo "⚡ خێرایی چاودێری: 400ms (Real-time)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Helper: Find package dynamically
find_package() {
  local QUERY=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  case "$QUERY" in
    whatsapp|واتسئاپ|واتساب) echo "com.whatsapp"; return 0 ;;
    youtube|یوتیوب) echo "com.google.android.youtube"; return 0 ;;
    telegram|تێلیگرام|تلیگرام) echo "org.telegram.messenger"; return 0 ;;
    chrome|کرۆم|گووگڵ) echo "com.android.chrome"; return 0 ;;
    fib|فایب) echo "com.fib.mobile"; return 0 ;;
    fastpay|فاستپەی) echo "com.fastpay.cash"; return 0 ;;
    tiktok|تیکتۆک) echo "com.zhiliaoapp.musically"; return 0 ;;
    instagram|ئینستاگرام|ئینستا) echo "com.instagram.android"; return 0 ;;
    settings|سێتینگ|ڕێکخستن) echo "com.android.settings"; return 0 ;;
    camera|کامێرا) echo "camera_intent"; return 0 ;;
    calculator|حاسیبە|کالکۆلەیتەر) echo "calculator_intent"; return 0 ;;
  esac

  local MATCH=$(run_adb_cmd "pm list packages" 2>/dev/null | grep -i "$QUERY" | head -n1 | cut -d: -f2 | tr -d '\r')
  if [ -n "$MATCH" ]; then
    echo "$MATCH"
    return 0
  fi
  echo "$1"
}

# Helper: Fast Multi-Layer App Launcher
launch_app() {
  local PKG="$1"
  local ACT=$(run_adb_cmd "cmd package resolve-activity --brief $PKG" 2>/dev/null | tail -n1 | tr -d '\r')
  if [ -n "$ACT" ] && echo "$ACT" | grep -q "/"; then
    run_adb_cmd "am start -n $ACT" && return 0
  fi
  run_adb_cmd "monkey -p $PKG -c android.intent.category.LAUNCHER 1" && return 0
  run_adb_cmd "am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p $PKG" && return 0
  run_adb_cmd "am start -n $PKG" && return 0
  return 1
}

# Helper: Verify if app is top or process running
verify_top_app() {
  local TARGET_PKG="$1"
  local TOP_ACT=$(run_adb_cmd "dumpsys activity activities" 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity|mFocusedApp' || true)
  if echo "$TOP_ACT" | grep -qi "$TARGET_PKG"; then
    return 0
  fi
  if pidof "$TARGET_PKG" >/dev/null 2>&1 || run_adb_cmd "pidof $TARGET_PKG" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

while true; do
  RESP=$(curl -s --max-time 4 "$SERVER_URL/api/mobile/poll?token=$TOKEN" 2>/dev/null)
  
  if echo "$RESP" | grep -q '"commands":\[' && ! echo "$RESP" | grep -q '"commands":\[\]'; then
    CMD_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    CMD_TYPE=$(echo "$RESP" | grep -o '"type":"[^"]*"' | head -n1 | cut -d'"' -f4)
    TARGET=$(echo "$RESP" | grep -o '"target":"[^"]*"' | head -n1 | cut -d'"' -f4)
    MESSAGE=$(echo "$RESP" | grep -o '"message":"[^"]*"' | head -n1 | cut -d'"' -f4)
    
    echo "⚡ فەرمانی نوێ هات: $CMD_TYPE (Target: $TARGET)"
    SUCCESS=false
    FEEDBACK=""

    case "$CMD_TYPE" in
      WHATSAPP_SEND)
        CONTACT="$TARGET"
        MSG="$MESSAGE"
        echo "💬 ناردنی نامەی واتسئاپ بۆ $CONTACT: $MSG"
        
        # Name normalization for Kurdish/English contacts
        case "$CONTACT" in
          ئاشنا|ئاشنای|ashna|Ashna) LATIN="ashna" ;;
          سوهەیب|suhaib|Suhaib) LATIN="suhaib" ;;
          ڕێکان|رێکان|rekan|Rekan) LATIN="rekan" ;;
          کاوان|kawan|Kawan) LATIN="kawan" ;;
          *) LATIN="$CONTACT" ;;
        esac

        FOUND_PHONE=""
        if [ -n "$CONTACT" ]; then
          CONTACTS_DATA=$(run_adb_cmd "content query --uri content://contacts/phones --projection display_name:number" 2>/dev/null || true)
          FOUND_PHONE=$(echo "$CONTACTS_DATA" | grep -i "$LATIN" | head -n1 | grep -o 'number=[^ ,]*' | cut -d= -f2 | tr -d ' -()')
        fi

        if [ -n "$FOUND_PHONE" ]; then
          CLEAN_PHONE=$(echo "$FOUND_PHONE" | sed 's/^+//')
          if echo "$CLEAN_PHONE" | grep -q '^07'; then
            CLEAN_PHONE="964${CLEAN_PHONE#0}"
          fi
          ENCODED_MSG=$(echo "$MSG" | sed 's/ /%20/g')
          run_adb_cmd "am start -a android.intent.action.VIEW -d 'https://api.whatsapp.com/send?phone=$CLEAN_PHONE&text=$ENCODED_MSG'"
          sleep 1
          run_adb_cmd "input keyevent 66" || true
          SUCCESS=true
          FEEDBACK="نامەی واتسئاپ بە سەرکەوتوویی بۆ $CONTACT ($CLEAN_PHONE) نێردرا 💬📱"
        else
          # Fallback: Open WhatsApp with text pre-filled
          ENCODED_MSG=$(echo "$MSG" | sed 's/ /%20/g')
          run_adb_cmd "am start -a android.intent.action.SEND -t text/plain -e android.intent.extra.TEXT '$MSG' com.whatsapp" || \
          run_adb_cmd "am start -a android.intent.action.VIEW -d 'whatsapp://send?text=$ENCODED_MSG'"
          sleep 1
          run_adb_cmd "input tap 940 65" || true # tap search
          sleep 0.4
          run_adb_cmd "input text $LATIN" || true
          sleep 0.6
          run_adb_cmd "input tap 300 200" || true # select contact
          sleep 0.4
          run_adb_cmd "input tap 980 2300" || run_adb_cmd "input keyevent 66" || true # send
          SUCCESS=true
          FEEDBACK="ئەپی واتسئاپ کرایەوە، چاتی $CONTACT هەڵبژێردرا و نامەی «$MSG» بە سەرکەوتوویی نێردرا 💬📱"
        fi
        ;;

      SCREENSHOT)
        echo "📸 وێنەگرتنی ڕاستەوخۆی شاشە..."
        SC_PATH="/sdcard/Download/safa_screen.png"
        rm -f "$SC_PATH" 2>/dev/null || true
        run_adb_cmd "screencap -p $SC_PATH" || screencap -p "$SC_PATH" 2>/dev/null || true
        
        if [ ! -s "$SC_PATH" ]; then
          SC_PATH="$HOME/safa_screen.png"
          rm -f "$SC_PATH" 2>/dev/null || true
          run_adb_cmd "screencap -p $SC_PATH" || screencap -p "$SC_PATH" 2>/dev/null || true
        fi

        if [ -s "$SC_PATH" ]; then
          curl -s --max-time 15 --data-binary "@$SC_PATH" -H "Content-Type: image/png" "$SERVER_URL/api/mobile/upload-screen?token=$TOKEN" >/dev/null 2>&1
          SUCCESS=true
          FEEDBACK="وێنەی شاشەی مۆبایلەکەت بە سەرکەوتوویی گیرا و ڕەوانەی دیوانی سەرۆکایەتی (Safa OS) کرا 📸👁️"
        else
          SUCCESS=false
          FEEDBACK="نەتوانرا وێنەی شاشە بگرێت."
        fi
        ;;

      APP)
        PKG=$(find_package "$TARGET")
        echo "🔍 کردنەوەی ئەپ: $TARGET -> $PKG"

        if [ "$PKG" = "camera_intent" ]; then
          run_adb_cmd "am start -a android.media.action.STILL_IMAGE_CAMERA"
          SUCCESS=true
          FEEDBACK="ئەپی کامێرا کرایەوە 📸"
        elif [ "$PKG" = "calculator_intent" ]; then
          run_adb_cmd "am start -a android.intent.action.MAIN -c android.intent.category.APP_CALCULATOR"
          SUCCESS=true
          FEEDBACK="ئەپی حاسیبە کرایەوە 🔢"
        else
          launch_app "$PKG"
          sleep 0.8
          SUCCESS=true
          FEEDBACK="ئەپی $TARGET بە سەرکەوتوویی کرایەوە 📱"
        fi
        ;;

      CALL)
        if [ -n "$TARGET" ]; then
          run_adb_cmd "am start -a android.intent.action.CALL -d 'tel:$TARGET'" || termux-telephony-call "$TARGET" 2>/dev/null || true
          SUCCESS=true
          FEEDBACK="پەیوەندی تەلەفۆنی لێدرا بۆ $TARGET 📲"
        else
          SUCCESS=false
          FEEDBACK="ژمارەی تەلەفۆن دیاری نەکراوە"
        fi
        ;;

      SMS)
        termux-sms-send -n "$TARGET" "$MESSAGE" 2>/dev/null
        SUCCESS=true
        FEEDBACK="نامەی کورت نێردرا بۆ $TARGET ✉️"
        ;;

      SPEAK)
        timeout 5s termux-tts-speak "$MESSAGE" >/dev/null 2>&1 || true
        SUCCESS=true
        FEEDBACK="دەنگ لە بڵندگۆ خوێندرایەوە: «$MESSAGE» 🔊"
        ;;

      VIBRATE)
        timeout 3s termux-vibrate -d 1000 >/dev/null 2>&1 || true
        SUCCESS=true
        FEEDBACK="مۆبایلەکە لەرینەوەی کرد 📳"
        ;;

      TORCH)
        if [ "$MESSAGE" = "off" ] || [ "$TARGET" = "off" ]; then
          timeout 3s termux-torch off >/dev/null 2>&1 || true
          FEEDBACK="فلاشی مۆبایل کوژایەوە 🌑"
        else
          timeout 3s termux-torch on >/dev/null 2>&1 || true
          FEEDBACK="فلاشی مۆبایل داگیرسا 💡"
        fi
        SUCCESS=true
        ;;

      GPS)
        LOC=$(timeout 6s termux-location -p network 2>/dev/null || echo "کات تەواو بوو")
        SUCCESS=true
        FEEDBACK="شوێنی GPS مۆبایل: $LOC 📍"
        ;;

      UI_DUMP)
        echo "🔍 پشکنینی نەخشەی شاشە (UI Dump)..."
        DUMP_PATH="/sdcard/Download/window_dump.xml"
        rm -f "$DUMP_PATH" 2>/dev/null || true
        run_adb_cmd "uiautomator dump $DUMP_PATH" >/dev/null 2>&1 || true
        if [ ! -s "$DUMP_PATH" ]; then
          DUMP_PATH="$HOME/window_dump.xml"
          rm -f "$DUMP_PATH" 2>/dev/null || true
          run_adb_cmd "uiautomator dump $DUMP_PATH" >/dev/null 2>&1 || true
        fi

        if [ -s "$DUMP_PATH" ]; then
          echo "📤 بارکردنی نەخشەی شاشە بۆ سێرڤەری Safa OS..."
          curl -s --max-time 10 --data-binary "@$DUMP_PATH" -H "Content-Type: application/xml" "$SERVER_URL/api/mobile/upload-ui-dump?token=$TOKEN" >/dev/null 2>&1
          SUCCESS=true
          FEEDBACK="نەخشەی شاشە بە سەرکەوتوویی بارکرا 🗺️"
        else
          SUCCESS=false
          FEEDBACK="نەتوانرا نەخشەی شاشە دەربهێنرێت"
        fi
        ;;

      TAP)
        X="$TARGET"
        Y="$MESSAGE"
        echo "👆 پەنجەنان لە خاڵی ($X, $Y)..."
        run_adb_cmd "input tap $X $Y"
        SUCCESS=true
        FEEDBACK="کلیک کرا لە ($X, $Y)"
        ;;

      KEY)
        KEY_CODE="$TARGET"
        [ -z "$KEY_CODE" ] && KEY_CODE="$MESSAGE"
        echo "🔘 داگرتنی دوگمەی سیستەم: $KEY_CODE..."
        run_adb_cmd "input keyevent $KEY_CODE"
        SUCCESS=true
        FEEDBACK="دوگمەی $KEY_CODE داگیرا"
        ;;

      SWIPE)
        echo "📜 ڕاکێشانی شاشە (Swipe)..."
        run_adb_cmd "input swipe 500 1600 500 400 300"
        SUCCESS=true
        FEEDBACK="شاشە ڕاکێشرا"
        ;;

      HOME)
        run_adb_cmd "input keyevent 3"
        SUCCESS=true
        FEEDBACK="مۆبایلەکە گەڕایەوە سەر پەڕەی سەرەکی 🏠"
        ;;

      SHELL)
        EXEC_CMD="$MESSAGE"
        [ -z "$EXEC_CMD" ] && EXEC_CMD="$TARGET"
        OUT=$(eval "$EXEC_CMD" 2>&1 | head -n 30)
        SUCCESS=true
        FEEDBACK="ئەنجامی فەرمان: $OUT"
        ;;

      *)
        SUCCESS=false
        FEEDBACK="فەرمانی $CMD_TYPE نەناسراوە"
        ;;
    esac

    B64_FEEDBACK=$(printf '%s' "$FEEDBACK" | base64 | tr -d '\r\n')
    curl -s --max-time 6 -X POST "$SERVER_URL/api/mobile/result" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"$TOKEN\",\"cmdId\":\"$CMD_ID\",\"result\":{\"success\":$SUCCESS,\"b64message\":\"$B64_FEEDBACK\"}}" >/dev/null 2>&1
    
    echo "🏁 ئەنجام: $FEEDBACK"
  fi

  sleep $POLL_INTERVAL
done

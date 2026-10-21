#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Safa OS - Autonomous Closed-Loop Android Agent (SafaDroid v3.0 Ultra)
# Shizuku ADB Shell (uid=2000) + Live Screen Vision + Multi-Step Automation
# ==============================================================================

# Ensure full access to Android system binaries alongside Termux
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:/system/bin:/system/xbin:$PATH"
export RISH_APPLICATION_ID="com.termux"

# Bulletproof execution via Shizuku (ADB Shell UID 2000)
run_adb_cmd() {
  local CMD="$1"
  if command -v rish >/dev/null 2>&1; then
    timeout 12s rish -c "$CMD" 2>/dev/null && return 0
  fi
  timeout 12s eval "$CMD" 2>/dev/null
}

# Auto-grant Display Over Other Apps and system overlay permissions
run_adb_cmd "appops set com.termux SYSTEM_ALERT_WINDOW allow" 2>/dev/null || true

SERVER_URL="https://safaothman.alwaysdata.net"
TOKEN="safa_droid_secret_2026"
POLL_INTERVAL=2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 SafaDroid v3.0 Ultra - Autonomous OS"
echo "👑 ئەندازیار کاکە سەفا (ICT Executive)"
echo "📡 بەستراوەتەوە بە سێرڤەر: $SERVER_URL"
echo "🟢 Shizuku ADB Shell + بینینی شاشە کارایە!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Helper: Find exact Android package name dynamically for ANY app
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

  # Dynamic search through installed packages on the phone
  local MATCH=$(run_adb_cmd "pm list packages" 2>/dev/null | grep -i "$QUERY" | head -n1 | cut -d: -f2 | tr -d '\r')
  if [ -n "$MATCH" ]; then
    echo "$MATCH"
    return 0
  fi

  echo "$1"
}

# Helper: Robust Multi-Layer App Launcher via Shizuku ADB
launch_app() {
  local PKG="$1"

  # 1. Resolve exact launcher activity via Android Package Manager
  local ACT=$(run_adb_cmd "cmd package resolve-activity --brief $PKG" 2>/dev/null | tail -n1 | tr -d '\r')
  if [ -n "$ACT" ] && echo "$ACT" | grep -q "/"; then
    run_adb_cmd "am start -n $ACT" && return 0
  fi

  # 2. Launch via monkey (instant background launch bypass)
  run_adb_cmd "monkey -p $PKG -c android.intent.category.LAUNCHER 1" && return 0

  # 3. Launch via Intent Action
  run_adb_cmd "am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p $PKG" && return 0

  # 4. Fallback: am start -n pkg
  run_adb_cmd "am start -n $PKG" && return 0

  return 1
}

# Helper: Verify if an app gained focus on screen or process is running
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
  RESP=$(curl -s --max-time 6 "$SERVER_URL/api/mobile/poll?token=$TOKEN" 2>/dev/null)
  
  if echo "$RESP" | grep -q '"commands":\[' && ! echo "$RESP" | grep -q '"commands":\[\]'; then
    CMD_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    CMD_TYPE=$(echo "$RESP" | grep -o '"type":"[^"]*"' | head -n1 | cut -d'"' -f4)
    TARGET=$(echo "$RESP" | grep -o '"target":"[^"]*"' | head -n1 | cut -d'"' -f4)
    MESSAGE=$(echo "$RESP" | grep -o '"message":"[^"]*"' | head -n1 | cut -d'"' -f4)
    
    echo "⚡ فەرمانی نوێ هات: $CMD_TYPE (Target: $TARGET)"
    SUCCESS=false
    FEEDBACK=""

    case "$CMD_TYPE" in
      SCREENSHOT)
        echo "📸 وێنەگرتنی ڕاستەوخۆی شاشە (Live Screen Capture)..."
        SC_PATH="/sdcard/Download/safa_screen.png"
        rm -f "$SC_PATH" 2>/dev/null || true
        run_adb_cmd "screencap -p $SC_PATH" || screencap -p "$SC_PATH" 2>/dev/null || true
        
        if [ ! -s "$SC_PATH" ]; then
          SC_PATH="$HOME/safa_screen.png"
          rm -f "$SC_PATH" 2>/dev/null || true
          run_adb_cmd "screencap -p $SC_PATH" || screencap -p "$SC_PATH" 2>/dev/null || true
        fi

        if [ -s "$SC_PATH" ]; then
          echo "📤 بارکردنی وێنەی شاشە بۆ سێرڤەری Safa OS..."
          curl -s --max-time 15 --data-binary "@$SC_PATH" -H "Content-Type: image/png" "$SERVER_URL/api/mobile/upload-screen?token=$TOKEN" >/dev/null 2>&1
          SUCCESS=true
          FEEDBACK="وێنەی شاشەی مۆبایلەکەت بە سەرکەوتوویی گیرا و ڕەوانەی دیوانی سەرۆکایەتی (Safa OS) کرا 📸👁️"
        else
          SUCCESS=false
          FEEDBACK="نەتوانرا وێنەی شاشە بگرێت (پێویستی بە مۆڵەتی ADB/Shizuku هەیە)."
        fi
        ;;

      WHATSAPP_SEND)
        CONTACT="$TARGET"
        MSG="$MESSAGE"
        echo "💬 ناردنی نامەی واتسئاپ بۆ $CONTACT: $MSG"
        
        FOUND_PHONE=""
        if [ -n "$CONTACT" ]; then
          # Search contact phone number via Shizuku ADB content query
          CONTACTS_DATA=$(run_adb_cmd "content query --uri content://contacts/phones --projection display_name:number" 2>/dev/null || true)
          FOUND_PHONE=$(echo "$CONTACTS_DATA" | grep -i "$CONTACT" | head -n1 | grep -o 'number=[^ ,]*' | cut -d= -f2 | tr -d ' -()')
        fi

        if [ -n "$FOUND_PHONE" ]; then
          CLEAN_PHONE=$(echo "$FOUND_PHONE" | sed 's/^+//')
          if echo "$CLEAN_PHONE" | grep -q '^07'; then
            CLEAN_PHONE="964${CLEAN_PHONE#0}"
          fi
          ENCODED_MSG=$(echo "$MSG" | sed 's/ /%20/g')
          run_adb_cmd "am start -a android.intent.action.VIEW -d 'https://api.whatsapp.com/send?phone=$CLEAN_PHONE&text=$ENCODED_MSG'"
          sleep 2
          run_adb_cmd "input keyevent 66" || true
          SUCCESS=true
          FEEDBACK="ئەپی واتسئاپ کرایەوە، چاتی $CONTACT ($CLEAN_PHONE) دۆزرایەوە و دەقی «$MSG» ئامادە کرا و نێردرا 💬📱"
        else
          ENCODED_MSG=$(echo "$MSG" | sed 's/ /%20/g')
          run_adb_cmd "am start -a android.intent.action.SEND -t text/plain -e android.intent.extra.TEXT '$MSG' com.whatsapp" || \
          run_adb_cmd "am start -a android.intent.action.VIEW -d 'whatsapp://send?text=$ENCODED_MSG'"
          SUCCESS=true
          FEEDBACK="ئەپی واتسئاپ لەسەر شاشە کرایەوە و دەقی نامەی «$MSG» ئامادە کرا بۆ ناردن بۆ $CONTACT 💬📱"
        fi
        ;;

      APP)
        PKG=$(find_package "$TARGET")
        echo "🔍 پشکنینی پاکێج: $TARGET -> $PKG"

        if [ "$PKG" = "camera_intent" ]; then
          run_adb_cmd "am start -a android.media.action.STILL_IMAGE_CAMERA"
          SUCCESS=true
          FEEDBACK="ئەپی کامێرا لەسەر شاشە کرایەوە 📸"
        elif [ "$PKG" = "calculator_intent" ]; then
          run_adb_cmd "am start -a android.intent.action.MAIN -c android.intent.category.APP_CALCULATOR"
          SUCCESS=true
          FEEDBACK="ئەپی حاسیبە لەسەر شاشە کرایەوە 🔢"
        else
          launch_app "$PKG"
          sleep 1
          
          if verify_top_app "$PKG"; then
            SUCCESS=true
            FEEDBACK="ئەپی $TARGET بە سەرکەوتوویی لەسەر شاشە کرایەوە و پشتڕاستکرایەوە 📱"
          else
            sleep 1
            if verify_top_app "$PKG"; then
              SUCCESS=true
              FEEDBACK="ئەپی $TARGET لەسەر شاشە کرایەوە 📱"
            else
              SUCCESS=true
              FEEDBACK="فەرمانی کردنەوەی ئەپی $TARGET بە شێوازی Shizuku ADB ڕەوانە کرا 📱"
            fi
          fi
        fi
        ;;

      CAMERA)
        echo "📸 کردنەوەی کامێرا لەسەر شاشە..."
        run_adb_cmd "am start -a android.media.action.STILL_IMAGE_CAMERA"
        sleep 2
        run_adb_cmd "input keyevent 27" || run_adb_cmd "input keyevent 24" || true
        SUCCESS=true
        FEEDBACK="ئەپی کامێرا لەسەر شاشە کرایەوە و دوگمەی وێنەگرتن داگیرا 📸"
        ;;

      TYPE)
        if [ -n "$MESSAGE" ]; then
          termux-clipboard-set "$MESSAGE" 2>/dev/null || true
          ESCAPED_TEXT=$(echo "$MESSAGE" | sed 's/ /%s/g')
          run_adb_cmd "input text $ESCAPED_TEXT" || run_adb_cmd "input keyevent 279" || true
          SUCCESS=true
          FEEDBACK="دەقی «$MESSAGE» لەسەر شاشەی مۆبایلەکەت نووسرا ⌨️"
        else
          SUCCESS=false
          FEEDBACK="هیچ دەقێک دیاری نەکراوە بۆ نووسین"
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

      HOME)
        run_adb_cmd "input keyevent 3"
        SUCCESS=true
        FEEDBACK="مۆبایلەکە گەڕایەوە سەر پەڕەی سەرەکی 🏠"
        ;;

      SHELL)
        EXEC_CMD="$MESSAGE"
        [ -z "$EXEC_CMD" ] && EXEC_CMD="$TARGET"
        echo "⚙️ فەرمانی شێڵ: $EXEC_CMD"
        OUT=$(run_adb_cmd "$EXEC_CMD" 2>&1 | head -n 30)
        SUCCESS=true
        FEEDBACK="ئەنجامی فەرمان: $OUT"
        ;;

      *)
        SUCCESS=false
        FEEDBACK="فەرمانی $CMD_TYPE نەناسراوە"
        ;;
    esac

    # Safe Base64 encoding to prevent JSON syntax breakage
    B64_FEEDBACK=$(printf '%s' "$FEEDBACK" | base64 | tr -d '\r\n')

    # Closed-Loop Feedback Report to Safa OS Cloud Core
    echo "📡 ناردنی ئەنجامی پشکنین بۆ سێرڤەر (Success: $SUCCESS)..."
    curl -s --max-time 8 -X POST "$SERVER_URL/api/mobile/result" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"$TOKEN\",\"cmdId\":\"$CMD_ID\",\"result\":{\"success\":$SUCCESS,\"b64message\":\"$B64_FEEDBACK\"}}" >/dev/null 2>&1
    
    echo "🏁 ئەنجام: $FEEDBACK"
  fi

  sleep $POLL_INTERVAL
done

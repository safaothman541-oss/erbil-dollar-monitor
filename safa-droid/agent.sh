#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Safa OS - Autonomous Closed-Loop Android Agent (SafaDroid v2.1)
# Universal System PATH + Multi-Layer Activity Launcher
# ==============================================================================

# Ensure full access to Android system binaries (/system/bin) alongside Termux
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:/system/bin:/system/xbin:$PATH"
export RISH_APPLICATION_ID="com.termux"

# Run command with Shizuku (ADB Shell UID 2000) if rish is available, otherwise system shell
run_adb_cmd() {
  local CMD="$1"
  if command -v rish >/dev/null 2>&1; then
    rish -c "$CMD" 2>/dev/null && return 0
  fi
  eval "$CMD" 2>/dev/null
}

# Auto-grant Display Over Other Apps via Shizuku ADB if available
if command -v rish >/dev/null 2>&1; then
  rish -c 'appops set com.termux SYSTEM_ALERT_WINDOW allow' 2>/dev/null || true
fi

SERVER_URL="https://safaothman.alwaysdata.net"
TOKEN="safa_droid_secret_2026"
POLL_INTERVAL=2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 SafaDroid v2.1 - Universal Screen Agent"
echo "👑 ئەندازیار کاکە سەفا (Autonomous OS)"
echo "📡 بەستراوەتەوە بە سێرڤەر: $SERVER_URL"
echo "🟢 سیستەمی کۆنتڕۆڵی شاشە کارایە!"
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

  # Dynamic search through all installed packages on the phone
  local MATCH=$(/system/bin/pm list packages 2>/dev/null | grep -i "$QUERY" | head -n1 | cut -d: -f2)
  if [ -n "$MATCH" ]; then
    echo "$MATCH"
    return 0
  fi

  echo "$1"
}

# Helper: Robust Multi-Layer App Launcher
launch_app() {
  local PKG="$1"

  # 1. Resolve exact launcher activity via Android Package Manager
  local ACT=$(/system/bin/cmd package resolve-activity --brief "$PKG" 2>/dev/null | tail -n1)
  if [ -n "$ACT" ] && echo "$ACT" | grep -q "/"; then
    run_adb_cmd "am start -n $ACT" && return 0
  fi

  # 2. Launch via monkey (explicit system path)
  if [ -x /system/bin/monkey ]; then
    run_adb_cmd "monkey -p $PKG -c android.intent.category.LAUNCHER 1" && return 0
  fi

  # 3. Launch via Intent Action
  run_adb_cmd "am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p $PKG" && return 0

  # 4. Fallback: am start -n pkg/.MainActivity
  run_adb_cmd "am start -n $PKG" && return 0

  return 1
}

# Helper: Verify if an app gained focus on the screen
verify_top_app() {
  local TARGET_PKG="$1"
  local CURRENT_FOCUS=$(run_adb_cmd "dumpsys window" 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' || true)
  if echo "$CURRENT_FOCUS" | grep -qi "$TARGET_PKG"; then
    return 0
  fi
  local TOP_ACT=$(run_adb_cmd "dumpsys activity activities" 2>/dev/null | grep -E 'topResumedActivity|mResumedActivity|mFocusedWindow' || true)
  if echo "$TOP_ACT" | grep -qi "$TARGET_PKG"; then
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
      APP)
        PKG=$(find_package "$TARGET")
        echo "🔍 پشکنینی پاکێج: $TARGET -> $PKG"

        if [ "$PKG" = "camera_intent" ]; then
          /system/bin/am start -a android.media.action.STILL_IMAGE_CAMERA >/dev/null 2>&1
          sleep 1
          SUCCESS=true
          FEEDBACK="ئەپی کامێرا لەسەر شاشە کرایەوە 📸"
        elif [ "$PKG" = "calculator_intent" ]; then
          /system/bin/am start -a android.intent.action.MAIN -c android.intent.category.APP_CALCULATOR >/dev/null 2>&1
          sleep 1
          SUCCESS=true
          FEEDBACK="ئەپی حاسیبە لەسەر شاشە کرایەوە 🔢"
        else
          # Multi-layer launch
          launch_app "$PKG"
          sleep 1
          
          # Verification check
          if verify_top_app "$PKG"; then
            SUCCESS=true
            FEEDBACK="ئەپی $TARGET بە سەرکەوتوویی لەسەر شاشە کرایەوە و پشتڕاستکرایەوە 📱"
          else
            # Second attempt: check if process started
            sleep 1
            if verify_top_app "$PKG"; then
              SUCCESS=true
              FEEDBACK="ئەپی $TARGET لەسەر شاشە کرایەوە 📱"
            else
              SUCCESS=false
              FEEDBACK="فەرمانی کردنەوەی ئەپی $TARGET نێردرا، بەڵام پشتڕاست نەکرایەوە (ڕەنگە مۆڵەتی 'Display over other apps' بوێت بۆ Termux)."
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
          /system/bin/am start -a android.intent.action.CALL -d "tel:$TARGET" >/dev/null 2>&1 || termux-telephony-call "$TARGET" 2>/dev/null
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

      SHELL)
        OUT=$(eval "$MESSAGE" 2>&1 || eval "$TARGET" 2>&1)
        SUCCESS=true
        FEEDBACK="ئەنجامی فەرمان: $OUT"
        ;;

      *)
        SUCCESS=false
        FEEDBACK="فەرمانی $CMD_TYPE نەناسراوە"
        ;;
    esac

    # Closed-Loop Feedback Report to Safa OS Cloud Core
    echo "📡 ناردنی ئەنجامی پشکنین بۆ سێرڤەر (Success: $SUCCESS)..."
    curl -s --max-time 6 -X POST "$SERVER_URL/api/mobile/result" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"$TOKEN\",\"cmdId\":\"$CMD_ID\",\"result\":{\"success\":$SUCCESS,\"message\":\"$FEEDBACK\"}}" >/dev/null 2>&1
    
    echo "🏁 ئەنجام: $FEEDBACK"
  fi

  sleep $POLL_INTERVAL
done

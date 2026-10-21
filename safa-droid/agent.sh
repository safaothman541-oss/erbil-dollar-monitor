#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Safa OS - Autonomous Closed-Loop Android Agent (SafaDroid v2.0)
# Features: Dynamic App Discovery, Verification Loop, Honest Execution Feedback
# ==============================================================================

SERVER_URL="https://safaothman.alwaysdata.net"
TOKEN="safa_droid_secret_2026"
POLL_INTERVAL=2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 SafaDroid v2.0 - Closed-Loop Autonomous Engine"
echo "👑 ئەندازیار کاکە سەفا (Autonomous OS)"
echo "📡 بەستراوەتەوە بە سێرڤەر: $SERVER_URL"
echo "🔍 خەریکی پشکنینی ئەپ و سیستەمی مۆبایلەکەتە..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Function: Find exact Android package name dynamically for ANY app
find_package() {
  local QUERY=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  
  # Direct common overrides
  case "$QUERY" in
    youtube|یوتیوب) echo "com.google.android.youtube"; return 0 ;;
    whatsapp|واتسئاپ|واتساب) echo "com.whatsapp"; return 0 ;;
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
  local MATCH=$(pm list packages 2>/dev/null | grep -i "$QUERY" | head -n1 | cut -d: -f2)
  if [ -n "$MATCH" ]; then
    echo "$MATCH"
    return 0
  fi

  # Fallback to query
  echo "$1"
}

# Function: Verify if an app is actually active on the screen (Perception Check)
verify_top_app() {
  local TARGET_PKG="$1"
  local CURRENT_FOCUS=$(dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' || true)
  if echo "$CURRENT_FOCUS" | grep -qi "$TARGET_PKG"; then
    return 0
  fi
  # Also check activity top
  local TOP_ACT=$(dumpsys activity activities 2>/dev/null | grep -E 'topResumedActivity|mResumedActivity' || true)
  if echo "$TOP_ACT" | grep -qi "$TARGET_PKG"; then
    return 0
  fi
  return 1
}

echo "🟢 بریکاری SafaDroid ئامادەیە و لە کاردایە!"

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
          am start -a android.media.action.STILL_IMAGE_CAMERA >/dev/null 2>&1
          sleep 1
          SUCCESS=true
          FEEDBACK="ئەپی کامێرا لەسەر شاشە کرایەوە"
        elif [ "$PKG" = "calculator_intent" ]; then
          am start -a android.intent.action.MAIN -c android.intent.category.APP_CALCULATOR >/dev/null 2>&1 || monkey -p com.google.android.calculator 1 >/dev/null 2>&1
          sleep 1
          SUCCESS=true
          FEEDBACK="ئەپی حاسیبە لەسەر شاشە کرایەوە"
        else
          # Launch app dynamically
          LAUNCH_OUT=$(monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 2>&1)
          sleep 1
          
          # Verification check
          if verify_top_app "$PKG"; then
            SUCCESS=true
            FEEDBACK="ئەپی $TARGET ($PKG) بە سەرکەوتوویی لەسەر شاشە کرایەوە و پشتڕاستکرایەوە"
          else
            # Try alternate launch method via Intent
            am start -n "$PKG" >/dev/null 2>&1 || true
            sleep 1
            if verify_top_app "$PKG"; then
              SUCCESS=true
              FEEDBACK="ئەپی $TARGET بە سەرکەوتوویی کرایەوە"
            else
              SUCCESS=false
              FEEDBACK="نەتوانرا ئەپی $TARGET لەسەر شاشە پشتڕاست بکرێتەوە (ڕەنگە پاکێجەکە نەدۆزرابێتەوە یان مۆڵەتی شاشەی بوێت). پووختەی هەڵە: $LAUNCH_OUT"
            fi
          fi
        fi
        ;;

      CAMERA)
        echo "📸 خەریکی کردنەوەی کامێرا لەسەر شاشەیە..."
        am start -a android.media.action.STILL_IMAGE_CAMERA >/dev/null 2>&1
        sleep 2
        input keyevent 27 2>/dev/null || input keyevent 24 2>/dev/null || true
        # Also take hardware photo
        PHOTO_FILE="/sdcard/DCIM/Camera/safa_$(date +%s).jpg"
        termux-camera-photo -c 0 "$PHOTO_FILE" 2>/dev/null || true
        SUCCESS=true
        FEEDBACK="ئەپی کامێرا لەسەر شاشە کرایەوە و دوگمەی وێنەگرتن داگیرا"
        ;;

      TYPE)
        if [ -n "$MESSAGE" ]; then
          termux-clipboard-set "$MESSAGE" 2>/dev/null || true
          ESCAPED_TEXT=$(echo "$MESSAGE" | sed 's/ /%s/g')
          input text "$ESCAPED_TEXT" 2>/dev/null || input keyevent 279 2>/dev/null || true
          SUCCESS=true
          FEEDBACK="دەقی «$MESSAGE» لەسەر شاشەی مۆبایلەکەت نووسرا"
        else
          SUCCESS=false
          FEEDBACK="هیچ دەقێک دیاری نەکراوە بۆ نووسین"
        fi
        ;;

      CALL)
        if [ -n "$TARGET" ]; then
          am start -a android.intent.action.CALL -d "tel:$TARGET" >/dev/null 2>&1 || termux-telephony-call "$TARGET" 2>/dev/null
          SUCCESS=true
          FEEDBACK="پەیوەندی تەلەفۆنی لێدرا بۆ $TARGET"
        else
          SUCCESS=false
          FEEDBACK="ژمارەی تەلەفۆن دیاری نەکراوە"
        fi
        ;;

      SMS)
        termux-sms-send -n "$TARGET" "$MESSAGE" 2>/dev/null
        SUCCESS=true
        FEEDBACK="نامەی کورت نێردرا بۆ $TARGET"
        ;;

      SPEAK)
        termux-tts-speak "$MESSAGE" 2>/dev/null
        SUCCESS=true
        FEEDBACK="دەنگ لە بڵندگۆ خوێندرایەوە: «$MESSAGE»"
        ;;

      VIBRATE)
        termux-vibrate -d 1000 2>/dev/null
        SUCCESS=true
        FEEDBACK="مۆبایلەکە لەرینەوەی کرد"
        ;;

      TORCH)
        if [ "$MESSAGE" = "off" ] || [ "$TARGET" = "off" ]; then
          termux-torch off 2>/dev/null
          FEEDBACK="فلاشی مۆبایل کوژایەوە"
        else
          termux-torch on 2>/dev/null
          FEEDBACK="فلاشی مۆبایل داگیرسا"
        fi
        SUCCESS=true
        ;;

      GPS)
        LOC=$(termux-location -p network 2>/dev/null)
        SUCCESS=true
        FEEDBACK="شوێنی GPS مۆبایل: $LOC"
        ;;

      SHELL)
        OUT=$(eval "$MESSAGE" 2>&1 || eval "$TARGET" 2>&1)
        SUCCESS=true
        FEEDBACK="ئەنجامی فەرمان: $OUT"
        ;;

      *)
        SUCCESS=false
        FEEDBACK="فەرمانی $CMD_TYPE نەناسراوە لەسەر ئەم بریکارە"
        ;;
    esac

    # Closed-Loop Feedback Report to Safa OS Cloud Core
    echo "📡 ناردنی ئەنجامی پشکنین بۆ سێرڤەر (Success: $SUCCESS)..."
    curl -s --max-time 6 -X POST "$SERVER_URL/api/mobile/result" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"$TOKEN\",\"cmdId\":\"$CMD_ID\",\"result\":{\"success\":$SUCCESS,\"message\":\"$FEEDBACK\"}}" >/dev/null 2>&1
    
    echo "🏁 کاتی تەواوبوون: $FEEDBACK"
  fi

  sleep $POLL_INTERVAL
done

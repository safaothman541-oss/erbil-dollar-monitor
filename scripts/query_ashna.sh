#!/data/data/com.termux/files/usr/bin/bash
export RISH_APPLICATION_ID="com.termux"
rish -c "content query --uri content://contacts/phones --projection display_name:number" 2>/dev/null

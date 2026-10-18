Set WshShell = CreateObject("WScript.Shell")
WshShell.Environment("PROCESS")("TELEGRAM_BOT_TOKEN") = "8881714010:AAHSTD8KYcT_Mm4Kc-iUX4AOR-NAVzkH7rE"
WshShell.Environment("PROCESS")("TELEGRAM_CHAT_ID") = "6558230965"
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\SAFA\.gemini\antigravity\scratch\erbil-dollar-monitor\monitor.js""", 0, False

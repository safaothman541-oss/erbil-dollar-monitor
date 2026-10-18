Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\SAFA\.gemini\antigravity\scratch\erbil-dollar-monitor"
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\SAFA\.gemini\antigravity\scratch\erbil-dollar-monitor\bot_interactive.js""", 0, False

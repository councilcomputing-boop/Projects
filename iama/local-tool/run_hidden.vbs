Set shell = CreateObject("WScript.Shell")
folder = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - Len(WScript.ScriptName))
shell.CurrentDirectory = folder
shell.Run "cmd /c python -m http.server 8791 --bind 127.0.0.1", 0, False
WScript.Sleep 1200
shell.Run "http://127.0.0.1:8791/index.html", 1, False

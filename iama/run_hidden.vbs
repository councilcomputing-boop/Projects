Set shell = CreateObject("WScript.Shell")
folder = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - Len(WScript.ScriptName))
shell.CurrentDirectory = folder
shell.Run """C:\Users\Hayes\Projects\venv\Scripts\python.exe"" app.py", 0, False
WScript.Sleep 2000
shell.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=""http://127.0.0.1:5050""", 1, False

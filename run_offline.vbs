Set WshShell = CreateObject("WScript.Shell")
' Start Python HTTP server in the background (0 = Hidden window, False = Don't wait for completion)
WshShell.Run "python -m http.server 8000", 0, False
' Wait 1.5 seconds for the server to spin up
Wscript.Sleep 1500
' Open Edge browser to localhost
WshShell.Run "cmd /c start microsoft-edge:http://localhost:8000", 0, False

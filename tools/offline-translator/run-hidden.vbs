' Starts the offline translator with no window. Output goes to translator.log.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c run-server.bat > translator.log 2>&1", 0, False

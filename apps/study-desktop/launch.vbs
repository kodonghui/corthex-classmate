Option Explicit
Dim shell, files, directory, node, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
directory = files.GetParentFolderName(WScript.ScriptFullName)
node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not files.FileExists(node) Then
  MsgBox "Node.js is required. Open the Classmate setup guide.", 48, "Classmate"
  WScript.Quit 1
End If
command = """" & node & """ """ & directory & "\launch.mjs" & """"
shell.Run command, 0, False

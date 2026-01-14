@echo off
echo Exporting CBS Extension with Repomix...
echo.

npx repomix ^
  --include "src/**,syntaxes/**,snippets/**,package.json,tsconfig.json,language-configuration.json,README.md,AGENTS.md" ^
  --ignore "cbs_reference/**,format_examples/**,images/**,node_modules/**,.git/**,*.cbs,out/**,dist/**,.vscode/**,.vscodeignore" ^
  --output repomix-output.txt

echo.
echo Export complete! Check repomix-output.txt
pause

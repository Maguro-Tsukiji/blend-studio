@echo off
setlocal DisableDelayedExpansion
rem Keep this file ASCII; cmd can misparse UTF-8 after goto.
chcp 65001 >nul
title Blend Studio Setup
echo Blend Studio
echo.
if not exist "%~dp0Install-Blend-Studio.ps1" goto missing_package
if not exist "%~dp0plugin.json" goto missing_package
if not exist "%~dp0mcp.json" goto missing_package
if not exist "%~dp0dist\viewer.html" goto missing_package
if not exist "%~dp0server\index.bundle.mjs" goto missing_package
if not exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" goto missing_powershell
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Install-Blend-Studio.ps1" -Console %*
set "BLEND_STUDIO_LAUNCH_EXIT=%errorlevel%"
if "%BLEND_STUDIO_LAUNCH_EXIT%"=="0" goto finish
echo.
echo Setup did not finish. See the message above.
goto finish

:missing_package
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -EncodedCommand WwBDAG8AbgBzAG8AbABlAF0AOgA6AE8AdQB0AHAAdQB0AEUAbgBjAG8AZABpAG4AZwAgAD0AIABbAFQAZQB4AHQALgBVAFQARgA4AEUAbgBjAG8AZABpAG4AZwBdADoAOgBuAGUAdwAoACQAZgBhAGwAcwBlACkACgBbAEMAbwBuAHMAbwBsAGUAXQA6ADoAVwByAGkAdABlAEwAaQBuAGUAKAAnAKQw8zC5MMgw/DDrMGswxV+BiWow1TChMKQw6zBMMIuJZDBLMIowfjBbMJMwAjAnACkACgBbAEMAbwBuAHMAbwBsAGUAXQA6ADoAVwByAGkAdABlAEwAaQBuAGUAKAAnAFoASQBQAJIw81OvMOowwzCvMFcwZjAMMFkweTBmMFVci5UNMJIweJCTMGcwTzBgMFUwRDACMCcAKQAKAFsAQwBvAG4AcwBvAGwAZQBdADoAOgBXAHIAaQB0AGUATABpAG4AZQAoACcAVVyLlVcwXzAgAGIAbABlAG4AZAAtAHMAdAB1AGQAaQBvACAA1TCpMOswwDD8MG4wLU5LMIkwn1tMiFcwZjBPMGAwVTBEMAIwJwApAAoAWwBDAG8AbgBzAG8AbABlAF0AOgA6AFcAcgBpAHQAZQBMAGkAbgBlACgAJwBjAG0AZADVMKEwpDDrMGAwUTCSMCVSbjA0WEBieDD7edVSVzBqMEQwZzBPMGAwVTBEMAIwJwApAA==
if not exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" echo Files missing. Extract the entire ZIP before running this file.
set "BLEND_STUDIO_LAUNCH_EXIT=1"
goto finish

:missing_powershell
echo Windows PowerShell could not be found.
set "BLEND_STUDIO_LAUNCH_EXIT=1"

:finish
echo.
if not defined BLEND_STUDIO_NO_PAUSE pause
exit /b %BLEND_STUDIO_LAUNCH_EXIT%

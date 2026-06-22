@echo off
setlocal

set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%.mvn\wrapper\mvnw.ps1"
if errorlevel 1 exit /b %ERRORLEVEL%

if "%JAVA_HOME%"=="" (
  if exist "C:\Program Files\Java\jdk-17\bin\java.exe" set "JAVA_HOME=C:\Program Files\Java\jdk-17"
)

set "PATH=%JAVA_HOME%\bin;%SCRIPT_DIR%.mvn\apache-maven-3.9.9\bin;%PATH%"
call "%SCRIPT_DIR%.mvn\apache-maven-3.9.9\bin\mvn.cmd" %*
exit /b %ERRORLEVEL%

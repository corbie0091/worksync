@echo off
echo 버전 업데이트 중...

for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set dt=%%a
set VERSION=v%dt:~0,4%.%dt:~4,2%.%dt:~6,2%.%dt:~8,4%

powershell -Command "(Get-Content service-worker.js) -replace \"const APP_VERSION = '.*'\", \"const APP_VERSION = '%VERSION%'\" | Set-Content service-worker.js"

echo 버전: %VERSION%
echo.

git add .
git commit -m "deploy %VERSION%"
git push

echo.
echo 배포 완료! 버전: %VERSION%
pause
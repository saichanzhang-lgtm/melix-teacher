@echo off
echo ============================================
echo   Beijing K12 English AI Tutor - Deploy
echo ============================================
echo.
echo 1. Opening firewall port 3000...
netsh advfirewall firewall add rule name="BeijingTutor-3000" dir=in action=allow protocol=TCP localport=3000
echo.
echo 2. Starting server...
cd /d %~dp0web
start "BeijingTutor" node server.js
echo.
echo ============================================
echo   DEPLOYED!
echo.
echo   本地访问: http://localhost:3000
echo   公网访问: http://YOUR_IP:3000
echo   登录页面: http://localhost:3000/login.html
echo.
echo   开发模式验证码: 123456
echo ============================================
pause


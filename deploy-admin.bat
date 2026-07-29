@echo off
REM === Beijing Tutor — 一键上线 (右键以管理员身份运行) ===
echo 🚀 正在部署 Beijing English AI Tutor Platform...
netsh advfirewall firewall add rule name="BeijingTutor-3000" dir=in action=allow protocol=TCP localport=3000 >/dev/null 2>&1
cd /d "%~dp0web"
start "BeijingTutor" node server.js
timeout /t 3 >/dev/null
echo.
echo ✅ 部署完成！
echo.
for /f "tokens=*" %%i in ('curl -s --connect-timeout 3 ifconfig.me 2^>nul') do set PUBIP=%%i
echo 📱 公网访问: http://%PUBIP%:3000
echo 💻 本地访问: http://localhost:3000
echo 🔑 登录页面: http://localhost:3000/login.html
echo 🔐 验证码(开发): 123456
echo.
echo 按任意键退出...
pause >/dev/null


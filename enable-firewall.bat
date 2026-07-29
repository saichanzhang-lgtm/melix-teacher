@echo off
title 北京K12英语AI家教平台 - 手机端访问配置
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║  📱 北京K12英语AI家教平台 - 网络配置     ║
echo   ╚══════════════════════════════════════════╝
echo.
echo   正在配置防火墙，开放 3000 端口...
netsh advfirewall firewall add rule name="BeijingEnglishTutor" dir=in action=allow protocol=TCP localport=3000 2>nul
if %errorlevel%==0 (
    echo   ✅ 防火墙规则已添加成功！
) else (
    echo   ⚠️ 防火墙规则已存在或添加失败（可能已配置过）
)
echo.
echo   ┌────────────────────────────────────────┐
echo   │  📱 手机访问地址：                      │
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo   │  http://%%a:3000                      │
)
echo   │                                        │
echo   │  💡 注意：                              │
echo   │  1. 手机和电脑必须连同一个WiFi          │
echo   │  2. 请用手机浏览器打开（非微信）        │
echo   │  3. 微信内置浏览器可能无法访问本地地址  │
echo   │  4. 如仍无法访问，请关闭手机VPN/代理    │
echo   └────────────────────────────────────────┘
echo.
echo   按任意键退出...
pause >nul

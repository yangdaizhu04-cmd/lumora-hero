@echo off
chcp 65001 >nul
title Lumora Hero - 本地预览

cd /d "%~dp0"

echo ==========================================
echo    Lumora Hero  本地预览启动器
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 没有检测到 Node.js。
    echo 请先访问 https://nodejs.org 安装 Node.js 18 或更高版本，然后重新双击本文件。
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] 首次运行，正在安装依赖，这一步可能需要一两分钟...
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，请检查网络后重新双击本文件。
        echo.
        pause
        exit /b 1
    )
    echo.
) else (
    echo [1/2] 依赖已就绪
)

echo [2/2] 正在启动本地服务，浏览器将自动打开 http://localhost:5173
echo.
echo 提示：保持本窗口开启即代表服务运行中；关闭本窗口或按 Ctrl+C 即可停止。
echo.

call npm run dev -- --open

echo.
echo 服务已停止，可按任意键关闭窗口。
pause >nul

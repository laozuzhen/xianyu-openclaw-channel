@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ============================================
:: 闲鱼 OpenClaw 频道插件 一键安装脚本 (Windows)
:: ============================================
:: 用法: install-openclaw.bat [--bridge-token TOKEN]

echo.
echo ============================================
echo   🐟 闲鱼 OpenClaw 频道插件 一键安装
echo ============================================
echo.

set "BRIDGE_TOKEN="
set "SKIP_PYTHON=0"
set "OPENCLAW_ONLY=0"

:: 解析参数
:parse_args
if "%~1"=="" goto :start
if "%~1"=="--bridge-token" (
    set "BRIDGE_TOKEN=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--skip-python" (
    set "SKIP_PYTHON=1"
    shift
    goto :parse_args
)
if "%~1"=="--openclaw-only" (
    set "OPENCLAW_ONLY=1"
    shift
    goto :parse_args
)
if "%~1"=="-h" goto :help
if "%~1"=="--help" goto :help
echo [ERROR] 未知参数: %~1
exit /b 1

:help
echo 用法: install-openclaw.bat [选项]
echo.
echo 选项:
echo   --bridge-token TOKEN   设置 Bridge API 认证 Token
echo   --skip-python          跳过 Python 依赖安装
echo   --openclaw-only        只安装 OpenClaw 插件
echo   -h, --help             显示帮助
exit /b 0

:start
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: 检测项目文件
if not exist "reply_server.py" (
    echo [INFO] 未检测到项目文件，正在克隆...
    git clone https://github.com/laozuzhen/xianyu-openclaw-channel.git xianyu-openclaw-channel
    cd xianyu-openclaw-channel
    set "PROJECT_DIR=%cd%"
)

echo [OK] 项目目录: %PROJECT_DIR%

:: ---- 1. Python 端安装 ----
if "%OPENCLAW_ONLY%"=="1" goto :install_plugin
if "%SKIP_PYTHON%"=="1" goto :install_plugin

echo [INFO] 安装 Python 依赖...
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 Python，请先安装 Python 3.11+
    exit /b 1
)

python --version

if not exist "venv" (
    echo [INFO] 创建虚拟环境...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo [OK] Python 依赖安装完成

:install_plugin
:: ---- 2. OpenClaw 插件安装 ----
set "PLUGIN_DIR=%PROJECT_DIR%openclaw-plugin"

if not exist "%PLUGIN_DIR%" (
    echo [ERROR] 未找到 openclaw-plugin 目录
    exit /b 1
)

echo [INFO] 安装 OpenClaw 插件 Node.js 依赖...

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 Node.js，请先安装 Node.js 16+
    exit /b 1
)

node --version

cd /d "%PLUGIN_DIR%"
call npm install --production 2>nul || call npm install
echo [OK] OpenClaw 插件依赖安装完成

cd /d "%PROJECT_DIR%"

:: ---- 3. 配置 Bridge Token ----
if "%BRIDGE_TOKEN%"=="" (
    for /f %%i in ('python -c "import secrets; print(secrets.token_urlsafe(32))"') do set "BRIDGE_TOKEN=%%i"
    echo [INFO] 已自动生成 Bridge Token
)

:: 写入 .env
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    ) else (
        echo BRIDGE_TOKEN=%BRIDGE_TOKEN%> .env
    )
)

:: 用 Python 更新 .env 中的 BRIDGE_TOKEN
python -c "
import re, sys
token = '%BRIDGE_TOKEN%'
try:
    with open('.env', 'r', encoding='utf-8') as f:
        content = f.read()
    if 'BRIDGE_TOKEN' in content:
        content = re.sub(r'^BRIDGE_TOKEN=.*$', f'BRIDGE_TOKEN={token}', content, flags=re.MULTILINE)
    else:
        content += f'\nBRIDGE_TOKEN={token}\n'
    with open('.env', 'w', encoding='utf-8') as f:
        f.write(content)
    print('[OK] 已更新 .env 中的 BRIDGE_TOKEN')
except Exception as e:
    print(f'[WARN] 更新 .env 失败: {e}')
"

:: ---- 4. 注册到 OpenClaw ----
set "CLAWDBOT_DIR=%USERPROFILE%\.clawdbot"
set "EXTENSIONS_DIR=%CLAWDBOT_DIR%\extensions"

if exist "%CLAWDBOT_DIR%" (
    echo [INFO] 检测到 OpenClaw 配置目录: %CLAWDBOT_DIR%

    if not exist "%EXTENSIONS_DIR%" mkdir "%EXTENSIONS_DIR%"

    set "LINK_TARGET=%EXTENSIONS_DIR%\xianyu"

    if exist "!LINK_TARGET!" rmdir /s /q "!LINK_TARGET!" 2>nul

    :: Windows 创建目录符号链接
    mklink /D "!LINK_TARGET!" "%PLUGIN_DIR%" >nul 2>&1
    if errorlevel 1 (
        echo [WARN] 创建符号链接失败（需要管理员权限），改用复制...
        xcopy /E /I /Y "%PLUGIN_DIR%" "!LINK_TARGET!" >nul
    )
    echo [OK] 已注册插件到 OpenClaw extensions
) else (
    echo [WARN] 未检测到 OpenClaw 配置目录
    echo [WARN] 请手动安装: moltbot plugins install -l "%PLUGIN_DIR%"
)

:: ---- 完成 ----
echo.
echo ============================================
echo   ✅ 安装完成！
echo ============================================
echo.
echo   Bridge Token: %BRIDGE_TOKEN%
echo.
echo   启动闲鱼自动回复系统:
echo     cd %PROJECT_DIR%
echo     python Start.py
echo.
echo   或使用 Docker:
echo     docker-compose up -d
echo.
echo   安装 OpenClaw 插件（如果上面没有自动注册）:
echo     moltbot plugins install -l "%PLUGIN_DIR%"
echo.
echo   重启 OpenClaw Gateway:
echo     moltbot restart
echo.

endlocal

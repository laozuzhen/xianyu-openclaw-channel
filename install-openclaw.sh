#!/bin/bash
# ============================================
# 闲鱼 OpenClaw 频道插件 一键安装脚本 (Linux/macOS)
# ============================================
# 用法: bash install-openclaw.sh [--bridge-token TOKEN]
#
# 此脚本会：
# 1. 克隆 xianyu-auto-reply（如果不在项目目录内）
# 2. 安装 Python 依赖
# 3. 安装 OpenClaw 频道插件的 Node.js 依赖
# 4. 配置 Bridge Token
# 5. 注册插件到 OpenClaw

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

BRIDGE_TOKEN=""
SKIP_PYTHON=false
OPENCLAW_ONLY=false

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --bridge-token) BRIDGE_TOKEN="$2"; shift 2 ;;
    --skip-python)  SKIP_PYTHON=true; shift ;;
    --openclaw-only) OPENCLAW_ONLY=true; shift ;;
    -h|--help)
      echo "用法: bash install-openclaw.sh [选项]"
      echo ""
      echo "选项:"
      echo "  --bridge-token TOKEN   设置 Bridge API 认证 Token"
      echo "  --skip-python          跳过 Python 依赖安装"
      echo "  --openclaw-only        只安装 OpenClaw 插件（不装 Python 端）"
      echo "  -h, --help             显示帮助"
      exit 0
      ;;
    *) err "未知参数: $1"; exit 1 ;;
  esac
done

echo ""
echo "============================================"
echo "  🐟 闲鱼 OpenClaw 频道插件 一键安装"
echo "============================================"
echo ""

# ---- 检测运行环境 ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# 如果脚本不在项目目录里（比如单独下载的），克隆项目
if [ ! -f "$PROJECT_DIR/reply_server.py" ]; then
  info "未检测到项目文件，正在克隆 xianyu-openclaw-channel..."
  REPO_URL="https://github.com/laozuzhen/xianyu-openclaw-channel.git"
  git clone "$REPO_URL" xianyu-openclaw-channel
  PROJECT_DIR="$(pwd)/xianyu-openclaw-channel"
  cd "$PROJECT_DIR"
  ok "项目克隆完成"
else
  cd "$PROJECT_DIR"
  ok "检测到项目目录: $PROJECT_DIR"
fi

# ---- 1. Python 端安装 ----
if [ "$OPENCLAW_ONLY" = false ] && [ "$SKIP_PYTHON" = false ]; then
  info "安装 Python 依赖..."
  if command -v python3 &>/dev/null; then
    PYTHON=python3
  elif command -v python &>/dev/null; then
    PYTHON=python
  else
    err "未找到 Python，请先安装 Python 3.11+"
    exit 1
  fi

  PY_VER=$($PYTHON --version 2>&1 | grep -oP '\d+\.\d+')
  info "Python 版本: $PY_VER"

  if [ ! -d "venv" ]; then
    info "创建虚拟环境..."
    $PYTHON -m venv venv
  fi

  source venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  ok "Python 依赖安装完成"
fi

# ---- 2. OpenClaw 插件安装 ----
PLUGIN_DIR="$PROJECT_DIR/openclaw-plugin"

if [ ! -d "$PLUGIN_DIR" ]; then
  err "未找到 openclaw-plugin 目录"
  err "请确保项目包含 openclaw-plugin/ 目录"
  exit 1
fi

info "安装 OpenClaw 插件 Node.js 依赖..."

if ! command -v node &>/dev/null; then
  err "未找到 Node.js，请先安装 Node.js 16+"
  exit 1
fi

NODE_VER=$(node --version)
info "Node.js 版本: $NODE_VER"

cd "$PLUGIN_DIR"
npm install --production 2>/dev/null || npm install
ok "OpenClaw 插件依赖安装完成"

cd "$PROJECT_DIR"

# ---- 3. 配置 Bridge Token ----
if [ -z "$BRIDGE_TOKEN" ]; then
  # 生成随机 Token
  if command -v python3 &>/dev/null; then
    BRIDGE_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
  elif command -v openssl &>/dev/null; then
    BRIDGE_TOKEN=$(openssl rand -base64 32 | tr -d '=/+' | head -c 43)
  else
    BRIDGE_TOKEN="changeme-$(date +%s)"
    warn "无法生成安全 Token，请手动修改 .env 中的 BRIDGE_TOKEN"
  fi
  info "已自动生成 Bridge Token"
fi

# 写入 .env
if [ -f ".env" ]; then
  if grep -q "BRIDGE_TOKEN" .env; then
    sed -i "s/^BRIDGE_TOKEN=.*/BRIDGE_TOKEN=$BRIDGE_TOKEN/" .env
    ok "已更新 .env 中的 BRIDGE_TOKEN"
  else
    echo "" >> .env
    echo "BRIDGE_TOKEN=$BRIDGE_TOKEN" >> .env
    ok "已添加 BRIDGE_TOKEN 到 .env"
  fi
else
  cp .env.example .env 2>/dev/null || echo "BRIDGE_TOKEN=$BRIDGE_TOKEN" > .env
  sed -i "s/^BRIDGE_TOKEN=.*/BRIDGE_TOKEN=$BRIDGE_TOKEN/" .env
  ok "已创建 .env 并设置 BRIDGE_TOKEN"
fi

# ---- 4. 注册到 OpenClaw ----
CLAWDBOT_DIR="$HOME/.clawdbot"
EXTENSIONS_DIR="$CLAWDBOT_DIR/extensions"

if [ -d "$CLAWDBOT_DIR" ]; then
  info "检测到 OpenClaw 配置目录: $CLAWDBOT_DIR"

  # 创建符号链接到 extensions
  mkdir -p "$EXTENSIONS_DIR"
  LINK_TARGET="$EXTENSIONS_DIR/xianyu"

  if [ -L "$LINK_TARGET" ] || [ -d "$LINK_TARGET" ]; then
    rm -rf "$LINK_TARGET"
  fi

  ln -s "$PLUGIN_DIR" "$LINK_TARGET"
  ok "已创建符号链接: $LINK_TARGET -> $PLUGIN_DIR"

  # 提示配置 channels
  echo ""
  info "请在 OpenClaw 配置文件中添加闲鱼频道配置："
  echo ""
  echo "  openclaw.json → channels.xianyu:"
  echo "  {"
  echo "    \"channels\": {"
  echo "      \"xianyu\": {"
  echo "        \"enabled\": true,"
  echo "        \"apiUrl\": \"http://localhost:8080\","
  echo "        \"bridgeToken\": \"$BRIDGE_TOKEN\""
  echo "      }"
  echo "    }"
  echo "  }"
  echo ""
else
  warn "未检测到 OpenClaw 配置目录 (~/.clawdbot)"
  warn "请手动安装插件: moltbot plugins install -l $PLUGIN_DIR"
fi

# ---- 完成 ----
echo ""
echo "============================================"
echo -e "  ${GREEN}✅ 安装完成！${NC}"
echo "============================================"
echo ""
echo "  Bridge Token: $BRIDGE_TOKEN"
echo ""
echo "  启动闲鱼自动回复系统:"
echo "    cd $PROJECT_DIR"
echo "    python Start.py"
echo ""
echo "  或使用 Docker:"
echo "    docker-compose up -d"
echo ""
echo "  安装 OpenClaw 插件（如果上面没有自动注册）:"
echo "    moltbot plugins install -l $PLUGIN_DIR"
echo ""
echo "  重启 OpenClaw Gateway 使插件生效:"
echo "    moltbot restart"
echo ""

/**
 * Bridge Process Manager
 *
 * 管理闲鱼自动回复 Python 进程的生命周期。
 * 当 OpenClaw Gateway 启动时自动启动 Python 进程，
 * 停止时自动关闭。
 */

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

interface BridgeLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 3000;

export class BridgeProcessManager {
  private proc: ChildProcess | null = null;
  private logger: BridgeLogger | null = null;
  private restartCount = 0;
  private stopping = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  /** Python 项目根目录（xianyu-auto-reply-repo/） */
  private get pythonRoot(): string {
    // 编译后: openclaw-plugin/dist/src/bridge-process.js → 上三级 = xianyu-auto-reply-repo/
    return path.resolve(__dirname, "..", "..", "..");
  }

  async start(logger: BridgeLogger): Promise<void> {
    this.logger = logger;
    this.stopping = false;
    this.restartCount = 0;
    this.spawn();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.proc) {
      this.logger?.info("[bridge-process] 正在停止 Python 进程...");
      this.proc.kill("SIGTERM");
      // 给进程 5 秒优雅退出，否则强杀
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.proc && !this.proc.killed) {
            this.proc.kill("SIGKILL");
          }
          resolve();
        }, 5000);
        this.proc?.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.proc = null;
      this.logger?.info("[bridge-process] Python 进程已停止");
    }
  }

  private spawn(): void {
    const pythonBin = this.detectPython();
    const entryScript = this.detectEntryScript();

    this.logger?.info(
      `[bridge-process] 启动: ${pythonBin} ${entryScript} (cwd: ${this.pythonRoot})`,
    );

    this.proc = spawn(pythonBin, [entryScript], {
      cwd: this.pythonRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
    });

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString("utf-8").trimEnd().split("\n");
      for (const line of lines) {
        this.logger?.info(`[python] ${line}`);
      }
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString("utf-8").trimEnd().split("\n");
      for (const line of lines) {
        this.logger?.warn(`[python:err] ${line}`);
      }
    });

    this.proc.on("exit", (code, signal) => {
      this.proc = null;
      if (this.stopping) return;

      this.logger?.warn(
        `[bridge-process] Python 进程退出 (code=${code}, signal=${signal})`,
      );

      if (this.restartCount < MAX_RESTARTS) {
        this.restartCount++;
        this.logger?.info(
          `[bridge-process] ${RESTART_DELAY_MS}ms 后重启 (${this.restartCount}/${MAX_RESTARTS})...`,
        );
        this.restartTimer = setTimeout(() => this.spawn(), RESTART_DELAY_MS);
      } else {
        this.logger?.error(
          `[bridge-process] 已达最大重启次数 (${MAX_RESTARTS})，不再重启`,
        );
      }
    });

    this.proc.on("error", (err) => {
      this.logger?.error(`[bridge-process] 启动失败: ${err.message}`);
    });
  }

  /** 检测可用的 Python 可执行文件，优先使用 venv */
  private detectPython(): string {
    const root = this.pythonRoot;
    const isWin = process.platform === "win32";

    // 检查 venv
    const venvDirs = [".venv", "venv"];
    for (const vdir of venvDirs) {
      const bin = isWin
        ? path.join(root, vdir, "Scripts", "python.exe")
        : path.join(root, vdir, "bin", "python");
      if (fs.existsSync(bin)) {
        this.logger?.info(`[bridge-process] 使用 venv: ${bin}`);
        return bin;
      }
    }

    // 回退到系统 python
    return isWin ? "python" : "python3";
  }

  /** 检测 Python 入口脚本 */
  private detectEntryScript(): string {
    const root = this.pythonRoot;
    if (fs.existsSync(path.join(root, "Start.py"))) return "Start.py";
    if (fs.existsSync(path.join(root, "reply_server.py")))
      return "reply_server.py";
    return "Start.py";
  }
}

/**
 * Bridge Process Manager
 *
 * 使用端口检查机制防止多个 Gateway 实例同时启动 Python 进程。
 */

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";

interface BridgeLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 3000;
const BRIDGE_PORT = 8080;

// Global singleton flags
let isStarting = false;
let globalProc: ChildProcess | null = null;

export class BridgeProcessManager {
  private proc: ChildProcess | null = null;
  private logger: BridgeLogger | null = null;
  private restartCount = 0;
  private stopping = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  private get pythonRoot(): string {
    return "C:\\Users\\Administrator\\.openclaw\\extensions\\xianyu";
  }

  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on("connect", () => { socket.destroy(); resolve(true); });
      socket.on("timeout", () => { socket.destroy(); resolve(false); });
      socket.on("error", () => { resolve(false); });
      socket.connect(port, "127.0.0.1");
    });
  }

  async start(logger: BridgeLogger): Promise<void> {
    this.logger = logger;
    
    if (isStarting) {
      this.logger.warn("[bridge-process] Instance already starting, skip");
      return;
    }
    
    if (globalProc && !globalProc.killed) {
      this.logger.warn("[bridge-process] Global process exists, skip");
      return;
    }
    
    const portInUse = await this.isPortInUse(BRIDGE_PORT);
    if (portInUse) {
      this.logger.info(`[bridge-process] Port ${BRIDGE_PORT} in use, skip (other instance running)`);
      return;
    }
    
    isStarting = true;
    this.stopping = false;
    this.restartCount = 0;
    this.spawn();
    isStarting = false;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    isStarting = false;
    
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    
    // Clear global reference first to prevent race conditions
    const procToKill = this.proc;
    this.proc = null;
    globalProc = null;
    
    if (procToKill && !procToKill.killed) {
      this.logger?.info("[bridge-process] Stopping Python process...");
      
      try {
        // On Windows, use SIGKILL for immediate termination
        // SIGTERM is not reliably supported on Windows
        if (process.platform === "win32") {
          procToKill.kill("SIGKILL");
        } else {
          procToKill.kill("SIGTERM");
        }
        
        // Wait for exit with timeout, but don't hang if already dead
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if still running
            try {
              if (!procToKill.killed) {
                procToKill.kill("SIGKILL");
              }
            } catch (e) {
              // Ignore errors - process might already be dead
            }
            resolve();
          }, 3000);
          
          procToKill.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
          
          // Check if already dead
          if (procToKill.killed || procToKill.exitCode !== null) {
            clearTimeout(timeout);
            resolve();
          }
        });
        
        this.logger?.info("[bridge-process] Python process stopped");
      } catch (err: any) {
        this.logger?.warn(`[bridge-process] Error stopping process: ${err.message}`);
      }
    }
  }

  private spawn(): void {
    const pythonBin = this.detectPython();
    const entryScript = this.detectEntryScript();

    this.logger?.info(`[bridge-process] Start: ${pythonBin} ${entryScript}`);

    this.proc = spawn(pythonBin, [entryScript], {
      cwd: this.pythonRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
    });
    
    globalProc = this.proc;

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf-8").trimEnd().split("\n")) {
        this.logger?.info(`[python] ${line}`);
      }
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf-8").trimEnd().split("\n")) {
        this.logger?.warn(`[python:err] ${line}`);
      }
    });

    this.proc.on("exit", (code, signal) => {
      this.proc = null;
      globalProc = null;
      if (this.stopping) return;

      this.logger?.warn(`[bridge-process] Python exited (code=${code}, signal=${signal})`);

      this.isPortInUse(BRIDGE_PORT).then((inUse) => {
        if (inUse) {
          this.logger?.info(`[bridge-process] Port ${BRIDGE_PORT} taken, skip restart`);
          return;
        }
        
        if (this.restartCount < MAX_RESTARTS) {
          this.restartCount++;
          this.logger?.info(`[bridge-process] Restart in ${RESTART_DELAY_MS}ms (${this.restartCount}/${MAX_RESTARTS})`);
          this.restartTimer = setTimeout(() => this.spawn(), RESTART_DELAY_MS);
        } else {
          this.logger?.error(`[bridge-process] Max restarts reached (${MAX_RESTARTS})`);
        }
      });
    });

    this.proc.on("error", (err) => {
      this.logger?.error(`[bridge-process] Start failed: ${err.message}`);
    });
  }

  private detectPython(): string {
    const root = this.pythonRoot;
    const isWin = process.platform === "win32";
    for (const vdir of [".venv", "venv"]) {
      const bin = isWin ? path.join(root, vdir, "Scripts", "python.exe") : path.join(root, vdir, "bin", "python");
      if (fs.existsSync(bin)) {
        this.logger?.info(`[bridge-process] Using venv: ${bin}`);
        return bin;
      }
    }
    return isWin ? "python" : "python3";
  }

  private detectEntryScript(): string {
    const root = this.pythonRoot;
    if (fs.existsSync(path.join(root, "Start.py"))) return "Start.py";
    if (fs.existsSync(path.join(root, "reply_server.py"))) return "reply_server.py";
    return "Start.py";
  }
}
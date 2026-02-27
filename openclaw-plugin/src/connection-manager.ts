/**
 * SSE Connection Manager for Xianyu Bridge API
 *
 * Provides robust SSE connection lifecycle management with:
 * - Exponential backoff with jitter for reconnection attempts
 * - Configurable max attempts and delay parameters
 * - Connection state tracking and event handling
 * - Proper cleanup via AbortController
 *
 * 📦 模式来源：openclaw-channel-dingtalk-repo/src/connection-manager.ts
 * 📝 简化为 SSE 连接管理（不需要 DWClient / WebSocket 监控）
 */

import type { BridgeMessageEvent, ConnectionManagerConfig } from "./types";
import { ConnectionState } from "./types";
import { BridgeClient } from "./bridge-client";

export class ConnectionManager {
  private config: ConnectionManagerConfig;
  private log?: any;
  private accountId: string;
  private bridgeClient: BridgeClient;

  // Connection state
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private attemptCount: number = 0;
  private stopped: boolean = false;

  // Abort control for the active SSE connection
  private abortController?: AbortController;

  // Reconnect timer
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  // Sleep abort control
  private sleepTimeout?: ReturnType<typeof setTimeout>;
  private sleepResolve?: () => void;

  // Stop signal for waitForStop()
  private stopPromiseResolvers: Array<() => void> = [];

  // Last event ID for SSE resume
  private lastEventId?: string;

  constructor(
    bridgeClient: BridgeClient,
    accountId: string,
    config: ConnectionManagerConfig,
    log?: any,
  ) {
    this.bridgeClient = bridgeClient;
    this.accountId = accountId;
    this.config = config;
    this.log = log;
  }

  private notifyStateChange(error?: string): void {
    this.config.onStateChange?.(this.state, error);
  }

  /**
   * Calculate next reconnection delay with exponential backoff and jitter.
   * Formula: min(initialDelay * 2^attempt, maxDelay) + random * jitter * delay
   */
  private calculateNextDelay(attempt: number): number {
    const { initialDelay, maxDelay, jitter } = this.config;
    const exponentialDelay = initialDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    const jitterAmount = cappedDelay * jitter * Math.random();
    return Math.max(100, Math.floor(cappedDelay + jitterAmount));
  }

  /**
   * Connect with robust retry logic.
   * Establishes SSE connection via BridgeClient, retries on failure.
   *
   * Uses an onConnected callback from BridgeClient.connectSSE to detect
   * when the HTTP fetch succeeds and the SSE stream is ready. This is
   * deterministic — no timing-based guessing (Promise.race / setTimeout).
   *
   * Flow:
   * 1. connectSSE calls fetch(). If fetch fails → catch → retry with backoff.
   * 2. If fetch succeeds → onConnected fires → state = CONNECTED, reset attemptCount.
   * 3. connectSSE blocks reading the stream. When stream ends → reconnect (reset counter).
   */
  public async connect(onMessage: (msg: BridgeMessageEvent) => void): Promise<void> {
    if (this.stopped) {
      throw new Error("Cannot connect: connection manager is stopped");
    }

    this.clearReconnectTimer();
    this.log?.info?.(`[${this.accountId}] Starting Xianyu Bridge SSE connection...`);

    while (!this.stopped) {
      this.attemptCount++;
      this.state = ConnectionState.CONNECTING;
      this.notifyStateChange();

      this.log?.info?.(
        `[${this.accountId}] SSE connection attempt ${this.attemptCount}/${this.config.maxAttempts}...`,
      );

      // Track whether this attempt successfully connected (fetch OK)
      let didConnect = false;

      try {
        this.abortController = new AbortController();

        // connectSSE will:
        // - throw immediately if fetch fails (Python not running, HTTP error, etc.)
        // - call onConnected() once fetch succeeds and stream is ready
        // - then block reading the stream until it ends or is aborted
        // - throw "SSE connection closed by server" when stream ends normally
        await this.bridgeClient.connectSSE(
          onMessage,
          this.abortController.signal,
          this.lastEventId,
          () => {
            // onConnected: fetch succeeded, SSE stream is open
            didConnect = true;
            this.state = ConnectionState.CONNECTED;
            this.attemptCount = 0;
            this.notifyStateChange();
            this.log?.info?.(`[${this.accountId}] Bridge SSE connection established`);
          },
        );

        // connectSSE resolved normally (shouldn't happen — it always throws on stream end)
        // Treat as stream ended
      } catch (err: any) {
        if (this.stopped) return;

        if (didConnect) {
          // Was connected, then stream ended — this is a runtime disconnection, not a connect failure.
          this.log?.warn?.(`[${this.accountId}] SSE stream ended: ${err.message}`);
          this.state = ConnectionState.DISCONNECTED;
          this.notifyStateChange("SSE stream ended");
          // Reset attempt counter since we had a successful connection
          this.attemptCount = 0;

          const delay = this.calculateNextDelay(0);
          this.log?.info?.(
            `[${this.accountId}] SSE disconnected, reconnecting in ${(delay / 1000).toFixed(2)}s...`,
          );
          await this.sleep(delay);
          if (this.stopped) return;
          continue;
        }

        // Never connected — this is a connection failure
        this.log?.error?.(
          `[${this.accountId}] SSE connection attempt ${this.attemptCount} failed: ${err.message}`,
        );

        if (this.attemptCount >= this.config.maxAttempts) {
          this.state = ConnectionState.FAILED;
          this.notifyStateChange("Max connection attempts reached");
          this.log?.error?.(
            `[${this.accountId}] Max attempts (${this.config.maxAttempts}) reached. Start the Python Bridge API and restart the plugin.`,
          );
          this.resolveStopPromises();
          return; // Stop silently
        }

        const nextDelay = this.calculateNextDelay(this.attemptCount - 1);
        this.log?.warn?.(
          `[${this.accountId}] Will retry in ${(nextDelay / 1000).toFixed(2)}s (attempt ${this.attemptCount + 1}/${this.config.maxAttempts})`,
        );

        await this.sleep(nextDelay);
        if (this.stopped) return;
      }
    }
  }

  /**
   * Stop the connection manager and cleanup resources.
   */
  public stop(): void {
    if (this.stopped) return;

    this.log?.info?.(`[${this.accountId}] Stopping SSE connection manager...`);

    this.stopped = true;
    this.state = ConnectionState.DISCONNECTING;

    // Abort active SSE connection
    this.abortController?.abort();
    this.abortController = undefined;

    // Clear reconnect timer
    this.clearReconnectTimer();

    // Cancel any in-flight sleep
    this.cancelSleep();

    this.state = ConnectionState.DISCONNECTED;
    this.log?.info?.(`[${this.accountId}] SSE connection manager stopped`);

    // Resolve all pending waitForStop() promises
    this.resolveStopPromises();
  }

  /**
   * Returns a Promise that resolves when the connection manager is stopped or failed.
   */
  public waitForStop(): Promise<void> {
    if (this.stopped || this.state === ConnectionState.FAILED) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.stopPromiseResolvers.push(resolve);
    });
  }

  /** Get current connection state */
  public getState(): ConnectionState {
    return this.state;
  }

  /** Check if connection is active */
  public isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /** Check if connection manager is stopped */
  public isStopped(): boolean {
    return this.stopped;
  }

  private resolveStopPromises(): void {
    for (const resolve of this.stopPromiseResolvers) {
      resolve();
    }
    this.stopPromiseResolvers = [];
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.sleepResolve = resolve;
      this.sleepTimeout = setTimeout(() => {
        this.sleepTimeout = undefined;
        this.sleepResolve = undefined;
        resolve();
      }, ms);
    });
  }

  private cancelSleep(): void {
    if (this.sleepTimeout) {
      clearTimeout(this.sleepTimeout);
      this.sleepTimeout = undefined;
    }
    if (this.sleepResolve) {
      this.sleepResolve();
      this.sleepResolve = undefined;
    }
  }
}

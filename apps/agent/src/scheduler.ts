export class AgentScheduler {
  private timer?: NodeJS.Timeout;
  private active?: AbortController;
  private running = false;
  private stopped = false;
  private lastWallClock = Date.now();

  constructor(
    private readonly input: Readonly<{
      intervalMs: number;
      task: (signal: AbortSignal) => Promise<void>;
      random?: () => number;
      now?: () => number;
      onClockRollback?: () => void;
      onTaskError?: (error: unknown) => void;
    }>
  ) {}

  start(): void {
    if (this.running || this.stopped) throw new Error("scheduler_state_invalid");
    this.running = true;
    const maximumJitter = Math.min(Math.floor(this.input.intervalMs * 0.1), 30_000);
    const random = this.input.random ?? Math.random;
    this.schedule(Math.floor(maximumJitter * Math.max(0, Math.min(1, random()))));
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.active?.abort(new Error("agent_stopping"));
    while (this.active) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.run();
    }, delayMs);
    this.timer.unref();
  }

  private async run(): Promise<void> {
    if (this.stopped || this.active) return;
    const now = (this.input.now ?? Date.now)();
    if (now < this.lastWallClock - 1_000) this.input.onClockRollback?.();
    this.lastWallClock = now;
    const controller = new AbortController();
    this.active = controller;
    try {
      await this.input.task(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) this.input.onTaskError?.(error);
    } finally {
      this.active = undefined;
      if (!this.stopped) this.schedule(this.input.intervalMs);
    }
  }
}

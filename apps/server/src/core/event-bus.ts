import { EventEmitter } from "node:events";
import type { InternalEvent } from "@streamops/shared";

export type EventHandler<T extends InternalEvent = InternalEvent> = (event: T) => void | Promise<void>;

export class EventBus {
  private readonly emitter = new EventEmitter();

  on<T extends InternalEvent>(type: T["type"], handler: EventHandler<T>): void {
    this.emitter.on(type, (event) => {
      void Promise.resolve(handler(event as T)).catch((error) => {
        this.emitter.emit("handler.error", { type, error });
      });
    });
  }

  onAny(handler: EventHandler): void {
    this.emitter.on("*", (event) => {
      void Promise.resolve(handler(event)).catch((error) => {
        this.emitter.emit("handler.error", { type: "*", error });
      });
    });
  }

  emit(event: InternalEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
  }

  onHandlerError(handler: (payload: { type: string; error: unknown }) => void): void {
    this.emitter.on("handler.error", handler);
  }
}

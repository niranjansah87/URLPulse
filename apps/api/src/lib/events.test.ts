import { describe, it, expect, vi } from "vitest";
import { BATCH_EVENTS_CHANNEL, buildBatchUpdatedMessage } from "@urlpulse/types";
import { createEventBus, type SubscriberClient } from "./events";

/** Fake subscriber that lets a test drive incoming messages. */
function fakeSubscriber() {
  let handler: ((channel: string, message: string) => void) | undefined;
  const sub: SubscriberClient = {
    subscribe: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
    on: vi.fn((_event, listener) => {
      handler = listener;
      return sub;
    }),
  };
  return { sub, emit: (channel: string, message: string) => handler?.(channel, message) };
}

describe("createEventBus", () => {
  it("delivers a notification only to clients of the matching batch", () => {
    const { sub, emit } = fakeSubscriber();
    const bus = createEventBus(sub);
    const a = vi.fn();
    const b = vi.fn();
    bus.addClient("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", a);
    bus.addClient("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", b);

    emit(BATCH_EVENTS_CHANNEL, buildBatchUpdatedMessage("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));

    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
  });

  it("stops delivering after a client is removed (no leak)", () => {
    const { sub, emit } = fakeSubscriber();
    const bus = createEventBus(sub);
    const send = vi.fn();
    const remove = bus.addClient("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", send);
    remove();

    emit(BATCH_EVENTS_CHANNEL, buildBatchUpdatedMessage("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));

    expect(send).not.toHaveBeenCalled();
    expect(bus.clientCount("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBe(0);
  });

  it("ignores malformed messages", () => {
    const { sub, emit } = fakeSubscriber();
    const bus = createEventBus(sub);
    const send = vi.fn();
    bus.addClient("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", send);
    expect(() => emit(BATCH_EVENTS_CHANNEL, "not json")).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

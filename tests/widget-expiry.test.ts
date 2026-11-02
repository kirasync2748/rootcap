import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleExpiry } from "../lib/widget/expiry";

afterEach(() => vi.useRealTimers());
describe("widget token expiration", () => {
  it("waits for long lifetimes without overflowing browser timers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const expire = vi.fn();
    scheduleExpiry(Date.now() + 2_147_483_647 + 10000, expire);
    vi.advanceTimersByTime(2_147_483_647);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(9999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
  });
  it("cancels expiration when verification is reset", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const cancel = scheduleExpiry(Date.now() + 1000, expire);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(expire).not.toHaveBeenCalled();
  });
});

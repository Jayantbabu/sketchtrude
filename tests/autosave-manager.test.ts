import { afterEach, describe, expect, it, vi } from "vitest";
import { AutosaveManager } from "@/persistence/autosave/autosave-manager";

describe("AutosaveManager", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("contains rejected scheduled local saves after the controller reports them", async () => {
    vi.useFakeTimers();
    const onLocalSave = vi.fn(async () => {
      throw new Error("recoverable local save failure");
    });
    const manager = new AutosaveManager({
      onLocalSave,
      onCloudSave: vi.fn(),
      localDebounceMs: 10,
      isOnline: () => false,
    });

    manager.scheduleLocal();
    await vi.advanceTimersByTimeAsync(10);

    expect(onLocalSave).toHaveBeenCalledOnce();
    manager.dispose();
  });
});

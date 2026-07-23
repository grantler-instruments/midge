import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  getBridgeStatus,
  listenBridgeLogs,
  listMidiPortNames,
  startBridge,
  stopBridge,
} from "./bridge.tauri";

describe("Tauri bridge", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(listen).mockReset();
  });

  it("invokes native bridge commands", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ inputs: ["in"], outputs: ["out"] })
      .mockResolvedValueOnce({ running: true })
      .mockResolvedValue(undefined);
    const config = { url: "mqtt://localhost:1883", prefix: "remote" };

    await expect(listMidiPortNames()).resolves.toEqual({ inputs: ["in"], outputs: ["out"] });
    await expect(getBridgeStatus()).resolves.toEqual({ running: true });
    await startBridge(config);
    await stopBridge();

    expect(invoke).toHaveBeenNthCalledWith(1, "list_midi_port_names");
    expect(invoke).toHaveBeenNthCalledWith(2, "get_bridge_status");
    expect(invoke).toHaveBeenNthCalledWith(3, "start_bridge", { config });
    expect(invoke).toHaveBeenNthCalledWith(4, "stop_bridge");
  });

  it("forwards log payloads and only unregisters once", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);
    const onLog = vi.fn();

    const dispose = await listenBridgeLogs(onLog);
    const callback = vi.mocked(listen).mock.calls[0][1] as (event: {
      payload: { direction: string; detail: string };
    }) => void;
    callback({ payload: { direction: "in", detail: "note-on" } });
    dispose();
    dispose();

    expect(listen).toHaveBeenCalledWith("bridge://log", expect.any(Function));
    expect(onLog).toHaveBeenCalledWith({ direction: "in", detail: "note-on" });
    expect(unlisten).toHaveBeenCalledOnce();
  });
});

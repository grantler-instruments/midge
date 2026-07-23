import { describe, expect, it } from "vitest";
import {
  getBridgeStatus,
  listenBridgeLogs,
  listMidiPortNames,
  startBridge,
  stopBridge,
} from "./bridge.web";

describe("web bridge", () => {
  it("returns unavailable bridge defaults", async () => {
    await expect(listMidiPortNames()).resolves.toEqual({ inputs: [], outputs: [] });
    await expect(getBridgeStatus()).resolves.toEqual({ running: false });
    await expect(stopBridge()).resolves.toBeUndefined();
  });

  it("reports that starting the bridge requires the desktop app", async () => {
    await expect(startBridge({ url: "mqtt://localhost:1883", prefix: "remote" })).rejects.toThrow(
      "only available in the desktop app",
    );
  });

  it("returns a no-op log listener", async () => {
    const unlisten = await listenBridgeLogs(() => {});

    expect(unlisten()).toBeUndefined();
  });
});

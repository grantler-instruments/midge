import { describe, expect, it } from "vitest";
import {
  connectMqtt,
  disconnectMqtt,
  getBridgeStatus,
  listenBridgeLogs,
  listMidiPortNames,
  startMidi,
  stopMidi,
} from "./bridge.web";

describe("web bridge", () => {
  it("returns unavailable bridge defaults", async () => {
    await expect(listMidiPortNames()).resolves.toEqual({ inputs: [], outputs: [] });
    await expect(getBridgeStatus()).resolves.toEqual({
      mqttConnected: false,
      midiListening: false,
    });
    await expect(disconnectMqtt()).resolves.toBeUndefined();
    await expect(stopMidi()).resolves.toBeUndefined();
  });

  it("reports that starting the bridge requires the desktop app", async () => {
    const config = { url: "mqtt://localhost:1883", prefix: "remote" };
    await expect(connectMqtt(config)).rejects.toThrow("only available in the desktop app");
    await expect(startMidi(config)).rejects.toThrow("only available in the desktop app");
  });

  it("returns a no-op log listener", async () => {
    const unlisten = await listenBridgeLogs(() => {});

    expect(unlisten()).toBeUndefined();
  });
});

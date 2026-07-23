import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPlatform } = vi.hoisted(() => ({
  getPlatform: vi.fn<() => "tauri" | "web">(),
}));

vi.mock("./index", () => ({ getPlatform }));
vi.mock("./bridge.tauri", () => ({
  connectMqtt: vi.fn(),
  disconnectMqtt: vi.fn(),
  getBridgeStatus: vi.fn(),
  listMidiPortNames: vi.fn(),
  startMidi: vi.fn(),
  stopMidi: vi.fn(),
  listenBridgeLogs: vi.fn(),
}));
vi.mock("./bridge.web", () => ({
  connectMqtt: vi.fn(),
  disconnectMqtt: vi.fn(),
  getBridgeStatus: vi.fn(),
  listMidiPortNames: vi.fn(),
  startMidi: vi.fn(),
  stopMidi: vi.fn(),
  listenBridgeLogs: vi.fn(),
}));

import {
  connectMqtt,
  disconnectMqtt,
  getBridgeStatus,
  listenBridgeLogs,
  listMidiPortNames,
  startMidi,
  stopMidi,
} from "./bridge";
import * as tauriBridge from "./bridge.tauri";
import * as webBridge from "./bridge.web";

describe("bridge platform facade", () => {
  beforeEach(() => {
    getPlatform.mockReset();
    vi.clearAllMocks();
  });

  it("routes bridge operations to Tauri", async () => {
    getPlatform.mockReturnValue("tauri");
    const config = { url: "mqtt://localhost:1883", prefix: "remote" };
    const onLog = vi.fn();
    const unlisten = vi.fn();
    vi.mocked(tauriBridge.listMidiPortNames).mockResolvedValue({
      inputs: ["in"],
      outputs: ["out"],
    });
    vi.mocked(tauriBridge.getBridgeStatus).mockResolvedValue({
      mqttConnected: true,
      midiListening: false,
    });
    vi.mocked(tauriBridge.listenBridgeLogs).mockResolvedValue(unlisten);

    await expect(listMidiPortNames()).resolves.toEqual({ inputs: ["in"], outputs: ["out"] });
    await expect(getBridgeStatus()).resolves.toEqual({ mqttConnected: true, midiListening: false });
    await connectMqtt(config);
    await disconnectMqtt();
    await startMidi(config);
    await stopMidi();
    await expect(listenBridgeLogs(onLog)).resolves.toBe(unlisten);

    expect(tauriBridge.connectMqtt).toHaveBeenCalledWith(config);
    expect(tauriBridge.disconnectMqtt).toHaveBeenCalledOnce();
    expect(tauriBridge.startMidi).toHaveBeenCalledWith(config);
    expect(tauriBridge.stopMidi).toHaveBeenCalledOnce();
    expect(tauriBridge.listenBridgeLogs).toHaveBeenCalledWith(onLog);
    expect(webBridge.connectMqtt).not.toHaveBeenCalled();
  });

  it("routes bridge operations to the web implementation", async () => {
    getPlatform.mockReturnValue("web");
    vi.mocked(webBridge.listMidiPortNames).mockResolvedValue({ inputs: [], outputs: [] });

    await expect(listMidiPortNames()).resolves.toEqual({ inputs: [], outputs: [] });

    expect(webBridge.listMidiPortNames).toHaveBeenCalledOnce();
    expect(tauriBridge.listMidiPortNames).not.toHaveBeenCalled();
  });
});

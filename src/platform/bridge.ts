import type { BridgeConfig, BridgeLogEntry, BridgeStatus, PortLists } from "../types/bridge";
import { getPlatform } from "./index";

export async function listMidiPortNames(): Promise<PortLists> {
  if (getPlatform() === "tauri") {
    const { listMidiPortNames: list } = await import("./bridge.tauri");
    return list();
  }
  const { listMidiPortNames: list } = await import("./bridge.web");
  return list();
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  if (getPlatform() === "tauri") {
    const { getBridgeStatus: getStatus } = await import("./bridge.tauri");
    return getStatus();
  }
  const { getBridgeStatus: getStatus } = await import("./bridge.web");
  return getStatus();
}

export async function connectMqtt(config: BridgeConfig): Promise<void> {
  if (getPlatform() === "tauri") {
    const { connectMqtt: connect } = await import("./bridge.tauri");
    return connect(config);
  }
  const { connectMqtt: connect } = await import("./bridge.web");
  return connect(config);
}

export async function disconnectMqtt(): Promise<void> {
  if (getPlatform() === "tauri") {
    const { disconnectMqtt: disconnect } = await import("./bridge.tauri");
    return disconnect();
  }
  const { disconnectMqtt: disconnect } = await import("./bridge.web");
  return disconnect();
}

export async function startMidi(config: BridgeConfig): Promise<void> {
  if (getPlatform() === "tauri") {
    const { startMidi: start } = await import("./bridge.tauri");
    return start(config);
  }
  const { startMidi: start } = await import("./bridge.web");
  return start(config);
}

export async function stopMidi(): Promise<void> {
  if (getPlatform() === "tauri") {
    const { stopMidi: stop } = await import("./bridge.tauri");
    return stop();
  }
  const { stopMidi: stop } = await import("./bridge.web");
  return stop();
}

export async function listenBridgeLogs(
  onLog: (entry: BridgeLogEntry) => void,
): Promise<() => void> {
  if (getPlatform() === "tauri") {
    const { listenBridgeLogs: listen } = await import("./bridge.tauri");
    return listen(onLog);
  }
  const { listenBridgeLogs: listen } = await import("./bridge.web");
  return listen(onLog);
}

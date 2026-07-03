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

export async function startBridge(config: BridgeConfig): Promise<void> {
  if (getPlatform() === "tauri") {
    const { startBridge: start } = await import("./bridge.tauri");
    return start(config);
  }
  const { startBridge: start } = await import("./bridge.web");
  return start(config);
}

export async function stopBridge(): Promise<void> {
  if (getPlatform() === "tauri") {
    const { stopBridge: stop } = await import("./bridge.tauri");
    return stop();
  }
  const { stopBridge: stop } = await import("./bridge.web");
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

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BridgeConfig, BridgeLogEntry, BridgeStatus, PortLists } from "../types/bridge";

export async function listMidiPortNames(): Promise<PortLists> {
  return invoke<PortLists>("list_midi_port_names");
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return invoke<BridgeStatus>("get_bridge_status");
}

export async function startBridge(config: BridgeConfig): Promise<void> {
  await invoke("start_bridge", { config });
}

export async function stopBridge(): Promise<void> {
  await invoke("stop_bridge");
}

export async function listenBridgeLogs(
  onLog: (entry: BridgeLogEntry) => void,
): Promise<() => void> {
  let unlisten: UnlistenFn | null = null;
  unlisten = await listen<BridgeLogEntry>("bridge://log", (event) => {
    onLog(event.payload);
  });
  return () => {
    if (unlisten) {
      void unlisten();
      unlisten = null;
    }
  };
}

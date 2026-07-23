import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BridgeConfig, BridgeLogEntry, BridgeStatus, PortLists } from "../types/bridge";

export async function listMidiPortNames(): Promise<PortLists> {
  return invoke<PortLists>("list_midi_port_names");
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return invoke<BridgeStatus>("get_bridge_status");
}

export async function connectMqtt(config: BridgeConfig): Promise<void> {
  await invoke("connect_mqtt", { config });
}

export async function disconnectMqtt(): Promise<void> {
  await invoke("disconnect_mqtt");
}

export async function startMidi(config: BridgeConfig): Promise<void> {
  await invoke("start_midi", { config });
}

export async function stopMidi(): Promise<void> {
  await invoke("stop_midi");
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

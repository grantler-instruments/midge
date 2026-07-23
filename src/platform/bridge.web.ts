import type { BridgeConfig, BridgeLogEntry, BridgeStatus, PortLists } from "../types/bridge";

export async function listMidiPortNames(): Promise<PortLists> {
  return { inputs: [], outputs: [] };
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return { mqttConnected: false, midiListening: false };
}

export async function connectMqtt(_config: BridgeConfig): Promise<void> {
  throw new Error("The MQTT↔MIDI bridge is only available in the desktop app");
}

export async function disconnectMqtt(): Promise<void> {}

export async function startMidi(_config: BridgeConfig): Promise<void> {
  throw new Error("The MQTT↔MIDI bridge is only available in the desktop app");
}

export async function stopMidi(): Promise<void> {}

export async function listenBridgeLogs(
  _onLog: (entry: BridgeLogEntry) => void,
): Promise<() => void> {
  return () => {};
}

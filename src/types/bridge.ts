export interface PortLists {
  inputs: string[];
  outputs: string[];
}

export interface BridgeConfig {
  url: string;
  prefix: string;
  midiIn?: string | null;
  midiOut?: string | null;
  virtual?: string | null;
  username?: string | null;
  password?: string | null;
  clientId?: string | null;
}

export interface BridgeStatus {
  mqttConnected: boolean;
  midiListening: boolean;
  url?: string | null;
  prefix?: string | null;
  midiIn?: string | null;
  midiOut?: string | null;
  virtualPort?: string | null;
}

export interface BridgeLogEntry {
  direction: string;
  detail: string;
}

export const DEFAULT_VIRTUAL_PORT_NAME = "midge";

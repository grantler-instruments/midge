import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { type MqttProtocol, parseMqttEndpoint } from "../mqttEndpoint";
import type { BridgeLogEntry } from "../types/bridge";
import { DEFAULT_VIRTUAL_PORT_NAME } from "../types/bridge";

interface AppState {
  darkMode: boolean;
  protocol: MqttProtocol;
  host: string;
  port: string;
  path: string;
  prefix: string;
  virtualPort: string;
  midiIn: string;
  midiOut: string;
  username: string;
  password: string;
  clientId: string;
  useNamedPorts: boolean;
  mqttConnected: boolean;
  midiListening: boolean;
  logEntries: Array<BridgeLogEntry & { id: number; timestamp: number }>;
  setDarkMode: (darkMode: boolean) => void;
  setProtocol: (protocol: MqttProtocol) => void;
  setHost: (host: string) => void;
  setPort: (port: string) => void;
  setPath: (path: string) => void;
  setPrefix: (prefix: string) => void;
  setVirtualPort: (virtualPort: string) => void;
  setMidiIn: (midiIn: string) => void;
  setMidiOut: (midiOut: string) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setClientId: (clientId: string) => void;
  setUseNamedPorts: (useNamedPorts: boolean) => void;
  setMqttConnected: (mqttConnected: boolean) => void;
  setMidiListening: (midiListening: boolean) => void;
  pushLogEntry: (entry: BridgeLogEntry) => void;
  clearLogs: () => void;
}

const MAX_LOG_ENTRIES = 100;
let nextLogEntryId = 0;

export function migrateAppState(persisted: unknown, version: number) {
  const state = persisted as AppState & { url?: string };
  if (version < 1 && state.virtualPort === "mqtt-midi-bridge") {
    state.virtualPort = DEFAULT_VIRTUAL_PORT_NAME;
  }
  if (version < 2 && state.url) {
    const endpoint = parseMqttEndpoint(state.url);
    if (endpoint) {
      Object.assign(state, endpoint);
    }
    delete state.url;
  }
  return state;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        darkMode: true,
        protocol: "mqtt",
        host: "127.0.0.1",
        port: "1883",
        path: "",
        prefix: "remote",
        virtualPort: DEFAULT_VIRTUAL_PORT_NAME,
        midiIn: "",
        midiOut: "",
        username: "",
        password: "",
        clientId: "",
        useNamedPorts: false,
        mqttConnected: false,
        midiListening: false,
        logEntries: [],
        setDarkMode: (darkMode) => set({ darkMode }),
        setProtocol: (protocol) => set({ protocol }),
        setHost: (host) => set({ host }),
        setPort: (port) => set({ port }),
        setPath: (path) => set({ path }),
        setPrefix: (prefix) => set({ prefix }),
        setVirtualPort: (virtualPort) => set({ virtualPort }),
        setMidiIn: (midiIn) => set({ midiIn }),
        setMidiOut: (midiOut) => set({ midiOut }),
        setUsername: (username) => set({ username }),
        setPassword: (password) => set({ password }),
        setClientId: (clientId) => set({ clientId }),
        setUseNamedPorts: (useNamedPorts) => set({ useNamedPorts }),
        setMqttConnected: (mqttConnected) => set({ mqttConnected }),
        setMidiListening: (midiListening) => set({ midiListening }),
        pushLogEntry: (entry) =>
          set((s) => ({
            logEntries: [
              { ...entry, id: nextLogEntryId++, timestamp: Date.now() },
              ...s.logEntries,
            ].slice(0, MAX_LOG_ENTRIES),
          })),
        clearLogs: () => set({ logEntries: [] }),
      }),
      {
        name: "midge-app",
        version: 2,
        migrate: migrateAppState,
        partialize: (s) => ({
          darkMode: s.darkMode,
          protocol: s.protocol,
          host: s.host,
          port: s.port,
          path: s.path,
          prefix: s.prefix,
          virtualPort: s.virtualPort,
          midiIn: s.midiIn,
          midiOut: s.midiOut,
          username: s.username,
          password: s.password,
          clientId: s.clientId,
          useNamedPorts: s.useNamedPorts,
        }),
      },
    ),
    { name: "AppStore" },
  ),
);

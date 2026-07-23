import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { BridgeLogEntry } from "../types/bridge";
import { DEFAULT_VIRTUAL_PORT_NAME } from "../types/bridge";

interface AppState {
  darkMode: boolean;
  url: string;
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
  logEntries: Array<BridgeLogEntry & { id: number }>;
  setDarkMode: (darkMode: boolean) => void;
  setUrl: (url: string) => void;
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

const MAX_LOG_ENTRIES = 200;
let nextLogEntryId = 0;

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        darkMode: true,
        url: "mqtt://127.0.0.1:1883",
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
        setUrl: (url) => set({ url }),
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
            logEntries: [{ ...entry, id: nextLogEntryId++ }, ...s.logEntries].slice(
              0,
              MAX_LOG_ENTRIES,
            ),
          })),
        clearLogs: () => set({ logEntries: [] }),
      }),
      {
        name: "midge-app",
        version: 1,
        migrate: (persisted, version) => {
          const state = persisted as AppState;
          if (version < 1 && state.virtualPort === "mqtt-midi-bridge") {
            state.virtualPort = DEFAULT_VIRTUAL_PORT_NAME;
          }
          return state;
        },
        partialize: (s) => ({
          darkMode: s.darkMode,
          url: s.url,
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

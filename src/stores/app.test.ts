import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("zustand/middleware", () => ({
  devtools: <T>(config: T) => config,
  persist: <T>(config: T) => config,
}));

import { DEFAULT_VIRTUAL_PORT_NAME } from "../types/bridge";
import { migrateAppState, useAppStore } from "./app";

const initialState = {
  darkMode: true,
  protocol: "mqtt" as const,
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
};

describe("app store", () => {
  beforeEach(() => {
    useAppStore.setState(initialState);
  });

  it("updates bridge configuration and runtime state", () => {
    const store = useAppStore.getState();

    store.setDarkMode(false);
    store.setProtocol("wss");
    store.setHost("broker.example");
    store.setPort("9443");
    store.setPath("/mqtt");
    store.setVirtualPort("Midge MIDI");
    store.setMqttConnected(true);
    store.setMidiListening(true);

    expect(useAppStore.getState()).toMatchObject({
      darkMode: false,
      protocol: "wss",
      host: "broker.example",
      port: "9443",
      path: "/mqtt",
      virtualPort: "Midge MIDI",
      mqttConnected: true,
      midiListening: true,
    });
  });

  it("migrates legacy broker URLs into endpoint fields", () => {
    expect(
      migrateAppState(
        {
          url: "wss://broker.example:9443/mqtt?tenant=midge",
          virtualPort: "mqtt-midi-bridge",
        },
        0,
      ),
    ).toMatchObject({
      protocol: "wss",
      host: "broker.example",
      port: "9443",
      path: "/mqtt?tenant=midge",
      virtualPort: DEFAULT_VIRTUAL_PORT_NAME,
    });
  });

  it("prepends log entries and retains the latest 100", () => {
    const store = useAppStore.getState();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    for (let index = 0; index < 101; index += 1) {
      store.pushLogEntry({ direction: "in", detail: String(index) });
    }

    const { logEntries } = useAppStore.getState();
    expect(logEntries).toHaveLength(100);
    expect(logEntries[0]).toMatchObject({
      direction: "in",
      detail: "100",
      timestamp: 1_700_000_000_000,
    });
    expect(logEntries[logEntries.length - 1]).toMatchObject({ direction: "in", detail: "1" });
    expect(new Set(logEntries.map((entry) => entry.id))).toHaveLength(100);

    store.clearLogs();
    expect(useAppStore.getState().logEntries).toEqual([]);
  });
});

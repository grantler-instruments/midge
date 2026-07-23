import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("zustand/middleware", () => ({
  devtools: <T>(config: T) => config,
  persist: <T>(config: T) => config,
}));

import { DEFAULT_VIRTUAL_PORT_NAME } from "../types/bridge";
import { useAppStore } from "./app";

const initialState = {
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
  bridgeRunning: false,
  logEntries: [],
};

describe("app store", () => {
  beforeEach(() => {
    useAppStore.setState(initialState);
  });

  it("updates bridge configuration and runtime state", () => {
    const store = useAppStore.getState();

    store.setDarkMode(false);
    store.setUrl("mqtt://broker.example:1883");
    store.setVirtualPort("Midge MIDI");
    store.setBridgeRunning(true);

    expect(useAppStore.getState()).toMatchObject({
      darkMode: false,
      url: "mqtt://broker.example:1883",
      virtualPort: "Midge MIDI",
      bridgeRunning: true,
    });
  });

  it("prepends log entries and retains the latest 200", () => {
    const store = useAppStore.getState();
    for (let index = 0; index < 201; index += 1) {
      store.pushLogEntry({ direction: "in", detail: String(index) });
    }

    const { logEntries } = useAppStore.getState();
    expect(logEntries).toHaveLength(200);
    expect(logEntries[0]).toMatchObject({ direction: "in", detail: "200" });
    expect(logEntries[logEntries.length - 1]).toMatchObject({ direction: "in", detail: "1" });
    expect(new Set(logEntries.map((entry) => entry.id))).toHaveLength(200);

    store.clearLogs();
    expect(useAppStore.getState().logEntries).toEqual([]);
  });
});

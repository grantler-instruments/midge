import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const endMock = vi.fn();
const subscribeMock = vi.fn();
const publishMock = vi.fn();
const onMock = vi.fn();
const onceMock = vi.fn();
const offMock = vi.fn();

vi.mock("mqtt", () => ({
  default: {
    connect: (...args: unknown[]) => connectMock(...args),
  },
}));

import {
  connectMqtt,
  disconnectMqtt,
  getBridgeStatus,
  listenBridgeLogs,
  listMidiPortNames,
  normalizeBrowserMqttUrl,
  resetWebBridgeForTests,
  startMidi,
  stopMidi,
} from "./bridge.web";

function createFakeClient() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const client = {
    subscribe: subscribeMock,
    publish: publishMock,
    end: endMock,
    on: onMock,
    once: onceMock,
    off: offMock,
  };

  onMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)?.add(handler);
    return client;
  });
  onceMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    const wrap = (...args: unknown[]) => {
      handlers.get(event)?.delete(wrap);
      handler(...args);
    };
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)?.add(wrap);
    return client;
  });
  offMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    handlers.get(event)?.delete(handler);
    return client;
  });
  endMock.mockImplementation((_force?: boolean, _opts?: object, cb?: () => void) => {
    cb?.();
    return client;
  });
  subscribeMock.mockImplementation((_topic: string, _opts: object, cb?: (err?: Error) => void) => {
    cb?.();
    return client;
  });
  publishMock.mockImplementation(
    (_topic: string, _payload: Uint8Array, _opts: object, cb?: (err?: Error) => void) => {
      cb?.();
      return client;
    },
  );

  return {
    client,
    emit(event: string, ...args: unknown[]) {
      for (const handler of [...(handlers.get(event) ?? [])]) {
        handler(...args);
      }
    },
  };
}

describe("normalizeBrowserMqttUrl", () => {
  it("rewrites mqtt schemes to websocket schemes", () => {
    expect(normalizeBrowserMqttUrl("mqtt://127.0.0.1:1883")).toBe("ws://127.0.0.1:1883");
    expect(normalizeBrowserMqttUrl("mqtts://broker.example/mqtt")).toBe(
      "wss://broker.example/mqtt",
    );
    expect(normalizeBrowserMqttUrl("ws://127.0.0.1:9001")).toBe("ws://127.0.0.1:9001");
  });

  it("rejects unsupported schemes", () => {
    expect(() => normalizeBrowserMqttUrl("http://example.com")).toThrow(/WebSocket URL/);
  });
});

describe("web bridge", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetWebBridgeForTests();
  });

  afterEach(async () => {
    await resetWebBridgeForTests();
    Reflect.deleteProperty(globalThis, "navigator");
  });

  it("lists empty MIDI ports when Web MIDI is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    await expect(listMidiPortNames()).resolves.toEqual({ inputs: [], outputs: [] });
  });

  it("lists MIDI ports from Web MIDI access", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        requestMIDIAccess: vi.fn().mockResolvedValue({
          inputs: new Map([
            ["1", { name: "Keyboard", id: "1" }],
            ["2", { name: null, id: "fallback-in" }],
          ]),
          outputs: new Map([["3", { name: "Synth", id: "3" }]]),
        }),
      },
    });

    await expect(listMidiPortNames()).resolves.toEqual({
      inputs: ["Keyboard", "fallback-in"],
      outputs: ["Synth"],
    });
  });

  it("connects MQTT over a rewritten websocket URL and emits status logs", async () => {
    const fake = createFakeClient();
    connectMock.mockReturnValue(fake.client);
    const logs: string[] = [];
    const stopListening = await listenBridgeLogs((entry) => {
      logs.push(`${entry.direction}:${entry.detail}`);
    });

    const connectPromise = connectMqtt({
      url: "mqtt://127.0.0.1:9001",
      prefix: "remote",
      clientId: "demo-client",
      username: "midge",
      password: "secret",
    });
    fake.emit("connect");
    await connectPromise;

    expect(connectMock).toHaveBeenCalledWith(
      "ws://127.0.0.1:9001",
      expect.objectContaining({
        clientId: "demo-client",
        username: "midge",
        password: "secret",
      }),
    );
    await expect(getBridgeStatus()).resolves.toMatchObject({
      mqttConnected: true,
      url: "ws://127.0.0.1:9001",
      prefix: "remote",
    });
    expect(logs.some((line) => line.startsWith("status:MQTT connected"))).toBe(true);

    await disconnectMqtt();
    expect(logs).toContain("status:MQTT disconnected");
    stopListening();
  });

  it("starts MIDI with named ports and rejects virtual ports", async () => {
    const input = {
      name: "Keyboard",
      id: "in-1",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const output = {
      name: "Synth",
      id: "out-1",
      send: vi.fn(),
    };
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        requestMIDIAccess: vi.fn().mockResolvedValue({
          inputs: new Map([["in-1", input]]),
          outputs: new Map([["out-1", output]]),
        }),
      },
    });

    await expect(
      startMidi({ url: "ws://localhost", prefix: "remote", virtual: "midge" }),
    ).rejects.toThrow(/Virtual MIDI ports/);

    await startMidi({
      url: "ws://localhost",
      prefix: "remote",
      midiIn: "Keyboard",
      midiOut: "Synth",
    });
    expect(input.addEventListener).toHaveBeenCalledWith("midimessage", expect.any(Function));
    await expect(getBridgeStatus()).resolves.toMatchObject({
      midiListening: true,
      midiIn: "Keyboard",
      midiOut: "Synth",
    });

    await stopMidi();
    expect(input.removeEventListener).toHaveBeenCalled();
  });
});

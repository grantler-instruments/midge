import mqtt, { type MqttClient } from "mqtt";
import { inSubscriptionTopics, midiBytesFromMqtt, mqttPayloadFromMidi } from "../mqttMidi";
import type { BridgeConfig, BridgeLogEntry, BridgeStatus, PortLists } from "../types/bridge";

type LogListener = (entry: BridgeLogEntry) => void;

const logListeners = new Set<LogListener>();

let mqttClient: MqttClient | null = null;
let mqttConnected = false;
let activePrefix = "";
let activeUrl: string | null = null;
let midiListening = false;
let midiAccess: MIDIAccess | null = null;
let midiInput: MIDIInput | null = null;
let midiOutput: MIDIOutput | null = null;
let midiInName: string | null = null;
let midiOutName: string | null = null;
let midiMessageHandler: ((event: MIDIMessageEvent) => void) | null = null;

function emitLog(direction: string, detail: string) {
  const entry: BridgeLogEntry = { direction, detail };
  for (const listener of logListeners) {
    listener(entry);
  }
}

function payloadToBytes(payload: Uint8Array | string): Uint8Array {
  if (typeof payload === "string") {
    return new TextEncoder().encode(payload);
  }
  return payload instanceof Uint8Array ? payload : new Uint8Array(payload);
}

/** Browser MQTT must use WebSockets; rewrite tcp schemes as a convenience. */
export function normalizeBrowserMqttUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  if (trimmed.startsWith("mqtt://")) {
    return `ws://${trimmed.slice("mqtt://".length)}`;
  }
  if (trimmed.startsWith("mqtts://")) {
    return `wss://${trimmed.slice("mqtts://".length)}`;
  }
  throw new Error(
    "Browser MQTT requires a WebSocket URL (ws:// or wss://). Many brokers expose MQTT over WebSockets on a different port (e.g. 9001).",
  );
}

async function ensureMidiAccess(): Promise<MIDIAccess> {
  if (midiAccess) {
    return midiAccess;
  }
  if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
    throw new Error("Web MIDI is not available in this browser (try Chrome or Edge).");
  }
  midiAccess = await navigator.requestMIDIAccess({ sysex: true });
  return midiAccess;
}

function findPortByName(ports: MIDIInputMap, name: string): MIDIInput | null;
function findPortByName(ports: MIDIOutputMap, name: string): MIDIOutput | null;
function findPortByName(
  ports: MIDIInputMap | MIDIOutputMap,
  name: string,
): MIDIInput | MIDIOutput | null {
  for (const port of ports.values()) {
    if (port.name === name) {
      return port;
    }
  }
  return null;
}

function handleIncomingMidi(message: Uint8Array) {
  if (!mqttClient || !mqttConnected) {
    return;
  }
  const mapped = mqttPayloadFromMidi(activePrefix, message);
  if (!mapped) {
    return;
  }
  mqttClient.publish(mapped.topic, Buffer.from(mapped.payload), { qos: 0 }, (err) => {
    if (err) {
      emitLog("error", `MQTT publish failed: ${err.message}`);
      return;
    }
    emitLog("midi→mqtt", `${mapped.topic} (${mapped.payload.length} bytes)`);
  });
}

function handleIncomingMqtt(topic: string, payload: Uint8Array) {
  const bytes = midiBytesFromMqtt(activePrefix, topic, payload);
  if (!bytes) {
    return;
  }
  if (!midiOutput) {
    emitLog("error", "MIDI is not listening");
    return;
  }
  try {
    midiOutput.send(bytes);
    emitLog("mqtt→midi", topic);
  } catch (err) {
    emitLog("error", `MIDI output failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function listMidiPortNames(): Promise<PortLists> {
  try {
    const access = await ensureMidiAccess();
    return {
      inputs: [...access.inputs.values()].map((port) => port.name ?? port.id),
      outputs: [...access.outputs.values()].map((port) => port.name ?? port.id),
    };
  } catch {
    return { inputs: [], outputs: [] };
  }
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return {
    mqttConnected,
    midiListening,
    url: activeUrl,
    prefix: activePrefix || null,
    midiIn: midiInName,
    midiOut: midiOutName,
    virtualPort: null,
  };
}

export async function connectMqtt(config: BridgeConfig): Promise<void> {
  if (mqttClient) {
    await disconnectMqtt();
  }

  const url = normalizeBrowserMqttUrl(config.url);
  const prefix = config.prefix.trim();
  if (!prefix) {
    throw new Error("Topic prefix is required");
  }

  const clientId =
    config.clientId && config.clientId.length > 0
      ? config.clientId
      : `midge-bridge-${crypto.randomUUID()}`;

  activePrefix = prefix;
  activeUrl = url;

  await new Promise<void>((resolve, reject) => {
    const client = mqtt.connect(url, {
      clientId,
      username: config.username || undefined,
      password: config.password || undefined,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 10_000,
    });

    const onConnect = () => {
      cleanupConnectListeners();
      mqttClient = client;
      mqttConnected = true;

      for (const topic of inSubscriptionTopics(prefix)) {
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            emitLog("error", `MQTT subscribe failed (${topic}): ${err.message}`);
          }
        });
      }

      client.on("message", (topic, payload) => {
        handleIncomingMqtt(topic, payloadToBytes(payload as Uint8Array | string));
      });
      client.on("close", () => {
        if (mqttClient === client) {
          mqttConnected = false;
          mqttClient = null;
          emitLog("status", "MQTT disconnected");
        }
      });
      client.on("error", (err) => {
        emitLog("error", `MQTT error: ${err.message}`);
      });

      emitLog("status", `MQTT connected (prefix ${prefix}, client ID ${clientId})`);
      resolve();
    };

    const onError = (err: Error) => {
      cleanupConnectListeners();
      client.end(true);
      reject(err);
    };

    const cleanupConnectListeners = () => {
      client.off("connect", onConnect);
      client.off("error", onError);
    };

    client.once("connect", onConnect);
    client.once("error", onError);
  });
}

export async function disconnectMqtt(): Promise<void> {
  const client = mqttClient;
  mqttClient = null;
  mqttConnected = false;
  activeUrl = null;
  if (!client) {
    return;
  }
  await new Promise<void>((resolve) => {
    client.end(true, {}, () => resolve());
  });
  emitLog("status", "MQTT disconnected");
}

export async function startMidi(config: BridgeConfig): Promise<void> {
  if (midiListening) {
    await stopMidi();
  }

  if (config.virtual) {
    throw new Error(
      "Virtual MIDI ports are not available in the browser. Select existing Web MIDI input and output ports.",
    );
  }

  const inputName = config.midiIn?.trim();
  const outputName = config.midiOut?.trim();
  if (!inputName || !outputName) {
    throw new Error("Select MIDI in and MIDI out ports to try the browser bridge.");
  }

  const access = await ensureMidiAccess();
  const input = findPortByName(access.inputs, inputName);
  const output = findPortByName(access.outputs, outputName);
  if (!input) {
    throw new Error(`MIDI input port not found: ${inputName}`);
  }
  if (!output) {
    throw new Error(`MIDI output port not found: ${outputName}`);
  }

  if (config.prefix.trim()) {
    activePrefix = config.prefix.trim();
  }

  midiMessageHandler = (event: MIDIMessageEvent) => {
    if (!event.data) {
      return;
    }
    handleIncomingMidi(event.data);
  };
  input.addEventListener("midimessage", midiMessageHandler);

  midiInput = input;
  midiOutput = output;
  midiInName = inputName;
  midiOutName = outputName;
  midiListening = true;
  emitLog("status", `MIDI listening (in: ${inputName}, out: ${outputName})`);
}

export async function stopMidi(): Promise<void> {
  if (midiInput && midiMessageHandler) {
    midiInput.removeEventListener("midimessage", midiMessageHandler);
  }
  midiMessageHandler = null;
  midiInput = null;
  midiOutput = null;
  midiInName = null;
  midiOutName = null;
  midiListening = false;
  emitLog("status", "MIDI stopped");
}

export async function listenBridgeLogs(onLog: LogListener): Promise<() => void> {
  logListeners.add(onLog);
  return () => {
    logListeners.delete(onLog);
  };
}

/** Test-only: clear module state between cases. */
export async function resetWebBridgeForTests(): Promise<void> {
  await stopMidi();
  await disconnectMqtt();
  midiAccess = null;
  activePrefix = "";
  logListeners.clear();
}

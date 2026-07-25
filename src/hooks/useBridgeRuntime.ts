import { useEffect, useState } from "react";
import { getBridgeStatus, listenBridgeLogs } from "../platform/bridge";
import { useAppStore } from "../stores/app";

export function useBridgeRuntime() {
  const pushLogEntry = useAppStore((s) => s.pushLogEntry);
  const setMqttConnected = useAppStore((s) => s.setMqttConnected);
  const setMidiListening = useAppStore((s) => s.setMidiListening);

  useEffect(() => {
    void getBridgeStatus().then((status) => {
      setMqttConnected(status.mqttConnected);
      setMidiListening(status.midiListening);
    });
  }, [setMidiListening, setMqttConnected]);

  useEffect(() => {
    let stopListening: (() => void) | undefined;
    void listenBridgeLogs((entry) => {
      pushLogEntry(entry);
      if (entry.direction === "status") {
        if (entry.detail === "MQTT disconnected") {
          setMqttConnected(false);
        } else if (entry.detail.startsWith("MQTT connected")) {
          setMqttConnected(true);
        } else if (entry.detail === "MIDI stopped") {
          setMidiListening(false);
        } else if (entry.detail.startsWith("MIDI listening")) {
          setMidiListening(true);
        }
      }
    }).then((stop) => {
      stopListening = stop;
    });
    return () => {
      stopListening?.();
    };
  }, [pushLogEntry, setMidiListening, setMqttConnected]);
}

export function useMidiPortNames() {
  const [ports, setPorts] = useState<{ inputs: string[]; outputs: string[] }>({
    inputs: [],
    outputs: [],
  });

  useEffect(() => {
    void import("../platform/bridge").then(({ listMidiPortNames }) => {
      void listMidiPortNames().then(setPorts);
    });
  }, []);

  return ports;
}

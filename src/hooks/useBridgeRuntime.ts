import { useEffect, useState } from "react";
import { getBridgeStatus, listenBridgeLogs } from "../platform/bridge";
import { useAppStore } from "../stores/app";

export function useBridgeRuntime() {
  const pushLogEntry = useAppStore((s) => s.pushLogEntry);
  const setBridgeRunning = useAppStore((s) => s.setBridgeRunning);

  useEffect(() => {
    void getBridgeStatus().then((status) => setBridgeRunning(status.running));
  }, [setBridgeRunning]);

  useEffect(() => {
    let stopListening: (() => void) | undefined;
    void listenBridgeLogs((entry) => {
      pushLogEntry(entry);
      if (entry.direction === "status") {
        if (entry.detail === "Bridge stopped") {
          setBridgeRunning(false);
        } else if (entry.detail.startsWith("Bridge started")) {
          setBridgeRunning(true);
        }
      }
    }).then((stop) => {
      stopListening = stop;
    });
    return () => {
      stopListening?.();
    };
  }, [pushLogEntry, setBridgeRunning]);
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

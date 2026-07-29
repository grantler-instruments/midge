import { describe, expect, it } from "vitest";
import {
  buildMqttUrl,
  defaultPortForProtocol,
  normalizeMqttPath,
  parseMqttEndpoint,
  validateMqttEndpoint,
} from "./mqttEndpoint";

describe("MQTT endpoint helpers", () => {
  it("builds TCP and WebSocket endpoints", () => {
    expect(
      buildMqttUrl({ protocol: "mqtts", host: "broker.example", port: "8884", path: "/ignored" }),
    ).toBe("mqtts://broker.example:8884");
    expect(
      buildMqttUrl({ protocol: "wss", host: "::1", port: "443", path: "mqtt?tenant=midge" }),
    ).toBe("wss://[::1]:443/mqtt?tenant=midge");
  });

  it("parses legacy URLs into form fields", () => {
    expect(parseMqttEndpoint("mqtt://broker.example:1883")).toEqual({
      protocol: "mqtt",
      host: "broker.example",
      port: "1883",
      path: "",
    });
    expect(parseMqttEndpoint("ws://[::1]:9001/mqtt?tenant=midge")).toEqual({
      protocol: "ws",
      host: "[::1]",
      port: "9001",
      path: "/mqtt?tenant=midge",
    });
  });

  it("uses conventional ports and validates overridden ports", () => {
    expect(defaultPortForProtocol("ws")).toBe("80");
    expect(defaultPortForProtocol("wss")).toBe("443");
    expect(defaultPortForProtocol("mqtt")).toBe("1883");
    expect(defaultPortForProtocol("mqtts")).toBe("8883");
    expect(normalizeMqttPath("mqtt")).toBe("/mqtt");
    expect(
      validateMqttEndpoint({ protocol: "mqtt", host: "broker.example", port: "65536", path: "" }),
    ).toBe("Port must be a number from 1 to 65535.");
  });
});

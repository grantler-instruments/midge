export const MQTT_PROTOCOLS = ["ws", "wss", "mqtt", "mqtts"] as const;

export type MqttProtocol = (typeof MQTT_PROTOCOLS)[number];

export interface MqttEndpoint {
  protocol: MqttProtocol;
  host: string;
  port: string;
  path: string;
}

const DEFAULT_PORTS: Record<MqttProtocol, string> = {
  ws: "80",
  wss: "443",
  mqtt: "1883",
  mqtts: "8883",
};

function isMqttProtocol(value: string): value is MqttProtocol {
  return MQTT_PROTOCOLS.some((protocol) => protocol === value);
}

export function defaultPortForProtocol(protocol: MqttProtocol): string {
  return DEFAULT_PORTS[protocol];
}

export function supportsPath(protocol: MqttProtocol): boolean {
  return protocol === "ws" || protocol === "wss";
}

export function normalizeMqttPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function buildMqttUrl({ protocol, host, port, path }: MqttEndpoint): string {
  const normalizedHost = host.trim().replace(/^\[|\]$/g, "");
  const urlHost = normalizedHost.includes(":") ? `[${normalizedHost}]` : normalizedHost;
  const normalizedPort = port.trim();
  const endpointPath = supportsPath(protocol) ? normalizeMqttPath(path) : "";
  return `${protocol}://${urlHost}${normalizedPort ? `:${normalizedPort}` : ""}${endpointPath}`;
}

export function parseMqttEndpoint(url: string): MqttEndpoint | null {
  try {
    const parsed = new URL(url);
    if (!isMqttProtocol(parsed.protocol.slice(0, -1)) || !parsed.hostname) {
      return null;
    }

    const protocol = parsed.protocol.slice(0, -1) as MqttProtocol;
    return {
      protocol,
      host: parsed.hostname,
      port: parsed.port || defaultPortForProtocol(protocol),
      path:
        supportsPath(protocol) && (parsed.pathname !== "/" || parsed.search)
          ? `${parsed.pathname}${parsed.search}`
          : "",
    };
  } catch {
    return null;
  }
}

export function validateMqttEndpoint({ host, port }: MqttEndpoint): string | null {
  if (!host.trim()) {
    return "Broker host is required.";
  }
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65_535) {
    return "Port must be a number from 1 to 65535.";
  }
  return null;
}

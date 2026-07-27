export type Direction = "in" | "out";

export type SystemMessageType = "clock" | "start" | "stop" | "continue";

export type ParsedTopic =
  | { kind: "noteon"; direction: Direction; channel: number; note: number }
  | { kind: "noteoff"; direction: Direction; channel: number; note: number }
  | { kind: "cc"; direction: Direction; channel: number; controller: number }
  | { kind: "program"; direction: Direction; channel: number }
  | { kind: "pitchbend"; direction: Direction; channel: number }
  | { kind: "sysex"; direction: Direction }
  | { kind: "system"; direction: Direction; system: SystemMessageType };

export function buildTopic(prefix: string, direction: Direction, segments: string[]): string {
  return [prefix, direction, ...segments].join("/");
}

export function buildNoteOnTopic(
  prefix: string,
  direction: Direction,
  channel: number,
  note: number,
): string {
  return buildTopic(prefix, direction, ["noteon", String(channel), String(note)]);
}

export function buildNoteOffTopic(
  prefix: string,
  direction: Direction,
  channel: number,
  note: number,
): string {
  return buildTopic(prefix, direction, ["noteoff", String(channel), String(note)]);
}

export function buildControlChangeTopic(
  prefix: string,
  direction: Direction,
  channel: number,
  controller: number,
): string {
  return buildTopic(prefix, direction, ["cc", String(channel), String(controller)]);
}

export function buildProgramChangeTopic(
  prefix: string,
  direction: Direction,
  channel: number,
): string {
  return buildTopic(prefix, direction, ["program", String(channel)]);
}

export function buildPitchBendTopic(prefix: string, direction: Direction, channel: number): string {
  return buildTopic(prefix, direction, ["pitchbend", String(channel)]);
}

export function buildSysexTopic(prefix: string, direction: Direction): string {
  return buildTopic(prefix, direction, ["sysex"]);
}

export function buildSystemTopic(
  prefix: string,
  direction: Direction,
  kind: SystemMessageType,
): string {
  return buildTopic(prefix, direction, [kind]);
}

function parseSystemType(value: string): SystemMessageType | undefined {
  if (value === "clock" || value === "start" || value === "stop" || value === "continue") {
    return value;
  }
  return undefined;
}

export function parseTopic(prefix: string, topic: string): ParsedTopic | undefined {
  const expected = `${prefix}/`;
  if (!topic.startsWith(expected)) {
    return undefined;
  }

  const parts = topic.slice(expected.length).split("/");
  if (parts.length < 2) {
    return undefined;
  }

  const direction = parts[0];
  if (direction !== "in" && direction !== "out") {
    return undefined;
  }

  switch (parts[1]) {
    case "sysex":
      if (parts.length === 2) {
        return { kind: "sysex", direction };
      }
      return undefined;
    case "clock":
    case "start":
    case "stop":
    case "continue": {
      if (parts.length !== 2) {
        return undefined;
      }
      const system = parseSystemType(parts[1]);
      return system ? { kind: "system", direction, system } : undefined;
    }
    case "cc": {
      if (parts.length !== 4) {
        return undefined;
      }
      const channel = Number(parts[2]);
      const controller = Number(parts[3]);
      if (!isValidChannel(channel) || !isValidController(controller)) {
        return undefined;
      }
      return { kind: "cc", direction, channel, controller };
    }
    case "noteon": {
      if (parts.length !== 4) {
        return undefined;
      }
      const channel = Number(parts[2]);
      const note = Number(parts[3]);
      if (!isValidChannel(channel) || !isValidNote(note)) {
        return undefined;
      }
      return { kind: "noteon", direction, channel, note };
    }
    case "noteoff": {
      if (parts.length !== 4) {
        return undefined;
      }
      const channel = Number(parts[2]);
      const note = Number(parts[3]);
      if (!isValidChannel(channel) || !isValidNote(note)) {
        return undefined;
      }
      return { kind: "noteoff", direction, channel, note };
    }
    case "program": {
      if (parts.length !== 3) {
        return undefined;
      }
      const channel = Number(parts[2]);
      if (!isValidChannel(channel)) {
        return undefined;
      }
      return { kind: "program", direction, channel };
    }
    case "pitchbend": {
      if (parts.length !== 3) {
        return undefined;
      }
      const channel = Number(parts[2]);
      if (!isValidChannel(channel)) {
        return undefined;
      }
      return { kind: "pitchbend", direction, channel };
    }
    default:
      return undefined;
  }
}

export function inSubscriptionTopics(prefix: string): string[] {
  return [
    `${prefix}/in/noteon/#`,
    `${prefix}/in/noteoff/#`,
    `${prefix}/in/cc/#`,
    `${prefix}/in/program/#`,
    `${prefix}/in/pitchbend/#`,
    `${prefix}/in/sysex`,
    `${prefix}/in/clock`,
    `${prefix}/in/start`,
    `${prefix}/in/stop`,
    `${prefix}/in/continue`,
  ];
}

export function isValidChannel(channel: number): boolean {
  return Number.isInteger(channel) && channel >= 1 && channel <= 16;
}

export function isValidNote(note: number): boolean {
  return Number.isInteger(note) && note >= 0 && note <= 127;
}

export function isValidController(controller: number): boolean {
  return Number.isInteger(controller) && controller >= 0 && controller <= 127;
}

export function isValidSevenBit(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 127;
}

export function isValidPitchBend(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 16383;
}

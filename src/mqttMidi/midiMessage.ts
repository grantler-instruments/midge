import type { SystemMessageType } from "./topics";

export type ParsedMidiMessage =
  | { kind: "noteon"; channel: number; note: number; velocity: number }
  | { kind: "noteoff"; channel: number; note: number; velocity: number }
  | { kind: "cc"; channel: number; controller: number; value: number }
  | { kind: "program"; channel: number; program: number }
  | { kind: "pitchbend"; channel: number; value: number }
  | { kind: "sysex"; data: number[] }
  | { kind: "system"; system: SystemMessageType };

const SYSTEM_BY_STATUS: ReadonlyArray<[number, SystemMessageType]> = [
  [0xf8, "clock"],
  [0xfa, "start"],
  [0xfc, "stop"],
  [0xfb, "continue"],
];

export function parseMidiMessage(message: Uint8Array | number[]): ParsedMidiMessage | undefined {
  if (message.length === 0) {
    return undefined;
  }

  const status = message[0];

  if (status >= 0xf8) {
    const match = SYSTEM_BY_STATUS.find(([value]) => value === status);
    return match ? { kind: "system", system: match[1] } : undefined;
  }

  if (status === 0xf0) {
    return { kind: "sysex", data: Array.from(message) };
  }

  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (channel < 1 || channel > 16) {
    return undefined;
  }

  switch (command) {
    case 0x90:
      if (message.length < 3) {
        return undefined;
      }
      if (message[2] === 0) {
        return { kind: "noteoff", channel, note: message[1], velocity: 0 };
      }
      return { kind: "noteon", channel, note: message[1], velocity: message[2] };
    case 0x80:
      if (message.length < 3) {
        return undefined;
      }
      return { kind: "noteoff", channel, note: message[1], velocity: message[2] };
    case 0xb0:
      if (message.length < 3) {
        return undefined;
      }
      return { kind: "cc", channel, controller: message[1], value: message[2] };
    case 0xc0:
      if (message.length < 2) {
        return undefined;
      }
      return { kind: "program", channel, program: message[1] };
    case 0xe0:
      if (message.length < 3) {
        return undefined;
      }
      return {
        kind: "pitchbend",
        channel,
        value: (message[2] << 7) | message[1],
      };
    default:
      return undefined;
  }
}

export function toMidiBytes(parsed: ParsedMidiMessage): number[] {
  switch (parsed.kind) {
    case "noteon":
      return [0x90 | (parsed.channel - 1), parsed.note, parsed.velocity];
    case "noteoff":
      return [0x80 | (parsed.channel - 1), parsed.note, parsed.velocity];
    case "cc":
      return [0xb0 | (parsed.channel - 1), parsed.controller, parsed.value];
    case "program":
      return [0xc0 | (parsed.channel - 1), parsed.program];
    case "pitchbend":
      return [0xe0 | (parsed.channel - 1), parsed.value & 0x7f, (parsed.value >> 7) & 0x7f];
    case "sysex":
      return [...parsed.data];
    case "system": {
      const match = SYSTEM_BY_STATUS.find(([, system]) => system === parsed.system);
      return match ? [match[0]] : [];
    }
  }
}

import { decodePitchBend, decodeSevenBit } from "./codec";
import { type ParsedMidiMessage, parseMidiMessage } from "./midiMessage";

function topicKind(topic: string): string | undefined {
  const parts = topic.split("/");
  const dirIndex = parts.findIndex((part) => part === "in" || part === "out");
  if (dirIndex < 0 || dirIndex + 1 >= parts.length) {
    return undefined;
  }
  return parts[dirIndex + 1];
}

/** Clock ticks flood the activity log; still bridge them, just don't display. */
export function shouldLogTraffic(topic: string): boolean {
  return topicKind(topic) !== "clock";
}

export function formatMidiDetail(message: ParsedMidiMessage): string {
  switch (message.kind) {
    case "noteon":
      return `noteon ch${message.channel} note${message.note} vel${message.velocity}`;
    case "noteoff":
      return `noteoff ch${message.channel} note${message.note} vel${message.velocity}`;
    case "cc":
      return `cc ch${message.channel} ctrl${message.controller} val${message.value}`;
    case "program":
      return `program ch${message.channel} prog${message.program}`;
    case "pitchbend":
      return `pitchbend ch${message.channel} val${message.value}`;
    case "sysex":
      return `sysex [${message.data.join(", ")}]`;
    case "system":
      return message.system;
  }
}

export function formatMqttDetail(topic: string, payload: Uint8Array | number[]): string {
  const bytes = payload instanceof Uint8Array ? payload : Uint8Array.from(payload);
  if (bytes.length === 0) {
    return topic;
  }

  const kind = topicKind(topic);
  try {
    switch (kind) {
      case "noteon":
      case "noteoff":
      case "cc":
      case "program":
        return `${topic} = ${decodeSevenBit(bytes)}`;
      case "pitchbend":
        return `${topic} = ${decodePitchBend(bytes)}`;
      case "sysex":
        return `${topic} = ${new TextDecoder().decode(bytes)}`;
      default:
        break;
    }
  } catch {
    // fall through to raw bytes
  }

  return `${topic} = [${Array.from(bytes).join(", ")}]`;
}

export function formatMidiToMqttDetail(
  midi: Uint8Array | number[],
  topic: string,
  payload: Uint8Array | number[],
): string {
  const parsed = parseMidiMessage(midi);
  const midiSide = parsed ? formatMidiDetail(parsed) : `[${Array.from(midi).join(", ")}]`;
  return `${midiSide} → ${formatMqttDetail(topic, payload)}`;
}

export function formatMqttToMidiDetail(
  topic: string,
  payload: Uint8Array | number[],
  midi: Uint8Array | number[],
): string {
  const parsed = parseMidiMessage(midi);
  const midiSide = parsed ? formatMidiDetail(parsed) : `[${Array.from(midi).join(", ")}]`;
  return `${formatMqttDetail(topic, payload)} → ${midiSide}`;
}

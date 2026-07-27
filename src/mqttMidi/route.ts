import {
  decodePitchBend,
  decodeSevenBit,
  decodeSysexJson,
  encodeEmptyPayload,
  encodePitchBend,
  encodeSevenBit,
  encodeSysexJson,
} from "./codec";
import { type ParsedMidiMessage, parseMidiMessage, toMidiBytes } from "./midiMessage";
import {
  buildControlChangeTopic,
  buildNoteOffTopic,
  buildNoteOnTopic,
  buildPitchBendTopic,
  buildProgramChangeTopic,
  buildSysexTopic,
  buildSystemTopic,
  type ParsedTopic,
  parseTopic,
} from "./topics";

export function mqttPayloadFromMidi(
  prefix: string,
  message: Uint8Array | number[],
): { topic: string; payload: Uint8Array } | undefined {
  const parsed = parseMidiMessage(message);
  if (!parsed) {
    return undefined;
  }

  try {
    switch (parsed.kind) {
      case "noteon":
        return {
          topic: buildNoteOnTopic(prefix, "out", parsed.channel, parsed.note),
          payload: encodeSevenBit(parsed.velocity),
        };
      case "noteoff":
        return {
          topic: buildNoteOffTopic(prefix, "out", parsed.channel, parsed.note),
          payload: encodeSevenBit(parsed.velocity),
        };
      case "cc":
        return {
          topic: buildControlChangeTopic(prefix, "out", parsed.channel, parsed.controller),
          payload: encodeSevenBit(parsed.value),
        };
      case "program":
        return {
          topic: buildProgramChangeTopic(prefix, "out", parsed.channel),
          payload: encodeSevenBit(parsed.program),
        };
      case "pitchbend":
        return {
          topic: buildPitchBendTopic(prefix, "out", parsed.channel),
          payload: encodePitchBend(parsed.value),
        };
      case "sysex":
        return {
          topic: buildSysexTopic(prefix, "out"),
          payload: encodeSysexJson(parsed.data),
        };
      case "system":
        return {
          topic: buildSystemTopic(prefix, "out", parsed.system),
          payload: encodeEmptyPayload(),
        };
    }
  } catch {
    return undefined;
  }
}

function topicToMidiMessage(parsed: ParsedTopic, payload: Uint8Array): ParsedMidiMessage {
  switch (parsed.kind) {
    case "noteon":
      return {
        kind: "noteon",
        channel: parsed.channel,
        note: parsed.note,
        velocity: decodeSevenBit(payload),
      };
    case "noteoff":
      return {
        kind: "noteoff",
        channel: parsed.channel,
        note: parsed.note,
        velocity: decodeSevenBit(payload),
      };
    case "cc":
      return {
        kind: "cc",
        channel: parsed.channel,
        controller: parsed.controller,
        value: decodeSevenBit(payload),
      };
    case "program":
      return {
        kind: "program",
        channel: parsed.channel,
        program: decodeSevenBit(payload),
      };
    case "pitchbend":
      return {
        kind: "pitchbend",
        channel: parsed.channel,
        value: decodePitchBend(payload),
      };
    case "sysex":
      return { kind: "sysex", data: decodeSysexJson(payload) };
    case "system":
      return { kind: "system", system: parsed.system };
  }
}

export function midiBytesFromMqtt(
  prefix: string,
  topic: string,
  payload: Uint8Array,
): number[] | undefined {
  const parsed = parseTopic(prefix, topic);
  if (parsed?.direction !== "in") {
    return undefined;
  }
  return toMidiBytes(topicToMidiMessage(parsed, payload));
}

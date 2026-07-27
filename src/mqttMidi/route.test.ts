import { describe, expect, it } from "vitest";
import {
  midiBytesFromMqtt,
  mqttPayloadFromMidi,
  parseMidiMessage,
  parseTopic,
  toMidiBytes,
} from "./index";

describe("mqttMidi protocol", () => {
  it("round-trips common MIDI messages through MQTT topics", () => {
    const cases: Array<{ bytes: number[]; topic: string; payload: number[] }> = [
      { bytes: [0x90, 60, 100], topic: "remote/out/noteon/1/60", payload: [100] },
      { bytes: [0x90, 60, 0], topic: "remote/out/noteoff/1/60", payload: [0] },
      { bytes: [0x80, 60, 64], topic: "remote/out/noteoff/1/60", payload: [64] },
      { bytes: [0xb0, 7, 100], topic: "remote/out/cc/1/7", payload: [100] },
      { bytes: [0xc0, 42], topic: "remote/out/program/1", payload: [42] },
      { bytes: [0xe0, 0, 64], topic: "remote/out/pitchbend/1", payload: [0, 64] },
      { bytes: [0xf8], topic: "remote/out/clock", payload: [] },
    ];

    for (const testCase of cases) {
      const mapped = mqttPayloadFromMidi("remote", testCase.bytes);
      expect(mapped?.topic).toBe(testCase.topic);
      expect(Array.from(mapped?.payload ?? [])).toEqual(testCase.payload);
    }
  });

  it("converts MQTT in-topics back to MIDI bytes", () => {
    expect(
      Array.from(midiBytesFromMqtt("remote", "remote/in/noteon/1/60", Uint8Array.of(100)) ?? []),
    ).toEqual([0x90, 60, 100]);
    expect(
      Array.from(midiBytesFromMqtt("remote", "remote/in/cc/2/7", Uint8Array.of(10)) ?? []),
    ).toEqual([0xb1, 7, 10]);
    expect(midiBytesFromMqtt("remote", "remote/out/cc/1/7", Uint8Array.of(10))).toBeUndefined();
  });

  it("parses topics and MIDI messages consistently", () => {
    expect(parseTopic("remote", "remote/in/noteon/1/60")).toEqual({
      kind: "noteon",
      direction: "in",
      channel: 1,
      note: 60,
    });
    const parsed = parseMidiMessage([0x90, 60, 100]);
    expect(parsed).toEqual({ kind: "noteon", channel: 1, note: 60, velocity: 100 });
    if (!parsed) {
      throw new Error("expected parsed MIDI message");
    }
    expect(toMidiBytes(parsed)).toEqual([0x90, 60, 100]);
  });
});

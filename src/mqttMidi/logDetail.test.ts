import { describe, expect, it } from "vitest";
import { formatMidiToMqttDetail, formatMqttToMidiDetail, shouldLogTraffic } from "./logDetail";

describe("logDetail", () => {
  it("formats midi→mqtt as MIDI first, then MQTT", () => {
    expect(
      formatMidiToMqttDetail(
        Uint8Array.of(0x90, 60, 100),
        "remote/out/noteon/1/60",
        Uint8Array.of(100),
      ),
    ).toBe("noteon ch1 note60 vel100 → remote/out/noteon/1/60 = 100");
    expect(
      formatMidiToMqttDetail(Uint8Array.of(0xb0, 7, 64), "remote/out/cc/1/7", Uint8Array.of(64)),
    ).toBe("cc ch1 ctrl7 val64 → remote/out/cc/1/7 = 64");
  });

  it("formats mqtt→midi as MQTT first, then MIDI", () => {
    expect(
      formatMqttToMidiDetail(
        "remote/in/noteon/1/60",
        Uint8Array.of(100),
        Uint8Array.of(0x90, 60, 100),
      ),
    ).toBe("remote/in/noteon/1/60 = 100 → noteon ch1 note60 vel100");
    expect(
      formatMqttToMidiDetail(
        "remote/in/pitchbend/2",
        Uint8Array.of(0, 64),
        Uint8Array.of(0xe1, 0, 64),
      ),
    ).toBe("remote/in/pitchbend/2 = 8192 → pitchbend ch2 val8192");
  });

  it("formats empty MQTT payloads without an equals value", () => {
    expect(formatMidiToMqttDetail(Uint8Array.of(0xfa), "remote/out/start", new Uint8Array())).toBe(
      "start → remote/out/start",
    );
  });

  it("skips clock ticks in the activity log", () => {
    expect(shouldLogTraffic("remote/out/clock")).toBe(false);
    expect(shouldLogTraffic("remote/out/start")).toBe(true);
    expect(shouldLogTraffic("remote/out/noteon/1/60")).toBe(true);
  });
});

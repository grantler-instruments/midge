import { isValidPitchBend, isValidSevenBit } from "./topics";

export function decodeSevenBit(payload: Uint8Array): number {
  if (payload.length !== 1) {
    throw new Error(`expected 1-byte payload, got ${payload.length} bytes`);
  }
  const value = payload[0];
  if (!isValidSevenBit(value)) {
    throw new Error(`invalid 7-bit MIDI value: ${value}`);
  }
  return value;
}

export function encodeSevenBit(value: number): Uint8Array {
  if (!isValidSevenBit(value)) {
    throw new Error(`expected 7-bit MIDI value 0–127, got ${value}`);
  }
  return Uint8Array.of(value);
}

export function decodePitchBend(payload: Uint8Array): number {
  if (payload.length !== 2) {
    throw new Error(`expected 2-byte pitch bend payload, got ${payload.length} bytes`);
  }
  const lsb = payload[0];
  const msb = payload[1];
  if (lsb > 127 || msb > 127) {
    throw new Error("pitch bend bytes must be 7-bit values");
  }
  return (msb << 7) | lsb;
}

export function encodePitchBend(value: number): Uint8Array {
  if (!isValidPitchBend(value)) {
    throw new Error(`expected pitch bend 0–16383, got ${value}`);
  }
  return Uint8Array.of(value & 0x7f, (value >> 7) & 0x7f);
}

export function decodeSysexJson(payload: Uint8Array): number[] {
  const text = new TextDecoder().decode(payload);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`SysEx payload must be JSON: ${err instanceof Error ? err.message : err}`);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("data" in parsed) ||
    !Array.isArray((parsed as { data: unknown }).data)
  ) {
    throw new Error("SysEx payload must be JSON with a data array");
  }
  return (parsed as { data: number[] }).data.map((value) => {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("SysEx data must be byte values");
    }
    return value;
  });
}

export function encodeSysexJson(data: number[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ data }));
}

export function encodeEmptyPayload(): Uint8Array {
  return new Uint8Array();
}

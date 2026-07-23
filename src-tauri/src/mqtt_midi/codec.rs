use super::topics::{is_valid_pitch_bend, is_valid_seven_bit};
use serde::Deserialize;

pub fn decode_seven_bit(payload: &[u8]) -> Result<u8, String> {
    if payload.len() != 1 {
        return Err(format!(
            "expected 1-byte payload, got {} bytes",
            payload.len()
        ));
    }
    let value = payload[0];
    if !is_valid_seven_bit(value) {
        return Err(format!("invalid 7-bit MIDI value: {value}"));
    }
    Ok(value)
}

pub fn encode_seven_bit(value: u8) -> Result<Vec<u8>, String> {
    if !is_valid_seven_bit(value) {
        return Err(format!("expected 7-bit MIDI value 0–127, got {value}"));
    }
    Ok(vec![value])
}

pub fn decode_pitch_bend(payload: &[u8]) -> Result<u16, String> {
    if payload.len() != 2 {
        return Err(format!(
            "expected 2-byte pitch bend payload, got {} bytes",
            payload.len()
        ));
    }
    let lsb = payload[0];
    let msb = payload[1];
    if lsb > 127 || msb > 127 {
        return Err("pitch bend bytes must be 7-bit values".to_string());
    }
    Ok(((msb as u16) << 7) | lsb as u16)
}

pub fn encode_pitch_bend(value: u16) -> Result<Vec<u8>, String> {
    if !is_valid_pitch_bend(value) {
        return Err(format!("expected pitch bend 0–16383, got {value}"));
    }
    Ok(vec![(value & 0x7f) as u8, ((value >> 7) & 0x7f) as u8])
}

#[derive(Deserialize)]
struct SysexJson {
    data: Vec<u8>,
}

pub fn decode_sysex_json(payload: &[u8]) -> Result<Vec<u8>, String> {
    let parsed: SysexJson = serde_json::from_slice(payload)
        .map_err(|err| format!("SysEx payload must be JSON: {err}"))?;
    Ok(parsed.data)
}

pub fn encode_sysex_json(data: &[u8]) -> Result<Vec<u8>, String> {
    serde_json::to_vec(&serde_json::json!({ "data": data })).map_err(|err| err.to_string())
}

pub fn encode_empty_payload() -> Vec<u8> {
    Vec::new()
}

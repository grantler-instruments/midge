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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seven_bit_round_trip() {
        assert_eq!(encode_seven_bit(0).unwrap(), vec![0]);
        assert_eq!(encode_seven_bit(127).unwrap(), vec![127]);
        assert_eq!(decode_seven_bit(&[42]).unwrap(), 42);
    }

    #[test]
    fn seven_bit_rejects_invalid_length_and_range() {
        assert!(encode_seven_bit(128).is_err());
        assert!(decode_seven_bit(&[]).is_err());
        assert!(decode_seven_bit(&[1, 2]).is_err());
        assert!(decode_seven_bit(&[128]).is_err());
    }

    #[test]
    fn pitch_bend_round_trip() {
        assert_eq!(encode_pitch_bend(0).unwrap(), vec![0, 0]);
        assert_eq!(encode_pitch_bend(8192).unwrap(), vec![0, 64]);
        assert_eq!(encode_pitch_bend(16383).unwrap(), vec![127, 127]);
        assert_eq!(decode_pitch_bend(&[0, 64]).unwrap(), 8192);
        assert_eq!(decode_pitch_bend(&[127, 127]).unwrap(), 16383);
    }

    #[test]
    fn pitch_bend_rejects_invalid_length_and_range() {
        assert!(encode_pitch_bend(16384).is_err());
        assert!(decode_pitch_bend(&[0]).is_err());
        assert!(decode_pitch_bend(&[0, 64, 0]).is_err());
        assert!(decode_pitch_bend(&[128, 0]).is_err());
        assert!(decode_pitch_bend(&[0, 128]).is_err());
    }

    #[test]
    fn sysex_json_round_trip() {
        let data = vec![0xf0, 0x7e, 0x00, 0xf7];
        let encoded = encode_sysex_json(&data).unwrap();
        assert_eq!(encoded, br#"{"data":[240,126,0,247]}"#);
        assert_eq!(decode_sysex_json(&encoded).unwrap(), data);
    }

    #[test]
    fn sysex_json_rejects_invalid_payload() {
        assert!(decode_sysex_json(br"not-json").is_err());
        assert!(decode_sysex_json(br#"{"other":[]}"#).is_err());
    }

    #[test]
    fn empty_payload_is_empty() {
        assert!(encode_empty_payload().is_empty());
    }
}

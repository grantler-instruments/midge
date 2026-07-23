use super::codec::{
    encode_empty_payload, encode_pitch_bend, encode_seven_bit, encode_sysex_json,
};
use super::midi_message::{parse_midi_message, ParsedMidiMessage};
use super::topics::{
    build_control_change_topic, build_note_off_topic, build_note_on_topic, build_pitch_bend_topic,
    build_program_change_topic, build_sysex_topic, build_system_topic, Direction,
};

pub fn mqtt_payload_from_midi(prefix: &str, message: &[u8]) -> Option<(String, Vec<u8>)> {
    let parsed = parse_midi_message(message)?;
    let direction = Direction::Out;

    match parsed {
        ParsedMidiMessage::NoteOn {
            channel,
            note,
            velocity,
        } => Some((
            build_note_on_topic(prefix, direction, channel, note),
            encode_seven_bit(velocity).ok()?,
        )),
        ParsedMidiMessage::NoteOff {
            channel,
            note,
            velocity,
        } => Some((
            build_note_off_topic(prefix, direction, channel, note),
            encode_seven_bit(velocity).ok()?,
        )),
        ParsedMidiMessage::ControlChange {
            channel,
            controller,
            value,
        } => Some((
            build_control_change_topic(prefix, direction, channel, controller),
            encode_seven_bit(value).ok()?,
        )),
        ParsedMidiMessage::ProgramChange { channel, program } => Some((
            build_program_change_topic(prefix, direction, channel),
            encode_seven_bit(program).ok()?,
        )),
        ParsedMidiMessage::PitchBend { channel, value } => Some((
            build_pitch_bend_topic(prefix, direction, channel),
            encode_pitch_bend(value).ok()?,
        )),
        ParsedMidiMessage::Sysex { data } => Some((
            build_sysex_topic(prefix, direction),
            encode_sysex_json(&data).ok()?,
        )),
        ParsedMidiMessage::System(kind) => Some((
            build_system_topic(prefix, direction, kind),
            encode_empty_payload(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn note_on_maps_to_out_topic_and_velocity() {
        let (topic, payload) = mqtt_payload_from_midi("remote", &[0x90, 60, 100]).unwrap();
        assert_eq!(topic, "remote/out/noteon/1/60");
        assert_eq!(payload, vec![100]);
    }

    #[test]
    fn note_on_velocity_zero_maps_to_note_off() {
        let (topic, payload) = mqtt_payload_from_midi("remote", &[0x90, 60, 0]).unwrap();
        assert_eq!(topic, "remote/out/noteoff/1/60");
        assert_eq!(payload, vec![0]);
    }

    #[test]
    fn note_off_maps_to_out_topic_and_velocity() {
        let (topic, payload) = mqtt_payload_from_midi("remote", &[0x80, 60, 64]).unwrap();
        assert_eq!(topic, "remote/out/noteoff/1/60");
        assert_eq!(payload, vec![64]);
    }

    #[test]
    fn control_change_maps_to_out_topic_and_value() {
        let (topic, payload) = mqtt_payload_from_midi("remote", &[0xb0, 7, 100]).unwrap();
        assert_eq!(topic, "remote/out/cc/1/7");
        assert_eq!(payload, vec![100]);
    }

    #[test]
    fn program_change_maps_to_out_topic_and_program() {
        let (topic, payload) = mqtt_payload_from_midi("remote", &[0xc0, 42]).unwrap();
        assert_eq!(topic, "remote/out/program/1");
        assert_eq!(payload, vec![42]);
    }

    #[test]
    fn pitch_bend_maps_to_out_topic_and_lsb_msb() {
        // value = (msb << 7) | lsb = (64 << 7) | 0 = 8192
        let (topic, payload) = mqtt_payload_from_midi("remote", &[0xe0, 0, 64]).unwrap();
        assert_eq!(topic, "remote/out/pitchbend/1");
        assert_eq!(payload, vec![0, 64]);
    }

    #[test]
    fn sysex_maps_to_out_topic_and_json_payload() {
        let sysex = vec![0xf0, 0x7e, 0x00, 0xf7];
        let (topic, payload) = mqtt_payload_from_midi("remote", &sysex).unwrap();
        assert_eq!(topic, "remote/out/sysex");
        assert_eq!(payload, br#"{"data":[240,126,0,247]}"#);
    }

    #[test]
    fn system_messages_map_to_out_topics_with_empty_payload() {
        for (status, kind) in [
            (0xf8u8, "clock"),
            (0xfa, "start"),
            (0xfc, "stop"),
            (0xfb, "continue"),
        ] {
            let (topic, payload) = mqtt_payload_from_midi("remote", &[status]).unwrap();
            assert_eq!(topic, format!("remote/out/{kind}"));
            assert!(payload.is_empty());
        }
    }

    #[test]
    fn empty_and_unsupported_messages_return_none() {
        assert!(mqtt_payload_from_midi("remote", &[]).is_none());
        assert!(mqtt_payload_from_midi("remote", &[0xf2, 0x00, 0x00]).is_none()); // song position
        assert!(mqtt_payload_from_midi("remote", &[0x90, 60]).is_none()); // truncated note on
    }
}

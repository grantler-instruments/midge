use super::codec::{decode_pitch_bend, decode_seven_bit};
use super::midi_message::{parse_midi_message, ParsedMidiMessage};

fn topic_kind(topic: &str) -> Option<&str> {
    let parts: Vec<&str> = topic.split('/').collect();
    let dir_index = parts.iter().position(|part| *part == "in" || *part == "out")?;
    parts.get(dir_index + 1).copied()
}

/// Clock ticks flood the activity log; still bridge them, just don't display.
pub fn should_log_traffic(topic: &str) -> bool {
    topic_kind(topic) != Some("clock")
}

pub fn format_midi_detail(message: &ParsedMidiMessage) -> String {
    match message {
        ParsedMidiMessage::NoteOn {
            channel,
            note,
            velocity,
        } => format!("noteon ch{channel} note{note} vel{velocity}"),
        ParsedMidiMessage::NoteOff {
            channel,
            note,
            velocity,
        } => format!("noteoff ch{channel} note{note} vel{velocity}"),
        ParsedMidiMessage::ControlChange {
            channel,
            controller,
            value,
        } => format!("cc ch{channel} ctrl{controller} val{value}"),
        ParsedMidiMessage::ProgramChange { channel, program } => {
            format!("program ch{channel} prog{program}")
        }
        ParsedMidiMessage::PitchBend { channel, value } => {
            format!("pitchbend ch{channel} val{value}")
        }
        ParsedMidiMessage::Sysex { data } => {
            let bytes = data
                .iter()
                .map(|byte| byte.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!("sysex [{bytes}]")
        }
        ParsedMidiMessage::System(kind) => kind.as_str().to_string(),
    }
}

pub fn format_mqtt_detail(topic: &str, payload: &[u8]) -> String {
    if payload.is_empty() {
        return topic.to_string();
    }

    let formatted = match topic_kind(topic) {
        Some("noteon" | "noteoff" | "cc" | "program") => decode_seven_bit(payload)
            .ok()
            .map(|value| format!("{topic} = {value}")),
        Some("pitchbend") => decode_pitch_bend(payload)
            .ok()
            .map(|value| format!("{topic} = {value}")),
        Some("sysex") => String::from_utf8(payload.to_vec())
            .ok()
            .map(|json| format!("{topic} = {json}")),
        _ => None,
    };

    formatted.unwrap_or_else(|| {
        let bytes = payload
            .iter()
            .map(|byte| byte.to_string())
            .collect::<Vec<_>>()
            .join(", ");
        format!("{topic} = [{bytes}]")
    })
}

fn format_midi_bytes(midi: &[u8]) -> String {
    parse_midi_message(midi).map_or_else(
        || {
            let bytes = midi
                .iter()
                .map(|byte| byte.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{bytes}]")
        },
        |message| format_midi_detail(&message),
    )
}

pub fn format_midi_to_mqtt_detail(midi: &[u8], topic: &str, payload: &[u8]) -> String {
    format!(
        "{} → {}",
        format_midi_bytes(midi),
        format_mqtt_detail(topic, payload)
    )
}

pub fn format_mqtt_to_midi_detail(topic: &str, payload: &[u8], midi: &[u8]) -> String {
    format!(
        "{} → {}",
        format_mqtt_detail(topic, payload),
        format_midi_bytes(midi)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_midi_to_mqtt_as_midi_then_mqtt() {
        assert_eq!(
            format_midi_to_mqtt_detail(&[0x90, 60, 100], "remote/out/noteon/1/60", &[100]),
            "noteon ch1 note60 vel100 → remote/out/noteon/1/60 = 100"
        );
        assert_eq!(
            format_midi_to_mqtt_detail(&[0xb0, 7, 64], "remote/out/cc/1/7", &[64]),
            "cc ch1 ctrl7 val64 → remote/out/cc/1/7 = 64"
        );
    }

    #[test]
    fn formats_mqtt_to_midi_as_mqtt_then_midi() {
        assert_eq!(
            format_mqtt_to_midi_detail("remote/in/noteon/1/60", &[100], &[0x90, 60, 100]),
            "remote/in/noteon/1/60 = 100 → noteon ch1 note60 vel100"
        );
        assert_eq!(
            format_mqtt_to_midi_detail("remote/in/pitchbend/2", &[0, 64], &[0xe1, 0, 64]),
            "remote/in/pitchbend/2 = 8192 → pitchbend ch2 val8192"
        );
    }

    #[test]
    fn skips_clock_logging() {
        assert!(!should_log_traffic("remote/out/clock"));
        assert!(should_log_traffic("remote/out/start"));
        assert!(should_log_traffic("remote/out/noteon/1/60"));
    }

    #[test]
    fn formats_empty_mqtt_payload_without_equals() {
        assert_eq!(
            format_midi_to_mqtt_detail(&[0xfa], "remote/out/start", &[]),
            "start → remote/out/start"
        );
    }
}

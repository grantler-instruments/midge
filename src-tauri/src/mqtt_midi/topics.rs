use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    In,
    Out,
}

impl Direction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::In => "in",
            Self::Out => "out",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SystemMessageType {
    Clock,
    Start,
    Stop,
    Continue,
}

impl SystemMessageType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Clock => "clock",
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Continue => "continue",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "clock" => Some(Self::Clock),
            "start" => Some(Self::Start),
            "stop" => Some(Self::Stop),
            "continue" => Some(Self::Continue),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ParsedTopic {
    NoteOn {
        direction: Direction,
        channel: u8,
        note: u8,
    },
    NoteOff {
        direction: Direction,
        channel: u8,
        note: u8,
    },
    ControlChange {
        direction: Direction,
        channel: u8,
        controller: u8,
    },
    ProgramChange {
        direction: Direction,
        channel: u8,
    },
    PitchBend {
        direction: Direction,
        channel: u8,
    },
    Sysex {
        direction: Direction,
    },
    System {
        direction: Direction,
        kind: SystemMessageType,
    },
}

pub fn build_topic(prefix: &str, direction: Direction, segments: &[&str]) -> String {
    let mut parts = vec![prefix.to_string(), direction.as_str().to_string()];
    parts.extend(segments.iter().map(|s| s.to_string()));
    parts.join("/")
}

pub fn build_note_on_topic(prefix: &str, direction: Direction, channel: u8, note: u8) -> String {
    build_topic(
        prefix,
        direction,
        &["noteon", &channel.to_string(), &note.to_string()],
    )
}

pub fn build_note_off_topic(prefix: &str, direction: Direction, channel: u8, note: u8) -> String {
    build_topic(
        prefix,
        direction,
        &["noteoff", &channel.to_string(), &note.to_string()],
    )
}

pub fn build_control_change_topic(
    prefix: &str,
    direction: Direction,
    channel: u8,
    controller: u8,
) -> String {
    build_topic(
        prefix,
        direction,
        &["cc", &channel.to_string(), &controller.to_string()],
    )
}

pub fn build_program_change_topic(prefix: &str, direction: Direction, channel: u8) -> String {
    build_topic(prefix, direction, &["program", &channel.to_string()])
}

pub fn build_pitch_bend_topic(prefix: &str, direction: Direction, channel: u8) -> String {
    build_topic(prefix, direction, &["pitchbend", &channel.to_string()])
}

pub fn build_sysex_topic(prefix: &str, direction: Direction) -> String {
    build_topic(prefix, direction, &["sysex"])
}

pub fn build_system_topic(prefix: &str, direction: Direction, kind: SystemMessageType) -> String {
    build_topic(prefix, direction, &[kind.as_str()])
}

pub fn parse_topic(prefix: &str, topic: &str) -> Option<ParsedTopic> {
    let expected = format!("{prefix}/");
    if !topic.starts_with(&expected) {
        return None;
    }

    let parts: Vec<&str> = topic[expected.len()..].split('/').collect();
    if parts.len() < 2 {
        return None;
    }

    let direction = match parts[0] {
        "in" => Direction::In,
        "out" => Direction::Out,
        _ => return None,
    };

    match parts[1] {
        "sysex" if parts.len() == 2 => Some(ParsedTopic::Sysex { direction }),
        "clock" | "start" | "stop" | "continue" if parts.len() == 2 => {
            Some(ParsedTopic::System {
                direction,
                kind: SystemMessageType::from_str(parts[1])?,
            })
        }
        "cc" if parts.len() == 4 => {
            let channel = parts[2].parse().ok().filter(|c| is_valid_channel(*c))?;
            let controller = parts[3].parse().ok().filter(|c| is_valid_controller(*c))?;
            Some(ParsedTopic::ControlChange {
                direction,
                channel,
                controller,
            })
        }
        "noteon" if parts.len() == 4 => {
            let channel = parts[2].parse().ok().filter(|c| is_valid_channel(*c))?;
            let note = parts[3].parse().ok().filter(|n| is_valid_note(*n))?;
            Some(ParsedTopic::NoteOn {
                direction,
                channel,
                note,
            })
        }
        "noteoff" if parts.len() == 4 => {
            let channel = parts[2].parse().ok().filter(|c| is_valid_channel(*c))?;
            let note = parts[3].parse().ok().filter(|n| is_valid_note(*n))?;
            Some(ParsedTopic::NoteOff {
                direction,
                channel,
                note,
            })
        }
        "program" if parts.len() == 3 => {
            let channel = parts[2].parse().ok().filter(|c| is_valid_channel(*c))?;
            Some(ParsedTopic::ProgramChange { direction, channel })
        }
        "pitchbend" if parts.len() == 3 => {
            let channel = parts[2].parse().ok().filter(|c| is_valid_channel(*c))?;
            Some(ParsedTopic::PitchBend { direction, channel })
        }
        _ => None,
    }
}

pub fn in_subscription_topics(prefix: &str) -> Vec<String> {
    vec![
        format!("{prefix}/in/noteon/#"),
        format!("{prefix}/in/noteoff/#"),
        format!("{prefix}/in/cc/#"),
        format!("{prefix}/in/program/#"),
        format!("{prefix}/in/pitchbend/#"),
        format!("{prefix}/in/sysex"),
        format!("{prefix}/in/clock"),
        format!("{prefix}/in/start"),
        format!("{prefix}/in/stop"),
        format!("{prefix}/in/continue"),
    ]
}

pub fn is_valid_channel(channel: u8) -> bool {
    (1..=16).contains(&channel)
}

pub fn is_valid_note(note: u8) -> bool {
    note <= 127
}

pub fn is_valid_controller(controller: u8) -> bool {
    controller <= 127
}

pub fn is_valid_seven_bit(value: u8) -> bool {
    value <= 127
}

pub fn is_valid_pitch_bend(value: u16) -> bool {
    value <= 16383
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_control_change_round_trip() {
        let topic = build_control_change_topic("remote", Direction::Out, 1, 7);
        let parsed = parse_topic("remote", &topic).unwrap();
        assert_eq!(
            parsed,
            ParsedTopic::ControlChange {
                direction: Direction::Out,
                channel: 1,
                controller: 7,
            }
        );
    }
}

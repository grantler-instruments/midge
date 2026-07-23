use super::topics::SystemMessageType;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ParsedMidiMessage {
    NoteOn {
        channel: u8,
        note: u8,
        velocity: u8,
    },
    NoteOff {
        channel: u8,
        note: u8,
        velocity: u8,
    },
    ControlChange {
        channel: u8,
        controller: u8,
        value: u8,
    },
    ProgramChange {
        channel: u8,
        program: u8,
    },
    PitchBend {
        channel: u8,
        value: u16,
    },
    Sysex {
        data: Vec<u8>,
    },
    System(SystemMessageType),
}

const SYSTEM_BY_STATUS: &[(u8, SystemMessageType)] = &[
    (0xf8, SystemMessageType::Clock),
    (0xfa, SystemMessageType::Start),
    (0xfc, SystemMessageType::Stop),
    (0xfb, SystemMessageType::Continue),
];

pub fn parse_midi_message(message: &[u8]) -> Option<ParsedMidiMessage> {
    if message.is_empty() {
        return None;
    }

    let status = message[0];

    if status >= 0xf8 {
        return SYSTEM_BY_STATUS
            .iter()
            .find(|(value, _)| *value == status)
            .map(|(_, kind)| ParsedMidiMessage::System(*kind));
    }

    if status == 0xf0 {
        return Some(ParsedMidiMessage::Sysex {
            data: message.to_vec(),
        });
    }

    let command = status & 0xf0;
    let channel = (status & 0x0f) + 1;
    if !(1..=16).contains(&channel) {
        return None;
    }

    match command {
        0x90 if message.len() >= 3 => {
            let note = message[1];
            let velocity = message[2];
            if velocity == 0 {
                Some(ParsedMidiMessage::NoteOff {
                    channel,
                    note,
                    velocity: 0,
                })
            } else {
                Some(ParsedMidiMessage::NoteOn {
                    channel,
                    note,
                    velocity,
                })
            }
        }
        0x80 if message.len() >= 3 => Some(ParsedMidiMessage::NoteOff {
            channel,
            note: message[1],
            velocity: message[2],
        }),
        0xb0 if message.len() >= 3 => Some(ParsedMidiMessage::ControlChange {
            channel,
            controller: message[1],
            value: message[2],
        }),
        0xc0 if message.len() >= 2 => Some(ParsedMidiMessage::ProgramChange {
            channel,
            program: message[1],
        }),
        0xe0 if message.len() >= 3 => {
            let value = ((message[2] as u16) << 7) | message[1] as u16;
            Some(ParsedMidiMessage::PitchBend { channel, value })
        }
        _ => None,
    }
}

pub fn to_midi_bytes(parsed: &ParsedMidiMessage) -> Vec<u8> {
    match parsed {
        ParsedMidiMessage::NoteOn {
            channel,
            note,
            velocity,
        } => vec![0x90 | (channel - 1), *note, *velocity],
        ParsedMidiMessage::NoteOff {
            channel,
            note,
            velocity,
        } => vec![0x80 | (channel - 1), *note, *velocity],
        ParsedMidiMessage::ControlChange {
            channel,
            controller,
            value,
        } => vec![0xb0 | (channel - 1), *controller, *value],
        ParsedMidiMessage::ProgramChange { channel, program } => {
            vec![0xc0 | (channel - 1), *program]
        }
        ParsedMidiMessage::PitchBend { channel, value } => {
            vec![
                0xe0 | (channel - 1),
                (value & 0x7f) as u8,
                ((value >> 7) & 0x7f) as u8,
            ]
        }
        ParsedMidiMessage::Sysex { data } => data.clone(),
        ParsedMidiMessage::System(kind) => SYSTEM_BY_STATUS
            .iter()
            .find(|(_, value)| value == kind)
            .map(|(status, _)| vec![*status])
            .unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_note_on() {
        assert_eq!(
            parse_midi_message(&[0x90, 60, 100]),
            Some(ParsedMidiMessage::NoteOn {
                channel: 1,
                note: 60,
                velocity: 100,
            })
        );
    }

    #[test]
    fn note_on_velocity_zero_becomes_note_off() {
        assert_eq!(
            parse_midi_message(&[0x90, 60, 0]),
            Some(ParsedMidiMessage::NoteOff {
                channel: 1,
                note: 60,
                velocity: 0,
            })
        );
    }

    #[test]
    fn parses_note_off_control_change_program_and_pitch_bend() {
        assert_eq!(
            parse_midi_message(&[0x81, 60, 64]),
            Some(ParsedMidiMessage::NoteOff {
                channel: 2,
                note: 60,
                velocity: 64,
            })
        );
        assert_eq!(
            parse_midi_message(&[0xb0, 7, 100]),
            Some(ParsedMidiMessage::ControlChange {
                channel: 1,
                controller: 7,
                value: 100,
            })
        );
        assert_eq!(
            parse_midi_message(&[0xc0, 42]),
            Some(ParsedMidiMessage::ProgramChange {
                channel: 1,
                program: 42,
            })
        );
        assert_eq!(
            parse_midi_message(&[0xe0, 0, 64]),
            Some(ParsedMidiMessage::PitchBend {
                channel: 1,
                value: 8192,
            })
        );
    }

    #[test]
    fn parses_sysex_and_system_messages() {
        let sysex = vec![0xf0, 0x7e, 0x00, 0xf7];
        assert_eq!(
            parse_midi_message(&sysex),
            Some(ParsedMidiMessage::Sysex { data: sysex })
        );
        assert_eq!(
            parse_midi_message(&[0xf8]),
            Some(ParsedMidiMessage::System(SystemMessageType::Clock))
        );
        assert_eq!(
            parse_midi_message(&[0xfa]),
            Some(ParsedMidiMessage::System(SystemMessageType::Start))
        );
        assert_eq!(
            parse_midi_message(&[0xfc]),
            Some(ParsedMidiMessage::System(SystemMessageType::Stop))
        );
        assert_eq!(
            parse_midi_message(&[0xfb]),
            Some(ParsedMidiMessage::System(SystemMessageType::Continue))
        );
    }

    #[test]
    fn rejects_empty_truncated_and_unsupported() {
        assert_eq!(parse_midi_message(&[]), None);
        assert_eq!(parse_midi_message(&[0x90, 60]), None);
        assert_eq!(parse_midi_message(&[0x80, 60]), None);
        assert_eq!(parse_midi_message(&[0xb0, 7]), None);
        assert_eq!(parse_midi_message(&[0xc0]), None);
        assert_eq!(parse_midi_message(&[0xe0, 0]), None);
        assert_eq!(parse_midi_message(&[0xf2, 0x00, 0x00]), None);
        assert_eq!(parse_midi_message(&[0xf9]), None); // tick, unsupported
    }

    #[test]
    fn to_midi_bytes_round_trips_channel_and_system_messages() {
        let cases = [
            ParsedMidiMessage::NoteOn {
                channel: 1,
                note: 60,
                velocity: 100,
            },
            ParsedMidiMessage::NoteOff {
                channel: 2,
                note: 60,
                velocity: 64,
            },
            ParsedMidiMessage::ControlChange {
                channel: 1,
                controller: 7,
                value: 100,
            },
            ParsedMidiMessage::ProgramChange {
                channel: 1,
                program: 42,
            },
            ParsedMidiMessage::PitchBend {
                channel: 1,
                value: 8192,
            },
            ParsedMidiMessage::Sysex {
                data: vec![0xf0, 0x7e, 0x00, 0xf7],
            },
            ParsedMidiMessage::System(SystemMessageType::Clock),
            ParsedMidiMessage::System(SystemMessageType::Start),
            ParsedMidiMessage::System(SystemMessageType::Stop),
            ParsedMidiMessage::System(SystemMessageType::Continue),
        ];

        for message in cases {
            let bytes = to_midi_bytes(&message);
            assert_eq!(parse_midi_message(&bytes), Some(message));
        }
    }

    #[test]
    fn note_off_from_velocity_zero_round_trips_as_note_off_status() {
        let message = ParsedMidiMessage::NoteOff {
            channel: 1,
            note: 60,
            velocity: 0,
        };
        assert_eq!(to_midi_bytes(&message), vec![0x80, 60, 0]);
    }
}

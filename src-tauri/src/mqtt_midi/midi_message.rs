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

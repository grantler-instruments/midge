use midir::{MidiInput, MidiOutput};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct PortLists {
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
}

pub fn list_midi_port_names() -> PortLists {
    PortLists {
        inputs: list_input_port_names(),
        outputs: list_output_port_names(),
    }
}

pub fn list_input_port_names() -> Vec<String> {
    let Ok(midi) = MidiInput::new("midge-port-list-in") else {
        return Vec::new();
    };
    let ports = midi.ports();
    ports
        .iter()
        .filter_map(|port| {
            midi.port_name(port)
                .ok()
                .map(|name| name.trim().to_string())
                .filter(|name| !name.is_empty())
        })
        .collect()
}

pub fn list_output_port_names() -> Vec<String> {
    let Ok(midi) = MidiOutput::new("midge-port-list-out") else {
        return Vec::new();
    };
    let ports = midi.ports();
    ports
        .iter()
        .filter_map(|port| {
            midi.port_name(port)
                .ok()
                .map(|name| name.trim().to_string())
                .filter(|name| !name.is_empty())
        })
        .collect()
}

pub fn find_input_port_index(name: &str) -> Result<usize, String> {
    let midi = MidiInput::new("midge-bridge-in").map_err(|e| e.to_string())?;
    let ports = midi.ports();
    ports
        .iter()
        .enumerate()
        .find(|(_, port)| {
            midi.port_name(port)
                .map(|label| label.trim() == name)
                .unwrap_or(false)
        })
        .map(|(index, _)| index)
        .ok_or_else(|| format!("MIDI port not found: {name}"))
}

pub fn find_output_port_index(name: &str) -> Result<usize, String> {
    let midi = MidiOutput::new("midge-bridge-out").map_err(|e| e.to_string())?;
    let ports = midi.ports();
    ports
        .iter()
        .enumerate()
        .find(|(_, port)| {
            midi.port_name(port)
                .map(|label| label.trim() == name)
                .unwrap_or(false)
        })
        .map(|(index, _)| index)
        .ok_or_else(|| format!("MIDI port not found: {name}"))
}

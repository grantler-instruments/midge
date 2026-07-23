use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};

use midir::{MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
#[cfg(unix)]
use midir::os::unix::{VirtualInput, VirtualOutput};
use rumqttc::{AsyncClient, Event, EventLoop, Incoming, MqttOptions, QoS, Transport};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;
use tokio::task::JoinHandle as TokioJoinHandle;

use crate::devices::{find_input_port_index, find_output_port_index, PortLists};
use crate::mqtt_midi::{
    build_control_change_topic, build_note_off_topic, build_note_on_topic, build_pitch_bend_topic,
    build_program_change_topic, build_sysex_topic, build_system_topic, decode_pitch_bend,
    decode_seven_bit, decode_sysex_json, encode_empty_payload, encode_pitch_bend,
    encode_seven_bit, encode_sysex_json, in_subscription_topics, parse_midi_message, parse_topic,
    to_midi_bytes, Direction, ParsedMidiMessage, ParsedTopic,
};

pub const DEFAULT_VIRTUAL_PORT_NAME: &str = "midge";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeConfig {
    pub url: String,
    pub prefix: String,
    pub midi_in: Option<String>,
    pub midi_out: Option<String>,
    pub r#virtual: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub client_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    pub running: bool,
    pub url: Option<String>,
    pub prefix: Option<String>,
    pub midi_in: Option<String>,
    pub midi_out: Option<String>,
    pub virtual_port: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct BridgeLogEntry {
    pub direction: String,
    pub detail: String,
}

struct ResolvedBridgeConfig {
    url: String,
    host: String,
    port: u16,
    use_tls: bool,
    prefix: String,
    midi_in: String,
    midi_out: String,
    use_virtual: bool,
    username: Option<String>,
    password: Option<String>,
    client_id: String,
}

struct BridgeHandle {
    stop_tx: oneshot::Sender<()>,
    mqtt_task: TokioJoinHandle<()>,
    midi_out_thread: JoinHandle<()>,
    midi_forward_thread: JoinHandle<()>,
    _midi_in: MidiInputConnection<()>,
    config: ResolvedBridgeConfig,
}

pub struct BridgeState(pub Mutex<Option<BridgeHandle>>);

impl Default for BridgeState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[tauri::command]
pub fn list_midi_port_names() -> PortLists {
    crate::devices::list_midi_port_names()
}

#[tauri::command]
pub fn get_bridge_status(state: State<'_, BridgeState>) -> BridgeStatus {
    let guard = state.0.lock().ok();
    if let Some(handle) = guard.as_ref().and_then(|inner| inner.as_ref()) {
        BridgeStatus {
            running: true,
            url: Some(handle.config.url.clone()),
            prefix: Some(handle.config.prefix.clone()),
            midi_in: Some(handle.config.midi_in.clone()),
            midi_out: Some(handle.config.midi_out.clone()),
            virtual_port: handle
                .config
                .use_virtual
                .then(|| handle.config.midi_in.clone()),
        }
    } else {
        BridgeStatus {
            running: false,
            url: None,
            prefix: None,
            midi_in: None,
            midi_out: None,
            virtual_port: None,
        }
    }
}

#[tauri::command]
pub async fn start_bridge(
    app: AppHandle,
    state: State<'_, BridgeState>,
    config: BridgeConfig,
) -> Result<(), String> {
    stop_bridge_inner(&state).await?;

    let resolved = resolve_bridge_config(config)?;
    let midi_out_conn = open_midi_output(&resolved)?;
    let (midi_out_tx, midi_out_rx) = mpsc::channel();
    let midi_out_thread = spawn_midi_out_thread(midi_out_conn, midi_out_rx);

    let (mqtt_publish_tx, mqtt_publish_rx) = mpsc::channel();
    let (raw_midi_tx, raw_midi_rx) = mpsc::channel();
    let prefix = resolved.prefix.clone();
    let app_for_midi = app.clone();
    let midi_in_label = resolved.midi_in.clone();
    let midi_in_conn = open_midi_input(&resolved, raw_midi_tx)?;
    let midi_forward_thread = thread::spawn(move || {
        while let Ok(message) = raw_midi_rx.recv() {
            if let Some((topic, payload)) = mqtt_payload_from_midi(&prefix, &message) {
                let detail = format!("{} ({} bytes)", topic, payload.len());
                let _ = mqtt_publish_tx.send((topic, payload));
                let _ = app_for_midi.emit(
                    "bridge://log",
                    BridgeLogEntry {
                        direction: "midi→mqtt".to_string(),
                        detail,
                    },
                );
            }
        }
    });

    let mut mqtt_options =
        MqttOptions::new(resolved.client_id.clone(), resolved.host.clone(), resolved.port);
    mqtt_options.set_keep_alive(std::time::Duration::from_secs(30));
    if resolved.use_tls {
        mqtt_options.set_transport(Transport::tls_with_default_config());
    }
    if let Some(username) = resolved.username.clone().filter(|value| !value.is_empty()) {
        mqtt_options.set_credentials(username, resolved.password.clone().unwrap_or_default());
    }

    let (client, eventloop) = AsyncClient::new(mqtt_options, 64);
    for topic in in_subscription_topics(&resolved.prefix) {
        client
            .subscribe(topic, QoS::AtMostOnce)
            .await
            .map_err(|e| e.to_string())?;
    }

    let (stop_tx, stop_rx) = oneshot::channel();
    let app_for_mqtt = app.clone();
    let prefix_for_mqtt = resolved.prefix.clone();
    let mqtt_task = tokio::spawn(async move {
        run_mqtt_loop(
            app_for_mqtt,
            eventloop,
            client,
            prefix_for_mqtt,
            midi_out_tx,
            mqtt_publish_rx,
            stop_rx,
        )
        .await;
    });

    let _ = app.emit(
        "bridge://log",
        BridgeLogEntry {
            direction: "status".to_string(),
            detail: format!(
                "Bridge started ({}{})",
                if resolved.use_virtual {
                    "virtual "
                } else {
                    ""
                },
                midi_in_label
            ),
        },
    );

    *state.0.lock().map_err(|e| e.to_string())? = Some(BridgeHandle {
        stop_tx,
        mqtt_task,
        midi_out_thread,
        midi_forward_thread,
        _midi_in: midi_in_conn,
        config: resolved,
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_bridge(state: State<'_, BridgeState>) -> Result<(), String> {
    stop_bridge_inner(&state).await
}

async fn stop_bridge_inner(state: &State<'_, BridgeState>) -> Result<(), String> {
    let handle = state.0.lock().map_err(|e| e.to_string())?.take();
    if let Some(handle) = handle {
        let _ = handle.stop_tx.send(());
        let _ = handle.mqtt_task.await;
        let _ = handle.midi_out_thread.join();
        let _ = handle.midi_forward_thread.join();
    }
    Ok(())
}

pub fn shutdown_on_exit(state: &BridgeState) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(handle) = guard.take() {
            let _ = handle.stop_tx.send(());
        }
    }
}

fn supports_virtual_midi_ports() -> bool {
    cfg!(any(target_os = "macos", target_os = "linux"))
}

fn resolve_bridge_config(config: BridgeConfig) -> Result<ResolvedBridgeConfig, String> {
    if config.url.trim().is_empty() {
        return Err("url is required".to_string());
    }
    if config.prefix.trim().is_empty() {
        return Err("prefix is required".to_string());
    }
    if config.prefix.contains('+') || config.prefix.contains('#') {
        return Err("prefix must not contain MQTT wildcards".to_string());
    }
    if config.r#virtual.is_some() && (config.midi_in.is_some() || config.midi_out.is_some()) {
        return Err("use either virtual or midiIn/midiOut, not both".to_string());
    }
    if config.midi_in.is_some() != config.midi_out.is_some() {
        return Err("midiIn and midiOut must both be set when using named ports".to_string());
    }

    let (host, port, use_tls) = parse_mqtt_url(&config.url)?;
    let client_id = config
        .client_id
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("midge-bridge-{}", uuid_suffix()));

    let (midi_in, midi_out, use_virtual) =
        if let Some(name) = config.r#virtual.filter(|v| !v.is_empty()) {
            (name.clone(), name, true)
        } else if let (Some(midi_in), Some(midi_out)) = (config.midi_in, config.midi_out) {
            (midi_in, midi_out, false)
        } else if supports_virtual_midi_ports() {
            (
                DEFAULT_VIRTUAL_PORT_NAME.to_string(),
                DEFAULT_VIRTUAL_PORT_NAME.to_string(),
                true,
            )
        } else if cfg!(target_os = "windows") {
            return Err(
                "On Windows, set midiIn and midiOut to existing ports (e.g. loopMIDI).".to_string(),
            );
        } else {
            return Err(
                "Set virtual, or midiIn and midiOut (virtual ports auto-create on macOS and Linux)."
                    .to_string(),
            );
        };

    Ok(ResolvedBridgeConfig {
        url: config.url,
        host,
        port,
        use_tls,
        prefix: config.prefix,
        midi_in,
        midi_out,
        use_virtual,
        username: config.username,
        password: config.password,
        client_id,
    })
}

fn parse_mqtt_url(url: &str) -> Result<(String, u16, bool), String> {
    let (rest, use_tls) = if let Some(rest) = url.strip_prefix("mqtts://") {
        (rest, true)
    } else if let Some(rest) = url.strip_prefix("mqtt://") {
        (rest, false)
    } else {
        return Err("url must start with mqtt:// or mqtts://".to_string());
    };

    if rest.is_empty() {
        return Err("url must include a host".to_string());
    }

    if let Some((host, port_text)) = rest.rsplit_once(':') {
        if host.is_empty() {
            return Err("url host must not be empty".to_string());
        }
        let port: u16 = port_text
            .parse()
            .map_err(|_| format!("invalid MQTT port: {port_text}"))?;
        Ok((host.to_string(), port, use_tls))
    } else {
        Ok((rest.to_string(), if use_tls { 8883 } else { 1883 }, use_tls))
    }
}

fn uuid_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}")
}

fn open_midi_output(config: &ResolvedBridgeConfig) -> Result<MidiOutputConnection, String> {
    if config.use_virtual {
        #[cfg(unix)]
        {
            let midi = MidiOutput::new("midge-bridge-out").map_err(|e| e.to_string())?;
            return midi
                .create_virtual(&config.midi_out)
                .map_err(|e| e.to_string());
        }
        #[cfg(not(unix))]
        {
            return Err("Virtual MIDI ports are not supported on this platform".to_string());
        }
    }

    let midi = MidiOutput::new("midge-bridge-out").map_err(|e| e.to_string())?;
    let index = find_output_port_index(&config.midi_out)?;
    let ports = midi.ports();
    let port = ports
        .get(index)
        .ok_or_else(|| format!("MIDI output port not found: {}", config.midi_out))?;
    midi.connect(port, "midge-bridge-out")
        .map_err(|e| e.to_string())
}

fn open_midi_input(
    config: &ResolvedBridgeConfig,
    raw_midi_tx: Sender<Vec<u8>>,
) -> Result<MidiInputConnection<()>, String> {
    if config.use_virtual {
        #[cfg(unix)]
        {
            let mut midi_in = MidiInput::new("midge-bridge-in").map_err(|e| e.to_string())?;
            return midi_in
                .create_virtual(
                    &config.midi_in,
                    move |_timestamp, message, _| {
                        let _ = raw_midi_tx.send(message.to_vec());
                    },
                    (),
                )
                .map_err(|e| e.to_string());
        }
        #[cfg(not(unix))]
        {
            return Err("Virtual MIDI ports are not supported on this platform".to_string());
        }
    }

    connect_midi_input(&config.midi_in, raw_midi_tx)
}

fn connect_midi_input(
    name: &str,
    raw_midi_tx: Sender<Vec<u8>>,
) -> Result<MidiInputConnection<()>, String> {
    let midi_in = MidiInput::new("midge-bridge-in").map_err(|e| e.to_string())?;
    let index = find_input_port_index(name)?;
    let ports = midi_in.ports();
    let port = ports
        .get(index)
        .ok_or_else(|| format!("MIDI input port not found: {name}"))?;
    midi_in
        .connect(
            port,
            "midge-bridge-in",
            move |_timestamp, message, _| {
                let _ = raw_midi_tx.send(message.to_vec());
            },
            (),
        )
        .map_err(|e| e.to_string())
}

fn spawn_midi_out_thread(
    mut conn: MidiOutputConnection,
    rx: Receiver<Vec<u8>>,
) -> JoinHandle<()> {
    thread::spawn(move || {
        while let Ok(message) = rx.recv() {
            let _ = conn.send(&message);
        }
    })
}

async fn run_mqtt_loop(
    app: AppHandle,
    mut eventloop: EventLoop,
    client: AsyncClient,
    prefix: String,
    midi_out_tx: Sender<Vec<u8>>,
    mqtt_publish_rx: Receiver<(String, Vec<u8>)>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    loop {
        tokio::select! {
            _ = &mut stop_rx => break,
            incoming = eventloop.poll() => {
                match incoming {
                    Ok(Event::Incoming(Incoming::Publish(publish))) => {
                        if let Err(err) = handle_mqtt_publish(
                            &app,
                            &prefix,
                            &publish.topic,
                            &publish.payload,
                            &midi_out_tx,
                        ) {
                            let _ = app.emit("bridge://log", BridgeLogEntry {
                                direction: "error".to_string(),
                                detail: err,
                            });
                        }
                    }
                    Ok(_) => {}
                    Err(err) => {
                        let _ = app.emit("bridge://log", BridgeLogEntry {
                            direction: "error".to_string(),
                            detail: format!("MQTT event loop error: {err}"),
                        });
                        break;
                    }
                }
            }
        }

        while let Ok((topic, payload)) = mqtt_publish_rx.try_recv() {
            if let Err(err) = client
                .publish(topic.clone(), QoS::AtMostOnce, false, payload)
                .await
            {
                let _ = app.emit("bridge://log", BridgeLogEntry {
                    direction: "error".to_string(),
                    detail: format!("MQTT publish failed: {err}"),
                });
            }
        }
    }

    let _ = client.disconnect().await;
    let _ = app.emit("bridge://log", BridgeLogEntry {
        direction: "status".to_string(),
        detail: "Bridge stopped".to_string(),
    });
}

fn handle_mqtt_publish(
    app: &AppHandle,
    prefix: &str,
    topic: &str,
    payload: &[u8],
    midi_out_tx: &Sender<Vec<u8>>,
) -> Result<(), String> {
    let parsed = parse_topic(prefix, topic).ok_or_else(|| format!("ignored topic: {topic}"))?;
    if !matches!(parsed, ParsedTopic::NoteOn { direction: Direction::In, .. }
        | ParsedTopic::NoteOff { direction: Direction::In, .. }
        | ParsedTopic::ControlChange { direction: Direction::In, .. }
        | ParsedTopic::ProgramChange { direction: Direction::In, .. }
        | ParsedTopic::PitchBend { direction: Direction::In, .. }
        | ParsedTopic::Sysex { direction: Direction::In }
        | ParsedTopic::System { direction: Direction::In, .. })
    {
        return Ok(());
    }

    let bytes = mqtt_to_midi_bytes(&parsed, payload)?;
    midi_out_tx
        .send(bytes)
        .map_err(|_| "MIDI output thread stopped".to_string())?;
    let _ = app.emit(
        "bridge://log",
        BridgeLogEntry {
            direction: "mqtt→midi".to_string(),
            detail: topic.to_string(),
        },
    );
    Ok(())
}

fn mqtt_to_midi_bytes(parsed: &ParsedTopic, payload: &[u8]) -> Result<Vec<u8>, String> {
    let message = match parsed {
        ParsedTopic::NoteOn {
            channel, note, ..
        } => ParsedMidiMessage::NoteOn {
            channel: *channel,
            note: *note,
            velocity: decode_seven_bit(payload)?,
        },
        ParsedTopic::NoteOff {
            channel, note, ..
        } => ParsedMidiMessage::NoteOff {
            channel: *channel,
            note: *note,
            velocity: decode_seven_bit(payload)?,
        },
        ParsedTopic::ControlChange {
            channel,
            controller,
            ..
        } => ParsedMidiMessage::ControlChange {
            channel: *channel,
            controller: *controller,
            value: decode_seven_bit(payload)?,
        },
        ParsedTopic::ProgramChange { channel, .. } => ParsedMidiMessage::ProgramChange {
            channel: *channel,
            program: decode_seven_bit(payload)?,
        },
        ParsedTopic::PitchBend { channel, .. } => ParsedMidiMessage::PitchBend {
            channel: *channel,
            value: decode_pitch_bend(payload)?,
        },
        ParsedTopic::Sysex { .. } => ParsedMidiMessage::Sysex {
            data: decode_sysex_json(payload)?,
        },
        ParsedTopic::System { kind, .. } => ParsedMidiMessage::System(*kind),
    };
    Ok(to_midi_bytes(&message))
}

fn mqtt_payload_from_midi(prefix: &str, message: &[u8]) -> Option<(String, Vec<u8>)> {
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

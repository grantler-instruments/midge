use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

#[cfg(unix)]
use midir::os::unix::{VirtualInput, VirtualOutput};
use midir::{MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use rumqttc::{AsyncClient, Event, EventLoop, Incoming, MqttOptions, QoS, Transport};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc as tokio_mpsc, oneshot};
use tokio::task::JoinHandle as TokioJoinHandle;
use uuid::Uuid;

use crate::devices::{find_input_port_index, find_output_port_index, PortLists};
use crate::mqtt_midi::{
    decode_pitch_bend, decode_seven_bit, decode_sysex_json, format_midi_to_mqtt_detail,
    format_mqtt_to_midi_detail, in_subscription_topics, mqtt_payload_from_midi, parse_topic,
    should_log_traffic, to_midi_bytes, Direction, ParsedMidiMessage, ParsedTopic,
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
    pub mqtt_connected: bool,
    pub midi_listening: bool,
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

struct ResolvedMqttConfig {
    url: String,
    host: String,
    port: u16,
    use_tls: bool,
    prefix: String,
    username: Option<String>,
    password: Option<String>,
    client_id: String,
}

struct ResolvedMidiConfig {
    midi_in: String,
    midi_out: String,
    use_virtual: bool,
}

type MidiOutputSender = Sender<Vec<u8>>;
type MqttPublishSender = tokio_mpsc::UnboundedSender<(String, Vec<u8>)>;

struct MqttHandle {
    stop_tx: oneshot::Sender<()>,
    mqtt_task: TokioJoinHandle<()>,
    config: ResolvedMqttConfig,
}

struct MidiHandle {
    midi_out_thread: JoinHandle<()>,
    midi_forward_thread: JoinHandle<()>,
    _midi_in: MidiInputConnection<()>,
    config: ResolvedMidiConfig,
}

struct BridgeStateInner {
    mqtt: Option<MqttHandle>,
    midi: Option<MidiHandle>,
    midi_out_tx: Arc<Mutex<Option<MidiOutputSender>>>,
    mqtt_publish_tx: Arc<Mutex<Option<MqttPublishSender>>>,
    /// Shared with the MIDI→MQTT forwarder so reconnecting MQTT picks up a new prefix
    /// without requiring MIDI to be restarted.
    active_prefix: Arc<Mutex<String>>,
}

pub struct BridgeState(Mutex<BridgeStateInner>);

impl Default for BridgeState {
    fn default() -> Self {
        Self(Mutex::new(BridgeStateInner {
            mqtt: None,
            midi: None,
            midi_out_tx: Arc::new(Mutex::new(None)),
            mqtt_publish_tx: Arc::new(Mutex::new(None)),
            active_prefix: Arc::new(Mutex::new(String::new())),
        }))
    }
}

#[tauri::command]
pub fn list_midi_port_names() -> PortLists {
    crate::devices::list_midi_port_names()
}

#[tauri::command]
pub fn get_bridge_status(state: State<'_, BridgeState>) -> BridgeStatus {
    let guard = state.0.lock().ok();
    let inner = guard.as_ref();
    let mqtt = inner.and_then(|inner| inner.mqtt.as_ref());
    let midi = inner.and_then(|inner| inner.midi.as_ref());
    BridgeStatus {
        mqtt_connected: mqtt.is_some(),
        midi_listening: midi.is_some(),
        url: mqtt.map(|handle| handle.config.url.clone()),
        prefix: mqtt.map(|handle| handle.config.prefix.clone()),
        midi_in: midi.map(|handle| handle.config.midi_in.clone()),
        midi_out: midi.map(|handle| handle.config.midi_out.clone()),
        virtual_port: midi.and_then(|handle| {
            handle
                .config
                .use_virtual
                .then(|| handle.config.midi_in.clone())
        }),
    }
}

#[tauri::command]
pub async fn connect_mqtt(
    app: AppHandle,
    state: State<'_, BridgeState>,
    config: BridgeConfig,
) -> Result<(), String> {
    stop_mqtt_inner(&state).await?;
    let resolved = resolve_mqtt_config(config)?;

    let mut mqtt_options = MqttOptions::new(
        resolved.client_id.clone(),
        resolved.host.clone(),
        resolved.port,
    );
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
    let (mqtt_publish_tx, mqtt_publish_rx) = tokio_mpsc::unbounded_channel();
    let midi_out_tx = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .midi_out_tx
        .clone();
    let mqtt_publish_tx_slot = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .mqtt_publish_tx
        .clone();
    *mqtt_publish_tx_slot.lock().map_err(|e| e.to_string())? = Some(mqtt_publish_tx);
    let app_for_mqtt = app.clone();
    let prefix_for_mqtt = resolved.prefix.clone();
    {
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard.active_prefix.lock().map_err(|e| e.to_string())? = resolved.prefix.clone();
    }
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
                "MQTT connected (prefix {}, client ID {})",
                resolved.prefix, resolved.client_id
            ),
        },
    );

    state.0.lock().map_err(|e| e.to_string())?.mqtt = Some(MqttHandle {
        stop_tx,
        mqtt_task,
        config: resolved,
    });

    Ok(())
}

#[tauri::command]
pub async fn disconnect_mqtt(state: State<'_, BridgeState>) -> Result<(), String> {
    stop_mqtt_inner(&state).await
}

#[tauri::command]
pub async fn start_midi(
    app: AppHandle,
    state: State<'_, BridgeState>,
    config: BridgeConfig,
) -> Result<(), String> {
    stop_midi_inner(&state).await?;
    let configured_prefix = config.prefix.clone();
    let resolved = resolve_midi_config(config)?;
    let midi_out_conn = open_midi_output(&resolved)?;
    let (midi_out_tx, midi_out_rx) = mpsc::channel();
    let (raw_midi_tx, raw_midi_rx) = mpsc::channel::<Vec<u8>>();
    let (mqtt_publish_tx, active_prefix) = {
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        let prefix = guard
            .mqtt
            .as_ref()
            .map(|handle| handle.config.prefix.clone())
            .unwrap_or(configured_prefix);
        *guard.active_prefix.lock().map_err(|e| e.to_string())? = prefix;
        (guard.mqtt_publish_tx.clone(), guard.active_prefix.clone())
    };
    let app_for_midi = app.clone();
    let midi_forward_thread = thread::spawn(move || {
        while let Ok(message) = raw_midi_rx.recv() {
            let prefix = match active_prefix.lock() {
                Ok(guard) => guard.clone(),
                Err(_) => continue,
            };
            if let Some((topic, payload)) = mqtt_payload_from_midi(&prefix, &message) {
                let should_log = should_log_traffic(&topic);
                let detail = if should_log {
                    Some(format_midi_to_mqtt_detail(&message, &topic, &payload))
                } else {
                    None
                };
                if let Ok(slot) = mqtt_publish_tx.lock() {
                    if let Some(sender) = slot.as_ref() {
                        let _ = sender.send((topic, payload));
                    }
                }
                if let Some(detail) = detail {
                    let _ = app_for_midi.emit(
                        "bridge://log",
                        BridgeLogEntry {
                            direction: "midi→mqtt".to_string(),
                            detail,
                        },
                    );
                }
            }
        }
    });
    let midi_in_conn = open_midi_input(&resolved, raw_midi_tx)?;
    let midi_out_thread = spawn_midi_out_thread(app.clone(), midi_out_conn, midi_out_rx);
    let midi_out_tx_slot = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .midi_out_tx
        .clone();
    *midi_out_tx_slot.lock().map_err(|e| e.to_string())? = Some(midi_out_tx);
    let midi_in_label = resolved.midi_in.clone();
    state.0.lock().map_err(|e| e.to_string())?.midi = Some(MidiHandle {
        midi_out_thread,
        midi_forward_thread,
        _midi_in: midi_in_conn,
        config: resolved,
    });
    let _ = app.emit(
        "bridge://log",
        BridgeLogEntry {
            direction: "status".to_string(),
            detail: format!("MIDI listening ({midi_in_label})"),
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn stop_midi(app: AppHandle, state: State<'_, BridgeState>) -> Result<(), String> {
    stop_midi_inner(&state).await?;
    let _ = app.emit(
        "bridge://log",
        BridgeLogEntry {
            direction: "status".to_string(),
            detail: "MIDI stopped".to_string(),
        },
    );
    Ok(())
}

async fn stop_mqtt_inner(state: &State<'_, BridgeState>) -> Result<(), String> {
    let (handle, publish_tx) = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        let publish_tx = guard.mqtt_publish_tx.clone();
        (guard.mqtt.take(), publish_tx)
    };
    if let Some(handle) = handle {
        *publish_tx.lock().map_err(|e| e.to_string())? = None;
        let _ = handle.stop_tx.send(());
        let _ = handle.mqtt_task.await;
    }
    Ok(())
}

async fn stop_midi_inner(state: &State<'_, BridgeState>) -> Result<(), String> {
    let (handle, midi_out_tx) = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        let midi_out_tx = guard.midi_out_tx.clone();
        (guard.midi.take(), midi_out_tx)
    };
    if let Some(handle) = handle {
        *midi_out_tx.lock().map_err(|e| e.to_string())? = None;
        let MidiHandle {
            midi_out_thread,
            midi_forward_thread,
            _midi_in,
            ..
        } = handle;
        drop(_midi_in);
        let _ = midi_out_thread.join();
        let _ = midi_forward_thread.join();
    }
    Ok(())
}

pub fn shutdown_on_exit(state: &BridgeState) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(handle) = guard.mqtt.take() {
            let _ = handle.stop_tx.send(());
        }
        guard.midi.take();
        if let Ok(mut sender) = guard.mqtt_publish_tx.lock() {
            *sender = None;
        }
        if let Ok(mut sender) = guard.midi_out_tx.lock() {
            *sender = None;
        }
    }
}

fn supports_virtual_midi_ports() -> bool {
    cfg!(any(target_os = "macos", target_os = "linux"))
}

fn resolve_mqtt_config(config: BridgeConfig) -> Result<ResolvedMqttConfig, String> {
    if config.url.trim().is_empty() {
        return Err("url is required".to_string());
    }
    if config.prefix.trim().is_empty() {
        return Err("prefix is required".to_string());
    }
    if config.prefix.contains('+') || config.prefix.contains('#') {
        return Err("prefix must not contain MQTT wildcards".to_string());
    }
    let (host, port, use_tls) = parse_mqtt_url(&config.url)?;
    let client_id = config
        .client_id
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("midge-bridge-{}", Uuid::new_v4()));

    Ok(ResolvedMqttConfig {
        url: config.url,
        host,
        port,
        use_tls,
        prefix: config.prefix,
        username: config.username,
        password: config.password,
        client_id,
    })
}

fn resolve_midi_config(config: BridgeConfig) -> Result<ResolvedMidiConfig, String> {
    if config.r#virtual.is_some() && (config.midi_in.is_some() || config.midi_out.is_some()) {
        return Err("use either virtual or midiIn/midiOut, not both".to_string());
    }
    if config.midi_in.is_some() != config.midi_out.is_some() {
        return Err("midiIn and midiOut must both be set when using named ports".to_string());
    }

    let (midi_in, midi_out, use_virtual) =
        if let Some(name) = config.r#virtual.filter(|value| !value.is_empty()) {
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

    Ok(ResolvedMidiConfig {
        midi_in,
        midi_out,
        use_virtual,
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

fn open_midi_output(config: &ResolvedMidiConfig) -> Result<MidiOutputConnection, String> {
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
    config: &ResolvedMidiConfig,
    raw_midi_tx: Sender<Vec<u8>>,
) -> Result<MidiInputConnection<()>, String> {
    if config.use_virtual {
        #[cfg(unix)]
        {
            let midi_in = MidiInput::new("midge-bridge-in").map_err(|e| e.to_string())?;
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
    app: AppHandle,
    mut conn: MidiOutputConnection,
    rx: Receiver<Vec<u8>>,
) -> JoinHandle<()> {
    thread::spawn(move || {
        while let Ok(message) = rx.recv() {
            if let Err(err) = conn.send(&message) {
                let _ = app.emit(
                    "bridge://log",
                    BridgeLogEntry {
                        direction: "error".to_string(),
                        detail: format!("MIDI output failed: {err}"),
                    },
                );
            }
        }
    })
}

async fn run_mqtt_loop(
    app: AppHandle,
    mut eventloop: EventLoop,
    client: AsyncClient,
    prefix: String,
    midi_out_tx: Arc<Mutex<Option<MidiOutputSender>>>,
    mut mqtt_publish_rx: tokio_mpsc::UnboundedReceiver<(String, Vec<u8>)>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    loop {
        tokio::select! {
            _ = &mut stop_rx => break,
            outgoing = mqtt_publish_rx.recv() => {
                let Some((topic, payload)) = outgoing else {
                    break;
                };
                if let Err(err) = client
                    .publish(topic.clone(), QoS::AtMostOnce, false, payload)
                    .await
                {
                    let _ = app.emit(
                        "bridge://log",
                        BridgeLogEntry {
                            direction: "error".to_string(),
                            detail: format!("MQTT publish failed: {err}"),
                        },
                    );
                }
            }
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
    }

    let _ = client.disconnect().await;
    let _ = app.emit(
        "bridge://log",
        BridgeLogEntry {
            direction: "status".to_string(),
            detail: "MQTT disconnected".to_string(),
        },
    );
}

fn handle_mqtt_publish(
    app: &AppHandle,
    prefix: &str,
    topic: &str,
    payload: &[u8],
    midi_out_tx: &Arc<Mutex<Option<MidiOutputSender>>>,
) -> Result<(), String> {
    let parsed = parse_topic(prefix, topic).ok_or_else(|| format!("ignored topic: {topic}"))?;
    if !matches!(
        parsed,
        ParsedTopic::NoteOn {
            direction: Direction::In,
            ..
        } | ParsedTopic::NoteOff {
            direction: Direction::In,
            ..
        } | ParsedTopic::ControlChange {
            direction: Direction::In,
            ..
        } | ParsedTopic::ProgramChange {
            direction: Direction::In,
            ..
        } | ParsedTopic::PitchBend {
            direction: Direction::In,
            ..
        } | ParsedTopic::Sysex {
            direction: Direction::In
        } | ParsedTopic::System {
            direction: Direction::In,
            ..
        }
    ) {
        return Ok(());
    }

    let bytes = mqtt_to_midi_bytes(&parsed, payload)?;
    let sender = midi_out_tx
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "MIDI is not listening".to_string())?;
    let detail = if should_log_traffic(topic) {
        Some(format_mqtt_to_midi_detail(topic, payload, &bytes))
    } else {
        None
    };
    sender
        .send(bytes)
        .map_err(|_| "MIDI output thread stopped".to_string())?;
    if let Some(detail) = detail {
        let _ = app.emit(
            "bridge://log",
            BridgeLogEntry {
                direction: "mqtt→midi".to_string(),
                detail,
            },
        );
    }
    Ok(())
}

fn mqtt_to_midi_bytes(parsed: &ParsedTopic, payload: &[u8]) -> Result<Vec<u8>, String> {
    let message = match parsed {
        ParsedTopic::NoteOn { channel, note, .. } => ParsedMidiMessage::NoteOn {
            channel: *channel,
            note: *note,
            velocity: decode_seven_bit(payload)?,
        },
        ParsedTopic::NoteOff { channel, note, .. } => ParsedMidiMessage::NoteOff {
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

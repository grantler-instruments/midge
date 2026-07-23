mod bridge;
mod devices;
mod mqtt_midi;

use bridge::{
    connect_mqtt, disconnect_mqtt, get_bridge_status, list_midi_port_names, start_midi, stop_midi,
    BridgeState,
};
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(BridgeState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_midi_port_names,
            get_bridge_status,
            connect_mqtt,
            disconnect_mqtt,
            start_midi,
            stop_midi,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = app.try_state::<BridgeState>() {
                bridge::shutdown_on_exit(state.inner());
            }
        }
    });
}

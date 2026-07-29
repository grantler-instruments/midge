# Midge

Desktop MQTT↔MIDI bridge built with Tauri, Vite, and React. Implements the same protocol as [@grantler-instruments/mqtt-midi-bridge](https://github.com/grantler-instruments/mqtt-midi/tree/main/packages/mqtt-midi-bridge):

- Subscribes to `{prefix}/in/…` (commands from web UIs) → MIDI **out**
- Publishes `{prefix}/out/…` (events from your DAW/hardware) ← MIDI **in**

Use the same `prefix` in web apps with `MqttMidi({ prefix: "remote", … })`.

## Stack

- **Frontend:** React 19, MUI 9, Zustand, Vite
- **Desktop:** Tauri 2
- **Rust:** `midir` (MIDI), `rumqttc` (MQTT)

## Development

```bash
npm install
npm run tauri:dev   # desktop app (native MIDI + MQTT)
npm run dev         # browser demo (Web MIDI + MQTT over WebSockets)
```

In the browser, use Chrome/Edge, allow MIDI access, pick real Web MIDI ports, and connect with a `ws://` / `wss://` broker URL (`mqtt://` is rewritten to `ws://` with the same host/port). Virtual ports remain desktop-only.

## Marketing site

A landing page lives in [`website/`](./website) and is deployed to GitHub Pages at
[grantler-instruments.github.io/midge](https://grantler-instruments.github.io/midge/).

```bash
npm run website:dev     # http://localhost:5175/midge/
npm run build:pages     # marketing → site/, web app → site/app/
```

The deployed site serves the marketing page at `/midge/` and the browser build of the app at
`/midge/app/`.

Pushes to `main` deploy automatically via `.github/workflows/deploy.yml` (gated on CI).
Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Configuration

Matches [mqtt-midi-bridge.config.example.json](./mqtt-midi-bridge.config.example.json):

| Field | Description |
|-------|-------------|
| `url` | MQTT broker endpoint, composed by the app from protocol, host, port, and optional WebSocket path |
| `prefix` | Topic prefix (e.g. `remote`) |
| `virtual` | Virtual port name (default `mqtt-midi-bridge` on macOS/Linux) |
| `midiIn` / `midiOut` | Named ports (Windows / hardware — set both) |
| `username` / `password` / `clientId` | Optional MQTT credentials |

On **macOS** and **Linux**, omitting `midiIn`, `midiOut`, and `virtual` creates a virtual port named **`mqtt-midi-bridge`**.

On **Windows**, set `midiIn` and `midiOut` to existing ports (e.g. loopMIDI).

Desktop builds support both raw MQTT and MQTT-over-WebSocket broker endpoints. WebSocket
brokers commonly use a separate port and path, such as `ws://localhost:9001/mqtt`.

The connection form provides protocol (`mqtt`, `mqtts`, `ws`, or `wss`), host, and port fields.
Changing protocol resets the port to its conventional default; you can override it. The optional
path field is shown for WebSocket protocols and supports endpoints such as `/mqtt`. Username and
password are entered separately from the endpoint.

## Topic format

Compatible with `@grantler-instruments/mqtt-midi`:

| Message | Topic | Payload |
|---------|-------|---------|
| Note on | `{prefix}/in/noteon/{ch}/{note}` | 1 byte velocity |
| Note off | `{prefix}/in/noteoff/{ch}/{note}` | 1 byte velocity |
| CC | `{prefix}/in/cc/{ch}/{controller}` | 1 byte value |
| Program change | `{prefix}/in/program/{ch}` | 1 byte program |
| Pitch bend | `{prefix}/in/pitchbend/{ch}` | 2 bytes (LSB, MSB) |
| SysEx | `{prefix}/in/sysex` | JSON `{"data":[…]}` |
| Clock/start/stop/continue | `{prefix}/in/{type}` | empty |

Outgoing MIDI from the DAW uses the same paths under `{prefix}/out/…`.

## License

AGPL-3.0-or-later

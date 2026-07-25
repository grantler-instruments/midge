import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useBridgeRuntime, useMidiPortNames } from "./hooks/useBridgeRuntime";
import { connectMqtt, disconnectMqtt, startMidi, stopMidi } from "./platform/bridge";
import { useAppStore } from "./stores/app";

function ChevronDownIcon() {
  return (
    <SvgIcon>
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z" />
    </SvgIcon>
  );
}

function formatLogTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function App() {
  useBridgeRuntime();
  const { inputs, outputs } = useMidiPortNames();

  const url = useAppStore((s) => s.url);
  const prefix = useAppStore((s) => s.prefix);
  const virtualPort = useAppStore((s) => s.virtualPort);
  const midiIn = useAppStore((s) => s.midiIn);
  const midiOut = useAppStore((s) => s.midiOut);
  const username = useAppStore((s) => s.username);
  const password = useAppStore((s) => s.password);
  const clientId = useAppStore((s) => s.clientId);
  const useNamedPorts = useAppStore((s) => s.useNamedPorts);
  const mqttConnected = useAppStore((s) => s.mqttConnected);
  const midiListening = useAppStore((s) => s.midiListening);
  const logEntries = useAppStore((s) => s.logEntries);
  const setUrl = useAppStore((s) => s.setUrl);
  const setPrefix = useAppStore((s) => s.setPrefix);
  const setVirtualPort = useAppStore((s) => s.setVirtualPort);
  const setMidiIn = useAppStore((s) => s.setMidiIn);
  const setMidiOut = useAppStore((s) => s.setMidiOut);
  const setUsername = useAppStore((s) => s.setUsername);
  const setPassword = useAppStore((s) => s.setPassword);
  const setClientId = useAppStore((s) => s.setClientId);
  const setUseNamedPorts = useAppStore((s) => s.setUseNamedPorts);
  const setMqttConnected = useAppStore((s) => s.setMqttConnected);
  const setMidiListening = useAppStore((s) => s.setMidiListening);
  const pushLogEntry = useAppStore((s) => s.pushLogEntry);
  const clearLogs = useAppStore((s) => s.clearLogs);

  const [isChangingMqttState, setIsChangingMqttState] = useState(false);
  const [isChangingMidiState, setIsChangingMidiState] = useState(false);
  const [mqttExpanded, setMqttExpanded] = useState(true);
  const [midiExpanded, setMidiExpanded] = useState(true);

  const mqttSummary = [url, prefix].filter(Boolean).join(" · ");
  const midiSummary = useNamedPorts
    ? [midiIn && `In: ${midiIn}`, midiOut && `Out: ${midiOut}`].filter(Boolean).join(" · ")
    : virtualPort
      ? `Virtual: ${virtualPort}`
      : "";

  const bridgeConfig = {
    url,
    prefix,
    virtual: useNamedPorts ? null : virtualPort || null,
    midiIn: useNamedPorts ? midiIn || null : null,
    midiOut: useNamedPorts ? midiOut || null : null,
    username: username || null,
    password: password || null,
    clientId: clientId || null,
  };
  const reportError = (err: unknown) => {
    pushLogEntry({
      direction: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
  };

  const handleConnectMqtt = async () => {
    setIsChangingMqttState(true);
    try {
      await connectMqtt(bridgeConfig);
      setMqttConnected(true);
    } catch (err) {
      reportError(err);
    } finally {
      setIsChangingMqttState(false);
    }
  };

  const handleDisconnectMqtt = async () => {
    setIsChangingMqttState(true);
    try {
      await disconnectMqtt();
      setMqttConnected(false);
    } catch (err) {
      reportError(err);
    } finally {
      setIsChangingMqttState(false);
    }
  };

  const handleStartMidi = async () => {
    setIsChangingMidiState(true);
    try {
      await startMidi(bridgeConfig);
      setMidiListening(true);
    } catch (err) {
      reportError(err);
    } finally {
      setIsChangingMidiState(false);
    }
  };

  const handleStopMidi = async () => {
    setIsChangingMidiState(true);
    try {
      await stopMidi();
      setMidiListening(false);
    } catch (err) {
      reportError(err);
    } finally {
      setIsChangingMidiState(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", py: 4 }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h4">Midge</Typography>
              <Typography variant="body2" color="text.secondary">
                Desktop MQTT↔MIDI bridge — connect your DAW and hardware over the network.
                Compatible with{" "}
                <Link
                  href="https://github.com/grantler-instruments/mqtt-midi"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                >
                  @grantler-instruments/mqtt-midi
                </Link>
                , and best friend of{" "}
                <Link
                  href="https://github.com/grantler-instruments/BYODMCSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                >
                  BYODMCSE
                </Link>
                .
              </Typography>
            </Box>
            <Box
              component="img"
              src="/logo.svg"
              alt="Midge logo"
              sx={{ width: 64, height: 64, flexShrink: 0 }}
            />
          </Box>

          <Accordion expanded={mqttExpanded} onChange={(_, expanded) => setMqttExpanded(expanded)}>
            <AccordionSummary expandIcon={<ChevronDownIcon />}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center", width: "100%", mr: 1 }}
              >
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, mr: 2 }}>
                  <Typography variant="h6">MQTT</Typography>
                  {!mqttExpanded && mqttSummary && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {mqttSummary}
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    Connect
                  </Typography>
                  <Switch
                    checked={mqttConnected}
                    disabled={isChangingMqttState}
                    slotProps={{ input: { "aria-label": "Connect MQTT bridge" } }}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(_, checked) => {
                      void (checked ? handleConnectMqtt() : handleDisconnectMqtt());
                    }}
                  />
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField
                  label="Broker URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  fullWidth
                  disabled={mqttConnected}
                  placeholder="mqtt://127.0.0.1:1883"
                  slotProps={{
                    htmlInput: {
                      autoCapitalize: "off",
                      autoCorrect: "off",
                      spellCheck: false,
                    },
                  }}
                />
                <TextField
                  label="Topic prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  fullWidth
                  disabled={mqttConnected}
                  helperText={
                    mqttConnected
                      ? "Disconnect to change broker settings. Active prefix is shown in the activity log."
                      : "Web apps use MqttMidi({ prefix }). Bridge subscribes to {prefix}/in/… and publishes {prefix}/out/…"
                  }
                  slotProps={{
                    htmlInput: {
                      autoCapitalize: "off",
                      autoCorrect: "off",
                      spellCheck: false,
                      style: { textTransform: "none" },
                    },
                  }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    disabled={mqttConnected}
                    slotProps={{
                      htmlInput: {
                        autoCapitalize: "off",
                        autoCorrect: "off",
                        spellCheck: false,
                      },
                    }}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    disabled={mqttConnected}
                  />
                  <TextField
                    label="Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    fullWidth
                    disabled={mqttConnected}
                    placeholder="auto"
                    slotProps={{
                      htmlInput: {
                        autoCapitalize: "off",
                        autoCorrect: "off",
                        spellCheck: false,
                        style: { textTransform: "none" },
                      },
                    }}
                  />
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion expanded={midiExpanded} onChange={(_, expanded) => setMidiExpanded(expanded)}>
            <AccordionSummary expandIcon={<ChevronDownIcon />}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center", width: "100%", mr: 1 }}
              >
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, mr: 2 }}>
                  <Typography variant="h6">MIDI</Typography>
                  {!midiExpanded && midiSummary && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {midiSummary}
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    Listen
                  </Typography>
                  <Switch
                    checked={midiListening}
                    disabled={isChangingMidiState}
                    slotProps={{ input: { "aria-label": "Listen for MIDI" } }}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(_, checked) => {
                      void (checked ? handleStartMidi() : handleStopMidi());
                    }}
                  />
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  color="primary"
                  value={useNamedPorts ? "named" : "virtual"}
                  onChange={(_, value) => {
                    if (value) setUseNamedPorts(value === "named");
                  }}
                >
                  <ToggleButton value="virtual">Create virtual port</ToggleButton>
                  <ToggleButton value="named">Connect existing port</ToggleButton>
                </ToggleButtonGroup>
                {useNamedPorts ? (
                  <>
                    <FormControl fullWidth>
                      <InputLabel id="midi-in-label">MIDI in</InputLabel>
                      <Select
                        labelId="midi-in-label"
                        label="MIDI in"
                        value={midiIn}
                        onChange={(e) => setMidiIn(e.target.value)}
                      >
                        {inputs.map((port) => (
                          <MenuItem key={port} value={port}>
                            {port}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel id="midi-out-label">MIDI out</InputLabel>
                      <Select
                        labelId="midi-out-label"
                        label="MIDI out"
                        value={midiOut}
                        onChange={(e) => setMidiOut(e.target.value)}
                      >
                        {outputs.map((port) => (
                          <MenuItem key={port} value={port}>
                            {port}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  <TextField
                    label="Virtual port name"
                    value={virtualPort}
                    onChange={(e) => setVirtualPort(e.target.value)}
                    fullWidth
                    helperText="Creates two virtual endpoints with this name: Live MIDI In (from MQTT) and Live MIDI Out (to MQTT)."
                  />
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ChevronDownIcon />}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center", width: "100%", mr: 1 }}
              >
                <Typography variant="h6">Activity log</Typography>
                <Button
                  size="small"
                  disabled={logEntries.length === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearLogs();
                  }}
                >
                  Clear
                </Button>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {logEntries.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    MQTT↔MIDI traffic and status messages appear here.
                  </Typography>
                )}
                {logEntries.map((entry) => (
                  <Stack key={entry.id} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatLogTimestamp(entry.timestamp)}
                    </Typography>
                    <Typography variant="body2" component="div">
                      [{entry.direction}] {entry.detail}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;

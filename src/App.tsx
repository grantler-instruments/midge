import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useBridgeRuntime, useMidiPortNames } from "./hooks/useBridgeRuntime";
import { getBridgeStatus, startBridge, stopBridge } from "./platform/bridge";
import { getPlatform } from "./platform";
import { useAppStore } from "./stores/app";

function App() {
  useBridgeRuntime();
  const platform = getPlatform();
  const { inputs, outputs } = useMidiPortNames();

  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const url = useAppStore((s) => s.url);
  const prefix = useAppStore((s) => s.prefix);
  const virtualPort = useAppStore((s) => s.virtualPort);
  const midiIn = useAppStore((s) => s.midiIn);
  const midiOut = useAppStore((s) => s.midiOut);
  const username = useAppStore((s) => s.username);
  const password = useAppStore((s) => s.password);
  const clientId = useAppStore((s) => s.clientId);
  const useNamedPorts = useAppStore((s) => s.useNamedPorts);
  const bridgeRunning = useAppStore((s) => s.bridgeRunning);
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
  const setBridgeRunning = useAppStore((s) => s.setBridgeRunning);
  const clearLogs = useAppStore((s) => s.clearLogs);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleStart = async () => {
    try {
      await startBridge({
        url,
        prefix,
        virtual: useNamedPorts ? null : virtualPort || null,
        midiIn: useNamedPorts ? midiIn || null : null,
        midiOut: useNamedPorts ? midiOut || null : null,
        username: username || null,
        password: password || null,
        clientId: clientId || null,
      });
      const status = await getBridgeStatus();
      setBridgeRunning(status.running);
      setStatusMessage("Bridge started");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStop = async () => {
    try {
      await stopBridge();
      setBridgeRunning(false);
      setStatusMessage("Bridge stopped");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", py: 4 }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="h4">Midge</Typography>
              <Typography variant="body2" color="text.secondary">
                MQTT↔MIDI bridge ({platform}) — compatible with{" "}
                <Typography component="span" variant="body2" color="text.secondary">
                  @grantler-instruments/mqtt-midi
                </Typography>
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2">Dark mode</Typography>
              <Switch checked={darkMode} onChange={(_, checked) => setDarkMode(checked)} />
            </Stack>
          </Stack>

          {statusMessage && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2">{statusMessage}</Typography>
            </Paper>
          )}

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              MQTT
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Broker URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
                placeholder="mqtt://127.0.0.1:1883"
              />
              <TextField
                label="Topic prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                fullWidth
                helperText="Web apps use MqttMidi({ prefix }). Bridge subscribes to {prefix}/in/… and publishes {prefix}/out/…"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  fullWidth
                  placeholder="auto"
                />
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              MIDI
            </Typography>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useNamedPorts}
                    onChange={(_, checked) => setUseNamedPorts(checked)}
                  />
                }
                label="Use named hardware / loopback ports"
              />
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
                  helperText="Default on macOS/Linux. Point your DAW at this port."
                />
              )}
              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={bridgeRunning} onClick={handleStart}>
                  Start bridge
                </Button>
                <Button variant="outlined" disabled={!bridgeRunning} onClick={handleStop}>
                  Stop bridge
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
            >
              <Typography variant="h6">Activity log</Typography>
              <Button size="small" onClick={clearLogs}>
                Clear
              </Button>
            </Stack>
            <Stack spacing={1}>
              {logEntries.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  MQTT↔MIDI traffic and status messages appear here.
                </Typography>
              )}
              {logEntries.map((entry, index) => (
                <Typography key={`${entry.direction}-${index}`} variant="body2" component="div">
                  [{entry.direction}] {entry.detail}
                </Typography>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;

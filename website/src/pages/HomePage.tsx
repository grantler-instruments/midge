import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Fragment, type ReactNode, useState } from "react";
import { DesktopFrame } from "../components/DeviceFrames";
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL, MQTT_MIDI_URL } from "../links";

const base = import.meta.env.BASE_URL;

const features = [
  {
    title: "MQTT → MIDI",
    body: "Subscribe to command topics from your web apps and turn them into MIDI output.",
    bullets: [
      { label: "Note on / off", description: "{prefix}/in/noteon/{ch}/{note}" },
      { label: "Control change", description: "{prefix}/in/cc/{ch}/{controller}" },
      { label: "Program & pitch bend", description: "{prefix}/in/program · pitchbend" },
      { label: "SysEx", description: "{prefix}/in/sysex with JSON payload" },
    ],
  },
  {
    title: "MIDI → MQTT",
    body: "Publish events from your DAW or hardware straight back onto MQTT.",
    bullets: [
      { label: "Live events", description: "MIDI in is published to {prefix}/out/…" },
      { label: "Round trip", description: "Same message types map both directions." },
    ],
  },
  {
    title: "Free & open source",
    body: "AGPL-3.0. Download builds for macOS, Windows, and Linux — no account, no cloud.",
  },
] as const;

const showFlow = [
  {
    title: "Play in your DAW",
    body: "Perform in Ableton, Logic, or any DAW — or play a hardware instrument. The MIDI streams straight into Midge over a normal MIDI port.",
  },
  {
    title: "Midge publishes to MQTT",
    body: "Every note, CC, program change, pitch bend, and SysEx is published to your MQTT broker under {prefix}/out/… in real time.",
  },
  {
    title: "Reaches every client",
    body: "The broker fans your MIDI out to all subscribed clients at once — a browser on stage, a phone in the crowd, or someone across the planet. Worldwide if you wish.",
  },
] as const;

function FlowCard({
  caption,
  children,
  accent,
}: {
  caption: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: { xs: "1 1 100%", sm: "1 1 0" },
        minWidth: { sm: 0 },
        borderRadius: 2,
        border: 1,
        borderColor: accent ? "primary.main" : "divider",
        bgcolor: accent ? "rgba(151,109,121,0.10)" : "rgba(255,255,255,0.03)",
        px: 2,
        py: 1.75,
        textAlign: "center",
      }}
    >
      <Typography
        variant="overline"
        color={accent ? "primary" : "text.secondary"}
        sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
      >
        {caption}
      </Typography>
      {children}
    </Box>
  );
}

function FlowArrow() {
  return (
    <Typography
      aria-hidden
      color="text.disabled"
      sx={{
        alignSelf: "center",
        flexShrink: 0,
        fontSize: "1.35rem",
        lineHeight: 1,
        transform: { xs: "rotate(90deg)", sm: "none" },
      }}
    >
      →
    </Typography>
  );
}

const codeSx = {
  fontFamily: "monospace",
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "text.primary",
  wordBreak: "break-all",
} as const;

function MidgeCard() {
  return (
    <FlowCard caption="Midge" accent>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center" }}>
        <Box component="img" src={`${base}app-logo.svg`} alt="" sx={{ width: 24, height: 24 }} />
        <Typography sx={{ fontWeight: 700 }}>relays it</Typography>
      </Stack>
    </FlowCard>
  );
}

function TextCard({ caption, text }: { caption: string; text: string }) {
  return (
    <FlowCard caption={caption}>
      <Typography sx={{ fontWeight: 700 }}>{text}</Typography>
    </FlowCard>
  );
}

function MidiCard() {
  return (
    <FlowCard caption="MIDI note">
      <Box component="code" sx={codeSx}>
        noteon 60 127
      </Box>
    </FlowCard>
  );
}

function MqttCard({ topic }: { topic: string }) {
  return (
    <FlowCard caption="MQTT message">
      <Stack spacing={0.5}>
        <Box component="code" sx={codeSx}>
          {topic}
        </Box>
        <Typography variant="caption" color="text.secondary">
          payload{" "}
          <Box component="code" sx={{ ...codeSx, fontSize: "0.85rem" }}>
            127
          </Box>
        </Typography>
      </Stack>
    </FlowCard>
  );
}

function FlowRow({ cards }: { cards: ReactNode[] }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "stretch" }}>
      {cards.map((card, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered flow
        <Fragment key={index}>
          {card}
          {index < cards.length - 1 && <FlowArrow />}
        </Fragment>
      ))}
    </Stack>
  );
}

const examples = [
  {
    id: "out",
    label: "MIDI out to the world",
    cards: [
      <TextCard key="src" caption="Source" text="Your DAW, synth, …" />,
      <MidiCard key="midi" />,
      <MidgeCard key="midge" />,
      <MqttCard key="mqtt" topic="remote/out/noteon/1/60" />,
      <TextCard key="dst" caption="Subscribers" text="Web app, microcontroller, desktop app" />,
    ],
  },
  {
    id: "in",
    label: "Control your gear",
    cards: [
      <TextCard key="src" caption="Source" text="Web app, microcontroller, desktop app" />,
      <MqttCard key="mqtt" topic="remote/in/noteon/1/60" />,
      <MidgeCard key="midge" />,
      <MidiCard key="midi" />,
      <TextCard key="dst" caption="Destination" text="Your DAW, synth, …" />,
    ],
  },
  {
    id: "jam",
    label: "Two DAWs, jamming",
    cards: [
      <TextCard key="a-daw" caption="Studio A" text="DAW, synth, …" />,
      <MidgeCard key="a-midge" />,
      <TextCard
        key="broker"
        caption="MQTT broker"
        text="Anywhere on the internet or local network"
      />,
      <MidgeCard key="b-midge" />,
      <TextCard key="b-daw" caption="Studio B" text="DAW, synth, …" />,
    ],
  },
] as const;

function ExampleFlow() {
  const [tab, setTab] = useState(0);
  const active = examples[tab];

  return (
    <Box sx={{ mt: { xs: 5, md: 7 } }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
        Examples
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, next: number) => setTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Example flows"
        sx={{
          minHeight: 40,
          mb: 3,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": {
            minHeight: 40,
            textTransform: "none",
            fontWeight: 600,
            color: "text.secondary",
          },
          "& .Mui-selected": { color: "primary.main" },
        }}
      >
        {examples.map((example) => (
          <Tab key={example.id} label={example.label} disableRipple />
        ))}
      </Tabs>

      <FlowRow cards={[...active.cards]} />

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
        Every subscribed client receives that message instantly —{" "}
        <Box component="code" sx={codeSx}>
          remote
        </Box>{" "}
        is the topic prefix you choose.
      </Typography>
    </Box>
  );
}

export function HomePage() {
  return (
    <>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 15% 20%, rgba(151, 109, 121, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 50% at 85% 10%, rgba(120, 90, 100, 0.18), transparent 50%),
            linear-gradient(180deg, #1a1819 0%, #121011 100%)
          `,
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 5, md: 8 }}
            sx={{ alignItems: { xs: "stretch", md: "center" } }}
          >
            <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  component="img"
                  src={`${base}app-logo.svg`}
                  alt=""
                  sx={{
                    width: { xs: 56, md: 72 },
                    height: { xs: 56, md: 72 },
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  component="h1"
                  color="primary"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    fontSize: { xs: "2.75rem", md: "4rem" },
                    lineHeight: 1,
                  }}
                >
                  Midge
                </Typography>
              </Stack>

              <Typography
                variant="h5"
                color="text.secondary"
                sx={{ fontWeight: 400, maxWidth: 520, lineHeight: 1.45 }}
              >
                A free desktop MQTT↔MIDI bridge. Drive your DAW and hardware from web apps over
                MQTT, and stream MIDI events back out.
              </Typography>

              <Typography color="text.secondary" sx={{ maxWidth: 520, lineHeight: 1.5 }}>
                Speaks the same protocol as{" "}
                <Box
                  component="a"
                  href={MQTT_MIDI_URL}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: "primary.main", textDecoration: "none" }}
                >
                  @grantler-instruments/mqtt-midi-bridge
                </Box>
                , so your web apps just work.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  size="large"
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<DownloadOutlinedIcon />}
                  sx={{ py: 1.5, px: 3, fontSize: "1.05rem" }}
                >
                  Download for desktop
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<GitHubIcon />}
                  sx={{ py: 1.5, px: 3, fontSize: "1.05rem" }}
                >
                  View on GitHub
                </Button>
              </Stack>

              <Typography color="text.secondary" sx={{ maxWidth: 520, lineHeight: 1.5 }}>
                Builds for macOS, Windows, and Linux.
              </Typography>
            </Stack>

            <Box
              sx={{
                flex: { md: "0 0 48%" },
                minWidth: 0,
                display: "flex",
                justifyContent: { xs: "center", md: "flex-end" },
              }}
            >
              <DesktopFrame
                src={`${base}screenshot.png`}
                alt="Midge desktop app"
                placeholder="Screenshot coming soon"
                maxWidth={{ xs: 360, md: 520 }}
              />
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 7, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
            From your DAW to the whole world
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 5, maxWidth: 620 }}>
            Play MIDI in your DAW and Midge relays it, over MQTT, to every subscribed client at once
            — anywhere on the internet. It works the other way too: web apps can send MIDI back into
            Midge and out to your instruments.
          </Typography>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 3, md: 2 }}
            sx={{ alignItems: { xs: "flex-start", md: "stretch" } }}
          >
            {showFlow.map((step, index) => (
              <Stack
                key={step.title}
                direction="row"
                spacing={2}
                sx={{ flex: 1, alignItems: "flex-start" }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="overline"
                    color="primary"
                    sx={{ fontWeight: 700, letterSpacing: "0.08em" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {step.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {step.body}
                  </Typography>
                </Box>
                {index < showFlow.length - 1 && (
                  <Typography
                    aria-hidden
                    color="text.disabled"
                    sx={{
                      display: { xs: "none", md: "block" },
                      pt: 3.5,
                      flexShrink: 0,
                      fontSize: "1.25rem",
                      lineHeight: 1,
                    }}
                  >
                    →
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>

          <ExampleFlow />
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 7, md: 10 }, borderTop: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
            Built for live systems
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 5, maxWidth: 560 }}>
            A small, focused bridge that runs quietly on your machine.
          </Typography>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 2.5, md: 3 }}
            sx={{ alignItems: "stretch" }}
          >
            {features.map((feature) => (
              <Card
                key={feature.title}
                variant="outlined"
                sx={{
                  flex: 1,
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  borderColor: "divider",
                }}
              >
                <CardContent
                  sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}
                >
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 1 }}>
                    {feature.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {feature.body}
                  </Typography>
                  {"bullets" in feature && (
                    <Box
                      component="ul"
                      sx={{
                        m: 0,
                        mt: 1.5,
                        pl: 2.25,
                        color: "text.secondary",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      {feature.bullets.map((item) => (
                        <Box component="li" key={item.label} sx={{ lineHeight: 1.45 }}>
                          <Typography
                            component="span"
                            sx={{ fontWeight: 600, color: "text.primary" }}
                          >
                            {item.label}
                          </Typography>
                          <Typography component="span" color="text.secondary">
                            {": "}
                            {item.description}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>
    </>
  );
}

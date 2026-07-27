import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { GITHUB_ISSUES_URL, PRIVACY_POLICY_URL } from "../links";

const sections = [
  {
    title: "Overview",
    body: [
      "Midge is a desktop MQTT↔MIDI bridge from Grantler Instruments. This privacy policy explains what information the app may access and how that information is handled.",
      "Midge does not require an account, and Grantler Instruments does not operate a cloud service that collects your data.",
    ],
  },
  {
    title: "Information the app may access",
    body: [
      "MIDI ports: Midge reads from and writes to the MIDI input and output ports you configure (including virtual ports it may create). MIDI data is processed locally on your device.",
      "MQTT broker: Midge connects to the MQTT broker URL you configure and sends/receives messages under the topic prefix you choose. That traffic goes only to the broker you specify.",
      "Local settings: the app stores your configuration (broker URL, prefix, port names, and optional credentials) on your device so your setup persists between sessions.",
    ],
  },
  {
    title: "What we do not collect",
    body: [
      "Grantler Instruments does not collect analytics, advertising identifiers, or personal profile data through Midge.",
      "We do not sell your personal information.",
    ],
  },
  {
    title: "Third parties",
    body: [
      "The MQTT broker and MIDI destinations you configure are outside Grantler Instruments’ control and may have their own privacy practices.",
      "Optional support links on this website (for example Buy Me a Coffee or GitHub) are operated by those services under their own policies.",
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update this privacy policy from time to time. The updated policy will be posted at this URL with a revised “Last updated” date.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about this policy or privacy in Midge can be raised through the project issue tracker.",
    ],
  },
] as const;

export function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
      <Stack spacing={4}>
        <Box>
          <Typography component="h1" variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Privacy Policy
          </Typography>
          <Typography color="text.secondary">Last updated: July 27, 2026</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Canonical URL:{" "}
            <Link href={PRIVACY_POLICY_URL} color="primary" underline="hover">
              {PRIVACY_POLICY_URL}
            </Link>
          </Typography>
        </Box>

        {sections.map((section) => (
          <Box key={section.title} component="section">
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>
              {section.title}
            </Typography>
            <Stack spacing={1.5}>
              {section.body.map((paragraph) => (
                <Typography key={paragraph} color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {paragraph}
                </Typography>
              ))}
            </Stack>
          </Box>
        ))}

        <Typography color="text.secondary">
          Report privacy questions or concerns via{" "}
          <Link href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer" underline="hover">
            GitHub Issues
          </Link>
          , or return to the{" "}
          <Link component={RouterLink} to="/" underline="hover">
            home page
          </Link>
          .
        </Typography>
      </Stack>
    </Container>
  );
}

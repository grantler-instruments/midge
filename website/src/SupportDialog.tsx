import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import LocalCafeOutlinedIcon from "@mui/icons-material/LocalCafeOutlined";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { GITHUB_ISSUES_URL, SUPPORT_URL } from "./links";
import { useWebsiteStore } from "./store/useWebsiteStore";

export function SupportDialog() {
  const open = useWebsiteStore((state) => state.supportOpen);
  const setSupportOpen = useWebsiteStore((state) => state.setSupportOpen);

  return (
    <Dialog
      open={open}
      onClose={() => setSupportOpen(false)}
      aria-labelledby="support-dialog-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="support-dialog-title">Support Midge</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            The best way to help is to run the desktop bridge and report issues when something
            breaks. That feedback shapes what gets fixed next.
          </Typography>
          <Typography color="text.secondary">
            If you want to support development directly, you can buy me a coffee.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={() => setSupportOpen(false)} color="inherit">
          Close
        </Button>
        <Button
          variant="outlined"
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noreferrer"
          startIcon={<BugReportOutlinedIcon />}
          onClick={() => setSupportOpen(false)}
        >
          Report an issue
        </Button>
        <Button
          variant="contained"
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          startIcon={<LocalCafeOutlinedIcon />}
          onClick={() => setSupportOpen(false)}
        >
          Buy me a coffee
        </Button>
      </DialogActions>
    </Dialog>
  );
}

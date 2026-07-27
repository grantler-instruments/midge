import { WorkInProgressBanner } from "@grantler-instruments/mui-theme";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet, Link as RouterLink } from "react-router-dom";
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL } from "./links";
import { SupportDialog } from "./SupportDialog";
import { useWebsiteStore } from "./store/useWebsiteStore";

const navLinks = [{ label: "Download", href: GITHUB_RELEASES_URL }] as const;

export function SiteLayout() {
  const menuOpen = useWebsiteStore((state) => state.menuOpen);
  const setMenuOpen = useWebsiteStore((state) => state.setMenuOpen);
  const toggleMenu = useWebsiteStore((state) => state.toggleMenu);
  const openSupport = useWebsiteStore((state) => state.openSupport);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "transparent",
          color: "text.primary",
          backdropFilter: "blur(12px)",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexGrow: 1,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Box
              component="img"
              src={`${import.meta.env.BASE_URL}app-logo.svg`}
              alt=""
              sx={{ width: 32, height: 32, borderRadius: 1 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              Midge
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
            {navLinks.map((link) => (
              <Button
                key={link.label}
                color="inherit"
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </Button>
            ))}
            <Button color="inherit" onClick={openSupport}>
              Support
            </Button>
          </Stack>

          <IconButton
            edge="end"
            color="inherit"
            aria-label="Open menu"
            onClick={toggleMenu}
            sx={{ display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Box sx={{ width: 260, pt: 1 }} role="presentation">
          <List>
            {navLinks.map((link) => (
              <ListItemButton
                key={link.label}
                component="a"
                href={link.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
            ))}
            <ListItemButton onClick={openSupport}>
              <ListItemText primary="Support" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{
          py: 4,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Grantler Instruments · AGPL-3.0
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              <Link
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                color="inherit"
                underline="hover"
              >
                GitHub
              </Link>
              <Link
                component="button"
                type="button"
                onClick={openSupport}
                color="inherit"
                underline="hover"
                sx={{
                  border: 0,
                  background: "none",
                  cursor: "pointer",
                  font: "inherit",
                  p: 0,
                }}
              >
                Support
              </Link>
              <Link component={RouterLink} to="/privacy" color="inherit" underline="hover">
                Privacy
              </Link>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <SupportDialog />
      <WorkInProgressBanner />
    </Box>
  );
}

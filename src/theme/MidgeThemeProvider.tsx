import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { type ReactNode, useMemo } from "react";
import { useAppStore } from "../stores/app";

export function MidgeThemeProvider({ children }: { children: ReactNode }) {
  const darkMode = useAppStore((s) => s.darkMode);
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: "#6b9bd1" },
          background: darkMode
            ? { default: "#1e2229", paper: "#252a33" }
            : { default: "#f4f6f8", paper: "#ffffff" },
        },
      }),
    [darkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

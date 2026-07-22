import { darkTheme } from "@grantler-instruments/mui-theme";
import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";

export function MidgeThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

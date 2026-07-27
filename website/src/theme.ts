import { darkTheme } from "@grantler-instruments/mui-theme";
import { createTheme } from "@mui/material/styles";

export const websiteTheme = createTheme(darkTheme, {
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
  },
});

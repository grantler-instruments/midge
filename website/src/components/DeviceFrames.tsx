import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

type FrameShellProps = {
  maxWidth: number | { xs?: number; sm?: number; md?: number };
  children: ReactNode;
  sx?: SxProps<Theme>;
};

function FrameShell({ maxWidth, children, sx }: FrameShellProps) {
  return (
    <Box
      sx={[
        {
          width: "100%",
          maxWidth,
          mx: "auto",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}

type ScreenProps = {
  src?: string | null;
  alt: string;
  placeholder: string;
  aspectRatio: string;
  borderRadius?: string | number;
};

function DeviceScreen({ src, alt, placeholder, aspectRatio, borderRadius = 0 }: ScreenProps) {
  if (src) {
    return (
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius,
          backgroundColor: "#0a0a0a",
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        aspectRatio,
        borderRadius,
        background: "linear-gradient(165deg, rgba(151,109,121,0.12) 0%, #121011 45%, #0a0a0a 100%)",
        px: 2,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "center", letterSpacing: "0.04em", opacity: 0.7 }}
      >
        {placeholder}
      </Typography>
    </Box>
  );
}

type DeviceFrameProps = {
  src?: string | null;
  alt: string;
  placeholder: string;
  maxWidth?: number | { xs?: number; sm?: number; md?: number };
};

export function DesktopFrame({ src, alt, placeholder, maxWidth = 480 }: DeviceFrameProps) {
  return (
    <FrameShell maxWidth={maxWidth}>
      <Box
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: "#0a0a0a",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.08),
            0 28px 70px rgba(0,0,0,0.55)
          `,
        }}
      >
        <DeviceScreen
          src={src}
          alt={alt}
          placeholder={placeholder}
          aspectRatio="16 / 10"
          borderRadius={0}
        />
      </Box>
    </FrameShell>
  );
}

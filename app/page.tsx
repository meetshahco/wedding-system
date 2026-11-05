import { Box, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Typography variant="h4" sx={{ fontFamily: "var(--font-playfair)" }}>
        Wedding Invitation — Coming in Phase 4
      </Typography>
    </Box>
  );
}


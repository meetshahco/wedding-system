import { Box, Typography } from "@mui/material";

export default function MessagesPage() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Messages & Reminders</Typography>
      <Typography color="text.secondary">Coming in Phase 8.</Typography>
    </Box>
  );
}


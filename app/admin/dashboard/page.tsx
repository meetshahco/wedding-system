import { Box, Typography } from "@mui/material";

export default function DashboardPage() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Dashboard
      </Typography>
      <Typography color="text.secondary">Coming in Phase 9.</Typography>
    </Box>
  );
}


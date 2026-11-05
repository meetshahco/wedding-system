import { Box, Typography } from "@mui/material";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Box sx={{ p: 3 }}>
      <Typography>Invite for token: {token} — Coming in Phase 5</Typography>
    </Box>
  );
}

"use client";

import { Suspense } from "react";
import { Box, Card, CardContent, Skeleton } from "@mui/material";
import LoginForm from "@/components/auth/LoginForm";

function LoginSkeleton() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        px: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 400, borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
            <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={180} height={32} />
            <Skeleton variant="text" width={220} height={20} />
          </Box>
          <Skeleton variant="rounded" width="100%" height={56} sx={{ mb: 2.5, borderRadius: 1 }} />
          <Skeleton variant="rounded" width="100%" height={56} sx={{ mb: 3, borderRadius: 1 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

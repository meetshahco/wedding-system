import { notFound } from "next/navigation";
import { Box, Typography, Paper, Button } from "@mui/material";
import { Favorite, SearchOff } from "@mui/icons-material";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CodeEntryForm from "@/components/guest/CodeEntryForm";
import { tokens } from "@/lib/theme";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WeddingCodeEntryPage({ params }: PageProps) {
  const { slug } = await params;

  const wedding = await prisma.wedding.findFirst({
    where: { slug: { equals: slug, mode: "insensitive" } },
  });

  if (!wedding) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          bgcolor: tokens.neutral.bg,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            maxWidth: 440,
            p: 4,
            textAlign: "center",
            borderRadius: 2,
            borderColor: tokens.neutral.border,
          }}
        >
          <SearchOff sx={{ fontSize: 48, color: tokens.neutral.textSecondary, mb: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Wedding Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We could not find a celebration matching this link. Please double-check your invitation URL.
          </Typography>
          <Button component={Link} href="/" variant="outlined" sx={{ minHeight: 44 }}>
            Go Home
          </Button>
        </Paper>
      </Box>
    );
  }

  const coupleNames = `${wedding.coupleName1} & ${wedding.coupleName2}`;
  const formattedDate = new Date(wedding.weddingDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, sm: 4 },
        bgcolor: tokens.neutral.bg,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Favorite sx={{ color: wedding.accentColor || tokens.primary.main, fontSize: 24 }} />
        <Typography variant="overline" sx={{ letterSpacing: "0.15rem", fontWeight: 600 }}>
          Wedding Invitation
        </Typography>
      </Box>

      <CodeEntryForm
        slug={wedding.slug}
        coupleNames={coupleNames}
        formattedDate={formattedDate}
        accentColor={wedding.accentColor}
      />
    </Box>
  );
}


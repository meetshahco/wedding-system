"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  BottomNavigation,
  BottomNavigationAction,
  Typography,
  IconButton,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Dashboard,
  People,
  Send,
  Message,
  Settings,
  Event,
  Favorite,
  Logout,
} from "@mui/icons-material";

const NAV_ITEMS = [
  { label: "Dashboard", icon: <Dashboard />, href: "/admin/dashboard" },
  { label: "Guests", icon: <People />, href: "/admin/guests" },
  { label: "Invitations", icon: <Send />, href: "/admin/invitations" },
  { label: "Messages", icon: <Message />, href: "/admin/messages" },
  { label: "Events", icon: <Event />, href: "/admin/events" },
  { label: "Settings", icon: <Settings />, href: "/admin/settings" },
];

const DRAWER_WIDTH = 240;

async function logout() {
  await fetch("/api/admin/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentIndex = NAV_ITEMS.findIndex((item) =>
    pathname.startsWith(item.href)
  );

  const drawerContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Brand */}
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>
          <Favorite fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Wedding Admin
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Management Panel
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Nav Links */}
      <List sx={{ flex: 1, px: 1.5, py: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <ListItemButton
              key={item.href}
              selected={active}
              onClick={() => {
                router.push(item.href);
                setMobileOpen(false);
              }}
              sx={{
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "primary.contrastText" },
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {/* Logout */}
      <List sx={{ px: 1.5, py: 1 }}>
        <ListItemButton onClick={logout} sx={{ color: "error.main" }}>
          <ListItemIcon sx={{ minWidth: 40, color: "error.main" }}>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Sign out" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop side drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              border: "none",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          pb: isMobile ? "56px" : 0, // space for bottom nav
        }}
      >
        {children}
      </Box>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.appBar,
          }}
        >
          <BottomNavigation
            value={currentIndex === -1 ? false : currentIndex}
            onChange={(_, newValue) => {
              router.push(NAV_ITEMS[newValue].href);
            }}
            showLabels
          >
            {NAV_ITEMS.slice(0, 5).map((item) => (
              <BottomNavigationAction
                key={item.href}
                label={item.label}
                icon={item.icon}
                sx={{ minWidth: 0 }}
              />
            ))}
          </BottomNavigation>
        </Box>
      )}
    </Box>
  );
}


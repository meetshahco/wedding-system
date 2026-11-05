"use client";

import { useState, useEffect } from "react";
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
  Avatar,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Chip,
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
  Apartment,
  Group,
} from "@mui/icons-material";

const BASE_NAV_ITEMS = [
  { label: "Dashboard", icon: <Dashboard />, href: "/admin/dashboard" },
  { label: "Guests", icon: <People />, href: "/admin/guests" },
  { label: "Invitations", icon: <Send />, href: "/admin/invitations" },
  { label: "Messages", icon: <Message />, href: "/admin/messages" },
  { label: "Events", icon: <Event />, href: "/admin/events" },
  { label: "Settings", icon: <Settings />, href: "/admin/settings" },
];

const OWNER_NAV_ITEMS = [
  { label: "Weddings", icon: <Apartment />, href: "/admin/weddings" },
  { label: "Users & Access", icon: <Group />, href: "/admin/users" },
];

const DRAWER_WIDTH = 250;

async function logout() {
  await fetch("/api/admin/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

interface UserData {
  id: string;
  name: string;
  email: string;
  globalRole: "OWNER" | "MANAGER" | "USER";
}

interface WeddingSummary {
  id: string;
  slug: string;
  coupleName1: string;
  coupleName2: string;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [activeWedding, setActiveWedding] = useState<WeddingSummary | null>(null);
  const [weddings, setWeddings] = useState<WeddingSummary[]>([]);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/admin/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setActiveWedding(data.activeWedding);
          setWeddings(data.weddings || []);
        }
      } catch {
        // ignore
      }
    }
    loadMe();
  }, []);

  const handleSwitchWedding = async (newId: string) => {
    try {
      const res = await fetch("/api/admin/auth/switch-wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingId: newId }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // ignore
    }
  };

  const isOwnerOrManager = currentUser?.globalRole === "OWNER" || currentUser?.globalRole === "MANAGER";
  const allNavItems = isOwnerOrManager
    ? [...BASE_NAV_ITEMS, ...OWNER_NAV_ITEMS]
    : BASE_NAV_ITEMS;

  const currentIndex = allNavItems.findIndex((item) =>
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
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 34, height: 34 }}>
          <Favorite fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Wedding Studio
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Management Panel
          </Typography>
        </Box>
      </Box>

      {/* Wedding Switcher */}
      {weddings.length > 0 && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <FormControl fullWidth size="small">
            <Select
              value={activeWedding?.id || ""}
              onChange={(e) => handleSwitchWedding(e.target.value)}
              displayEmpty
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                borderRadius: 1.5,
              }}
            >
              {weddings.map((w) => (
                <MenuItem key={w.id} value={w.id} sx={{ fontSize: "0.8125rem" }}>
                  {w.coupleName1} & {w.coupleName2}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      <Divider />

      {/* Nav Links */}
      <List sx={{ flex: 1, px: 1.5, py: 1 }}>
        {allNavItems.map((item) => {
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
                minHeight: 44,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "primary.contrastText" },
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: active ? 600 : 500 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {/* User Info & Logout */}
      <Box sx={{ p: 2, bgcolor: "action.selected" }}>
        {currentUser && (
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {currentUser.name}
              </Typography>
              <Chip
                label={currentUser.globalRole}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.65rem", height: 20 }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {currentUser.email}
            </Typography>
          </Box>
        )}

        <ListItemButton onClick={logout} sx={{ color: "error.main", p: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 32, color: "error.main" }}>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sign out"
            primaryTypographyProps={{ fontSize: "0.8125rem", fontWeight: 600 }}
          />
        </ListItemButton>
      </Box>
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
          pb: isMobile ? "56px" : 0,
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
              router.push(allNavItems[newValue].href);
            }}
            showLabels
          >
            {allNavItems.slice(0, 5).map((item) => (
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

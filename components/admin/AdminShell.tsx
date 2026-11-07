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
  IconButton,
  AppBar,
  Toolbar,
  Button,
  Tooltip,
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
  ContactPhone,
  Menu as MenuIcon,
  Close as CloseIcon,
  OpenInNew,
  MoreHoriz,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface NavItem {
  label: string;
  icon: React.ReactElement;
  href: string;
}

const NAV_GROUPS: { group: string; items: NavItem[]; requiresAdmin?: boolean }[] = [
  {
    group: "Overview",
    items: [{ label: "Dashboard", icon: <Dashboard fontSize="small" />, href: "/admin/dashboard" }],
  },
  {
    group: "Guest Operations",
    items: [
      { label: "Guests", icon: <People fontSize="small" />, href: "/admin/guests" },
      { label: "Senders", icon: <ContactPhone fontSize="small" />, href: "/admin/senders" },
      { label: "Invitations", icon: <Send fontSize="small" />, href: "/admin/invitations" },
      { label: "Messages", icon: <Message fontSize="small" />, href: "/admin/messages" },
    ],
  },
  {
    group: "Itinerary & Design",
    items: [{ label: "Events", icon: <Event fontSize="small" />, href: "/admin/events" }],
  },
  {
    group: "System & Setup",
    items: [
      { label: "Settings", icon: <Settings fontSize="small" />, href: "/admin/settings" },
      { label: "Weddings", icon: <Apartment fontSize="small" />, href: "/admin/weddings" },
      { label: "Users & Access", icon: <Group fontSize="small" />, href: "/admin/users" },
    ],
  },
];

const DRAWER_WIDTH = 260;

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

  // Filter groups according to user role
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (item.href === "/admin/weddings" || item.href === "/admin/users") {
        return isOwnerOrManager;
      }
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  // Flat list of items
  const allNavItems = visibleGroups.flatMap((g) => g.items);

  // Derive current page title for app bar
  const currentNavItem = allNavItems.find((item) => pathname.startsWith(item.href));
  const pageTitle = currentNavItem ? currentNavItem.label : "Wedding Admin";

  const drawerContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: tokens.neutral.bg,
        borderRight: `1px solid ${tokens.neutral.border}`,
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          p: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${tokens.neutral.border}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.primary.contrastText,
              width: 36,
              height: 36,
              borderRadius: 2,
            }}
          >
            <Favorite sx={{ fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Wedding Platform
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Studio Management
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={() => setMobileOpen(false)} size="small" sx={{ minWidth: 44, minHeight: 44 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Wedding Switcher Card */}
      {weddings.length > 0 && (
        <Box sx={{ p: 2, borderBottom: `1px solid ${tokens.neutral.border}` }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: tokens.neutral.textSecondary,
              display: "block",
              mb: 1,
            }}
          >
            Active Celebration
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={activeWedding?.id || ""}
              onChange={(e) => handleSwitchWedding(e.target.value)}
              displayEmpty
              sx={{
                fontSize: "0.85rem",
                fontWeight: 600,
                borderRadius: 2,
                bgcolor: tokens.neutral.subtle,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: tokens.neutral.border,
                },
              }}
            >
              {weddings.map((w) => (
                <MenuItem key={w.id} value={w.id} sx={{ fontSize: "0.85rem", fontWeight: 500, py: 1 }}>
                  {w.coupleName1} & {w.coupleName2}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Navigation Sections */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
        {visibleGroups.map((group) => (
          <Box key={group.group} sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                py: 0.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: "0.68rem",
                color: tokens.neutral.textSecondary,
                display: "block",
              }}
            >
              {group.group}
            </Typography>
            <List dense disablePadding>
              {group.items.map((item) => {
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
                      my: 0.5,
                      borderRadius: 2,
                      minHeight: 44,
                      px: 1.5,
                      transition: "all 0.15s ease",
                      bgcolor: active ? tokens.primary.main : "transparent",
                      color: active ? tokens.primary.contrastText : tokens.neutral.textPrimary,
                      "&:hover": {
                        bgcolor: active ? tokens.primary.dark : tokens.neutral.subtleHover,
                      },
                      "&.Mui-selected": {
                        bgcolor: tokens.primary.main,
                        color: tokens.primary.contrastText,
                        "&:hover": { bgcolor: tokens.primary.dark },
                        "& .MuiListItemIcon-root": { color: tokens.primary.contrastText },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 32,
                        color: active ? tokens.primary.contrastText : tokens.neutral.textSecondary,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: "0.875rem",
                        fontWeight: active ? 600 : 500,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer Profile & Logout */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${tokens.neutral.border}`,
          bgcolor: tokens.neutral.subtle,
        }}
      >
        {currentUser && (
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {currentUser.name}
              </Typography>
              <Chip
                label={currentUser.globalRole}
                size="small"
                sx={{
                  fontSize: "0.65rem",
                  height: 20,
                  fontWeight: 700,
                  bgcolor: tokens.neutral.subtleHover,
                  color: tokens.neutral.textPrimary,
                  border: `1px solid ${tokens.neutral.border}`,
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
              {currentUser.email}
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant="outlined"
          size="small"
          onClick={logout}
          startIcon={<Logout fontSize="small" />}
          sx={{
            borderColor: tokens.neutral.border,
            color: tokens.status.error,
            minHeight: 40,
            fontSize: "0.8125rem",
            fontWeight: 600,
            justifyContent: "center",
            "&:hover": {
              borderColor: tokens.status.errorBorder,
              bgcolor: tokens.status.errorBg,
            },
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: tokens.neutral.bg }}>
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
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content Area with Modern Top AppBar */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          pb: isMobile ? "72px" : 0,
        }}
      >
        {/* Top Header Bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: tokens.neutral.white,
            color: tokens.neutral.textPrimary,
            borderBottom: `1px solid ${tokens.neutral.border}`,
            zIndex: (t) => t.zIndex.drawer - 1,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
            {/* Mobile Hamburger Button */}
            {isMobile && (
              <IconButton
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{
                  mr: 1.5,
                  minWidth: 44,
                  minHeight: 44,
                  color: tokens.neutral.textPrimary,
                }}
                aria-label="Open navigation menu"
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Current Section Title */}
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.01em", flexGrow: 1 }}>
              {pageTitle}
            </Typography>

            {/* Quick Actions (Desktop & Mobile) */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {activeWedding && (
                <Tooltip title="View Public Guest Code Page">
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={`/w/${activeWedding.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                    sx={{
                      display: { xs: "none", sm: "inline-flex" },
                      borderColor: tokens.neutral.border,
                      color: tokens.neutral.textPrimary,
                      minHeight: 36,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRadius: 2,
                    }}
                  >
                    Guest View
                  </Button>
                </Tooltip>
              )}

              {/* User Avatar Chip */}
              {currentUser && (
                <Avatar
                  sx={{
                    bgcolor: tokens.neutral.subtleHover,
                    color: tokens.neutral.textPrimary,
                    width: 34,
                    height: 34,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    border: `1px solid ${tokens.neutral.border}`,
                  }}
                >
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </Avatar>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content Body */}
        <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.appBar,
            borderTop: `1px solid ${tokens.neutral.border}`,
            bgcolor: tokens.neutral.white,
          }}
        >
          <BottomNavigation
            value={
              pathname.startsWith("/admin/dashboard")
                ? 0
                : pathname.startsWith("/admin/guests")
                ? 1
                : pathname.startsWith("/admin/senders")
                ? 2
                : pathname.startsWith("/admin/invitations")
                ? 3
                : 4
            }
            onChange={(_, val) => {
              if (val === 0) router.push("/admin/dashboard");
              if (val === 1) router.push("/admin/guests");
              if (val === 2) router.push("/admin/senders");
              if (val === 3) router.push("/admin/invitations");
              if (val === 4) setMobileOpen(true);
            }}
            showLabels
            sx={{
              height: 60,
              "& .MuiBottomNavigationAction-root": {
                minWidth: 0,
                py: 1,
                color: tokens.neutral.textSecondary,
                "&.Mui-selected": {
                  color: tokens.primary.main,
                  "& .MuiBottomNavigationAction-label": {
                    fontWeight: 700,
                    fontSize: "0.75rem",
                  },
                },
              },
            }}
          >
            <BottomNavigationAction label="Overview" icon={<Dashboard fontSize="small" />} />
            <BottomNavigationAction label="Guests" icon={<People fontSize="small" />} />
            <BottomNavigationAction label="Senders" icon={<ContactPhone fontSize="small" />} />
            <BottomNavigationAction label="Invites" icon={<Send fontSize="small" />} />
            <BottomNavigationAction label="More" icon={<MoreHoriz fontSize="small" />} />
          </BottomNavigation>
        </Box>
      )}
    </Box>
  );
}

import { createTheme, ThemeOptions, alpha } from "@mui/material/styles";
import { Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

// Semantic palette tokens
export const tokens = {
  primary: {
    main: "#111111",
    dark: "#000000",
    light: "#262626",
    contrastText: "#FFFFFF",
  },
  neutral: {
    white: "#FFFFFF",
    bg: "#FFFFFF",
    paper: "#FFFFFF",
    subtle: "#F9FAFB",
    subtleHover: "#F3F4F6",
    border: "#E5E7EB",
    borderDark: "#D1D5DB",
    textPrimary: "#111111",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
  },
  status: {
    success: "#16A34A",
    successBg: "#F0FDF4",
    successBorder: "#BBF7D0",
    warning: "#D97706",
    warningBg: "#FFFBEB",
    warningBorder: "#FDE68A",
    error: "#DC2626",
    errorBg: "#FEF2F2",
    errorBorder: "#FECACA",
    info: "#4B5563",
    infoBg: "#F9FAFB",
    infoBorder: "#E5E7EB",
  },
};

const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    primary: {
      main: tokens.primary.main,
      dark: tokens.primary.dark,
      light: tokens.primary.light,
      contrastText: tokens.primary.contrastText,
    },
    secondary: {
      main: tokens.neutral.textSecondary,
      contrastText: tokens.neutral.white,
    },
    background: {
      default: tokens.neutral.bg,
      paper: tokens.neutral.paper,
    },
    text: {
      primary: tokens.neutral.textPrimary,
      secondary: tokens.neutral.textSecondary,
    },
    divider: tokens.neutral.border,
    error: {
      main: tokens.status.error,
      contrastText: tokens.neutral.white,
    },
    warning: {
      main: tokens.status.warning,
      contrastText: tokens.neutral.white,
    },
    success: {
      main: tokens.status.success,
      contrastText: tokens.neutral.white,
    },
    info: {
      main: tokens.status.info,
      contrastText: tokens.neutral.white,
    },
    action: {
      hover: tokens.neutral.subtleHover,
      selected: tokens.neutral.subtle,
      focus: alpha(tokens.primary.main, 0.12),
    },
  },
  typography: {
    fontFamily: "var(--font-inter), Inter, sans-serif",
    h1: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 700, letterSpacing: "-0.01em" },
    h4: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 600, letterSpacing: "-0.01em" },
    h5: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 600 },
    subtitle1: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 500 },
    subtitle2: { fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 500 },
    body1: { fontFamily: "var(--font-inter), Inter, sans-serif", letterSpacing: "-0.005em" },
    body2: { fontFamily: "var(--font-inter), Inter, sans-serif", letterSpacing: "-0.005em" },
    button: { fontFamily: "var(--font-inter), Inter, sans-serif", textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          fontFamily: "var(--font-inter), Inter, sans-serif",
        },
        body: {
          color: tokens.neutral.textPrimary,
          backgroundColor: tokens.neutral.bg,
          fontFamily: "var(--font-inter), Inter, sans-serif",
        },
        "*": {
          fontFamily: "inherit",
        },
        "a": {
          color: tokens.neutral.textPrimary,
          textDecoration: "none",
          "&:hover": {
            textDecoration: "underline",
          },
        },
        // Global visible focus rings (2px black outline with 2px offset)
        "*:focus-visible": {
          outline: `2px solid ${tokens.primary.main}`,
          outlineOffset: "2px",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 44,
          paddingLeft: 18,
          paddingRight: 18,
          fontSize: "0.875rem",
          fontWeight: 600,
          "&:focus-visible": {
            outline: `2px solid ${tokens.primary.main}`,
            outlineOffset: "2px",
          },
        },
        containedPrimary: {
          backgroundColor: tokens.primary.main,
          color: tokens.primary.contrastText,
          "&:hover": {
            backgroundColor: tokens.primary.dark,
          },
        },
        outlined: {
          borderColor: tokens.neutral.border,
          color: tokens.neutral.textPrimary,
          "&:hover": {
            borderColor: tokens.primary.main,
            backgroundColor: tokens.neutral.subtleHover,
          },
        },
        text: {
          color: tokens.neutral.textPrimary,
          "&:hover": {
            backgroundColor: tokens.neutral.subtleHover,
          },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.neutral.border}`,
          borderRadius: 8,
          backgroundColor: tokens.neutral.white,
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        outlined: {
          border: `1px solid ${tokens.neutral.border}`,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "medium" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: tokens.neutral.white,
            "& fieldset": {
              borderColor: tokens.neutral.border,
            },
            "&:hover fieldset": {
              borderColor: tokens.neutral.borderDark,
            },
            "&.Mui-focused fieldset": {
              borderColor: tokens.primary.main,
              borderWidth: "2px",
            },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: tokens.neutral.textSecondary,
          "&.Mui-checked": {
            color: tokens.primary.main,
          },
          "&.MuiCheckbox-indeterminate": {
            color: tokens.primary.main,
          },
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: tokens.neutral.textSecondary,
          "&.Mui-checked": {
            color: tokens.primary.main,
          },
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": {
            color: tokens.primary.main,
            "& + .MuiSwitch-track": {
              backgroundColor: tokens.primary.main,
              opacity: 1,
            },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: tokens.primary.main,
          height: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          color: tokens.neutral.textSecondary,
          "&.Mui-selected": {
            color: tokens.primary.main,
            fontWeight: 600,
          },
          minHeight: 44,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
        filledPrimary: {
          backgroundColor: tokens.primary.main,
          color: tokens.primary.contrastText,
        },
        outlined: {
          borderColor: tokens.neutral.border,
          color: tokens.neutral.textPrimary,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: tokens.neutral.border,
          color: tokens.neutral.textPrimary,
        },
        head: {
          backgroundColor: tokens.neutral.subtle,
          fontWeight: 600,
          color: tokens.neutral.textPrimary,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: tokens.neutral.subtle,
            "&:hover": {
              backgroundColor: tokens.neutral.subtleHover,
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: `1px solid ${tokens.neutral.border}`,
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)",
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderTop: `1px solid ${tokens.neutral.border}`,
          backgroundColor: tokens.neutral.white,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: tokens.neutral.textSecondary,
          minWidth: 44,
          minHeight: 44,
          "&.Mui-selected": {
            color: tokens.primary.main,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          minHeight: 44,
          "&.Mui-selected": {
            backgroundColor: tokens.primary.main,
            color: tokens.primary.contrastText,
            "& .MuiListItemIcon-root": {
              color: tokens.primary.contrastText,
            },
            "&:hover": {
              backgroundColor: tokens.primary.dark,
            },
          },
          "&:hover": {
            backgroundColor: tokens.neutral.subtleHover,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.neutral.border,
          borderRadius: 4,
        },
        bar: {
          backgroundColor: tokens.primary.main,
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);

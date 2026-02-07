# SOT-02 — Design Tokens & Styling Contract (Design-1 Lock)

This file is a **styling contract**. Implementation must use these tokens (CSS variables) and preserve semantics.

## 0) Source files
- `styles.zip` contains:
  - `/index.css`:
```css
@import './fonts.css';
@import './tailwind.css';
@import './theme.css';
```
  - `/tailwind.css`:
```css
@import 'tailwindcss' source(none);
@source '../**/*.{js,ts,jsx,tsx}';

@import 'tw-animate-css';
```
  - `/theme.css` (**primary tokens**): see below

## 1) Token system (authoritative)
> Copy exactly; do not rename tokens.

```css
@custom-variant dark (&:is(.dark *));

/* =============================================================================
   OMNIA CHARITY TRACKING - DESIGN SYSTEM TOKENS
   Mobile-first PWA for field operations
   Accessibility: WCAG 2.1 AA compliant, RTL-ready, outdoor-friendly
   ============================================================================= */

:root {
  /* ----- COLORS: LIGHT THEME ----- */
  /* Surfaces & Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F6F7;
  --bg-tertiary: #E8EAED;
  --surface-raised: #FFFFFF;
  --surface-overlay: #FFFFFF;

  /* Text */
  --text-primary: #1A1D21;
  --text-secondary: #545964;
  --text-tertiary: #7A7F8A;
  --text-inverse: #FFFFFF;
  --text-disabled: #A8ACB5;

  /* Borders */
  --border-default: #D1D5DB;
  --border-strong: #9CA3AF;
  --border-subtle: #E8EAED;

  /* Primary Brand (OMNIA Blue - trustworthy, calm) */
  --primary: #0066CC;
  --primary-hover: #0052A3;
  --primary-active: #003D7A;
  --primary-disabled: #99C2E5;
  --on-primary: #FFFFFF;

  /* Secondary (Neutral actions) */
  --secondary: #FFFFFF;
  --secondary-hover: #F5F6F7;
  --secondary-active: #E8EAED;
  --secondary-disabled: #F5F6F7;
  --on-secondary: #1A1D21;

  /* Critical/Destructive */
  --critical: #D32F2F;
  --critical-hover: #B71C1C;
  --critical-active: #8B0000;
  --critical-disabled: #F5A5A5;
  --on-critical: #FFFFFF;

  /* Warning (Urgent) */
  --warning: #F57C00;
  --warning-hover: #E65100;
  --warning-active: #BF360C;
  --warning-disabled: #FFCC80;
  --on-warning: #FFFFFF;

  /* Success */
  --success: #2E7D32;
  --success-hover: #1B5E20;
  --success-active: #0D4F14;
  --success-disabled: #A5D6A7;
  --on-success: #FFFFFF;

  /* Info */
  --info: #0288D1;
  --info-hover: #01579B;
  --info-active: #014473;
  --info-disabled: #81D4FA;
  --on-info: #FFFFFF;

  /* State: Focus ring for accessibility */
  --focus-ring: #0066CC;
  --focus-ring-offset: #FFFFFF;

  /* ----- TYPOGRAPHY ----- */
  /* Mobile-first scale - optimized for 16px base */
  --font-size-base: 16px;
  --text-xs: 0.75rem;    /* 12px - micro labels */
  --text-sm: 0.875rem;   /* 14px - small labels, captions */
  --text-base: 1rem;     /* 16px - body, inputs */
  --text-lg: 1.125rem;   /* 18px - subheadings */
  --text-xl: 1.25rem;    /* 20px - headings */
  --text-2xl: 1.5rem;    /* 24px - page titles */
  --text-3xl: 1.875rem;  /* 30px - hero text */

  /* Line heights for readability */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Font weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ----- SPACING SCALE (4px base) ----- */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */

  /* ----- DENSITY RULES ----- */
  /* Touch targets: 48px minimum for mobile */
  --touch-target-min: 48px;
  --touch-target-comfortable: 56px;
  
  /* Component heights */
  --height-input: 48px;
  --height-button: 48px;
  --height-chip: 36px;
  --height-tab: 48px;

  /* ----- BORDER RADIUS ----- */
  --radius-none: 0;
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-full: 9999px;

  /* ----- ELEVATION / SHADOWS ----- */
  --elevation-0: none;
  --elevation-1: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --elevation-2: 0 2px 4px 0 rgba(0, 0, 0, 0.08);
  --elevation-3: 0 4px 8px 0 rgba(0, 0, 0, 0.10);
  --elevation-4: 0 8px 16px 0 rgba(0, 0, 0, 0.12);
  --elevation-5: 0 16px 24px 0 rgba(0, 0, 0, 0.15);

  /* ----- ICON SIZES ----- */
  --icon-xs: 16px;
  --icon-sm: 20px;
  --icon-md: 24px;
  --icon-lg: 32px;
  --icon-xl: 48px;

  /* ----- Z-INDEX LAYERS ----- */
  --z-base: 0;
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-overlay: 1200;
  --z-modal: 1300;
  --z-toast: 1400;

  /* ----- TRANSITIONS ----- */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Legacy tokens for compatibility */
  --background: var(--bg-primary);
  --foreground: var(--text-primary);
  --border: var(--border-default);
  --radius: var(--radius-md);
}

/* ----- DARK THEME ----- */
.dark {
  /* Surfaces & Backgrounds */
  --bg-primary: #1A1D21;
  --bg-secondary: #2A2D31;
  --bg-tertiary: #3A3D41;
  --surface-raised: #2A2D31;
  --surface-overlay: #3A3D41;

  /* Text */
  --text-primary: #F5F6F7;
  --text-secondary: #B8BCC4;
  --text-tertiary: #9CA3AF;
  --text-inverse: #1A1D21;
  --text-disabled: #6B7280;

  /* Borders */
  --border-default: #3A3D41;
  --border-strong: #545964;
  --border-subtle: #2A2D31;

  /* Primary Brand */
  --primary: #3399FF;
  --primary-hover: #66B2FF;
  --primary-active: #99CCFF;
  --primary-disabled: #1A5C99;
  --on-primary: #1A1D21;

  /* Secondary */
  --secondary: #2A2D31;
  --secondary-hover: #3A3D41;
  --secondary-active: #4A4D51;
  --secondary-disabled: #2A2D31;
  --on-secondary: #F5F6F7;

  /* Critical/Destructive */
  --critical: #EF5350;
  --critical-hover: #F44336;
  --critical-active: #D32F2F;
  --critical-disabled: #5C2121;
  --on-critical: #1A1D21;

  /* Warning */
  --warning: #FFA726;
  --warning-hover: #FF9800;
  --warning-active: #F57C00;
  --warning-disabled: #663D00;
  --on-warning: #1A1D21;

  /* Success */
  --success: #66BB6A;
  --success-hover: #4CAF50;
  --success-active: #2E7D32;
  --success-disabled: #1B4D1F;
  --on-success: #1A1D21;

  /* Info */
  --info: #29B6F6;
  --info-hover: #03A9F4;
  --info-active: #0288D1;
  --info-disabled: #014773;
  --on-info: #1A1D21;

  /* Focus ring */
  --focus-ring: #3399FF;
  --focus-ring-offset: #1A1D21;

  /* Elevation in dark mode uses lighter shadows */
  --elevation-1: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --elevation-2: 0 2px 4px 0 rgba(0, 0, 0, 0.4);
  --elevation-3: 0 4px 8px 0 rgba(0, 0, 0, 0.5);
  --elevation-4: 0 8px 16px 0 rgba(0, 0, 0, 0.6);
  --elevation-5: 0 16px 24px 0 rgba(0, 0, 0, 0.7);

  /* Legacy tokens */
  --background: var(--bg-primary);
  --foreground: var(--text-primary);
  --border: var(--border-default);
}

/* ----- RTL SUPPORT ----- */
[dir="rtl"] {
  /* Custom properties for RTL layouts */
  --direction: rtl;
  --text-align-start: right;
  --text-align-end: left;
}

[dir="ltr"], :root {
  --direction: ltr;
  --text-align-start: left;
  --text-align-end: right;
}

/* =============================================================================
   BASE STYLES
   ============================================================================= */

@layer base {
  html {
    font-size: var(--font-size-base);
    -webkit-tap-highlight-color: transparent; /* Remove tap highlight on mobile */
    -webkit-text-size-adjust: 100%; /* Prevent font size adjustment on orientation change */
  }

  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-weight: var(--font-weight-normal);
    line-height: var(--leading-normal);
    /* Optimize for outdoor readability */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Typography defaults */
  h1 {
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-semibold);
    line-height: var(--leading-tight);
    color: var(--text-primary);
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-weight-semibold);
    line-height: var(--leading-tight);
    color: var(--text-primary);
  }

  h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-weight-medium);
    line-height: var(--leading-normal);
    color: var(--text-primary);
  }

  h4 {
    font-size: var(--text-base);
    font-weight: var(--font-weight-medium);
    line-height: var(--leading-normal);
    color: var(--text-primary);
  }

  label {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    line-height: var(--leading-normal);
    color: var(--text-primary);
  }

  /* Focus styles for accessibility */
  *:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    :root {
      --border-default: #000000;
      --text-secondary: var(--text-primary);
    }
    .dark {
      --border-default: #FFFFFF;
      --text-secondary: var(--text-primary);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

## 2) Semantic mapping rules
- Priority badges:
  - Overdue/Retard → `--critical`
  - Urgent → `--warning`
  - Normal → neutral surface (`--bg-secondary`) + text `--text-primary`
- Primary actions → `--primary` + `--on-primary`
- Focus ring → `--focus-ring` with offset `--focus-ring-offset`
- Surfaces:
  - page background → `--bg-primary`
  - cards → `--surface-raised`
  - separators → `--border-default`

## 3) Density + touch targets
- `--touch-target-min: 48px` must be enforced on:
  - icon buttons, tabs, chips, checkboxes rows, steppers, form controls

## 4) Dark mode + RTL
- Dark mode toggles `.dark` on root.
- RTL toggles `dir="rtl"` on `<html>` (or documentElement).

## 5) Tailwind usage
- Tailwind may be used for layout utilities, but **colors must come from tokens**:
  - Use `bg-[var(--...)]`, `text-[var(--...)]`, `border-[var(--...)]`, etc.

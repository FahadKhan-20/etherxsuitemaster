---
name: Lumina Dark
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#c8c6c5'
  on-tertiary: '#313030'
  tertiary-container: '#929090'
  on-tertiary-container: '#2a2a2a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar_width: 72px
  container_max_width: 480px
  gutter: 24px
  stack_sm: 8px
  stack_md: 16px
  stack_lg: 32px
---

## Brand & Style

This design system is engineered for a high-end, developer-centric experience. It prioritizes focus and technical precision through a sophisticated blend of **Minimalism** and **Atmospheric Lighting**. The aesthetic is defined by deep, recessive backgrounds contrasted against sharp, high-fidelity UI elements. 

The emotional response is one of "quiet power"—a professional tool that feels premium and intentional. By stripping away unnecessary ornamentation and relying on light as a spatial signifier (the central glow), the interface guides the user’s attention to the primary workflow without friction.

## Colors

The palette is anchored in a dark-mode-first architecture. The primary background utilizes a near-black charcoal to ensure depth, while a central radial gradient in muted grey/white provides a sense of illumination behind the core content.

- **Accent Purple:** A vibrant, high-saturation violet used sparingly for primary actions to draw immediate attention.
- **Pure White:** Reserved for primary buttons and high-contrast text to ensure maximum readability.
- **Tonal Greys:** A range of deep charcoals (near-black) used for inputs and sidebar containers to create subtle layer separation without breaking the dark aesthetic.

## Typography

The design system utilizes **Inter** for its utilitarian clarity and modern geometric construction. The hierarchy is tight, favoring slightly tighter letter-spacing for headlines to create a "locked-in" professional feel. Body text maintains generous line-height for legibility, while metadata and labels use a refined, smaller scale to keep the interface feeling spacious and uncluttered.

## Layout & Spacing

The layout is structured around a fixed-width vertical sidebar on the left, containing minimal, high-contrast icons. This creates a permanent navigation anchor while maximizing the central stage.

Main content is presented in a centered, fixed-width card layout for authentication and core workflows, ensuring a focused, linear experience. The spacing rhythm follows a strict 8px grid, emphasizing vertical stacking and generous margins to prevent visual density from feeling overwhelming.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layering** and **Atmospheric Blurs** rather than traditional drop shadows.

- **The Core Card:** Appears to float on the background through the use of a central radial glow effect.
- **Input Fields:** Recessed through the use of a slightly lighter charcoal fill than the background and a subtle 1px border.
- **Sidebar:** Defined by a sharp vertical border rather than a shadow, maintaining the minimalist "flat" aesthetic while providing structural separation.

## Shapes

The shape language is precise and disciplined. Small corner radii (rounded-sm) are used across all interactive elements—buttons, inputs, and containers—to maintain a professional, developer-centric edge. This "softened square" approach provides enough friendliness to be modern while remaining sharp enough to feel like a high-performance tool.

## Components

### Buttons
- **Primary:** Wide, full-width buttons with a white background and dark text, or a vibrant purple background for secondary CTAs.
- **Social Auth:** High-contrast buttons (Apple/Google) using pure white or solid monochromatic fills to ensure brand recognition without distracting from the primary flow.

### Input Fields
- **Email/Text:** Dark background fills (#171717) with a subtle #333333 border. Focus states should transition the border to the accent purple or white.
- **Icons:** Minimalist line icons (20px) placed within the left side of the input field.

### Sidebar
- **Icons:** Minimalist, single-color icons with high stroke-to-negative-space ratio.
- **Active State:** A subtle vertical pill or indicator light to show the current selection.

### Cards
- **Centered Container:** Uses a maximum width of 480px. It does not require a visible border if the central glow is used to define the area, relying instead on typographic alignment and white space.
  # AegisOne — Luxury & Unified Design System Specification (`design.md`)

  ## 1. Executive Vision & Core Aesthetics
  AegisOne's visual identity embodies **Cyber Precision**, **Luxury Enterprise Elegance**, and **Glassmorphic Depth**. 
  Every component, card, button, and layout across the **Landing Page**, **Onboarding Portal**, **Setup Engine**, and **Admin/Employee Dashboards** follows a synchronized, state-of-the-art visual standard.

  ---

  ## 2. Typography & Font Hierarchy

  ### Font Family
  - **Primary Body & Interface**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
  - **Display & Headlines**: `Outfit`, `Plus Jakarta Sans`, `Inter`, `sans-serif`
  - **Monospace & Code**: `JetBrains Mono`, `Fira Code`, `ui-monospace`, `monospace`

  ### Font Sizes & Weight Mapping
  | Token | Size | Weight | Tracking | Usage |
  | :--- | :--- | :--- | :--- | :--- |
  | `display-xl` | 3rem (48px) | 800 (ExtraBold) | `-0.025em` | Main Landing Hero Headline |
  | `display-lg` | 2.25rem (36px) | 700 (Bold) | `-0.02em` | Portal / Section Titles |
  | `heading-md` | 1.5rem (24px) | 700 (Bold) | `-0.015em` | Card & Header Titles |
  | `heading-sm` | 1.125rem (18px) | 600 (SemiBold) | `-0.01em` | Modal & Widget Titles |
  | `body-base` | 0.875rem (14px) | 400/500 (Regular/Medium) | `normal` | Standard Body & Form Inputs |
  | `body-sm` | 0.75rem (12px) | 500/600 (Medium/SemiBold) | `normal` | Badges, Subtitles, Tooltips |
  | `caption-xs` | 0.625rem (10px) | 700 (Bold) | `0.05em UPPERCASE` | Micro Badges, Table Headers |

  ---

  ## 3. Color System & Swatches

  ### 3.1 Primary Sapphire & Royal Blue Palette (Brand Core)
  ```css
  /* Blue Hierarchy */
  --blue-50:  #EFF6FF; /* Ultra Light Tint / Active Hover Backdrops */
  --blue-100: #DBEAFE; /* Soft Highlight Borders */
  --blue-200: #BFDBFE; /* Subtle Divider Lines */
  --blue-300: #93C5FD; /* Secondary Active State */
  --blue-400: #60A5FA; /* Neon Glow Accents */
  --blue-500: #3B82F6; /* Primary Vivid Blue */
  --blue-600: #0A5ED6; /* Aegis Royal Blue (Primary Brand Button) */
  --blue-700: #1D4ED8; /* Hover Active Primary Blue */
  --blue-800: #1E40AF; /* Dark Accent Gradient Endpoint */
  --blue-900: #1E3A8A; /* Deep Ocean Background Tint */
  --blue-950: #172554; /* Deepest Midnight Blue Accent */
  ```

  ### 3.2 Dark Mode Base (Slate & Obsidian Surface)
  ```css
  /* Dark Surfaces */
  --surface-dark-bg:      #030712; /* Canvas Base (Slate 950 / Darkest Void) */
  --surface-dark-card:    #0F172A; /* Card Glass background (Slate 900) */
  --surface-dark-elevated:#1E293B; /* Hover / Modal Elevated Glass (Slate 800) */
  --surface-dark-border:  rgba(255, 255, 255, 0.08); /* Subtle 8% White Border */
  --surface-dark-hover:   rgba(255, 255, 255, 0.12); /* Interactive Hover Border */
  ```

  ### 3.3 Light Mode Base (Crisp Snow & Pure White)
  ```css
  /* Light Surfaces */
  --surface-light-bg:     #F8FAFC; /* Canvas Base (Slate 50) */
  --surface-light-card:   #FFFFFF; /* Pure White Card Box */
  --surface-light-border: #E2E8F0; /* Slate 200 Subtle Border */
  --surface-light-hover:  #CBD5E1; /* Slate 300 Interactive Border */
  ```

  ### 3.4 Status & Severity Colors
  - **Emerald (Safe / Active / Approved)**:
    - Text/Icon: `#059669` (Light) / `#34D399` (Dark)
    - Badge Background: `rgba(16, 185, 129, 0.1)` | Border: `rgba(16, 185, 129, 0.2)`
  - **Amber (Warning / Suspended / Pending)**:
    - Text/Icon: `#D97706` (Light) / `#FBBF24` (Dark)
    - Badge Background: `rgba(245, 158, 11, 0.1)` | Border: `rgba(245, 158, 11, 0.2)`
  - **Crimson (Threat / Blocked / Error)**:
    - Text/Icon: `#DC2626` (Light) / `#F87171` (Dark)
    - Badge Background: `rgba(239, 68, 68, 0.1)` | Border: `rgba(239, 68, 68, 0.2)`
  - **Purple / Indigo (Enterprise Tier / AI Engine)**:
    - Text/Icon: `#7C3AED` (Light) / `#A78BFA` (Dark)
    - Badge Background: `rgba(139, 92, 246, 0.1)` | Border: `rgba(139, 92, 246, 0.2)`

  ---

  ## 4. Luxury UI Components & Specifications

  ### 4.1 Glassmorphic Cards & Elevate Hovers
  All cards utilize subtle border glows, backdrop blurs, and soft multi-layered shadows.
  ```tsx
  /* Standard Luxury Card Class */
  bg-white dark:bg-slate-900 
  border border-slate-200/80 dark:border-white/[0.08] 
  shadow-sm hover:shadow-xl hover:border-blue-500/30 dark:hover:border-blue-400/30 
  transition-all duration-300 ease-out rounded-2xl p-6
  ```

  ### 4.2 Buttons & Interactive Elements
  1. **Primary Luxury Button**:
    - Background: `bg-[#0A5ED6] hover:bg-[#0B63E0]`
    - Text: `text-white font-bold text-xs uppercase tracking-wider`
    - Shadow: `shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/35`
    - Scale: `active:scale-[0.98] transition-all`
  2. **Secondary Ghost Glass Button**:
    - Background: `bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08]`
    - Text: `text-slate-700 dark:text-slate-200 font-semibold text-xs`
    - Border: `border border-slate-200 dark:border-white/[0.08]`

  ### 4.3 Form Inputs & Selects
  - Background: `bg-slate-50 dark:bg-slate-950`
  - Border: `border border-slate-200 dark:border-slate-800`
  - Focus State: `focus:border-[#0A5ED6] focus:ring-2 focus:ring-[#0A5ED6]/20 focus:bg-white dark:focus:bg-slate-900`
  - Border Radius: `rounded-xl` (`12px`)
  - Padding: `px-4 py-3 text-sm`

  ### 4.4 Sleek Micro Progress Bars & Steppers
  - Stepper Container: Compact horizontal container with line connectors (`h-0.5`).
  - Progress Bar Fill: `bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500`
  - Capped Cap: `Math.min(100, Math.round(val))` to ensure progress bar never overflows 100%.

  ### 4.5 Compact Luxury Footer
  - Height: Compact (`py-4 px-6`)
  - Divider: `border-t border-slate-200 dark:border-white/[0.06]`
  - Text: `text-xs text-slate-400 font-medium`
  - Elements: Flex layout with Brand Logo, Security Status Dot (`bg-emerald-500 animate-pulse`), Copyright, and Quick Links.

  ---

  ## 5. Lucide Icon Standard
  Icon sets across all modules use consistent sizing and stroke weights:
  - **Navigation Links**: `w-4 h-4` (Stroke width: 2px)
  - **Card Header Icons**: `w-5 h-5` (Stroke width: 2px) inside a `p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10` container.
  - **Micro Badges**: `w-3 h-3`

  ---

  ## 6. Global Implementation Checklist
  - [x] Unified Color Palette & Gradients
  - [x] Persistent Glassmorphism & Borders across Landing, Portal, Setup, & Dashboards
  - [x] Monitored Micro-Animations (`framer-motion` & `transition-all duration-300`)
  - [x] Capped Progress Bar Mechanics (100% Maximum)
  - [x] Compact Responsive Footers across all views

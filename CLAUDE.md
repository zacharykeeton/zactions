# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16.1.6 application built with:
- **React 19.2.3** (App Router architecture)
- **TypeScript 5** with strict mode enabled
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** component system (installed via `shadcn` package)
- **Geist Sans** and **Geist Mono** fonts (optimized via next/font)

## Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server (run after build)
npm start

# Run ESLint
npm run lint
```

## Project Architecture

### Next.js App Router Structure
- All routes live in the `app/` directory
- [app/layout.tsx](app/layout.tsx) - Root layout with font configuration and metadata
- [app/page.tsx](app/page.tsx) - Home page component
- [app/globals.css](app/globals.css) - Global styles with Tailwind CSS v4 configuration

### Styling System
- **Tailwind CSS v4** (PostCSS plugin-based, no traditional config file)
- **shadcn/ui** components imported via `@import "shadcn/tailwind.css"`
- **tw-animate-css** for additional animations
- Dark mode configured with custom variant: `@custom-variant dark (&:is(.dark *))`
- Design tokens defined in CSS variables using OKLCH color space
- Utility function `cn()` in [lib/utils.ts](lib/utils.ts) for conditional classes (clsx + tailwind-merge)

### TypeScript Configuration
- Path alias: `@/*` maps to project root (use `@/` for imports)
- JSX mode: `react-jsx` (no React import needed in components)
- Target: ES2017
- Strict mode enabled

### UI Component Library
This project uses **shadcn/ui** for components:
- Components are imported from the shadcn package
- Custom theming via CSS variables in [app/globals.css](app/globals.css)
- Icons from `lucide-react`
- Utilities: `class-variance-authority`, `clsx`, `tailwind-merge`

## Important Patterns

### Component Creation
- Use TypeScript with `.tsx` extension
- Leverage the `cn()` utility from `@/lib/utils` for conditional styling
- Follow React 19 patterns (no unnecessary `"use client"` directives unless needed)

### Styling Approach
- Tailwind utility classes are the primary styling method
- Use the defined CSS variables for theming (e.g., `bg-background`, `text-foreground`)
- Dark mode classes automatically work with the custom variant

### Import Paths
- Use `@/` prefix for absolute imports (e.g., `import { cn } from "@/lib/utils"`)
- Next.js components: `next/image`, `next/font`, `next/link`

// Import the HeroUI theme plugin using CommonJS require
// Note: If your project uses ES Modules (type: "module" in package.json)
// and @heroui/theme supports it, you could potentially use:
// import { heroui } from '@heroui/theme';
// import tailwindcssAnimate from 'tailwindcss-animate';
const { heroui } = require('@heroui/theme');
const tailwindcssAnimate = require('tailwindcss-animate'); // Use a variable for require

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Scan the main HTML file
    "./src/**/*.{js,ts,jsx,tsx}", // Scan all JS/TS/JSX/TSX files in the src directory
    // Ensures Tailwind generates CSS for classes used within HeroUI components.
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  // Enable dark mode using a class (e.g., <html class="dark">)
  // Corrected: Use 'class' string instead of redundant array
  darkMode: 'class',
  theme: {
    extend: {
        // These color definitions look correct for shadcn/ui
        colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))', // Correctly defined
            foreground: 'hsl(var(--foreground))', // Correctly defined
            primary: {
                DEFAULT: 'hsl(var(--primary))',
                foreground: 'hsl(var(--primary-foreground))'
            },
            secondary: {
                DEFAULT: 'hsl(var(--secondary))',
                foreground: 'hsl(var(--secondary-foreground))'
            },
            destructive: {
                DEFAULT: 'hsl(var(--destructive))',
                foreground: 'hsl(var(--destructive-foreground))'
            },
            muted: {
                DEFAULT: 'hsl(var(--muted))',
                foreground: 'hsl(var(--muted-foreground))'
            },
            accent: {
                DEFAULT: 'hsl(var(--accent))',
                foreground: 'hsl(var(--accent-foreground))'
            },
            popover: {
                DEFAULT: 'hsl(var(--popover))',
                foreground: 'hsl(var(--popover-foreground))'
            },
            card: {
                DEFAULT: 'hsl(var(--card))',
                foreground: 'hsl(var(--card-foreground))'
            },
            chart: {
                '1': 'hsl(var(--chart-1))',
                '2': 'hsl(var(--chart-2))',
                '3': 'hsl(var(--chart-3))',
                '4': 'hsl(var(--chart-4))',
                '5': 'hsl(var(--chart-5))'
            }
        },
        // BorderRadius definitions look correct
        borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)'
        }
        // You might add keyframes and animation from shadcn/ui here if needed
        // keyframes: { ... },
        // animation: { ... },
    }
  },
  // Register Tailwind plugins
  plugins: [
    // Add the HeroUI theme plugin
    heroui(),
    // Add tailwindcss-animate plugin (required by shadcn/ui)
    tailwindcssAnimate
  ],
};
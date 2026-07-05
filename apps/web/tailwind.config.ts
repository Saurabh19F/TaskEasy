import type { Config } from 'tailwindcss';

// ── Aurora — Violet primary scale ──────────────────────────────────────────
// Anchored at #7C3AED (UI action) and #5B21B6 (brand deep)
const violetScale = {
  50:  '#F5F3FF',
  100: '#EDE9FE',
  200: '#DDD6FE',
  300: '#C4B5FD',
  400: '#A78BFA',
  500: '#8B5CF6',
  600: '#7C3AED',  // primary action — buttons, links, active states
  700: '#6D28D9',
  800: '#5B21B6',  // brand deep — identity moments
  900: '#4C1D95',
  950: '#2E1065',
};

// ── Cyan — Electric accent (highlights, AI, data moments) ─────────────────
const cyanScale = {
  50:  '#ECFEFF',
  100: '#CFFAFE',
  200: '#A5F3FC',
  300: '#67E8F9',
  400: '#22D3EE',
  500: '#06B6D4',  // accent — electric cyan
  600: '#0891B2',
  700: '#0E7490',
  800: '#155E75',
  900: '#164E63',
};

// ── Emerald — secondary (success, positive states) ─────────────────────────
const emeraldScale = {
  50:  '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  400: '#34D399',
  500: '#10B981',
  600: '#059669',  // secondary token
  700: '#047857',
  800: '#065F46',
  900: '#064E3B',
};

// ── Amber — tertiary (warning, attention) ─────────────────────────────────
const amberScale = {
  50:  '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',  // tertiary / warning token
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
};

// ── Red — error / danger ────────────────────────────────────────────────────
const redScale = {
  50:  '#FFF1F2',
  100: '#FFE4E6',
  200: '#FECDD3',
  300: '#FDA4AF',
  400: '#FB7185',
  500: '#F43F5E',
  600: '#E11D48',
  700: '#BE123C',
  800: '#9F1239',
  900: '#881337',
};

// ── Slate — neutral surfaces ────────────────────────────────────────────────
const slateScale = {
  50:  '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
};

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Design-system semantic tokens ──────────────────────────────────
        primary: violetScale,

        brand: {
          DEFAULT: '#5B21B6',  // deep violet — core brand identity
          light:   '#7C3AED',  // action violet — buttons / UI
        },

        accent: {
          DEFAULT: '#06B6D4',  // electric cyan
          light:   '#ECFEFF',
        },

        success: {
          DEFAULT: '#059669',
          light:   '#D1FAE5',
        },

        warning: {
          DEFAULT: '#D97706',
          light:   '#FEF3C7',
        },

        danger: {
          DEFAULT: '#DC2626',
          light:   '#FEE2E2',
        },

        sidebar: {
          DEFAULT: '#0D0921',  // deep space sidebar
          hover:   'rgba(255,255,255,0.08)',
          active:  '#7C3AED',
          text:    'rgba(255,255,255,0.85)',
          muted:   'rgba(255,255,255,0.45)',
        },

        // ── Tailwind named color overrides → Aurora design system ──────────
        blue:    violetScale,
        indigo:  violetScale,
        sky:     cyanScale,
        violet:  violetScale,
        purple:  violetScale,
        fuchsia: redScale,
        pink:    redScale,
        rose:    redScale,
        red:     redScale,
        cyan:    cyanScale,
        teal:    emeraldScale,
        emerald: emeraldScale,
        green:   emeraldScale,
        lime:    emeraldScale,
        yellow:  amberScale,
        amber:   amberScale,
        orange:  amberScale,
        slate:   slateScale,
        gray:    slateScale,
        zinc:    slateScale,
        neutral: slateScale,
        stone:   slateScale,
      },

      fontFamily: {
        // Display: Plus Jakarta Sans — modern geometric SaaS headings
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        // Body + UI: Inter — exceptional legibility in data-dense environments
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        // Mono: JetBrains Mono — technical data points, IDs, metadata
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Menlo', 'monospace'],
      },

      fontSize: {
        'display-lg':    ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg':   ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-md':   ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg':       ['16px', { lineHeight: '24px' }],
        'body-md':       ['14px', { lineHeight: '20px' }],
        'label-sm':      ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'code-sm':       ['12px', { lineHeight: '18px' }],
      },

      borderRadius: {
        sm:      '0.375rem',  //  6px
        DEFAULT: '0.625rem',  // 10px — standard
        md:      '0.875rem',  // 14px
        lg:      '1rem',      // 16px — large containers
        xl:      '1.5rem',    // 24px — very large (modals, kanban)
        '2xl':   '1.75rem',   // 28px — hero panels
        full:    '9999px',    // pill
      },

      boxShadow: {
        'level-0': 'none',
        'level-1': '0 0 0 1px rgb(209 196 249)',
        'level-2': '0 4px 6px -1px rgba(91,33,182,0.14), 0 2px 4px -2px rgba(91,33,182,0.10)',
        'level-3': '0 20px 25px -5px rgba(91,33,182,0.18), 0 8px 10px -6px rgba(91,33,182,0.10)',
        card:    '0 1px 3px rgba(91,33,182,0.06)',
        sm:      '0 1px 3px rgba(91,33,182,0.06)',
        DEFAULT: '0 4px 6px -1px rgba(91,33,182,0.14), 0 2px 4px -2px rgba(91,33,182,0.10)',
        md:      '0 4px 6px -1px rgba(91,33,182,0.14), 0 2px 4px -2px rgba(91,33,182,0.10)',
        lg:      '0 20px 25px -5px rgba(91,33,182,0.18), 0 8px 10px -6px rgba(91,33,182,0.10)',
        xl:      '0 25px 50px -12px rgba(91,33,182,0.22)',
        'violet': '0 8px 32px -8px rgba(124,58,237,0.45)',
        'violet-lg': '0 20px 48px -12px rgba(124,58,237,0.50)',
        'cyan': '0 8px 32px -8px rgba(6,182,212,0.40)',
      },

      spacing: {
        '4.5': '1.125rem',
        '18':  '4.5rem',
        gutter: '1rem',
        'sidebar': '268px',
      },

      animation: {
        'slide-in': 'slideIn 150ms ease-out',
        'fade-in':  'fadeIn 150ms ease-out',
        'pop-in':   'popIn 200ms ease-out',
        'shimmer':  'shimmer 2s linear infinite',
        'float':    'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },

      keyframes: {
        slideIn: { '0%': { transform: 'translateX(-100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        fadeIn:  { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        popIn:   { '0%': { opacity: '0', transform: 'scale(0.97) translateY(4px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float:   { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,58,237,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(124,58,237,0)' },
        },
      },

      backgroundImage: {
        'aurora': 'linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #06B6D4 100%)',
        'aurora-soft': 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.08) 100%)',
        'sidebar-gradient': 'linear-gradient(160deg, #0D0921 0%, #130F3A 55%, #0F1845 100%)',
        'card-hover': 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(6,182,212,0.03) 100%)',
      },

      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
      },
    },
  },
  plugins: [],
};

export default config;

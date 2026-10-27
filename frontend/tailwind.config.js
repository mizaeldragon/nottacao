/** @type {import('tailwindcss').Config} */

// Toda cor que muda entre claro e escuro é uma variável CSS definida em src/index.css.
// A variável guarda os canais "R G B" (sem rgb()) para o <alpha-value> do Tailwind
// continuar funcionando em classes como bg-orange-500/15 e bg-gray-700/50.
const cor = (nome) => `rgb(var(--c-${nome}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // ── Escala do app (telas internas) ───────────────────────────────
        // O papel de cada tom é o mesmo nos dois temas:
        // 900 = fundo da página · 800 = card · 700 = borda/input/botão secundário
        // 600 = borda de input · 500 = texto apagado · 400 = legenda
        // 300 = texto secundário · 100 = texto do corpo · 50 = título forte
        // (no claro a escala fica invertida; no escuro segue a ordem natural)
        gray: {
          50: cor('gray-50'),
          100: cor('gray-100'),
          200: cor('gray-200'),
          300: cor('gray-300'),
          400: cor('gray-400'),
          500: cor('gray-500'),
          600: cor('gray-600'),
          700: cor('gray-700'),
          800: cor('gray-800'),
          900: cor('gray-900'),
        },
        // ── Escala das páginas públicas (landing, login, termos) ─────────
        // 950 é o fundo escuro dessas telas e continua escuro nos dois temas.
        slate: {
          50: cor('slate-50'),
          100: cor('slate-100'),
          200: cor('slate-200'),
          300: cor('slate-300'),
          400: cor('slate-400'),
          500: cor('slate-500'),
          600: cor('slate-600'),
          700: cor('slate-700'),
          800: cor('slate-800'),
          900: cor('slate-900'),
          950: cor('slate-950'),
        },
        // Card das páginas públicas (era bg-white fixo) e fundo da landing.
        superficie: cor('superficie'),
        pagina: cor('pagina'),

        // ── Acento azul (herdou o nome "orange" do tema antigo) ──────────
        // Fundos sólidos viram degradê em index.css.
        orange: {
          400: cor('orange-400'),
          500: cor('orange-500'),
          600: cor('orange-600'),
        },

        // ── Cores de significado ─────────────────────────────────────────
        // No claro são escurecidas para ter contraste sobre o branco;
        // no escuro voltam a ser claras para contrastar com o fundo.
        green: { 400: cor('green-400') },
        red: { 400: cor('red-400') },
        emerald: { 400: cor('emerald-400') },
        sky: { 400: cor('sky-400') },
        rose: { 400: cor('rose-400') },
        yellow: { 300: cor('yellow-300') },
        amber: {
          400: cor('amber-400'),
          500: cor('amber-500'),
          600: cor('amber-600'),
        },
        violet: {
          400: cor('violet-400'),
          500: cor('violet-500'),
        },
        indigo: {
          500: cor('indigo-500'),
          600: cor('indigo-600'),
        },
      },
    },
  },
  plugins: [],
};

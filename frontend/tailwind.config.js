/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Tema CLARO: a escala de cinza foi invertida.
        // Antes (escuro): 900 = fundo escuro, 100/50 = texto claro.
        // Agora (claro):  900 = branco (fundo), 100/50 = quase preto (texto).
        gray: {
          50: '#0f172a', // texto/título mais forte (era o mais claro)
          100: '#111827', // texto padrão do corpo
          200: '#1f2937',
          300: '#374151', // texto secundário
          400: '#6b7280', // texto suave / legendas
          500: '#9ca3af',
          600: '#d1d5db', // bordas de input
          700: '#e5e7eb', // bordas, fundos de input/botão secundário, linhas
          800: '#f8fafc', // cards (quase branco)
          900: '#ffffff', // fundo da página (branco)
        },
        // Acento azul (antes laranja). Fundos sólidos viram degradê via index.css.
        orange: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        // Acentos escurecidos para terem contraste sobre o branco.
        green: { 400: '#16a34a' },
        red: { 400: '#dc2626' },
        emerald: { 400: '#059669' },
        sky: { 400: '#0284c7' },
        rose: { 400: '#e11d48' },
        yellow: { 300: '#a16207' },
      },
    },
  },
  plugins: [],
};

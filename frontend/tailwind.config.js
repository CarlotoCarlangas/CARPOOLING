/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Marca dinámica por MODO (variable CSS --brand, definida en index.css):
        //   Pasajero = azul #2563EB · Chofer = verde esmeralda #059669.
        // Toda la app usa bg-taco/text-taco/marca, así que al cambiar la
        // variable según el modo, la interfaz completa se re-tiñe sin tocar la
        // disposición de nada. "taco" se mantiene como alias por compatibilidad.
        taco: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
        },
        marca: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
        },
        // Ámbar = acción sobre el mapa (pines, ruta, auto). Fijo en ambos modos.
        ambar: { DEFAULT: "#F59E0B", dark: "#D97706" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        panel: "0 -4px 16px rgba(15,23,42,0.08)",
        flotante: "0 4px 14px rgba(15,23,42,0.12)",
      },
    },
  },
  plugins: [],
};

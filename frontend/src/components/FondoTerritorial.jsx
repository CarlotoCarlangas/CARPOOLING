/**
 * Fondo territorial sutil: grilla de mapa punteada + rutas + pines, muy
 * tenue, detrás de todo el contenido. Refuerza la propuesta de valor (lo
 * territorial) en el "espacio claro" de cada pantalla sin competir con el
 * contenido ni con los mapas reales (que van opacos y lo tapan).
 *
 * Es fijo, no interactivo (pointer-events:none) y de z bajo; el contenido
 * de la app va con z superior (ver Layout en App.jsx).
 */
export default function FondoTerritorial() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 820"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="fondo-mapdots" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill="#64748b" />
          </pattern>
        </defs>
        <rect width="1200" height="820" fill="url(#fondo-mapdots)" opacity="0.06" />
        <g fill="none" strokeLinecap="round" strokeDasharray="2 15">
          <path d="M-40 640 C 250 540 330 310 630 310 S 1010 190 1260 250" stroke="#2563eb" strokeWidth="5" opacity="0.11" />
          <path d="M-40 180 C 220 250 400 520 720 520 S 1060 660 1260 580" stroke="#059669" strokeWidth="5" opacity="0.10" />
        </g>
        <g fill="#2563eb" opacity="0.12">
          <path transform="translate(628,286) scale(.85)" d="M0 0 C11 0 18 8 18 17 C18 28 0 44 0 44 C0 44 -18 28 -18 17 C-18 8 -11 0 0 0Z" />
          <path transform="translate(150,612) scale(.7)" d="M0 0 C11 0 18 8 18 17 C18 28 0 44 0 44 C0 44 -18 28 -18 17 C-18 8 -11 0 0 0Z" />
          <path transform="translate(1040,214) scale(.7)" d="M0 0 C11 0 18 8 18 17 C18 28 0 44 0 44 C0 44 -18 28 -18 17 C-18 8 -11 0 0 0Z" />
        </g>
      </svg>
    </div>
  );
}

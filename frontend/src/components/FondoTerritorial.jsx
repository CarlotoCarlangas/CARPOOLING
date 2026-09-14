/**
 * Fondo territorial sutil: grilla de mapa punteada + rutas + pines, tenue,
 * detrás de todo el contenido. Refuerza la propuesta de valor (lo territorial)
 * en el "espacio claro" de cada pantalla, sin competir con el contenido ni con
 * los mapas reales (que van opacos y lo tapan).
 *
 * La composición es VERTICAL (pensada para celular): las rutas bajan por la
 * pantalla y los pines se reparten de arriba a abajo, así se percibe aunque el
 * viewport sea angosto. Es fijo, no interactivo, y de z bajo (el contenido va
 * con z superior — ver Layout en App.jsx).
 */
const PIN = "M0 0 C11 0 18 8 18 17 C18 28 0 44 0 44 C0 44 -18 28 -18 17 C-18 8 -11 0 0 0Z";

export default function FondoTerritorial() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 420 860"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="fondo-mapdots" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.8" fill="#64748b" />
          </pattern>
        </defs>
        <rect width="420" height="860" fill="url(#fondo-mapdots)" opacity="0.13" />

        {/* rutas que bajan por la pantalla */}
        <g fill="none" strokeLinecap="round" strokeDasharray="2 14">
          <path d="M-30 90 C 150 200 90 360 250 440 S 300 680 470 770"
                stroke="#2563eb" strokeWidth="5" opacity="0.18" />
          <path d="M450 40 C 300 170 340 340 170 430 S 120 650 -30 740"
                stroke="#059669" strokeWidth="5" opacity="0.16" />
        </g>

        {/* pines repartidos de arriba a abajo */}
        <g fill="#2563eb" opacity="0.17">
          <path transform="translate(356,120) scale(.8)" d={PIN} />
          <path transform="translate(250,432) scale(.95)" d={PIN} />
          <path transform="translate(70,300) scale(.7)" d={PIN} />
          <path transform="translate(150,628) scale(.8)" d={PIN} />
          <path transform="translate(320,770) scale(.72)" d={PIN} />
        </g>
      </svg>
    </div>
  );
}

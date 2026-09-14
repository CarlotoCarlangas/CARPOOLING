/**
 * Copi — la mascota de la app: el pin del mapa (territorial) con su termo
 * mañanero. Aparece chico y en momentos puntuales (estados vacíos,
 * confirmaciones), nunca sobre el mapa. Colores fijos (azul pin / verde
 * termo) para que sea reconocible en cualquier modo.
 *
 * pose: "normal" | "feliz" | "duerme"
 */
const AZUL = "#2563EB";
const AZUL_DEEP = "#1E3A8A";
const VERDE = "#059669";
const VERDE_DEEP = "#064E3B";
const VERDE_BAND = "#047857";
const OJO = "#22303f";

export default function Copi({ pose = "normal", size = 104, className = "" }) {
  return (
    <svg
      viewBox="0 0 150 140"
      width={size}
      height={(size * 140) / 150}
      role="img"
      aria-label="Copi, la mascota"
      className={className}
    >
      {pose === "duerme" && (
        <>
          <text x="104" y="40" className="copi-z1" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="800" fill="#94a3b8">z</text>
          <text x="92" y="52" className="copi-z2" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="800" fill="#94a3b8">z</text>
        </>
      )}

      {pose === "feliz" && (
        <g fill="none" stroke={VERDE} strokeWidth="3" strokeLinecap="round">
          <path className="copi-w1" d="M120 40 q-5-6 0-12" />
          <path className="copi-w2" d="M128 38 q-5-6 0-12" />
        </g>
      )}
      {pose === "normal" && (
        <g fill="none" stroke={VERDE} strokeWidth="3" strokeLinecap="round">
          <path className="copi-w1" d="M118 58 q-5-6 0-12 q5-6 0-12" />
          <path className="copi-w2" d="M126 54 q-5-6 0-12 q5-6 0-12" />
          <path className="copi-w3" d="M110 54 q-5-6 0-12 q5-6 0-12" />
        </g>
      )}

      <ellipse cx="62" cy="128" rx="30" ry="6" fill="rgba(20,40,90,.12)" />

      <g className="copi-bob">
        {/* patas */}
        <path d="M54 100 L50 116" stroke={AZUL_DEEP} strokeWidth="6" strokeLinecap="round" />
        <path d="M70 100 L74 116" stroke={AZUL_DEEP} strokeWidth="6" strokeLinecap="round" />

        {/* cuerpo pin */}
        <path d="M62 12 C84 12 96 28 96 46 C96 72 68 92 62 104 C56 92 28 72 28 46 C28 28 40 12 62 12Z" fill={AZUL} />
        <circle cx="62" cy="44" r="21" fill="#fff" />

        {pose === "duerme" ? (
          <>
            <path d="M51 44 q5 4 10 0" stroke={OJO} strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M63 44 q5 4 10 0" stroke={OJO} strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M57 53 q5 3 10 0" stroke={AZUL} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : pose === "feliz" ? (
          <>
            <path d="M52 42 q4-5 8 0" stroke={OJO} strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M64 42 q4-5 8 0" stroke={OJO} strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M54 50 q8 8 16 0" stroke={AZUL} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <g className="copi-eye"><circle cx="54" cy="42" r="3.9" fill={OJO} /><circle cx="55.3" cy="40.6" r="1.3" fill="#fff" /></g>
            <g className="copi-eye"><circle cx="70" cy="42" r="3.9" fill={OJO} /><circle cx="71.3" cy="40.6" r="1.3" fill="#fff" /></g>
            <path d="M54 50 q8 7 16 0" stroke={AZUL} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}
        <circle cx="46" cy="49" r="3.2" fill="#f2a0a0" opacity=".6" />
        <circle cx="78" cy="49" r="3.2" fill="#f2a0a0" opacity=".6" />

        {/* termo */}
        {pose === "duerme" ? (
          <g>
            <rect x="103" y="70" width="16" height="9" rx="3" fill={VERDE_DEEP} />
            <path d="M102 79 h18 v22 q0 5-5 5 h-8 q-5 0-5-5Z" fill={VERDE} />
          </g>
        ) : pose === "feliz" ? (
          <g>
            <rect x="112" y="44" width="20" height="11" rx="4" fill={VERDE_DEEP} />
            <path d="M111 55 h22 v30 q0 7-7 7 h-8 q-7 0-7-7Z" fill={VERDE} />
            <rect x="111" y="66" width="22" height="6" fill={VERDE_BAND} />
            <path d="M92 72 q10-6 17 1" stroke={AZUL} strokeWidth="8" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <rect x="112" y="60" width="22" height="12" rx="4" fill={VERDE_DEEP} />
            <path d="M111 72 h24 v34 q0 8-8 8 h-8 q-8 0-8-8Z" fill={VERDE} />
            <rect x="111" y="84" width="24" height="7" fill={VERDE_BAND} />
            <path d="M96 88 q12 0 16 10" stroke={AZUL} strokeWidth="9" fill="none" strokeLinecap="round" />
            <circle cx="112" cy="98" r="6.5" fill={AZUL} />
          </g>
        )}
      </g>
    </svg>
  );
}

import { useState } from "react";

/**
 * Modal para que el conductor rechace una solicitud eligiendo un MOTIVO:
 * respuestas rápidas predefinidas + una opción "Otro" con texto libre.
 * El motivo se le muestra al pasajero en "Mis reservas", así sabe por qué
 * no fue aceptado (minimización: motivos neutros, sin exponer de más).
 *
 * Reutilizable: se usa en la bandeja de Solicitudes y en "Mis Viajes".
 */
const MOTIVOS_RAPIDOS = [
  "Ya no tengo cupos disponibles",
  "No me queda de paso ese punto de subida",
  "El horario no me calza para este viaje",
  "Prefiero no concretar este viaje",
];

export default function ModalRechazo({ nombrePasajero, onCancelar, onConfirmar, enviando }) {
  const [seleccion, setSeleccion] = useState(MOTIVOS_RAPIDOS[0]);
  const [otro, setOtro] = useState("");

  const esOtro = seleccion === "__otro__";
  const motivoFinal = esOtro ? otro.trim() : seleccion;
  const puedeConfirmar = motivoFinal.length > 0 && !enviando;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90%] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Rechazar solicitud</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-4">
          {nombrePasajero
            ? `Cuéntale a ${nombrePasajero} por qué no puedes llevarlo.`
            : "Elige el motivo. Se le mostrará al pasajero."}
        </p>

        <div className="space-y-2">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSeleccion(m)}
              className={`w-full text-left text-sm rounded-xl border-2 px-3 py-2.5 transition ${
                seleccion === m ? "border-taco bg-orange-50 font-semibold text-taco" : "border-gray-200 text-gray-700"
              }`}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeleccion("__otro__")}
            className={`w-full text-left text-sm rounded-xl border-2 px-3 py-2.5 transition ${
              esOtro ? "border-taco bg-orange-50 font-semibold text-taco" : "border-gray-200 text-gray-700"
            }`}
          >
            Otro motivo…
          </button>
        </div>

        {esOtro && (
          <textarea
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            placeholder="Escribe el motivo (lo verá el pasajero)"
            rows={3}
            maxLength={300}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-2"
            autoFocus
          />
        )}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(motivoFinal)}
            disabled={!puedeConfirmar}
            className="flex-[1.4] bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {enviando ? "Enviando…" : "Rechazar y avisar"}
          </button>
        </div>
      </div>
    </div>
  );
}

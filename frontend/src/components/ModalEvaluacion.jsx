import { useState } from "react";

/**
 * Modal de evaluación post-viaje (Módulo 7): estrellas (1-5) + comentario
 * opcional. Lo usan tanto el pasajero (evalúa al conductor) como el
 * conductor (evalúa al pasajero) — de ahí que reciba el nombre del evaluado.
 */
export default function ModalEvaluacion({ nombreEvaluado, onCancelar, onConfirmar, enviando }) {
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");

  const puede = estrellas >= 1 && !enviando;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        <h2 className="text-lg font-bold text-gray-900">Evalúa tu viaje</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-4">
          ¿Cómo fue tu experiencia con <b>{nombreEvaluado}</b>?
        </p>

        <div className="flex justify-center gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEstrellas(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="text-4xl leading-none transition"
              aria-label={`${n} estrellas`}
            >
              <span className={(hover || estrellas) >= n ? "text-amber-400" : "text-gray-300"}>★</span>
            </button>
          ))}
        </div>

        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Deja un comentario (opcional)"
          rows={3}
          maxLength={500}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
        />

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={() => onConfirmar({ estrellas, comentario: comentario.trim() || null })}
            disabled={!puede}
            className="flex-[1.4] bg-taco text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {enviando ? "Enviando…" : "Enviar evaluación"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import ModalEvaluacion from "./ModalEvaluacion";

/**
 * Botón + modal de evaluación para un viaje puntual (una solicitud). Sirve
 * para AMBOS lados: el backend sabe a quién evalúa el usuario actual (al otro
 * participante). Solo aparece si el viaje ya se realizó (viaje_finalizado).
 */
export default function BotonEvaluar({ solicitudId, finalizado }) {
  const { token } = useAuth();
  const [estado, setEstado] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!finalizado) return;
    let activo = true;
    api.estadoEvaluacion(solicitudId, token).then((e) => activo && setEstado(e)).catch(() => {});
    return () => {
      activo = false;
    };
  }, [solicitudId, finalizado, token]);

  if (!finalizado || !estado) return null;

  if (estado.ya_evaluado) {
    return (
      <p className="mt-3 text-sm text-gray-500 flex items-center gap-1">
        <span className="text-amber-400">{"★".repeat(estado.estrellas_previas || 0)}</span>
        Ya evaluaste a {estado.otra_persona_nombre}
      </p>
    );
  }

  const confirmar = async ({ estrellas, comentario }) => {
    setEnviando(true);
    try {
      const nuevo = await api.evaluarViaje(solicitudId, { estrellas, comentario }, token);
      setEstado(nuevo);
      setAbierto(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="mt-3 w-full bg-amber-400 text-amber-950 rounded-lg py-2 text-sm font-bold"
      >
        ⭐ Evaluar a {estado.otra_persona_nombre}
      </button>
      {abierto && (
        <ModalEvaluacion
          nombreEvaluado={estado.otra_persona_nombre}
          enviando={enviando}
          onCancelar={() => setAbierto(false)}
          onConfirmar={confirmar}
        />
      )}
    </>
  );
}

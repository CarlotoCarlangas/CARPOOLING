import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const DOC_LABELS = {
  licencia: "Licencia de conducir",
  revision_tecnica: "Revisión técnica",
  soap: "SOAP (seguro obligatorio)",
};

export default function Perfil() {
  const { usuario, token, refrescarPerfil } = useAuth();
  const [vehiculo, setVehiculo] = useState(null);
  const [datosVehiculo, setDatosVehiculo] = useState({ patente: "", marca: "", modelo: "", color: "" });
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState("");

  const cargarVehiculo = async () => {
    if (!usuario?.es_conductor) return;
    try {
      const doc = await api.obtenerVehiculo(token);
      setVehiculo(doc);
      setDatosVehiculo({
        patente: doc.patente || "",
        marca: doc.marca || "",
        modelo: doc.modelo || "",
        color: doc.color || "",
      });
    } catch (err) {
      setMensaje(err.message);
    }
  };

  useEffect(() => {
    cargarVehiculo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const guardarVehiculo = async (e) => {
    e.preventDefault();
    setMensaje("");
    try {
      await api.actualizarVehiculo(datosVehiculo, token);
      await cargarVehiculo();
      setMensaje("Datos del vehículo guardados");
    } catch (err) {
      setMensaje(err.message);
    }
  };

  const subirDocumento = async (tipo, archivo) => {
    if (!archivo) return;
    setSubiendo(tipo);
    setMensaje("");
    try {
      await api.subirDocumento(tipo, archivo, token);
      await cargarVehiculo();
      setMensaje(`${DOC_LABELS[tipo]} subido correctamente`);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setSubiendo("");
    }
  };

  const subirFoto = async (archivo) => {
    if (!archivo) return;
    try {
      await api.subirFoto(archivo, token);
      await refrescarPerfil();
      setMensaje("Foto de perfil actualizada");
    } catch (err) {
      setMensaje(err.message);
    }
  };

  if (!usuario) return null;

  const documentosCompletos =
    vehiculo?.licencia_conducir_url && vehiculo?.revision_tecnica_url && vehiculo?.soap_url;

  return (
    <div className="max-w-2xl mx-auto p-6 my-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-4">Mi perfil</h1>
        <div className="flex items-center gap-4 mb-4">
          <img
            src={
              usuario.foto_url
                ? `${import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`}${usuario.foto_url}`
                : "https://placehold.co/80x80?text=Foto"
            }
            alt="Foto de perfil"
            className="w-20 h-20 rounded-full object-cover border"
          />
          <label className="text-sm text-taco underline cursor-pointer">
            Cambiar foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => subirFoto(e.target.files[0])}
            />
          </label>
        </div>
        <p><b>Nombre:</b> {usuario.nombre}</p>
        <p><b>RUT:</b> {usuario.rut}</p>
        <p><b>Teléfono:</b> {usuario.telefono}</p>
        <p><b>Email:</b> {usuario.email}</p>
        <p><b>Roles:</b> {[usuario.es_conductor && "Conductor", usuario.es_pasajero && "Pasajero"].filter(Boolean).join(", ")}</p>
      </div>

      {usuario.es_conductor && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-2">Datos del vehículo</h2>
          <p className="text-sm text-gray-600 mb-4">
            Necesitas subir tu licencia de conducir, revisión técnica y SOAP antes de poder
            publicar rutas.
          </p>

          <form onSubmit={guardarVehiculo} className="grid grid-cols-2 gap-3 mb-4">
            <input
              placeholder="Patente"
              value={datosVehiculo.patente}
              onChange={(e) => setDatosVehiculo((p) => ({ ...p, patente: e.target.value }))}
              className="border rounded-lg px-3 py-2"
            />
            <input
              placeholder="Marca"
              value={datosVehiculo.marca}
              onChange={(e) => setDatosVehiculo((p) => ({ ...p, marca: e.target.value }))}
              className="border rounded-lg px-3 py-2"
            />
            <input
              placeholder="Modelo"
              value={datosVehiculo.modelo}
              onChange={(e) => setDatosVehiculo((p) => ({ ...p, modelo: e.target.value }))}
              className="border rounded-lg px-3 py-2"
            />
            <input
              placeholder="Color"
              value={datosVehiculo.color}
              onChange={(e) => setDatosVehiculo((p) => ({ ...p, color: e.target.value }))}
              className="border rounded-lg px-3 py-2"
            />
            <button type="submit" className="col-span-2 bg-gray-800 text-white py-2 rounded-lg">
              Guardar datos del vehículo
            </button>
          </form>

          <div className="space-y-3">
            {Object.entries(DOC_LABELS).map(([tipo, label]) => {
              const subido = vehiculo?.[
                tipo === "licencia"
                  ? "licencia_conducir_url"
                  : tipo === "revision_tecnica"
                  ? "revision_tecnica_url"
                  : "soap_url"
              ];
              return (
                <div key={tipo} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="text-sm">
                    {subido ? "✅" : "⬜"} {label}
                  </span>
                  <label className="text-sm text-taco underline cursor-pointer">
                    {subiendo === tipo ? "Subiendo..." : subido ? "Reemplazar" : "Subir"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => subirDocumento(tipo, e.target.files[0])}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <p className="text-sm mt-4">
            {documentosCompletos ? (
              <span className="text-green-700">✓ Ya puedes publicar rutas.</span>
            ) : (
              <span className="text-amber-700">Faltan documentos por subir para poder publicar rutas.</span>
            )}
          </p>
        </div>
      )}

      {mensaje && <p className="text-sm text-gray-700">{mensaje}</p>}
    </div>
  );
}

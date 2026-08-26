import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validarRut, formatearRut } from "../services/rut";

const ESTADO_INICIAL = {
  rut: "",
  nombre: "",
  telefono: "",
  email: "",
  password: "",
  es_conductor: false,
  es_pasajero: false,
  genero: "",
  modo_solo_mujeres: false,
  acepta_terminos: false,
};

export default function Registro() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [errorRut, setErrorRut] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const actualizar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const alCambiarRut = (valor) => {
    actualizar("rut", valor);
    if (valor.length > 3) {
      setErrorRut(validarRut(valor) ? "" : "RUT inválido");
    } else {
      setErrorRut("");
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");

    if (!validarRut(form.rut)) {
      setErrorRut("RUT inválido");
      return;
    }
    if (!form.es_conductor && !form.es_pasajero) {
      setError("Selecciona al menos un rol: conductor o pasajero");
      return;
    }
    if (!form.acepta_terminos) {
      setError("Debes aceptar los Términos y la Política de Privacidad");
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await registrar({ ...form, rut: formatearRut(form.rut) });
      navigate(respuesta.usuario.es_conductor ? "/perfil" : "/rutas");
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-sm my-6">
      <h1 className="text-2xl font-bold mb-4">Crear cuenta</h1>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">RUT</label>
          <input
            type="text"
            placeholder="12.345.678-5"
            value={form.rut}
            onChange={(e) => alCambiarRut(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
          {errorRut && <p className="text-red-600 text-xs mt-1">{errorRut}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre completo</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => actualizar("nombre", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            type="tel"
            placeholder="+56 9 1234 5678"
            value={form.telefono}
            onChange={(e) => actualizar("telefono", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => actualizar("email", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            minLength={6}
            value={form.password}
            onChange={(e) => actualizar("password", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <p className="text-sm font-medium mb-1">¿Cómo quieres usar TACO?</p>
          <label className="flex items-center gap-2 text-sm mb-1">
            <input
              type="checkbox"
              checked={form.es_conductor}
              onChange={(e) => actualizar("es_conductor", e.target.checked)}
            />
            Quiero ofrecer viajes (conductor)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.es_pasajero}
              onChange={(e) => actualizar("es_pasajero", e.target.checked)}
            />
            Quiero buscar viajes (pasajero)
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Género (opcional — solo si quieres activar "modo solo mujeres")
          </label>
          <select
            value={form.genero}
            onChange={(e) => actualizar("genero", e.target.value || null)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Prefiero no decir</option>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {form.genero === "femenino" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.modo_solo_mujeres}
              onChange={(e) => actualizar("modo_solo_mujeres", e.target.checked)}
            />
            Activar modo solo mujeres (solo veré/aceptaré viajes marcados así)
          </label>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.acepta_terminos}
            onChange={(e) => actualizar("acepta_terminos", e.target.checked)}
            className="mt-1"
          />
          <span>
            Acepto los{" "}
            <Link to="/terminos" target="_blank" className="text-taco underline">
              Términos y la Política de Privacidad
            </Link>{" "}
            de TACO, incluyendo el tratamiento de mis datos personales según lo descrito.
          </span>
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-taco text-white py-2 rounded-lg font-medium hover:bg-taco-dark disabled:opacity-50"
        >
          {enviando ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="text-sm mt-4 text-center">
        ¿Ya tienes cuenta? <Link to="/login" className="text-taco underline">Inicia sesión</Link>
      </p>
    </div>
  );
}

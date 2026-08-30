import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const [rutOEmail, setRutOEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const respuesta = await iniciarSesion({ rut_o_email: rutOEmail, password });
      navigate(respuesta.usuario.es_conductor ? "/perfil" : "/buscar");
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-sm my-6">
      <h1 className="text-2xl font-bold mb-4">Iniciar sesión</h1>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">RUT o email</label>
          <input
            type="text"
            value={rutOEmail}
            onChange={(e) => setRutOEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-taco text-white py-2 rounded-lg font-medium hover:bg-taco-dark disabled:opacity-50"
        >
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p className="text-sm mt-4 text-center">
        ¿No tienes cuenta? <Link to="/registro" className="text-taco underline">Crea una</Link>
      </p>
    </div>
  );
}

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import RutaProtegida from "./components/RutaProtegida";
import Inicio from "./pages/Inicio";
import Registro from "./pages/Registro";
import Login from "./pages/Login";
import Terminos from "./pages/Terminos";
import Perfil from "./pages/Perfil";
import CrearRuta from "./pages/CrearRuta";
import DetalleRuta from "./pages/DetalleRuta";
import Buscar from "./pages/Buscar";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* h-full (no h-dvh): index.css ya encadena html/body/#root a
            height:100%, que es más compatible en navegadores de Android
            más viejos que la unidad dvh — usamos el mismo mecanismo que
            ya prueba funcionar en el resto de la app. */}
        <div className="h-full flex flex-col overflow-hidden">
          <Navbar />
          {/* flex-1 + min-h-0 le da a cada página exactamente el alto que
              sobra bajo el Navbar. La mayoría de las páginas no lo usan
              (su contenido es más corto y este contenedor solo hace de
              scroll normal), pero Buscar.jsx lo aprovecha para el mapa a
              pantalla completa estilo Uber. */}
          <main className="flex-1 min-h-0 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/login" element={<Login />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/buscar" element={<Buscar />} />
              <Route path="/rutas/:id" element={<DetalleRuta />} />
              <Route
                path="/perfil"
                element={
                  <RutaProtegida>
                    <Perfil />
                  </RutaProtegida>
                }
              />
              <Route
                path="/crear-ruta"
                element={
                  <RutaProtegida>
                    <CrearRuta />
                  </RutaProtegida>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

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
import Rutas from "./pages/Rutas";
import DetalleRuta from "./pages/DetalleRuta";
import Buscar from "./pages/Buscar";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/rutas" element={<Rutas />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

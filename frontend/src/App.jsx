import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ViajeProvider } from "./context/ViajeContext";
import { ModoProvider, useModo } from "./context/ModoContext";
import Navbar from "./components/Navbar";
import FondoTerritorial from "./components/FondoTerritorial";
import RutaProtegida from "./components/RutaProtegida";
import Inicio from "./pages/Inicio";
import Registro from "./pages/Registro";
import Login from "./pages/Login";
import Terminos from "./pages/Terminos";
import Perfil from "./pages/Perfil";
import CrearRuta from "./pages/CrearRuta";
import DetalleRuta from "./pages/DetalleRuta";
import Buscar from "./pages/Buscar";
import MisReservas from "./pages/MisReservas";
import Solicitudes from "./pages/Solicitudes";
import Chat from "./pages/Chat";
import ViajeEnVivo from "./pages/ViajeEnVivo";
import MiViaje from "./pages/MiViaje";
import Admin from "./pages/Admin";
import MisViajes from "./pages/MisViajes";
import EditarRuta from "./pages/EditarRuta";
import SolicitudesRuta from "./pages/SolicitudesRuta";
import Bloqueados from "./pages/Bloqueados";

// El contenedor raíz lleva data-modo (chofer|pasajero): eso cambia la variable
// de color de marca en index.css, así toda la interfaz se re-tiñe sin mover
// nada de lugar. La barra (Navbar) va abajo y se auto-oculta en pantallas
// enfocadas (chat, viaje en vivo, auth).
function Layout({ children }) {
  const { modo } = useModo();
  return (
    <div data-modo={modo} className="h-full flex flex-col overflow-hidden">
      <FondoTerritorial />
      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto">{children}</main>
      <Navbar />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ViajeProvider>
        <ModoProvider>
          <BrowserRouter>
            <Layout>
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
                <Route
                  path="/mis-reservas"
                  element={
                    <RutaProtegida>
                      <MisReservas />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/solicitudes"
                  element={
                    <RutaProtegida>
                      <Solicitudes />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/mis-viajes"
                  element={
                    <RutaProtegida>
                      <MisViajes />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/mis-viajes/:id/editar"
                  element={
                    <RutaProtegida>
                      <EditarRuta />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/mis-viajes/:id/solicitudes"
                  element={
                    <RutaProtegida>
                      <SolicitudesRuta />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/bloqueados"
                  element={
                    <RutaProtegida>
                      <Bloqueados />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/chat/:solicitudId"
                  element={
                    <RutaProtegida>
                      <Chat />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/viaje/:solicitudId"
                  element={
                    <RutaProtegida>
                      <ViajeEnVivo />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/mi-viaje/:rutaId"
                  element={
                    <RutaProtegida>
                      <MiViaje />
                    </RutaProtegida>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RutaProtegida>
                      <Admin />
                    </RutaProtegida>
                  }
                />
              </Routes>
            </Layout>
          </BrowserRouter>
        </ModoProvider>
      </ViajeProvider>
    </AuthProvider>
  );
}

export default App;

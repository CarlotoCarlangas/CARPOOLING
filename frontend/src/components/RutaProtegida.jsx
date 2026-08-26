import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RutaProtegida({ children }) {
  const { estaAutenticado } = useAuth();
  if (!estaAutenticado) return <Navigate to="/login" replace />;
  return children;
}

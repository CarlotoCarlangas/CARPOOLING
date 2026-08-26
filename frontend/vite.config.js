import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// host: true permite que otros dispositivos en la misma red Wi-Fi
// (celular, otro notebook) accedan a http://<tu-ip-local>:5173
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})

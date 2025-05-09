// vite.config.js
export default {
  server: {
    host: true,        // équivalent à 0.0.0.0
    port: 8080,        // ou un autre port de ton choix
    strictPort: false, // cherche un port dispo si 5173 est pris
  }
}

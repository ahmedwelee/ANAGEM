// Dev only: forwards /api to the backend so the browser never makes cross-origin calls.
// changeOrigin stays false on purpose: the backend then sees Host and Origin agree (same origin) and skips its CORS check.
// Override the target with:  API_TARGET=http://localhost:8181 npm start
export default {
  '/api': { target: process.env.API_TARGET || 'http://localhost:8080', secure: false, changeOrigin: false },
};

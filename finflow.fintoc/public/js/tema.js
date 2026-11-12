/* Modo claro/oscuro de Bootstrap (data-bs-theme). Se aplica antes de dibujar para que no parpadee. */
(function () {
  var t = null;
  try { t = localStorage.getItem('finflow-tema'); } catch (e) { /* sin almacenamiento */ }
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-bs-theme', t);
})();

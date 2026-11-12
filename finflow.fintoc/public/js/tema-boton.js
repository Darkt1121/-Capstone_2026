/* Botón de modo claro/oscuro (abajo a la izquierda). */
(function () {
  var btn = document.getElementById('tema');
  var sol = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>';
  var luna = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
  function pintar() {
    var oscuro = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    btn.innerHTML = oscuro ? sol : luna;
    btn.title = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    btn.setAttribute('aria-label', btn.title);
  }
  btn.addEventListener('click', function () {
    var nuevo = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', nuevo);
    try { localStorage.setItem('finflow-tema', nuevo); } catch (e) { /* sin almacenamiento */ }
    pintar();
  });
  pintar();
})();

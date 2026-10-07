// Gráfico del gasto diario, basado en el ejemplo oficial "Dashboard" de Bootstrap (Chart.js)
(() => {
  'use strict'

  const datos = JSON.parse(document.getElementById('datos-grafico').textContent)
  const estilos = getComputedStyle(document.documentElement)
  const color = estilos.getPropertyValue('--bs-primary').trim()
  const pesos = valor => '$' + valor.toLocaleString('es-CL')

  Chart.defaults.color = estilos.getPropertyValue('--bs-secondary-color').trim()
  Chart.defaults.borderColor = estilos.getPropertyValue('--bs-border-color-translucent').trim()

  new Chart(document.getElementById('grafico'), {
    type: 'line',
    data: {
      labels: datos.dias,
      datasets: [{
        data: datos.montos,
        lineTension: 0,
        backgroundColor: 'transparent',
        borderColor: color,
        borderWidth: 3,
        pointBackgroundColor: color
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: items => 'Día ' + items[0].label, label: item => pesos(item.parsed.y) } }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: pesos } } }
    }
  })
})()

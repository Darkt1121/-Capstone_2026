/* Importar cartolas (CSV, Excel, PDF con clave) y conexión con Fintoc. */
import { FINTOC, GOOGLE } from './estado.js';
import { AI } from './marco.js';
import { render } from './render.js';

// importar
export function bankShort(b) { return { 'BancoEstado CuentaRUT': 'CuentaRUT', 'Otro banco': 'Otra cuenta' }[b] || b; }
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    if (/\.xlsx?$/i.test(file.name)) {
      r.onload = () => { try { const wb = window.XLSX.read(r.result, { type: 'array' }); resolve(window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';' })); } catch (e) { reject(new Error('No pudimos leer el Excel.')); } };
      r.readAsArrayBuffer(file);
    } else { r.onload = () => resolve(r.result); r.readAsText(file, 'utf-8'); }
    r.onerror = () => reject(new Error('No pudimos leer el archivo.'));
  });
}
// Cartolas en PDF: se leen en el navegador con pdf.js, que se descarga solo cuando hace falta.
// La clave del archivo se usa para abrirlo y no se guarda ni se envía al servidor.
export const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
export const PDF = { file: null, error: '' };
// Versión de la política de privacidad. Si el texto cambia, se cambia esta fecha y todos deben aceptar de nuevo.
export const POLITICA = '2026-11-12';
document.getElementById('politica-version').textContent = POLITICA.split('-').reverse().join('/');
export async function readPdf(file, clave) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js'; s.onload = resolve;
      s.onerror = () => reject(new Error('No pudimos cargar el lector de PDF. Revisa tu conexión.'));
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  }
  let doc;
  try { doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), password: clave }).promise; }
  catch (e) { if (e.name === 'PasswordException') throw e; throw new Error('No pudimos leer el PDF.'); }
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const items = (await (await doc.getPage(n)).getTextContent()).items.filter((i) => i.str.trim());
    // Se arman las líneas: de arriba hacia abajo y, dentro de cada línea, de izquierda a derecha.
    items.sort((a, b) => b.transform[5] - a.transform[5]);
    const lineas = [];
    for (const it of items) {
      const ultima = lineas[lineas.length - 1];
      if (ultima && Math.abs(ultima.y - it.transform[5]) <= 3) ultima.items.push(it); else lineas.push({ y: it.transform[5], items: [it] });
    }
    paginas.push(lineas.map((l) => l.items.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(' ')).join('\n'));
  }
  return paginas.join('\f');
}
// conexión bancaria (Fintoc)
// Las llaves secretas y el link_token viven solo en el servidor (server.js).
export async function api(path, opts) {
  const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' }, opts));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No pudimos comunicarnos con el servidor.');
  return j;
}
// Pide al servidor qué está activo (Fintoc, asistente, Google) y vuelve a dibujar.
export function cargarConfig() {
  fetch('/api/fintoc/config').then((r) => (r.ok ? r.json() : null)).then((c) => { if (c) { FINTOC.enabled = !!c.enabled; AI.enabled = !!c.asistente; GOOGLE.clientId = c.googleClientId || ''; if (c.contacto) document.getElementById('politica-contacto').textContent = ' Para consultas o para ejercer tus derechos, escribe a ' + c.contacto + '.'; render(); } }).catch(() => { /* sin servidor: solo cartolas */ });
}

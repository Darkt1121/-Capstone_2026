/* Lógica de FinFlow: cálculos que no dependen de la pantalla. Todo se entrega en el objeto FF.
   Cada tema está en su archivo; este los junta. */
import { CATEGORIAS, merchant, personKey, classify, counterpartyKey, category } from './clasificacion.js';
import { markDuplicates, markInternal } from './traspasos.js';
import { budgetStatus, goalStatus, monthlySurplus, nextCharges, businessReport, monthSummary, balances, toCSV } from './plan.js';
import { parseStatement, parsePdfStatement, parseAmount, parseDate } from './cartolas.js';
import { mergeRows, buildTransactions } from './movimientos.js';
import { recurring, project } from './proyeccion.js';
import { fmt, monthName, prevMonth, shortDate, titleCase, addDays, diffDays, monthKey } from './util.js';

export const FF = { CATEGORIAS, merchant, personKey, markDuplicates, budgetStatus, goalStatus, monthlySurplus, nextCharges, businessReport, parseStatement, parsePdfStatement, parseAmount, parseDate, mergeRows, buildTransactions, classify, counterpartyKey, category, markInternal, monthSummary, balances, recurring, project, toCSV, fmt, monthName, prevMonth, shortDate, titleCase, addDays, diffDays, monthKey };

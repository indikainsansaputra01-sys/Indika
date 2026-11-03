/**
 * Monthly and Daily Stock Take Calculation & Export Utilities
 * PT Indah Kiat Pulp & Paper Tbk - Finish Pallet Management System
 */
import ExcelJS from 'exceljs';
import { Transaction, StockItem, QuantityUnit, MarketType, PalletSideType } from '../types';
import {
  printDocument,
  generateDocNumber,
  generateStockTakeDocNumber,
  formatPalletDimension
} from './exportUtils';
import { getLogoCleanBase64, getCompanyLogoCleanBase64 } from './logoUtils';
import { normalizePalletDimension, isAllowed115x140Spec } from './dimensionUtils';

export interface DailyPoint {
  day: number;
  dateStr: string; // YYYY-MM-DD
  stock: number; // Saldo stok akhir hari
  inQty: number; // Masuk pada hari itu
  outQty: number; // Keluar pada hari itu
  hasMutation: boolean;
}

export interface MonthlyStockRow {
  id: string;
  palletSize: string;
  palletType: string;
  typePallet: PalletSideType;
  marketType: MarketType;
  unit: QuantityUnit;
  startOfMonthQty: number; // Saldo awal bulan (sebelum mutasi tgl 1)
  dailyPoints: DailyPoint[]; // Hari 1 s/d daysInMonth
  totalInMonth: number; // Total penerimaan dalam bulan ini
  totalOutMonth: number; // Total pengeluaran dalam bulan ini
  endOfMonthQty: number; // Saldo akhir bulan
  currentStock: number; // Saldo real-time saat ini di gudang
  activeColumns: string[]; // Kolom peletakan yard
}

export interface MonthlyStockMatrixResult {
  year: number;
  month: number; // 1-12
  monthName: string;
  daysInMonth: number;
  daysList: number[];
  rows: MonthlyStockRow[];
  totalStartMonth: number;
  totalInMonth: number;
  totalOutMonth: number;
  totalEndMonth: number;
  dailyTotals: {
    [day: number]: {
      stock: number;
      inQty: number;
      outQty: number;
    };
  };
}

export interface SingleDayStockRow {
  id: string;
  palletSize: string;
  palletType: string;
  typePallet: PalletSideType;
  marketType: MarketType;
  unit: QuantityUnit;
  startOfDayQty: number;
  inToday: number;
  outToday: number;
  endOfDayQty: number;
  activeColumns: string[];
  status: 'AMAN' | 'PERHATIAN' | 'KRITIS';
  txCount: number;
}

export interface SingleDayStockResult {
  targetDate: string;
  formattedDate: string;
  rows: SingleDayStockRow[];
  totalStart: number;
  totalIn: number;
  totalOut: number;
  totalEnd: number;
  transactionsOnDate: Transaction[];
}

export interface DailyLedgerRow {
  date: string;
  dayNumber: number;
  palletSize: string;
  palletType: string;
  typePallet: PalletSideType;
  marketType: MarketType;
  unit: QuantityUnit;
  startQty: number;
  inQty: number;
  outQty: number;
  endQty: number;
  columns: string;
  shifts: string;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function getMonthName(month: number): string {
  return MONTH_NAMES_ID[month - 1] || `Bulan ${month}`;
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${day} ${getMonthName(month)} ${year}`;
}

/**
 * Calculates stock balance matrix per date for an entire month
 */
export function calculateMonthlyStockMatrix(
  year: number,
  month: number,
  stocks: StockItem[],
  transactions: Transaction[]
): MonthlyStockMatrixResult {
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysList = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = getMonthName(month);
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Identify all distinct pallet items from live stocks and recorded transactions
  const itemMap = new Map<string, {
    palletSize: string;
    palletType: string;
    typePallet: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    currentStock: number;
    activeColumns: Set<string>;
  }>();

  // From live stocks
  stocks.forEach(stk => {
    const stkTypePallet = stk.typePallet || 'LS';
    if (!isAllowed115x140Spec(stk.palletSize, stk.palletType, stk.marketType, stkTypePallet, stk.unit)) {
      return;
    }
    const key = `${stk.palletSize.trim()}__${stkTypePallet}__${stk.palletType.trim()}__${stk.marketType}__${stk.unit}`;
    itemMap.set(key, {
      palletSize: stk.palletSize.trim(),
      palletType: stk.palletType.trim(),
      typePallet: stkTypePallet,
      marketType: stk.marketType,
      unit: stk.unit,
      currentStock: stk.quantity,
      activeColumns: new Set()
    });
  });

  // From transactions (in case any existed that currently have 0 stock)
  transactions.forEach(tx => {
    const txTypePallet = tx.typePallet || 'LS';
    if (!isAllowed115x140Spec(tx.palletSize, tx.palletType, tx.marketType, txTypePallet, tx.unit)) {
      return;
    }
    const key = `${tx.palletSize.trim()}__${txTypePallet}__${tx.palletType.trim()}__${tx.marketType}__${tx.unit}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        palletSize: tx.palletSize.trim(),
        palletType: tx.palletType.trim(),
        typePallet: txTypePallet,
        marketType: tx.marketType,
        unit: tx.unit,
        currentStock: 0,
        activeColumns: new Set()
      });
    }
    if (tx.pelatakanPallet && tx.pelatakanPallet.trim()) {
      itemMap.get(key)!.activeColumns.add(tx.pelatakanPallet.trim());
    }
  });

  // 2. Pre-filter and group transactions by item key
  const txByItem = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    const txTypePallet = tx.typePallet || 'LS';
    const key = `${tx.palletSize.trim()}__${txTypePallet}__${tx.palletType.trim()}__${tx.marketType}__${tx.unit}`;
    if (!txByItem.has(key)) txByItem.set(key, []);
    txByItem.get(key)!.push(tx);
  });

  const rows: MonthlyStockRow[] = [];
  const dailyTotals: { [day: number]: { stock: number; inQty: number; outQty: number } } = {};
  daysList.forEach(d => {
    dailyTotals[d] = { stock: 0, inQty: 0, outQty: 0 };
  });

  let grandStart = 0;
  let grandIn = 0;
  let grandOut = 0;
  let grandEnd = 0;

  // 3. For each distinct pallet item, calculate daily ending balances
  itemMap.forEach((meta, key) => {
    const itemTxs = txByItem.get(key) || [];
    const currentStock = meta.currentStock;

    // Helper to get daily stock at end of a given date (YYYY-MM-DD)
    const getStockAtEndOfDate = (targetDateStr: string): number => {
      if (targetDateStr > todayStr) {
        // Future date in current month, equals current stock
        return currentStock;
      }
      // Backward calculation from currentStock:
      // Subtract all incoming after targetDate, add back all outgoing after targetDate
      let diffAfter = 0;
      for (const t of itemTxs) {
        if (t.date > targetDateStr) {
          if (t.transactionType === 'PENERIMAAN') {
            diffAfter += t.quantity;
          } else {
            diffAfter -= t.quantity;
          }
        }
      }
      return Math.max(0, currentStock - diffAfter);
    };

    const firstDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Transactions on Day 1
    let inDay1 = 0;
    let outDay1 = 0;
    for (const t of itemTxs) {
      if (t.date === firstDateStr) {
        if (t.transactionType === 'PENERIMAAN') inDay1 += t.quantity;
        else outDay1 += t.quantity;
      }
    }

    const stockEndOfDay1 = getStockAtEndOfDate(firstDateStr);
    const startOfMonthQty = Math.max(0, stockEndOfDay1 - inDay1 + outDay1);

    // Build points for day 1..daysInMonth
    const dailyPoints: DailyPoint[] = [];
    let totalInMonth = 0;
    let totalOutMonth = 0;

    daysList.forEach(day => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      let inQty = 0;
      let outQty = 0;

      for (const t of itemTxs) {
        if (t.date === dateStr) {
          if (t.transactionType === 'PENERIMAAN') inQty += t.quantity;
          else outQty += t.quantity;
        }
      }

      totalInMonth += inQty;
      totalOutMonth += outQty;

      const endOfDayStock = getStockAtEndOfDate(dateStr);

      dailyPoints.push({
        day,
        dateStr,
        stock: endOfDayStock,
        inQty,
        outQty,
        hasMutation: inQty > 0 || outQty > 0
      });

      // Accumulate to overall day total
      dailyTotals[day].stock += endOfDayStock;
      dailyTotals[day].inQty += inQty;
      dailyTotals[day].outQty += outQty;
    });

    const endOfMonthQty = getStockAtEndOfDate(lastDateStr);

    // Include item if it has any balance or activity in this month or current stock > 0
    const hasActivity =
      startOfMonthQty > 0 ||
      totalInMonth > 0 ||
      totalOutMonth > 0 ||
      endOfMonthQty > 0 ||
      currentStock > 0;

    if (hasActivity) {
      rows.push({
        id: `m_row_${key}`,
        palletSize: meta.palletSize,
        palletType: meta.palletType,
        typePallet: meta.typePallet,
        marketType: meta.marketType,
        unit: meta.unit,
        startOfMonthQty,
        dailyPoints,
        totalInMonth,
        totalOutMonth,
        endOfMonthQty,
        currentStock,
        activeColumns: Array.from(meta.activeColumns)
      });

      grandStart += startOfMonthQty;
      grandIn += totalInMonth;
      grandOut += totalOutMonth;
      grandEnd += endOfMonthQty;
    }
  });

  // Sort rows naturally by pallet size then type
  rows.sort((a, b) => {
    const sizeCmp = a.palletSize.localeCompare(b.palletSize, undefined, { numeric: true });
    if (sizeCmp !== 0) return sizeCmp;
    return a.palletType.localeCompare(b.palletType);
  });

  return {
    year,
    month,
    monthName,
    daysInMonth,
    daysList,
    rows,
    totalStartMonth: grandStart,
    totalInMonth: grandIn,
    totalOutMonth: grandOut,
    totalEndMonth: grandEnd,
    dailyTotals
  };
}

/**
 * Calculates stock balance and movements for a single specific date (1 Hari Saja)
 */
export function calculateSingleDayStockTake(
  targetDate: string,
  stocks: StockItem[],
  transactions: Transaction[],
  thresholds = { safeMin: 20, warningMin: 10, criticalMax: 9 }
): SingleDayStockResult {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Identify all distinct pallet items
  const itemMap = new Map<string, {
    palletSize: string;
    palletType: string;
    typePallet: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    currentStock: number;
    activeColumns: Set<string>;
  }>();

  stocks.forEach(stk => {
    const stkTypePallet = stk.typePallet || 'LS';
    if (!isAllowed115x140Spec(stk.palletSize, stk.palletType, stk.marketType, stkTypePallet, stk.unit)) {
      return;
    }
    const key = `${stk.palletSize.trim()}__${stkTypePallet}__${stk.palletType.trim()}__${stk.marketType}__${stk.unit}`;
    itemMap.set(key, {
      palletSize: stk.palletSize.trim(),
      palletType: stk.palletType.trim(),
      typePallet: stkTypePallet,
      marketType: stk.marketType,
      unit: stk.unit,
      currentStock: stk.quantity,
      activeColumns: new Set()
    });
  });

  transactions.forEach(tx => {
    const txTypePallet = tx.typePallet || 'LS';
    if (!isAllowed115x140Spec(tx.palletSize, tx.palletType, tx.marketType, txTypePallet, tx.unit)) {
      return;
    }
    const key = `${tx.palletSize.trim()}__${txTypePallet}__${tx.palletType.trim()}__${tx.marketType}__${tx.unit}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        palletSize: tx.palletSize.trim(),
        palletType: tx.palletType.trim(),
        typePallet: txTypePallet,
        marketType: tx.marketType,
        unit: tx.unit,
        currentStock: 0,
        activeColumns: new Set()
      });
    }
    if (tx.pelatakanPallet && tx.pelatakanPallet.trim()) {
      itemMap.get(key)!.activeColumns.add(tx.pelatakanPallet.trim());
    }
  });

  const txByItem = new Map<string, Transaction[]>();
  const txToday: Transaction[] = [];

  transactions.forEach(tx => {
    const txTypePallet = tx.typePallet || 'LS';
    const key = `${tx.palletSize.trim()}__${txTypePallet}__${tx.palletType.trim()}__${tx.marketType}__${tx.unit}`;
    if (!txByItem.has(key)) txByItem.set(key, []);
    txByItem.get(key)!.push(tx);

    if (tx.date === targetDate) {
      txToday.push(tx);
    }
  });

  const rows: SingleDayStockRow[] = [];
  let totalStart = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalEnd = 0;

  itemMap.forEach((meta, key) => {
    const itemTxs = txByItem.get(key) || [];
    const currentStock = meta.currentStock;

    // End of day stock calculation
    let endOfDayQty = 0;
    if (targetDate > todayStr) {
      endOfDayQty = currentStock;
    } else {
      let diffAfter = 0;
      for (const t of itemTxs) {
        if (t.date > targetDate) {
          if (t.transactionType === 'PENERIMAAN') diffAfter += t.quantity;
          else diffAfter -= t.quantity;
        }
      }
      endOfDayQty = Math.max(0, currentStock - diffAfter);
    }

    // Movements on targetDate
    let inToday = 0;
    let outToday = 0;
    let txCount = 0;
    const colsToday = new Set<string>();

    for (const t of itemTxs) {
      if (t.date === targetDate) {
        txCount++;
        if (t.transactionType === 'PENERIMAAN') inToday += t.quantity;
        else outToday += t.quantity;
        if (t.pelatakanPallet && t.pelatakanPallet.trim()) {
          colsToday.add(t.pelatakanPallet.trim());
        }
      }
    }

    const startOfDayQty = Math.max(0, endOfDayQty - inToday + outToday);

    // Determine status
    let status: 'AMAN' | 'PERHATIAN' | 'KRITIS' = 'AMAN';
    if (endOfDayQty <= thresholds.criticalMax) {
      status = 'KRITIS';
    } else if (endOfDayQty < thresholds.safeMin) {
      status = 'PERHATIAN';
    }

    const allColumns = colsToday.size > 0 ? Array.from(colsToday) : Array.from(meta.activeColumns);

    const hasData = startOfDayQty > 0 || inToday > 0 || outToday > 0 || endOfDayQty > 0;
    if (hasData) {
      rows.push({
        id: `s_row_${key}`,
        palletSize: meta.palletSize,
        palletType: meta.palletType,
        typePallet: meta.typePallet,
        marketType: meta.marketType,
        unit: meta.unit,
        startOfDayQty,
        inToday,
        outToday,
        endOfDayQty,
        activeColumns: allColumns,
        status,
        txCount
      });

      totalStart += startOfDayQty;
      totalIn += inToday;
      totalOut += outToday;
      totalEnd += endOfDayQty;
    }
  });

  rows.sort((a, b) => a.palletSize.localeCompare(b.palletSize, undefined, { numeric: true }));

  return {
    targetDate,
    formattedDate: formatDateIndo(targetDate),
    rows,
    totalStart,
    totalIn,
    totalOut,
    totalEnd,
    transactionsOnDate: txToday
  };
}

/**
 * Transforms monthly stock matrix into a date-by-date daily ledger rows
 */
export function getMonthlyDailyLedgerRows(
  matrix: MonthlyStockMatrixResult,
  filterSize?: string
): DailyLedgerRow[] {
  const result: DailyLedgerRow[] = [];

  matrix.daysList.forEach(day => {
    const dateStr = `${matrix.year}-${String(matrix.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    matrix.rows.forEach(r => {
      if (filterSize && filterSize !== 'ALL' && r.palletSize !== filterSize) {
        return;
      }

      const point = r.dailyPoints.find(p => p.day === day);
      if (!point) return;

      const prevPoint = r.dailyPoints.find(p => p.day === day - 1);
      const startQty = prevPoint ? prevPoint.stock : r.startOfMonthQty;

      // Only include if there is balance or movement on this day
      if (startQty > 0 || point.inQty > 0 || point.outQty > 0 || point.stock > 0) {
        result.push({
          date: dateStr,
          dayNumber: day,
          palletSize: r.palletSize,
          palletType: r.palletType,
          typePallet: r.typePallet,
          marketType: r.marketType,
          unit: r.unit,
          startQty,
          inQty: point.inQty,
          outQty: point.outQty,
          endQty: point.stock,
          columns: r.activeColumns.join(', ') || '-',
          shifts: point.hasMutation ? (point.inQty > 0 && point.outQty > 0 ? 'Masuk & Keluar' : point.inQty > 0 ? 'Penerimaan (+)' : 'Pengeluaran (-)') : 'Tidak Ada Mutasi'
        });
      }
    });
  });

  return result;
}

/**
 * Generates an executive Excel workbook (.xlsx) for the Monthly Stock Matrix
 */
export async function exportMonthlyStockToExcel(params: {
  matrix: MonthlyStockMatrixResult;
  operatorName: string;
}): Promise<void> {
  const { matrix, operatorName } = params;
  const totalDays = matrix.daysInMonth;
  const monthLabel = `${matrix.monthName.toUpperCase()} ${matrix.year}`;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `Finish Pallet Management System (${operatorName})`;
  workbook.created = new Date();
  workbook.properties.date1904 = true;

  // Columns: 7 fixed + (totalDays * 3) + 4 trailing (tanpa kolom peletakan) = 7 + (31 * 3) + 4 = 104 cols
  const fixedColCount = 7;
  const trailingColCount = 4;
  const totalColCount = fixedColCount + (totalDays * 3) + trailingColCount;

  const logoClean = await getLogoCleanBase64();
  const companyLogoClean = await getCompanyLogoCleanBase64();

  // --- SHEET 1: MATRIKS STOK HARIAN (BULANAN) DETAIL DENGAN KOLOM PENERIMAAN & PENGELUARAN ---
  const wsMatrix = workbook.addWorksheet(`Matriks Detail ${matrix.monthName}`, {
    views: [
      {
        state: 'frozen',
        xSplit: 5, // Bekukan sampai Pallet Runners saja, jangan sampai ke kolom Satuan
        ySplit: 8,
        topLeftCell: 'F9',
        activeCell: 'F9',
        showGridLines: true
      }
    ],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  // Logo Finish Pallet (Kolom 1 / A)
  if (logoClean) {
    try {
      const imgId = workbook.addImage({
        base64: logoClean,
        extension: 'png'
      });
      wsMatrix.addImage(imgId, {
        tl: { col: 0.08, row: 0.15 },
        ext: { width: 48, height: 48 }
      });
    } catch (e) {
      console.warn('Could not add logo to wsMatrix', e);
    }
  }

  // Logo PT Indah Kiat (Berdampingan tepat di sebelah logo Finish Pallet, Kolom 2 / B)
  if (companyLogoClean) {
    try {
      const compImgId = workbook.addImage({
        base64: companyLogoClean,
        extension: 'png'
      });
      wsMatrix.addImage(compImgId, {
        tl: { col: 0.95, row: 0.18 },
        ext: { width: 110, height: 46 }
      });
    } catch (e) {
      console.warn('Could not add company logo to wsMatrix', e);
    }
  }

  // Header PT Indah Kiat (kolom 3 ke atas agar kedua logo di kolom 1 & 2 rapih berdampingan)
  wsMatrix.mergeCells(1, 3, 1, Math.min(totalColCount, 25));
  const c1 = wsMatrix.getCell(1, 3);
  c1.value = 'PT INDAH KIAT PULP & PAPER TBK';
  c1.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  wsMatrix.getRow(1).height = 24;

  wsMatrix.mergeCells(2, 3, 2, Math.min(totalColCount, 25));
  const c2 = wsMatrix.getCell(2, 3);
  c2.value = 'WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM · LAPORAN STOK TAKE BULANAN';
  c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
  wsMatrix.getRow(2).height = 18;

  wsMatrix.mergeCells(3, 3, 3, Math.min(totalColCount, 25));
  const c3 = wsMatrix.getCell(3, 3);
  c3.value = `PERIODE: ${monthLabel} (${totalDays} HARI) · TANGGAL 01 S/D ${String(totalDays).padStart(2, '0')}`;
  c3.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsMatrix.getRow(3).height = 22;

  // Metadata Row
  const stockDocNumber = generateStockTakeDocNumber(matrix.year, matrix.month);
  wsMatrix.getRow(5).values = [
    'No. Registrasi Dokumen:', stockDocNumber,
    'Petugas / Operator:', 'Semua Operator Finish Pallet',
    'Waktu Unduh:', `${new Date().toLocaleString('id-ID')} WIB`,
    'Total Varian Pallet:', `${matrix.rows.length} Ukuran/Jenis Terdaftar`
  ];
  wsMatrix.getRow(5).font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };

  // --- TWO-TIER TABLE HEADERS (ROW 7 & ROW 8) ---
  const row7 = wsMatrix.getRow(7);
  const row8 = wsMatrix.getRow(8);
  row7.height = 24;
  row8.height = 22;

  // 1. Fixed Columns (Rows 7-8 merged)
  const fixedHeaders = [
    'No',
    'Ukuran Pallet',
    'Region',
    'Wrap Type',
    'Pallet Runners',
    'Satuan',
    'Stok Awal Bulan'
  ];

  fixedHeaders.forEach((title, idx) => {
    const colIdx = idx + 1;
    wsMatrix.mergeCells(7, colIdx, 8, colIdx);
    const cell = row7.getCell(colIdx);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // 2. Day Columns with 3 sub-columns per date: [Stok Akhir | Penerimaan (+) | Pengeluaran (-)]
  matrix.daysList.forEach((d) => {
    const startCol = fixedColCount + 1 + (d - 1) * 3;
    const endCol = startCol + 2;

    // Merge Row 7 across 3 sub-columns for date header
    wsMatrix.mergeCells(7, startCol, 7, endCol);
    const dateHeaderCell = row7.getCell(startCol);
    dateHeaderCell.value = `Tgl ${String(d).padStart(2, '0')}`;
    dateHeaderCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    dateHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dateHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    dateHeaderCell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'medium', color: { argb: 'FF0F172A' } }
    };

    // Sub-columns on Row 8
    const subColDefs = [
      { col: startCol, label: 'Stok Akhir', bg: 'FF334155' },
      { col: startCol + 1, label: 'Produksi (Penerimaan)', bg: 'FF065F46' },
      { col: startCol + 2, label: 'Pengeluaran (-)', bg: 'FF92400E' }
    ];

    subColDefs.forEach((sc) => {
      const subCell = row8.getCell(sc.col);
      subCell.value = sc.label;
      subCell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
      subCell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF475569' } }
      };
    });
  });

  // 3. Trailing Summary Columns (Rows 7-8 merged) - Tanpa Kolom Peletakan Yard
  const trailingColStart = fixedColCount + 1 + totalDays * 3;
  const trailingHeaders = [
    { title: 'Total Penerimaan (+)', bg: 'FF065F46' },
    { title: 'Total Pengeluaran (-)', bg: 'FF92400E' },
    { title: 'Stok Akhir Bulan', bg: 'FF1E293B' },
    { title: 'Status Kesiapan', bg: 'FF0F172A' }
  ];

  trailingHeaders.forEach((th, idx) => {
    const colIdx = trailingColStart + idx;
    wsMatrix.mergeCells(7, colIdx, 8, colIdx);
    const cell = row7.getCell(colIdx);
    cell.value = th.title;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: th.bg } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // --- DATA ROWS (ROW 9+) ---
  let curRow = 9;
  matrix.rows.forEach((r, idx) => {
    const dataRow = wsMatrix.getRow(curRow);
    dataRow.height = 20;
    const isEven = idx % 2 === 0;

    // 1. Fixed cells
    dataRow.getCell(1).value = idx + 1;
    dataRow.getCell(2).value = formatPalletDimension(r.palletSize);
    dataRow.getCell(3).value = r.marketType;
    dataRow.getCell(4).value = r.palletType;
    dataRow.getCell(5).value = r.typePallet || 'LS';
    dataRow.getCell(6).value = r.unit;
    dataRow.getCell(7).value = r.startOfMonthQty;

    // Styling fixed cells
    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(2).font = { name: 'Calibri', size: 9.5, bold: true };
    dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(5).font = { name: 'Calibri', size: 9.5, bold: true };
    dataRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    dataRow.getCell(7).numFmt = '#,##0;(#,##0);"-"';
    dataRow.getCell(7).font = { name: 'Calibri', size: 9.5, bold: true };

    // 2. Day values (Stok Akhir, Penerimaan, Pengeluaran)
    matrix.daysList.forEach((d) => {
      const sc = fixedColCount + 1 + (d - 1) * 3;
      const pt = r.dailyPoints.find((p) => p.day === d);
      const stockVal = pt ? pt.stock : 0;
      const inVal = pt && pt.inQty > 0 ? pt.inQty : 0;
      const outVal = pt && pt.outQty > 0 ? pt.outQty : 0;
      const hasMutation = inVal > 0 || outVal > 0;

      // Col sc: Stok Akhir
      const stockCell = dataRow.getCell(sc);
      stockCell.value = stockVal;
      stockCell.numFmt = '#,##0;(#,##0);"-"';
      stockCell.alignment = { horizontal: 'right', vertical: 'middle' };
      stockCell.font = { name: 'Calibri', size: 9.5, bold: hasMutation || stockVal > 0 };
      if (hasMutation) {
        stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Gold tint
      }

      // Col sc + 1: Penerimaan (+)
      const inCell = dataRow.getCell(sc + 1);
      inCell.value = inVal;
      inCell.numFmt = '#,##0;(#,##0);"-"';
      inCell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (inVal > 0) {
        inCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
        inCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      } else {
        inCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
      }

      // Col sc + 2: Pengeluaran (-)
      const outCell = dataRow.getCell(sc + 2);
      outCell.value = outVal;
      outCell.numFmt = '#,##0;(#,##0);"-"';
      outCell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (outVal > 0) {
        outCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
        outCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
      } else {
        outCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
      }
    });

    // 3. Trailing cells
    const cTotalIn = dataRow.getCell(trailingColStart);
    cTotalIn.value = r.totalInMonth;
    cTotalIn.numFmt = '#,##0;(#,##0);"-"';
    cTotalIn.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    cTotalIn.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotalOut = dataRow.getCell(trailingColStart + 1);
    cTotalOut.value = r.totalOutMonth;
    cTotalOut.numFmt = '#,##0;(#,##0);"-"';
    cTotalOut.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
    cTotalOut.alignment = { horizontal: 'right', vertical: 'middle' };

    const cEndStock = dataRow.getCell(trailingColStart + 2);
    cEndStock.value = r.endOfMonthQty;
    cEndStock.numFmt = '#,##0;(#,##0);"-"';
    cEndStock.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };
    cEndStock.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cEndStock.alignment = { horizontal: 'right', vertical: 'middle' };

    const statusStr = r.endOfMonthQty <= 0 ? 'KRITIS' : r.endOfMonthQty < 500 ? 'PERHATIAN' : 'AMAN';
    const cStatus = dataRow.getCell(trailingColStart + 3);
    cStatus.value = statusStr;
    cStatus.font = { name: 'Calibri', size: 9, bold: true };
    cStatus.alignment = { horizontal: 'center', vertical: 'middle' };

    // Standard borders and alternate row background
    for (let c = 1; c <= totalColCount; c++) {
      const cell = dataRow.getCell(c);
      if (!cell.fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }

    curRow++;
  });

  // --- GRAND TOTAL ROW ---
  const totalRow = wsMatrix.getRow(curRow);
  totalRow.height = 24;
  wsMatrix.mergeCells(curRow, 1, curRow, 6);
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = 'TOTAL KESELURUHAN';
  totalLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };
  totalLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  totalRow.getCell(7).value = matrix.totalStartMonth;
  totalRow.getCell(7).numFmt = '#,##0';
  totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(7).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };

  // Day grand totals
  matrix.daysList.forEach((d) => {
    const sc = fixedColCount + 1 + (d - 1) * 3;
    const dayTot = matrix.dailyTotals[d];
    const sCell = totalRow.getCell(sc);
    sCell.value = dayTot?.stock || 0;
    sCell.numFmt = '#,##0;(#,##0);"-"';
    sCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };
    sCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const inCell = totalRow.getCell(sc + 1);
    inCell.value = dayTot?.inQty || 0;
    inCell.numFmt = '#,##0;(#,##0);"-"';
    inCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    inCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const outCell = totalRow.getCell(sc + 2);
    outCell.value = dayTot?.outQty || 0;
    outCell.numFmt = '#,##0;(#,##0);"-"';
    outCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
    outCell.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // Trailing grand totals
  const totInCell = totalRow.getCell(trailingColStart);
  totInCell.value = matrix.totalInMonth;
  totInCell.numFmt = '#,##0';
  totInCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
  totInCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const totOutCell = totalRow.getCell(trailingColStart + 1);
  totOutCell.value = matrix.totalOutMonth;
  totOutCell.numFmt = '#,##0';
  totOutCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
  totOutCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const totEndCell = totalRow.getCell(trailingColStart + 2);
  totEndCell.value = matrix.totalEndMonth;
  totEndCell.numFmt = '#,##0';
  totEndCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF78350F' } };
  totEndCell.alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(trailingColStart + 3).value = '-';
  totalRow.getCell(trailingColStart + 3).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= totalColCount; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFFDE68A' } },
      right: { style: 'thin', color: { argb: 'FFFDE68A' } }
    };
  }

  // --- COLUMN WIDTHS CONFIGURATION ---
  wsMatrix.getColumn(1).width = 7.5; // No
  wsMatrix.getColumn(2).width = 16;  // Ukuran Pallet
  wsMatrix.getColumn(3).width = 10;  // Region
  wsMatrix.getColumn(4).width = 18;  // Wrap Type
  wsMatrix.getColumn(5).width = 13;  // Pallet Runners
  wsMatrix.getColumn(6).width = 7;   // Satuan
  wsMatrix.getColumn(7).width = 13;  // Stok Awal Bulan

  for (let d = 1; d <= totalDays; d++) {
    const sc = fixedColCount + 1 + (d - 1) * 3;
    wsMatrix.getColumn(sc).width = 10;     // Stok Akhir
    wsMatrix.getColumn(sc + 1).width = 12; // Produksi (Penerimaan)
    wsMatrix.getColumn(sc + 2).width = 11; // Pengeluaran (-)
  }

  wsMatrix.getColumn(trailingColStart).width = 14;     // Total In
  wsMatrix.getColumn(trailingColStart + 1).width = 14; // Total Out
  wsMatrix.getColumn(trailingColStart + 2).width = 16; // Stok Akhir Bulan
  wsMatrix.getColumn(trailingColStart + 3).width = 14; // Status Kesiapan

  // Add Verification / Signature Block
  curRow += 3;
  wsMatrix.mergeCells(curRow, 1, curRow, Math.min(totalColCount, 25));
  const sigTitle = wsMatrix.getCell(curRow, 1);
  sigTitle.value = 'LEMBAR PENGESAHAN HASIL STOK TAKE BULANAN PALLET';
  sigTitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  sigTitle.alignment = { horizontal: 'center' };

  curRow += 2;
  const sigCols = [2, Math.floor(totalColCount / 2), Math.min(totalColCount - 2, 25)];

  const sigRoles = ['Dibuat / Dilaporkan Oleh:', 'Diperiksa Oleh:', 'Disetujui Oleh:'];
  const sigTitles = ['Operator Finish Pallet', 'Supervisor Workshop Pallet & Coreplug', 'Manager Workshop Pallet & Coreplug'];
  const sigNames = ['( .................................................. )', '( .................................................. )', '( .................................................. )'];

  sigCols.forEach((col, idx) => {
    wsMatrix.getCell(curRow, col).value = sigRoles[idx];
    wsMatrix.getCell(curRow, col).font = { name: 'Calibri', size: 9.5, bold: true };
    wsMatrix.getCell(curRow, col).alignment = { horizontal: 'center' };

    wsMatrix.getCell(curRow + 1, col).value = sigTitles[idx];
    wsMatrix.getCell(curRow + 1, col).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
    wsMatrix.getCell(curRow + 1, col).alignment = { horizontal: 'center' };

    wsMatrix.getCell(curRow + 4, col).value = sigNames[idx];
    wsMatrix.getCell(curRow + 4, col).font = { name: 'Calibri', size: 9.5, bold: true };
    wsMatrix.getCell(curRow + 4, col).alignment = { horizontal: 'center' };

    wsMatrix.getCell(curRow + 5, col).value = 'Tulis Nama Terang & TTD';
    wsMatrix.getCell(curRow + 5, col).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    wsMatrix.getCell(curRow + 5, col).alignment = { horizontal: 'center' };
  });

  // --- SHEET 2: BUKU MUTASI HARIAN PER TANGGAL ---
  const wsLedger = workbook.addWorksheet(`Buku Mutasi ${matrix.monthName}`, {
    views: [
      {
        state: 'frozen',
        xSplit: 5, // Bekukan sampai Pallet Runners saja, jangan sampai ke kolom Satuan
        ySplit: 4,
        topLeftCell: 'F5',
        activeCell: 'F5',
        showGridLines: true
      }
    ],
    pageSetup: {
      orientation: 'portrait',
      paperSize: 9
    }
  });

  // Logo Finish Pallet (Kolom 1 / A)
  if (logoClean) {
    try {
      const imgId = workbook.addImage({
        base64: logoClean,
        extension: 'png'
      });
      wsLedger.addImage(imgId, {
        tl: { col: 0.08, row: 0.15 },
        ext: { width: 44, height: 44 }
      });
    } catch (e) {
      console.warn('Could not add logo to wsLedger', e);
    }
  }

  // Logo PT Indah Kiat (Berdampingan di sebelah logo Finish Pallet, Kolom 2 / B)
  if (companyLogoClean) {
    try {
      const compImgId = workbook.addImage({
        base64: companyLogoClean,
        extension: 'png'
      });
      wsLedger.addImage(compImgId, {
        tl: { col: 0.85, row: 0.15 },
        ext: { width: 105, height: 44 }
      });
    } catch (e) {
      console.warn('Could not add company logo to wsLedger', e);
    }
  }

  wsLedger.mergeCells(1, 3, 1, 10);
  const l1 = wsLedger.getCell(1, 3);
  l1.value = 'PT INDAH KIAT PULP & PAPER TBK';
  l1.font = { name: 'Calibri', size: 14, bold: true };

  wsLedger.mergeCells(2, 3, 2, 10);
  const l2 = wsLedger.getCell(2, 3);
  l2.value = `BUKU MUTASI STOK HARIAN PALLET · ${monthLabel}`;
  l2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };

  const ledgerHeaders = [
    'Tanggal',
    'Ukuran Pallet',
    'Region',
    'Wrap Type',
    'Pallet Runners',
    'Satuan',
    'Stok Awal',
    'Penerimaan (+)',
    'Pengeluaran (-)',
    'Saldo Akhir'
  ];

  const ledgerHRow = wsLedger.getRow(4);
  ledgerHRow.values = ledgerHeaders;
  ledgerHRow.height = 24;
  ledgerHeaders.forEach((_, idx) => {
    const cell = ledgerHRow.getCell(idx + 1);
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  });

  const ledgerItems = getMonthlyDailyLedgerRows(matrix);
  let lRow = 5;
  ledgerItems.forEach((item, idx) => {
    const row = wsLedger.getRow(lRow);
    row.values = [
      formatDateIndo(item.date),
      formatPalletDimension(item.palletSize),
      item.marketType,
      item.palletType,
      item.typePallet || 'LS',
      item.unit,
      item.startQty,
      item.inQty,
      item.outQty,
      item.endQty
    ];
    row.height = 18;

    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 9.5 };
      if (colNum >= 7) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (colNum === 1 || colNum === 3 || colNum === 5 || colNum === 6) {
        cell.alignment = { horizontal: 'center' };
      }
    });

    lRow++;
  });

  wsLedger.getColumn(1).width = 18;
  wsLedger.getColumn(2).width = 16;
  wsLedger.getColumn(3).width = 14;
  wsLedger.getColumn(4).width = 18;
  wsLedger.getColumn(5).width = 12;
  wsLedger.getColumn(6).width = 8;
  wsLedger.getColumn(7).width = 12;
  wsLedger.getColumn(8).width = 12;
  wsLedger.getColumn(9).width = 12;
  wsLedger.getColumn(10).width = 14;

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Laporan_Stok_Bulanan_${matrix.monthName}_${matrix.year}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Generates an executive Excel workbook (.xlsx) for Single Day Stock Take (1 Hari Saja)
 */
export async function exportSingleDayStockToExcel(params: {
  singleDay: SingleDayStockResult;
  operatorName: string;
}): Promise<void> {
  const { singleDay, operatorName } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `Finish Pallet Management System (${operatorName})`;
  workbook.created = new Date();

  const logoClean = await getLogoCleanBase64();
  const companyLogoClean = await getCompanyLogoCleanBase64();

  const ws = workbook.addWorksheet(`Stok ${singleDay.targetDate}`, {
    views: [
      {
        state: 'frozen',
        xSplit: 5, // Bekukan sampai Pallet Runners saja, jangan sampai ke kolom Satuan
        ySplit: 7,
        topLeftCell: 'F8',
        activeCell: 'F8',
        showGridLines: true
      }
    ],
    pageSetup: {
      orientation: 'portrait',
      paperSize: 9
    }
  });

  // Logo Finish Pallet (Kolom 1 / A)
  if (logoClean) {
    try {
      const imgId = workbook.addImage({
        base64: logoClean,
        extension: 'png'
      });
      ws.addImage(imgId, {
        tl: { col: 0.08, row: 0.15 },
        ext: { width: 48, height: 48 }
      });
    } catch (e) {
      console.warn('Could not add logo to singleDay ws', e);
    }
  }

  // Logo PT Indah Kiat (Berdampingan tepat di sebelah logo Finish Pallet, Kolom 2 / B)
  if (companyLogoClean) {
    try {
      const compImgId = workbook.addImage({
        base64: companyLogoClean,
        extension: 'png'
      });
      ws.addImage(compImgId, {
        tl: { col: 0.95, row: 0.18 },
        ext: { width: 110, height: 46 }
      });
    } catch (e) {
      console.warn('Could not add company logo to singleDay ws', e);
    }
  }

  // Header PT Indah Kiat (kolom 3 ke atas agar kedua logo di kolom 1 & 2 rapih berdampingan)
  ws.mergeCells(1, 3, 1, 11);
  const c1 = ws.getCell(1, 3);
  c1.value = 'PT INDAH KIAT PULP & PAPER TBK';
  c1.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F172A' } };

  ws.mergeCells(2, 3, 2, 11);
  const c2 = ws.getCell(2, 3);
  c2.value = 'WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM · STOK TAKE HARIAN';
  c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };

  ws.mergeCells(3, 3, 3, 11);
  const c3 = ws.getCell(3, 3);
  c3.value = `TANGGAL AUDIT: ${singleDay.formattedDate.toUpperCase()} (${singleDay.targetDate})`;
  c3.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  const singleDayDocNumber = generateStockTakeDocNumber(undefined, undefined, singleDay.targetDate);
  ws.getRow(5).values = [
    'No. Registrasi Dokumen:', singleDayDocNumber,
    '', 'Petugas / Operator:', 'Semua Operator Finish Pallet',
    '', 'Waktu Cetak:', `${new Date().toLocaleString('id-ID')} WIB`,
    '', 'Total Varian:', `${singleDay.rows.length} Pallet`
  ];
  ws.getRow(5).font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };

  const headers = [
    'No',
    'Ukuran Pallet',
    'Region',
    'Wrap Type',
    'Pallet Runners',
    'Satuan',
    'Stok Awal',
    'Penerimaan (+)',
    'Pengeluaran (-)',
    'Stok Akhir',
    'Status Kesiapan'
  ];

  const hRow = ws.getRow(7);
  hRow.values = headers;
  hRow.height = 24;
  headers.forEach((_, idx) => {
    const cell = hRow.getCell(idx + 1);
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };
  });

  let curRow = 8;
  singleDay.rows.forEach((r, idx) => {
    const row = ws.getRow(curRow);
    row.values = [
      idx + 1,
      formatPalletDimension(r.palletSize),
      r.marketType,
      r.palletType,
      r.typePallet || 'LS',
      r.unit,
      r.startOfDayQty,
      r.inToday,
      r.outToday,
      r.endOfDayQty,
      r.status
    ];
    row.height = 20;

    const isEven = idx % 2 === 0;
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 9.5, bold: colNum === 2 || colNum === 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colNum >= 7 && colNum <= 10) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNum === 1 || colNum === 3 || colNum === 5 || colNum === 6 || colNum === 11) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Semantic highlight for Status
      if (colNum === 11) {
        if (r.status === 'KRITIS') {
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else if (r.status === 'PERHATIAN') {
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        } else {
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        }
      }
    });

    curRow++;
  });

  // Total row
  const totRow = ws.getRow(curRow);
  totRow.values = [
    'TOTAL AKUMULASI HARI INI',
    '', '', '', '', '',
    singleDay.totalStart,
    singleDay.totalIn,
    singleDay.totalOut,
    singleDay.totalEnd,
    ''
  ];
  totRow.height = 24;

  totRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
    if (colNum >= 7 && colNum <= 10) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });
  ws.mergeCells(curRow, 1, curRow, 6);

  ws.getColumn(1).width = 7.5;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 8;
  ws.getColumn(7).width = 14;
  ws.getColumn(8).width = 16;
  ws.getColumn(9).width = 16;
  ws.getColumn(10).width = 16;
  ws.getColumn(11).width = 16;

  // Signature Block
  curRow += 3;
  ws.mergeCells(curRow, 1, curRow, 11);
  const sTitle = ws.getCell(curRow, 1);
  sTitle.value = 'LEMBAR PENGESAHAN HASIL STOK TAKE HARIAN';
  sTitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  sTitle.alignment = { horizontal: 'center' };

  curRow += 2;
  const sigPositions = [2, 5, 9];
  const sigRoles = ['Dibuat / Dilaporkan Oleh:', 'Diperiksa Oleh:', 'Disetujui Oleh:'];
  const sigTitles = ['Operator Finish Pallet', 'Supervisor Workshop Pallet & Coreplug', 'Manager Workshop Pallet & Coreplug'];
  const sigNames = ['( .................................................. )', '( .................................................. )', '( .................................................. )'];

  sigPositions.forEach((col, idx) => {
    ws.getCell(curRow, col).value = sigRoles[idx];
    ws.getCell(curRow, col).font = { name: 'Calibri', size: 9.5, bold: true };
    ws.getCell(curRow, col).alignment = { horizontal: 'center' };

    ws.getCell(curRow + 1, col).value = sigTitles[idx];
    ws.getCell(curRow + 1, col).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
    ws.getCell(curRow + 1, col).alignment = { horizontal: 'center' };

    ws.getCell(curRow + 4, col).value = sigNames[idx];
    ws.getCell(curRow + 4, col).font = { name: 'Calibri', size: 9.5, bold: true };
    ws.getCell(curRow + 4, col).alignment = { horizontal: 'center' };

    ws.getCell(curRow + 5, col).value = 'Tulis Nama Terang & TTD';
    ws.getCell(curRow + 5, col).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    ws.getCell(curRow + 5, col).alignment = { horizontal: 'center' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Laporan_Stok_Harian_${singleDay.targetDate}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Returns printable A4 Landscape HTML for Monthly Stock Matrix
 */
export function getPrintableMonthlyMatrixHTML(params: {
  matrix: MonthlyStockMatrixResult;
  operatorName: string;
  dayStart?: number;
  dayEnd?: number;
}): string {
  const { matrix, operatorName, dayStart = 1, dayEnd = matrix.daysInMonth } = params;
  const filteredDays = matrix.daysList.filter(d => d >= dayStart && d <= dayEnd);
  const monthLabel = `${matrix.monthName.toUpperCase()} ${matrix.year}`;
  const currentDateStr = new Date().toLocaleString('id-ID');

  const headersHtml = [
    '<th style="padding: 5px 3px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px;">NO</th>',
    '<th style="padding: 5px 4px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px; text-align: left;">UKURAN PALLET</th>',
    '<th style="padding: 5px 3px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px; text-align: center;">REGION</th>',
    '<th style="padding: 5px 4px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px; text-align: left;">WRAP TYPE</th>',
    '<th style="padding: 5px 3px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px; text-align: center;">PALLET RUNNERS</th>',
    '<th style="padding: 5px 3px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px;">SAT</th>',
    '<th style="padding: 5px 3px; border: 1px solid #1E293B; background: #1E293B; color: #FFF; font-size: 8px; text-align: right;">AWAL</th>',
    ...filteredDays.map(d => `<th style="padding: 5px 2px; border: 1px solid #1E293B; background: #0F172A; color: #FFF; font-size: 8px; text-align: center;">TGL ${d}</th>`),
    '<th style="padding: 5px 3px; border: 1px solid #064E3B; background: #065F46; color: #FFF; font-size: 8px; text-align: right;">PENERIMAAN (+)</th>',
    '<th style="padding: 5px 3px; border: 1px solid #991B1B; background: #B91C1C; color: #FFF; font-size: 8px; text-align: right;">PENGELUARAN (-)</th>',
    '<th style="padding: 5px 3px; border: 1px solid #1E293B; background: #1E293B; color: #FFF; font-size: 8px; text-align: right;">STOK AKHIR</th>'
  ].join('');

  const rowsHtml = matrix.rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const dayCells = filteredDays.map(d => {
      const pt = r.dailyPoints.find(p => p.day === d);
      const val = pt ? pt.stock : 0;
      const mutated = pt && (pt.inQty > 0 || pt.outQty > 0);
      const cellBg = mutated ? '#FEF3C7' : 'transparent';
      return `<td style="padding: 3px 2px; border: 1px solid #CBD5E1; text-align: right; font-size: 7.5px; background: ${cellBg}; vertical-align: top;">
        <div style="font-weight: 800; font-size: 7.8px; color: ${val > 0 ? '#0F172A' : '#94A3B8'};">Stk:${val > 0 ? val : '-'}</div>
        ${mutated ? `
          <div style="font-size: 6.8px; color: #047857; font-weight: bold; line-height: 1.1;">${pt.inQty > 0 ? 'In:' + pt.inQty : ''}</div>
          <div style="font-size: 6.8px; color: #B91C1C; font-weight: bold; line-height: 1.1;">${pt.outQty > 0 ? 'Out:' + pt.outQty : ''}</div>
        ` : ''}
      </td>`;
    }).join('');

    const typeBadgeStyle = r.typePallet === 'LS'
      ? 'background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; font-weight: bold; border-radius: 3px; padding: 1px 3px;'
      : 'background: #FAF5FF; color: #6B21A8; border: 1px solid #E9D5FF; font-weight: bold; border-radius: 3px; padding: 1px 3px;';

    return `
      <tr style="background: ${bg};">
        <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; font-size: 8px;">${i + 1}</td>
        <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: left; font-size: 8.5px; font-weight: bold;">${formatPalletDimension(r.palletSize)}</td>
        <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; font-size: 8px;">${r.marketType}</td>
        <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: left; font-size: 8px;">${r.palletType}</td>
        <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; font-size: 8px;"><span style="${typeBadgeStyle}">${r.typePallet}</span></td>
        <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; font-size: 8px;">${r.unit}</td>
        <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: right; font-size: 8.5px; font-weight: bold; background: #F1F5F9;">${r.startOfMonthQty}</td>
        ${dayCells}
        <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: right; font-size: 8.5px; color: #047857; font-weight: bold;">+${r.totalInMonth}</td>
        <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: right; font-size: 8.5px; color: #B91C1C; font-weight: bold;">-${r.totalOutMonth}</td>
        <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: right; font-size: 9px; font-weight: 800; background: #FEF3C7; color: #78350F;">${r.endOfMonthQty}</td>
      </tr>
    `;
  }).join('');

  // Total footer row
  const totalDayCells = filteredDays.map(d => {
    const dayTot = matrix.dailyTotals[d];
    const val = dayTot?.stock || 0;
    const hasMut = dayTot && (dayTot.inQty > 0 || dayTot.outQty > 0);
    return `<td style="padding: 4px 2px; border: 1px solid #FDE68A; text-align: right; font-size: 7.5px; font-weight: bold; vertical-align: top;">
      <div>Stk:${val > 0 ? val : '-'}</div>
      ${hasMut ? `
        <div style="font-size: 6.8px; color: #047857; font-weight: bold; line-height: 1.1;">${dayTot.inQty > 0 ? 'In:' + dayTot.inQty : ''}</div>
        <div style="font-size: 6.8px; color: #B91C1C; font-weight: bold; line-height: 1.1;">${dayTot.outQty > 0 ? 'Out:' + dayTot.outQty : ''}</div>
      ` : ''}
    </td>`;
  }).join('');

  const totalRowHtml = `
    <tr style="background: #FEF3C7; color: #78350F; border-top: 2px solid #0F172A; border-bottom: 3px double #0F172A;">
      <td colspan="6" style="padding: 5px 4px; text-align: left; font-size: 9px; font-weight: bold;">TOTAL SALDO PALLET</td>
      <td style="padding: 5px 3px; text-align: right; font-size: 9px; font-weight: bold;">${matrix.totalStartMonth}</td>
      ${totalDayCells}
      <td style="padding: 5px 3px; text-align: right; font-size: 9px; font-weight: bold; color: #047857;">+${matrix.totalInMonth}</td>
      <td style="padding: 5px 3px; text-align: right; font-size: 9px; font-weight: bold; color: #B91C1C;">-${matrix.totalOutMonth}</td>
      <td style="padding: 5px 3px; text-align: right; font-size: 9.5px; font-weight: 800;">${matrix.totalEndMonth}</td>
    </tr>
  `;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan Stok Take Bulanan ${matrix.monthName} ${matrix.year} - PT Indah Kiat Pulp & Paper Tbk</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 6mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 10px;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .company { font-size: 14px; font-weight: 800; color: #0F172A; }
    .unit { font-size: 9px; font-weight: 700; color: #047857; margin-top: 1px; }
    .title { font-size: 12px; font-weight: 800; margin-top: 2px; text-transform: uppercase; color: #1E293B; }
    .meta {
      font-size: 9px;
      color: #334155;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      background: #F8FAFC;
      padding: 4px 8px;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .sig-section {
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .sig-heading {
      text-align: center;
      font-size: 9.5px;
      font-weight: bold;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .sig-grid {
      display: flex;
      justify-content: space-between;
      text-align: center;
      font-size: 9px;
    }
    .sig-box { width: 30%; }
    .sig-name {
      margin-top: 40px;
      font-weight: bold;
      text-decoration: underline;
    }
    .sig-desc { font-size: 8.5px; color: #64748B; margin-top: 2px; }
    .no-print-toolbar {
      margin-bottom: 10px;
      background: #1E293B;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-print {
      padding: 6px 14px;
      background: #047857;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 11px;
      cursor: pointer;
    }
    @media print {
      .no-print-toolbar { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <span style="font-size: 11px; font-weight: 600;">
      Pratonton Dokumen Resmi A4 Landscape · PT Indah Kiat Pulp & Paper Tbk
    </span>
    <button class="btn-print" onclick="window.print()">Cetak Dokumen Sekarang (Print / PDF)</button>
  </div>

  <div class="header" style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 8px;">
    <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; height: 44px; flex-shrink: 0;">
      <img src="/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png" alt="PT Indah Kiat Pulp & Paper" style="height: 32px; width: auto; object-fit: contain;" />
    </div>
    <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0;">
      <img src="/splash-pallet-logo.jpg" alt="Logo Finish Pallet" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px;" />
    </div>
    <div style="flex: 1;">
      <div class="company">PT INDAH KIAT PULP & PAPER TBK</div>
      <div class="unit">WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM</div>
      <div class="title">LAPORAN STOK TAKE & SALDO MUTASI BULANAN PER TANGGAL</div>
    </div>
  </div>

  <div class="meta">
    <span><b>No. Registrasi:</b> ${generateStockTakeDocNumber(matrix.year, matrix.month)}</span>
    <span><b>Periode:</b> ${monthLabel} (Tanggal ${dayStart} s/d ${dayEnd})</span>
    <span><b>Waktu Unduh:</b> ${currentDateStr} WIB</span>
    <span><b>Operator:</b> Semua Operator Finish Pallet</span>
    <span><b>Total Item:</b> ${matrix.rows.length} Ukuran/Jenis Terdaftar</span>
  </div>

  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>
      ${rowsHtml}
      ${totalRowHtml}
    </tbody>
  </table>

  <div class="sig-section">
    <div class="sig-heading">Lembar Verifikasi & Pengesahan Hasil Stok Take Bulanan</div>
    <div class="sig-grid">
      <div class="sig-box">
        <div><b>Dibuat / Dilaporkan Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Operator Finish Pallet</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Diperiksa Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Supervisor Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Disetujui Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Manager Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
    </div>
  </div>
  <div style="margin-top: 18px; padding-top: 6px; border-top: 1px dashed #CBD5E1; font-size: 8px; color: #94A3B8; display: flex; justify-content: space-between;">
    <span>PT Indah Kiat Pulp & Paper Tbk · Workshop Pallet dan Coreplug</span>
    <span>Dokumen Resmi Stok Take Bulanan · Dicetak pada ${currentDateStr} WIB</span>
  </div>
</body>
</html>`;
}

/**
 * Returns printable A4 Portrait HTML for Single Day Stock Take (1 Hari Saja)
 */
export function getPrintableSingleDayHTML(params: {
  singleDay: SingleDayStockResult;
  operatorName: string;
}): string {
  const { singleDay, operatorName } = params;
  const currentDateStr = new Date().toLocaleString('id-ID');

  const rowsHtml = singleDay.rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const typeBadgeStyle = r.typePallet === 'LS'
      ? 'background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; font-weight: bold; border-radius: 3px; padding: 1px 4px;'
      : 'background: #FAF5FF; color: #6B21A8; border: 1px solid #E9D5FF; font-weight: bold; border-radius: 3px; padding: 1px 4px;';
    const statusBadge = r.status === 'KRITIS'
      ? '<span style="background: #FEE2E2; color: #B91C1C; font-weight: bold; border-radius: 3px; padding: 2px 6px; font-size: 9px;">KRITIS</span>'
      : r.status === 'PERHATIAN'
      ? '<span style="background: #FEF3C7; color: #B45309; font-weight: bold; border-radius: 3px; padding: 2px 6px; font-size: 9px;">PERHATIAN</span>'
      : '<span style="background: #D1FAE5; color: #047857; font-weight: bold; border-radius: 3px; padding: 2px 6px; font-size: 9px;">AMAN</span>';
    return `
      <tr style="background: ${bg};">
        <td style="padding: 6px 4px; border: 1px solid #CBD5E1; text-align: center; font-size: 9.5px;">${i + 1}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: left; font-size: 10px; font-weight: bold;">${formatPalletDimension(r.palletSize)}</td>
        <td style="padding: 6px 4px; border: 1px solid #CBD5E1; text-align: center; font-size: 9.5px;">${r.marketType}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: left; font-size: 9.5px;">${r.palletType}</td>
        <td style="padding: 6px 4px; border: 1px solid #CBD5E1; text-align: center; font-size: 9.5px;"><span style="${typeBadgeStyle}">${r.typePallet || 'LS'}</span></td>
        <td style="padding: 6px 4px; border: 1px solid #CBD5E1; text-align: center; font-size: 9.5px;">${r.unit}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: right; font-size: 10px; font-weight: bold; background: #F1F5F9;">${r.startOfDayQty.toLocaleString('id-ID')}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: right; font-size: 10px; color: #047857; font-weight: bold;">+${r.inToday.toLocaleString('id-ID')}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: right; font-size: 10px; color: #B91C1C; font-weight: bold;">-${r.outToday.toLocaleString('id-ID')}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: right; font-size: 10.5px; font-weight: 800; background: #FEF3C7; color: #78350F;">${r.endOfDayQty.toLocaleString('id-ID')}</td>
        <td style="padding: 6px 6px; border: 1px solid #CBD5E1; text-align: center;">${statusBadge}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan Stok Harian ${singleDay.targetDate} - PT Indah Kiat Pulp & Paper Tbk</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 15px;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .company { font-size: 15px; font-weight: 800; color: #0F172A; }
    .unit { font-size: 9.5px; font-weight: 700; color: #047857; margin-top: 1px; }
    .title { font-size: 12px; font-weight: 800; margin-top: 3px; text-transform: uppercase; color: #1E293B; }
    .meta {
      font-size: 9.5px;
      color: #334155;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      background: #F8FAFC;
      padding: 6px 10px;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      padding: 7px 5px;
      border: 1px solid #1E293B;
      background: #0F172A;
      color: #FFFFFF;
      font-size: 9.5px;
      text-transform: uppercase;
    }
    .summary-card {
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: bold;
      color: #78350F;
    }
    .sig-section {
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .sig-heading {
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .sig-grid {
      display: flex;
      justify-content: space-between;
      text-align: center;
      font-size: 9.5px;
    }
    .sig-box { width: 30%; }
    .sig-name {
      margin-top: 45px;
      font-weight: bold;
      text-decoration: underline;
    }
    .sig-desc { font-size: 8.5px; color: #64748B; margin-top: 2px; }
    .no-print-toolbar {
      margin-bottom: 12px;
      background: #1E293B;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-print {
      padding: 6px 14px;
      background: #047857;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 11px;
      cursor: pointer;
    }
    @media print {
      .no-print-toolbar { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <span style="font-size: 11px; font-weight: 600;">
      Pratonton Dokumen Resmi A4 Portrait · PT Indah Kiat Pulp & Paper Tbk
    </span>
    <button class="btn-print" onclick="window.print()">Cetak Dokumen Sekarang (Print / PDF)</button>
  </div>

  <div class="header" style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 8px;">
    <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; height: 44px; flex-shrink: 0;">
      <img src="/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png" alt="PT Indah Kiat Pulp & Paper" style="height: 32px; width: auto; object-fit: contain;" />
    </div>
    <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0;">
      <img src="/splash-pallet-logo.jpg" alt="Logo Finish Pallet" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px;" />
    </div>
    <div style="flex: 1;">
      <div class="company">PT INDAH KIAT PULP & PAPER TBK</div>
      <div class="unit">WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM</div>
      <div class="title">LAPORAN SALDO STOK HARIAN (STOCK TAKE 1 HARI)</div>
    </div>
  </div>

  <div class="meta">
    <span><b>No. Registrasi:</b> ${generateStockTakeDocNumber(undefined, undefined, singleDay.targetDate)}</span>
    <span><b>Tanggal Audit:</b> ${singleDay.formattedDate} (${singleDay.targetDate})</span>
    <span><b>Waktu Unduh:</b> ${currentDateStr} WIB</span>
    <span><b>Operator Yard:</b> Semua Operator Finish Pallet</span>
    <span><b>Total Item:</b> ${singleDay.rows.length} Baris Pallet</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 32px; text-align: center;">NO</th>
        <th style="text-align: left;">UKURAN PALLET</th>
        <th style="text-align: center;">REGION</th>
        <th style="text-align: left;">WRAP TYPE</th>
        <th style="width: 50px; text-align: center;">PALLET RUNNERS</th>
        <th style="text-align: center;">SATUAN</th>
        <th style="text-align: right;">STOK AWAL</th>
        <th style="text-align: right;">PENERIMAAN (+)</th>
        <th style="text-align: right;">PENGELUARAN (-)</th>
        <th style="text-align: right;">STOK AKHIR</th>
        <th style="text-align: center; width: 85px;">STATUS</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="background: #FEF3C7; color: #78350F; font-weight: bold; border-top: 2px solid #0F172A; border-bottom: 3px double #0F172A;">
        <td colspan="6" style="padding: 6px; text-align: left; font-size: 10px;">TOTAL SALDO AKUMULASI HARI INI</td>
        <td style="padding: 6px; text-align: right; font-size: 10px;">${singleDay.totalStart.toLocaleString('id-ID')}</td>
        <td style="padding: 6px; text-align: right; font-size: 10px; color: #047857;">+${singleDay.totalIn.toLocaleString('id-ID')}</td>
        <td style="padding: 6px; text-align: right; font-size: 10px; color: #B91C1C;">-${singleDay.totalOut.toLocaleString('id-ID')}</td>
        <td style="padding: 6px; text-align: right; font-size: 11px; font-weight: 800;">${singleDay.totalEnd.toLocaleString('id-ID')}</td>
        <td style="padding: 6px; text-align: center; font-size: 10px;">-</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-card">
    <span>Ringkasan Mutasi:</span>
    <span>Stok Awal: ${singleDay.totalStart.toLocaleString('id-ID')}</span>
    <span>Penerimaan (+): +${singleDay.totalIn.toLocaleString('id-ID')}</span>
    <span>Pengeluaran (-): -${singleDay.totalOut.toLocaleString('id-ID')}</span>
    <span>Stok Akhir Tersedia: ${singleDay.totalEnd.toLocaleString('id-ID')} Unit</span>
  </div>

  <div class="sig-section">
    <div class="sig-heading">Lembar Verifikasi & Pengesahan Hasil Stok Take Harian</div>
    <div class="sig-grid">
      <div class="sig-box">
        <div><b>Dibuat / Dilaporkan Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Operator Finish Pallet</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Diperiksa Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Supervisor Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Disetujui Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Manager Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
    </div>
  </div>
  <div style="margin-top: 20px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 8.5px; color: #94A3B8; display: flex; justify-content: space-between;">
    <span>PT Indah Kiat Pulp & Paper Tbk · Workshop Pallet dan Coreplug</span>
    <span>Dokumen Resmi Stok Take Harian · Dicetak pada ${currentDateStr} WIB</span>
  </div>
</body>
</html>`;
}

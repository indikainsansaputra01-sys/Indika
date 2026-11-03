import { Transaction, StockItem, QuantityUnit, MarketType, PalletSideType } from '../types';
import { normalizePalletDimension, isAllowed115x140Spec } from './dimensionUtils';

export interface LocationPalletItem {
  palletSize: string;
  palletType: string;
  typePallet: PalletSideType;
  marketType: MarketType;
  unit: QuantityUnit;
  quantity: number;
  lastUpdated: string;
  notes?: string;
}

export interface ColumnStockGroup {
  columnName: string;
  totalQty: number;
  items: LocationPalletItem[];
}

export interface SizeLocationItem {
  columnName: string;
  palletType: string;
  typePallet: PalletSideType;
  marketType: MarketType;
  unit: QuantityUnit;
  quantity: number;
  lastUpdated: string;
  notes?: string;
}

export interface SizeStockGroup {
  palletSize: string;
  totalQty: number;
  columns: SizeLocationItem[];
}

export interface ColumnSummary {
  columnName: string;
  totalQty: number;
  uniqueSizesCount: number;
  totalItemsCount: number;
  sizesList: string[];
}

export interface DailyStockItem {
  id: string;
  palletSize: string;
  palletType: string;
  typePallet: PalletSideType;
  marketType: MarketType;
  unit: QuantityUnit;
  startOfDayQty: number;
  inTodayQty: number;
  outTodayQty: number;
  availableTodayQty: number;
  currentTotalStock: number;
  activeColumns: string[];
  lastUpdated: string;
}

export interface DailyStockSummary {
  targetDate: string;
  totalStartOfDay: number;
  totalInToday: number;
  totalOutToday: number;
  totalAvailableToday: number;
  totalCurrentStock: number;
  items: DailyStockItem[];
}

/**
 * Normalizes column name for grouping while preserving clean formatting
 */
export function normalizeColumnName(name?: string): string {
  if (!name || !name.trim()) return 'Area Transit (Tanpa Kolom)';
  return name.trim().toUpperCase();
}

export interface ParsedColumnAllocation {
  column: string;
  qty: number;
}

/**
 * Parses single or multi-column allocations from strings like:
 * - "F9 30 + F10 10"
 * - "F9 (30 Set) + F10 (10 Set)"
 * - "F9 (30), F10 (10)"
 * - "F9: 30, F10: 10"
 * - "F8 40"
 * - "F8"
 * - "Area Transit"
 *
 * Guarantees that when an outgoing transaction is revised from e.g. "F9 30 + F10 10" to "F8 40",
 * F9 automatically gets 30 refunded, F10 gets 10 refunded, and F8 is deducted by 40.
 */
export function parseColumnAllocations(
  rawColStr?: string | null,
  fallbackQty: number = 0
): ParsedColumnAllocation[] {
  if (!rawColStr || !rawColStr.trim()) {
    return [{ column: 'Area Transit (Tanpa Kolom)', qty: Math.max(0, fallbackQty) }];
  }

  const clean = rawColStr.trim();
  const delimiters = /[,+;\n]+/;
  const rawParts = delimiters.test(clean) ? clean.split(delimiters) : [clean];
  const results: ParsedColumnAllocation[] = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Pattern 1: Column with quantity e.g. "F9 30", "F9 (30)", "F9 (30 Set)", "F9 = 30", "F9: 30"
    const match = trimmed.match(/^(?:kolom\s+)?([a-zA-Z0-9_\s/-]+?)(?:[:=\s(]+)(\d+)(?:\s*(?:set|pcs|set\)|pcs\)))?\)?$/i);
    if (match) {
      const colName = match[1].trim().replace(/^kolom\s+/i, '');
      const parsedQty = parseInt(match[2], 10);
      if (colName && !isNaN(parsedQty) && parsedQty > 0) {
        results.push({
          column: colName.toUpperCase(),
          qty: parsedQty
        });
        continue;
      }
    }

    // Pattern 2: Single column without quantity e.g. "F8", "Area Transit"
    const singleCol = trimmed.replace(/[()]/g, '').trim().replace(/^kolom\s+/i, '');
    if (singleCol) {
      results.push({
        column: singleCol.toUpperCase(),
        qty: Math.max(0, fallbackQty)
      });
    }
  }

  if (results.length === 0) {
    return [{ column: 'Area Transit (Tanpa Kolom)', qty: Math.max(0, fallbackQty) }];
  }

  // If only 1 result and it had no explicit quantity specified, assign fallbackQty
  if (results.length === 1 && (results[0].qty === 0 || (!/\d+/.test(rawParts[0]) && fallbackQty > 0))) {
    results[0].qty = Math.max(0, fallbackQty);
  }

  return results;
}

/**
 * Calculates stock distribution across yard columns/locations from transactions
 */
export function calculateLocationStock(transactions: Transaction[]) {
  // Map: location -> sizeKey -> item
  const locationMap = new Map<string, Map<string, LocationPalletItem>>();

  // Sort transactions chronologically: receipts before shipments on same timestamp
  const sortedTxs = [...transactions].sort((a, b) => {
    const timeA = a.createdAt || `${a.date} ${a.time || '00:00'}`;
    const timeB = b.createdAt || `${b.date} ${b.time || '00:00'}`;
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    if (a.transactionType === 'PENERIMAAN' && b.transactionType === 'PENGELUARAN') return -1;
    if (a.transactionType === 'PENGELUARAN' && b.transactionType === 'PENERIMAAN') return 1;
    return 0;
  });

  for (const tx of sortedTxs) {
    if (!tx) continue;
    const normSize = normalizePalletDimension(tx.palletSize);
    const txTypePallet = tx.typePallet || 'LS';
    const txPalletType = tx.palletType ? String(tx.palletType).trim() : 'Pallet Reamwrap';
    const cleanType = txPalletType.replace(/^pallet\s+/i, '');

    // User requirement: Validasi spek ukuran 115x140
    if (!isAllowed115x140Spec(normSize, tx.palletType, tx.marketType, txTypePallet, tx.unit)) {
      continue;
    }

    const itemKey = `${normSize}__${txTypePallet}__${cleanType.toLowerCase()}__${(tx.marketType ? String(tx.marketType).trim() : 'Lokal').toLowerCase()}__${(tx.unit ? String(tx.unit).trim() : 'Set').toLowerCase()}`;

    if (tx.transactionType === 'PENERIMAAN') {
      const allocations = parseColumnAllocations(tx.pelatakanPallet, tx.quantity);
      for (const alloc of allocations) {
        const targetCol = normalizeColumnName(alloc.column);
        if (!locationMap.has(targetCol)) {
          locationMap.set(targetCol, new Map());
        }
        const colItems = locationMap.get(targetCol)!;
        const existing = colItems.get(itemKey) || {
          palletSize: normSize,
          palletType: txPalletType,
          typePallet: txTypePallet,
          marketType: tx.marketType || 'Lokal',
          unit: tx.unit || 'Set',
          quantity: 0,
          lastUpdated: tx.date || '',
          notes: tx.notes?.trim() || ''
        };
        existing.quantity += alloc.qty;
        existing.lastUpdated = tx.date;
        if (tx.notes?.trim()) {
          existing.notes = tx.notes.trim();
        }
        colItems.set(itemKey, existing);
      }
    } else if (tx.transactionType === 'PENGELUARAN') {
      const allocations = parseColumnAllocations(tx.pelatakanPallet, tx.quantity);
      let remainingNeeded = tx.quantity;

      // 1. Kurangi dari alokasi kolom-kolom yang dicatat di transaksi
      for (const alloc of allocations) {
        const cName = normalizeColumnName(alloc.column);
        if (locationMap.has(cName)) {
          const colItemsMap = locationMap.get(cName)!;
          if (colItemsMap.has(itemKey)) {
            const it = colItemsMap.get(itemKey)!;
            const take = Math.min(it.quantity, alloc.qty, remainingNeeded);
            it.quantity -= take;
            it.lastUpdated = tx.date;
            remainingNeeded -= take;
          }
        }
      }

      // 2. Jika masih ada sisa pengeluaran (misal saldo kolom kurang atau belum dicatat),
      // kurangi dari kolom lain yang menyimpan ukuran/spek pallet ini
      if (remainingNeeded > 0) {
        const primaryCols = new Set(allocations.map(a => normalizeColumnName(a.column)));
        for (const [cName, itemsMap] of locationMap.entries()) {
          if (remainingNeeded <= 0) break;
          if (primaryCols.has(cName)) continue;
          if (itemsMap.has(itemKey)) {
            const it = itemsMap.get(itemKey)!;
            if (it.quantity > 0) {
              const take = Math.min(it.quantity, remainingNeeded);
              it.quantity -= take;
              it.lastUpdated = tx.date;
              remainingNeeded -= take;
            }
          }
        }
      }
    } else if (tx.transactionType === 'PINDAH_KOLOM') {
      // 1. Kurangi dari kolom asal
      const sourceCol = normalizeColumnName(tx.pelatakanPallet);
      if (!locationMap.has(sourceCol)) {
        locationMap.set(sourceCol, new Map());
      }
      const sourceColItems = locationMap.get(sourceCol)!;
      const sourceExisting = sourceColItems.get(itemKey) || {
        palletSize: normSize,
        palletType: txPalletType,
        typePallet: txTypePallet,
        marketType: tx.marketType || 'Lokal',
        unit: tx.unit || 'Set',
        quantity: 0,
        lastUpdated: tx.date || ''
      };
      sourceExisting.quantity = Math.max(0, sourceExisting.quantity - tx.quantity);
      sourceExisting.lastUpdated = tx.date;
      sourceColItems.set(itemKey, sourceExisting);

      // 2. Tambahkan ke kolom tujuan relokasi
      const targetCol = normalizeColumnName(tx.kolomTujuan);
      if (!locationMap.has(targetCol)) {
        locationMap.set(targetCol, new Map());
      }
      const targetColItems = locationMap.get(targetCol)!;
      const targetExisting = targetColItems.get(itemKey) || {
        palletSize: normSize,
        palletType: txPalletType,
        typePallet: txTypePallet,
        marketType: tx.marketType || 'Lokal',
        unit: tx.unit || 'Set',
        quantity: 0,
        lastUpdated: tx.date || ''
      };
      targetExisting.quantity += tx.quantity;
      targetExisting.lastUpdated = tx.date;
      targetColItems.set(itemKey, targetExisting);
    } else if (tx.transactionType === 'UBAH_SPEK') {
      // 1. Kurangi dari kolom asal untuk Spek Asal
      const sourceCol = normalizeColumnName(tx.pelatakanPallet);
      if (!locationMap.has(sourceCol)) {
        locationMap.set(sourceCol, new Map());
      }
      const sourceColItems = locationMap.get(sourceCol)!;
      const sourceExisting = sourceColItems.get(itemKey) || {
        palletSize: normSize,
        palletType: txPalletType,
        typePallet: txTypePallet,
        marketType: tx.marketType || 'Lokal',
        unit: tx.unit || 'Set',
        quantity: 0,
        lastUpdated: tx.date || ''
      };
      sourceExisting.quantity = Math.max(0, sourceExisting.quantity - tx.quantity);
      sourceExisting.lastUpdated = tx.date;
      sourceColItems.set(itemKey, sourceExisting);

      // 2. Tambahkan ke kolom tujuan untuk Spek Baru (targetPalletType)
      const targetCol = normalizeColumnName(tx.kolomTujuan || tx.pelatakanPallet);
      if (!locationMap.has(targetCol)) {
        locationMap.set(targetCol, new Map());
      }
      const targetColItems = locationMap.get(targetCol)!;
      const targetPalletType = tx.targetPalletType ? String(tx.targetPalletType).trim() : 'Pallet Bulkpack';
      const targetItemKey = `${normSize}__${txTypePallet}__${targetPalletType.toLowerCase()}__${(tx.marketType || 'Lokal').toLowerCase()}__${(tx.unit || 'Set').toLowerCase()}`;
      const targetExisting = targetColItems.get(targetItemKey) || {
        palletSize: normSize,
        palletType: targetPalletType,
        typePallet: txTypePallet,
        marketType: tx.marketType || 'Lokal',
        unit: tx.unit || 'Set',
        quantity: 0,
        lastUpdated: tx.date || ''
      };
      targetExisting.quantity += tx.quantity;
      targetExisting.lastUpdated = tx.date;
      targetColItems.set(targetItemKey, targetExisting);
    }
  }

  // 1. Group By Column (contoh: di kolom F14 ada ukuran apa saja & berapa quantity)
  const byColumn: ColumnStockGroup[] = [];
  locationMap.forEach((itemsMap, colName) => {
    const activeItems = Array.from(itemsMap.values()).filter(
      it => it.quantity > 0
    );
    if (activeItems.length > 0) {
      const totalQty = activeItems.reduce((acc, it) => acc + it.quantity, 0);
      byColumn.push({
        columnName: colName,
        totalQty,
        items: activeItems.sort((a, b) => b.quantity - a.quantity)
      });
    }
  });

  // Sort columns: named columns first, Transit at the end
  byColumn.sort((a, b) => {
    if (a.columnName.startsWith('Area Transit')) return 1;
    if (b.columnName.startsWith('Area Transit')) return -1;
    return a.columnName.localeCompare(b.columnName, undefined, { numeric: true, sensitivity: 'base' });
  });

  // 2. Group By Pallet Size (contoh: 81x111 ada di kolom berapa saja dan quantity berapa saja)
  const sizeMap = new Map<string, Map<string, SizeLocationItem>>();

  byColumn.forEach(col => {
    col.items.forEach(it => {
      const sizeKey = normalizePalletDimension(it.palletSize);
      if (!sizeMap.has(sizeKey)) {
        sizeMap.set(sizeKey, new Map());
      }
      const colMapForSize = sizeMap.get(sizeKey)!;
      const itPalletType = it.palletType ? String(it.palletType).trim() : 'Pallet Reamwrap';
      const existingKey = `${col.columnName}__${it.typePallet || 'LS'}__${itPalletType}__${it.marketType}__${it.unit}`;
      const existing = colMapForSize.get(existingKey) || {
        columnName: col.columnName,
        palletType: itPalletType,
        typePallet: it.typePallet,
        marketType: it.marketType,
        unit: it.unit,
        quantity: 0,
        lastUpdated: it.lastUpdated,
        notes: it.notes || ''
      };
      existing.quantity += it.quantity;
      if (it.notes) {
        existing.notes = it.notes;
      }
      colMapForSize.set(existingKey, existing);
    });
  });

  const bySize: SizeStockGroup[] = [];
  sizeMap.forEach((colMap, palletSize) => {
    const activeCols = Array.from(colMap.values()).filter(c => c.quantity > 0);
    if (activeCols.length > 0) {
      const totalQty = activeCols.reduce((acc, c) => acc + c.quantity, 0);
      bySize.push({
        palletSize,
        totalQty,
        columns: activeCols.sort((a, b) => b.quantity - a.quantity)
      });
    }
  });

  bySize.sort((a, b) => a.palletSize.localeCompare(b.palletSize, undefined, { numeric: true }));

  // 3. Overall Columns Summary (Data stok keseluruhan kolom)
  const overallColumns: ColumnSummary[] = byColumn.map(col => {
    const uniqueSizes = Array.from(new Set(col.items.map(it => it.palletSize)));
    return {
      columnName: col.columnName,
      totalQty: col.totalQty,
      uniqueSizesCount: uniqueSizes.length,
      totalItemsCount: col.items.length,
      sizesList: uniqueSizes
    };
  });

  const grandTotalAllColumns = overallColumns.reduce((acc, c) => acc + c.totalQty, 0);

  return {
    byColumn,
    bySize,
    overallColumns,
    grandTotalAllColumns
  };
}

/**
 * Calculates stock available on a specific date (Tampilan data stok yang tersedia di hari itu)
 */
export function calculateDailyStock(
  targetDate: string,
  stocks: StockItem[],
  transactions: Transaction[]
): DailyStockSummary {
  // Aggregate transactions up to targetDate and on targetDate
  // Key: palletSize__typePallet__palletType__marketType__unit
  const itemMap = new Map<string, {
    palletSize: string;
    palletType: string;
    typePallet: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    startQty: number;
    inToday: number;
    outToday: number;
    lastUpdated: string;
    activeColumns: Set<string>;
  }>();

  // Helper to get or create map entry
  const getEntry = (palletSize: string, palletType: string, typePallet: PalletSideType = 'LS', marketType: MarketType, unit: QuantityUnit) => {
    const normSize = normalizePalletDimension(palletSize);
    const pTypeStr = palletType ? String(palletType).trim() : 'Pallet Reamwrap';
    const mktStr = marketType ? String(marketType).trim() : 'Lokal';
    const unitStr = unit ? String(unit).trim() : 'Set';
    const key = `${normSize}__${typePallet}__${pTypeStr.toLowerCase()}__${mktStr.toLowerCase()}__${unitStr.toLowerCase()}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        palletSize: normSize,
        palletType: pTypeStr,
        typePallet,
        marketType,
        unit,
        startQty: 0,
        inToday: 0,
        outToday: 0,
        lastUpdated: targetDate,
        activeColumns: new Set()
      });
    }
    return itemMap.get(key)!;
  };

  // 1. Process all transactions
  transactions.forEach(tx => {
    const txTypePallet = tx.typePallet || 'LS';
    if (!isAllowed115x140Spec(tx.palletSize, tx.palletType, tx.marketType, txTypePallet, tx.unit)) {
      return;
    }
    const entry = getEntry(tx.palletSize, tx.palletType, txTypePallet, tx.marketType, tx.unit);

    if (tx.date < targetDate) {
      // Prior to today: affects starting balance of the day
      if (tx.transactionType === 'PENERIMAAN') {
        entry.startQty += tx.quantity;
      } else {
        entry.startQty = Math.max(0, entry.startQty - tx.quantity);
      }
    } else if (tx.date === targetDate) {
      // Exactly on targetDate
      if (tx.transactionType === 'PENERIMAAN') {
        entry.inToday += tx.quantity;
      } else {
        entry.outToday += tx.quantity;
      }
      entry.lastUpdated = tx.date;
      if (tx.pelatakanPallet && tx.pelatakanPallet.trim()) {
        entry.activeColumns.add(tx.pelatakanPallet.trim());
      }
    }

    if (tx.pelatakanPallet && tx.pelatakanPallet.trim()) {
      entry.activeColumns.add(tx.pelatakanPallet.trim());
    }
  });

  // 2. Also ensure all items from current `stocks` are represented if they exist
  stocks.forEach(stk => {
    const stkTypePallet = stk.typePallet || 'LS';
    if (!isAllowed115x140Spec(stk.palletSize, stk.palletType, stk.marketType, stkTypePallet, stk.unit)) {
      return;
    }
    const entry = getEntry(stk.palletSize, stk.palletType, stkTypePallet, stk.marketType, stk.unit);
    // If no transactions happened yet, startQty or availableQty equals current stock
    if (entry.startQty === 0 && entry.inToday === 0 && entry.outToday === 0 && stk.quantity > 0) {
      entry.startQty = stk.quantity;
      entry.lastUpdated = stk.lastUpdated || targetDate;
    }
  });

  // 3. Build array of DailyStockItem
  const items: DailyStockItem[] = [];
  let totalStartOfDay = 0;
  let totalInToday = 0;
  let totalOutToday = 0;
  let totalAvailableToday = 0;
  let totalCurrentStock = 0;

  itemMap.forEach((data, key) => {
    if (!isAllowed115x140Spec(data.palletSize, data.palletType, data.marketType, data.typePallet, data.unit)) {
      return;
    }
    // Current stock from stocks array matching this item
    const matchedStock = stocks.find(
      s =>
        s &&
        normalizePalletDimension(s.palletSize) === data.palletSize &&
        (s.typePallet || 'LS') === data.typePallet &&
        (s.palletType ? String(s.palletType).trim().toLowerCase() : '') === data.palletType.toLowerCase() &&
        (s.marketType ? String(s.marketType).trim().toLowerCase() : '') === String(data.marketType).toLowerCase() &&
        (s.unit ? String(s.unit).trim().toLowerCase() : '') === String(data.unit).toLowerCase()
    );

    const currentTotal = matchedStock ? matchedStock.quantity : Math.max(0, data.startQty + data.inToday - data.outToday);
    const availableToday = Math.max(0, data.startQty + data.inToday - data.outToday);
    const effectiveStartQty = data.startQty;

    // Sesuai permintaan user: tetap sertakan jika tercatat di master/stok meskipun saldo 0
    if (effectiveStartQty > 0 || data.inToday > 0 || data.outToday > 0 || currentTotal > 0 || matchedStock !== undefined) {
      items.push({
        id: `daily_${key}`,
        palletSize: data.palletSize,
        palletType: data.palletType,
        typePallet: data.typePallet,
        marketType: data.marketType,
        unit: data.unit,
        startOfDayQty: effectiveStartQty,
        inTodayQty: data.inToday,
        outTodayQty: data.outToday,
        availableTodayQty: availableToday,
        currentTotalStock: currentTotal,
        activeColumns: Array.from(data.activeColumns),
        lastUpdated: data.lastUpdated
      });

      totalStartOfDay += data.startQty;
      totalInToday += data.inToday;
      totalOutToday += data.outToday;
      totalAvailableToday += availableToday;
      totalCurrentStock += currentTotal;
    }
  });

  // Sort by pallet size
  items.sort((a, b) => a.palletSize.localeCompare(b.palletSize, undefined, { numeric: true }));

  return {
    targetDate,
    totalStartOfDay,
    totalInToday,
    totalOutToday,
    totalAvailableToday,
    totalCurrentStock,
    items
  };
}

/**
 * Gets exact live available stock per yard column for a specific pallet configuration.
 * Strictly sorts transactions chronologically (receipts before shipments on same timestamp)
 * and calculates running balances per column, preventing stale or phantom stock numbers.
 */
export function getAvailableColumnsForPallet(params: {
  transactions: Transaction[];
  palletSize: string;
  palletType: string;
  typePallet?: PalletSideType;
  unit: QuantityUnit;
  marketType?: MarketType;
}): Array<{ col: string; qty: number; notes?: string }> {
  const { transactions, palletSize, palletType, typePallet = 'LS', unit, marketType } = params;
  if (!palletSize || !palletSize.trim()) return [];

  const cleanSize = normalizePalletDimension(palletSize);
  const cleanType = (palletType || '').trim().toLowerCase().replace(/^pallet\s+/i, '');
  const cleanTypePallet = (typePallet || 'LS').toUpperCase();
  const cleanUnit = (unit || 'Set').trim().toLowerCase();
  const normalizeMarket = (m?: string) => (m || 'Lokal').trim().toLowerCase().replace(/^export$/, 'ekspor');
  const cleanMarket = normalizeMarket(marketType);

  // Gunakan kalkulasi ground-truth posisi peletakan kolom resmi
  const locStock = calculateLocationStock(transactions);
  const matchedSizeGroup = locStock.bySize.find(
    s => normalizePalletDimension(s.palletSize) === cleanSize
  );

  if (!matchedSizeGroup) return [];

  const matchingCols = matchedSizeGroup.columns.filter(c => {
    const cType = (c.palletType || '').trim().toLowerCase().replace(/^pallet\s+/i, '');
    const cTypePallet = (c.typePallet || 'LS').toUpperCase();
    const cUnit = (c.unit || 'Set').trim().toLowerCase();
    const cMarket = normalizeMarket(c.marketType);

    return (
      cType === cleanType &&
      cTypePallet === cleanTypePallet &&
      cUnit === cleanUnit &&
      cMarket === cleanMarket &&
      c.quantity > 0
    );
  });

  return matchingCols
    .map(c => ({
      col: c.columnName,
      qty: c.quantity,
      notes: c.notes || ''
    }))
    .sort((a, b) => a.col.localeCompare(b.col, undefined, { numeric: true }));
}

/**
 * Formats detailed column breakdown string for reports and UI
 * Example output: "F11 = 500, F9 = 500"
 */
export function getPalletColumnDetailString(params: {
  transactions: Transaction[];
  palletSize: string;
  palletType: string;
  typePallet?: PalletSideType;
  unit: QuantityUnit;
  marketType?: MarketType;
  totalQuantity: number;
}): string {
  if (params.totalQuantity <= 0) return '-';

  const colBreakdown = getAvailableColumnsForPallet({
    transactions: params.transactions,
    palletSize: params.palletSize,
    palletType: params.palletType,
    typePallet: params.typePallet,
    unit: params.unit,
    marketType: params.marketType
  });

  if (colBreakdown.length === 0) {
    return `Transit = ${params.totalQuantity}`;
  }

  const sumCols = colBreakdown.reduce((sum, c) => sum + c.qty, 0);

  if (sumCols === params.totalQuantity) {
    return colBreakdown.map((c) => `${c.col} = ${c.qty}`).join(', ');
  }

  if (sumCols < params.totalQuantity) {
    const unassigned = params.totalQuantity - sumCols;
    const parts = colBreakdown.map((c) => `${c.col} = ${c.qty}`);
    if (unassigned > 0) {
      parts.push(`Transit = ${unassigned}`);
    }
    return parts.join(', ');
  }

  // If sumCols > params.totalQuantity (e.g. some outbound didn't tag column)
  let remaining = params.totalQuantity;
  const parts: string[] = [];
  for (const c of colBreakdown) {
    if (remaining <= 0) break;
    const allocated = Math.min(c.qty, remaining);
    if (allocated > 0) {
      parts.push(`${c.col} = ${allocated}`);
      remaining -= allocated;
    }
  }
  return parts.length > 0 ? parts.join(', ') : colBreakdown.map((c) => `${c.col} = ${c.qty}`).join(', ');
}

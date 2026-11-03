import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Boxes,
  Search,
  Filter,
  Download,
  Printer,
  SlidersHorizontal,
  History,
  X,
  Eye,
  Calendar,
  MapPin,
  Grid,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  WifiOff
} from 'lucide-react';
import { exportToExcel, exportToCSV, generateStockTakeDocNumber } from '../../utils/exportUtils';
import { exportToPDF, formatPalletDimension } from '../../utils/pdfExportUtils';
import { PrintReportModal } from '../common/PrintReportModal';
import { StockItem, MarketType, QuantityUnit } from '../../types';
import { calculateLocationStock, calculateDailyStock, getPalletColumnDetailString } from '../../utils/stockLocationUtils';
import {
  normalizePalletDimension,
  isAllowed115x140Spec,
  formatTypePallet,
  formatJenisPallet,
  formatMarketType,
  formatSatuan
} from '../../utils/dimensionUtils';
import { formatDateIndo } from '../../utils/monthlyStockUtils';

interface DataStokProps {
  onNavigateToHistory: (filterQuery: { size?: string; type?: string; txType?: 'ALL' | 'PENERIMAAN' | 'PENGELUARAN' }) => void;
}

export const DataStok: React.FC<DataStokProps> = ({ onNavigateToHistory }) => {
  const {
    stocks,
    thresholds,
    updateThresholds,
    transactions,
    isOperator,
    currentUser,
    masterSizes,
    masterTypes,
    showNotification
  } = useApp();

  const getToday = () => new Date().toISOString().split('T')[0];

  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Main Tabs: Saldo Aktual vs Stok Tersedia Hari Ini vs Mapping Kolom Peletakan
  const [activeMainTab, setActiveMainTab] = useState<'saldo-aktual' | 'stok-harian' | 'mapping-kolom'>('saldo-aktual');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Tab 1 (Saldo Aktual) Filter State: Rentang Waktu, Ukuran, Shift, Lokal/Ekspor, Jenis Pallet, Type Pallet, Satuan
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterShift, setFilterShift] = useState('ALL');
  const [search, setSearch] = useState('');
  const [filterMarket, setFilterMarket] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterTypePallet, setFilterTypePallet] = useState<'ALL' | 'LS' | 'SS'>('ALL');
  const [filterUnit, setFilterUnit] = useState<'ALL' | 'Set' | 'Pcs'>('ALL');
  const [selectedStockForDetail, setSelectedStockForDetail] = useState<StockItem | null>(null);

  // Tab 2 (Stok Hari Ini / Per Tanggal) State
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const [dailyStartDate, setDailyStartDate] = useState('');
  const [dailyEndDate, setDailyEndDate] = useState('');
  const [dailyFilterShift, setDailyFilterShift] = useState('ALL');
  const [dailySearch, setDailySearch] = useState('');
  const [dailyFilterMarket, setDailyFilterMarket] = useState<'ALL' | 'Lokal' | 'Ekspor'>('ALL');
  const [dailyFilterType, setDailyFilterType] = useState('ALL');
  const [dailyFilterTypePallet, setDailyFilterTypePallet] = useState<'ALL' | 'LS' | 'SS'>('ALL');
  const [dailyFilterUnit, setDailyFilterUnit] = useState<'ALL' | 'Set' | 'Pcs'>('ALL');

  // Tab 3 (Mapping Kolom Yard) Sub-Mode State
  const [mappingSubMode, setMappingSubMode] = useState<'by-column' | 'by-size' | 'rekap-semua'>('by-column');
  const [columnSearch, setColumnSearch] = useState('');
  const [columnFilterTypePallet, setColumnFilterTypePallet] = useState<'ALL' | 'LS' | 'SS'>('ALL');

  // Threshold Configuration Modal State
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [tempSafe, setTempSafe] = useState(thresholds.safeMin);
  const [tempWarning, setTempWarning] = useState(thresholds.warningMin);

  // Ground-truth mapping yard columns (dihitung sekali saat transactions berubah, bukan tiap render baris tabel)
  const locationStockData = useMemo(() => {
    return calculateLocationStock(transactions);
  }, [transactions]);

  // Fast O(1) column lookup map to avoid recalculating entire transactions history on every table row
  const palletColumnBreakdownMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sz of locationStockData.bySize) {
      const normSize = normalizePalletDimension(sz.palletSize);
      for (const c of sz.columns) {
        if (c.quantity <= 0) continue;
        const cType = (c.palletType || '').trim().toLowerCase().replace(/^pallet\s+/i, '');
        const cTypePallet = (c.typePallet || 'LS').toUpperCase();
        const cMarket = (c.marketType || 'Lokal').trim().toLowerCase().replace(/^export$/, 'ekspor');
        const cUnit = (c.unit || 'Set').trim().toLowerCase();
        const key = `${normSize}__${cTypePallet}__${cType}__${cMarket}__${cUnit}`;

        const prev = map.get(key);
        const piece = `${c.columnName} = ${c.quantity}`;
        map.set(key, prev ? `${prev}, ${piece}` : piece);
      }
    }
    return map;
  }, [locationStockData]);

  // --- TAB 1 COMPUTATIONS: Saldo Stok Fisik Aktual ---
  // Base catalog of stocks:
  // Menggabungkan seluruh data stok aktual, master ukuran, dan riwayat transaksi.
  // Terpisah dari state 'search' agar tidak menghitung ulang seluruh database pada setiap ketikan karakter.
  const baseCatalogStocks = useMemo(() => {
    const map = new Map<string, StockItem>();

    // 1. Masukkan semua stok yang ada di database / memory
    for (const s of stocks) {
      if (!s) continue;
      const normSize = normalizePalletDimension(s.palletSize);
      if (!normSize) continue;
      const typePal = s.typePallet || 'LS';
      const pType = s.palletType ? String(s.palletType).trim() : 'Pallet Reamwrap';
      const mkt = s.marketType ? String(s.marketType).trim() : 'Lokal';
      const unt = s.unit ? String(s.unit).trim() : 'Set';
      if (!isAllowed115x140Spec(normSize, pType, mkt, typePal, unt)) {
        continue;
      }
      const rawQty = typeof s.quantity === 'number' && !isNaN(s.quantity) ? Math.max(0, s.quantity) : 0;
      // Jangan masukkan spek jika tidak memiliki riwayat transaksi sama sekali di sistem
      // (contoh spek salah input seperti 82x82 Set yang sudah direvisi menjadi Pcs, agar tidak timbul duplikat data atau jatuh ke status Transit)
      if (transactions.length > 0) {
        const hasTx = transactions.some(t =>
          t &&
          normalizePalletDimension(t.palletSize) === normSize &&
          (t.typePallet || 'LS') === typePal &&
          (t.palletType || '').trim().toLowerCase() === pType.toLowerCase() &&
          (t.marketType || 'Lokal').trim().toLowerCase() === mkt.toLowerCase() &&
          (t.unit || 'Set').trim().toLowerCase() === unt.toLowerCase()
        );
        if (!hasTx) {
          continue;
        }
      }
      const key = `${normSize}__${typePal}__${pType.toLowerCase()}__${mkt.toLowerCase()}__${unt.toLowerCase()}`;
      map.set(key, {
        ...s,
        palletSize: normSize,
        typePallet: typePal,
        palletType: pType,
        marketType: mkt as any,
        unit: unt as any,
        quantity: rawQty
      });
    }

    // 2. Masukkan semua ukuran dari masterSizes (jika belum ada, sertakan dengan saldo 0)
    for (const ms of masterSizes) {
      if (!ms) continue;
      const normSize = normalizePalletDimension(ms.name);
      if (!normSize) continue;
      const key = `${normSize}__LS__pallet reamwrap__lokal__set`;
      if (!map.has(key)) {
        map.set(key, {
          id: `master_${normSize}_LS_rw_lokal`,
          palletSize: normSize,
          palletType: 'Pallet Reamwrap',
          typePallet: 'LS',
          marketType: 'Lokal',
          unit: 'Set',
          quantity: 0,
          lastUpdated: '-'
        });
      }
    }

    // 3. Masukkan semua riwayat ukuran dari transaksi (jika stoknya sekarang 0 atau belum ada di map)
    for (const t of transactions) {
      if (!t) continue;
      const normSize = normalizePalletDimension(t.palletSize);
      if (!normSize) continue;
      const typePal = t.typePallet || 'LS';
      const pType = t.palletType ? String(t.palletType).trim() : 'Pallet Reamwrap';
      const mkt = t.marketType ? String(t.marketType).trim() : 'Lokal';
      const unt = t.unit ? String(t.unit).trim() : 'Set';
      if (!isAllowed115x140Spec(normSize, pType, mkt, typePal, unt)) {
        continue;
      }
      const key = `${normSize}__${typePal}__${pType.toLowerCase()}__${mkt.toLowerCase()}__${unt.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          id: `tx_${normSize}_${typePal}_${pType}_${mkt}_${unt}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
          palletSize: normSize,
          palletType: pType,
          typePallet: typePal,
          marketType: mkt as MarketType,
          unit: unt as QuantityUnit,
          quantity: 0,
          lastUpdated: t.date || '-'
        });
      }
    }

    return Array.from(map.values());
  }, [stocks, masterSizes, transactions]);

  // Set lookup instan O(1) untuk filter shift & tanggal agar tidak melakukan loop bersarang transaksi
  const activeShiftOrDateItemKeys = useMemo(() => {
    if (filterShift === 'ALL' && !startDate && !endDate) return null;
    const set = new Set<string>();
    for (const t of transactions) {
      if (!t) continue;
      if (filterShift !== 'ALL' && t.shift !== filterShift) continue;
      if (startDate && t.date < startDate) continue;
      if (endDate && t.date > endDate) continue;
      const nSize = normalizePalletDimension(t.palletSize);
      set.add(`${nSize}__${t.marketType}`);
    }
    return set;
  }, [transactions, filterShift, startDate, endDate]);

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normQ = normalizePalletDimension(q);
    const qTokens = q ? q.split(/\s+/).filter(Boolean) : [];

    let list = baseCatalogStocks;

    // Sesuai instruksi user: jika user mencari suatu ukuran (contoh: "63x88"),
    // jika stoknya 0 atau belum terdaftar di katalog, tetap munculkan di hasil pencarian
    if (normQ && /\d/.test(normQ)) {
      const hasMatchingSize = baseCatalogStocks.some(
        it => normalizePalletDimension(it.palletSize) === normQ
      );
      if (!hasMatchingSize) {
        list = [
          ...baseCatalogStocks,
          {
            id: `search_placeholder_${normQ}`,
            palletSize: normQ,
            palletType: filterType !== 'ALL' ? filterType : 'Pallet Reamwrap',
            typePallet: filterTypePallet !== 'ALL' ? filterTypePallet : 'LS',
            marketType: (filterMarket !== 'ALL' ? filterMarket : 'Lokal') as 'Lokal' | 'Ekspor',
            unit: (filterUnit !== 'ALL' ? filterUnit : 'Set') as 'Set' | 'Pcs',
            quantity: 0,
            lastUpdated: '-'
          }
        ];
      }
    }

    return list.filter((item) => {
      const normItemSize = normalizePalletDimension(item.palletSize);
      const isSizeQuery = Boolean(normQ) && normItemSize.includes(normQ);

      if (qTokens.length > 0 && !isSizeQuery) {
        const itemType = formatTypePallet(item.typePallet).toUpperCase();
        const itemTypeFull = itemType === 'LS' ? 'long side' : 'short side';
        const searchableText = `${item.palletSize} ${normItemSize} ${itemType} ${itemTypeFull} ${item.palletType} ${item.marketType} ${item.unit}`.toLowerCase();
        const matchSearch = qTokens.every(tok => searchableText.includes(tok));
        if (!matchSearch) return false;
      }

      const matchMarket = filterMarket === 'ALL' || item.marketType === filterMarket;
      const matchType =
        filterType === 'ALL' ||
        item.palletType === filterType ||
        (filterType === 'Pallet Reamwrap' && item.palletType.toLowerCase().includes('reamwrap')) ||
        (filterType === 'Pallet Bulkpack' && item.palletType.toLowerCase().includes('bulkpack')) ||
        (filterType === 'Pallet Racuk' && item.palletType.toLowerCase().includes('racuk')) ||
        (filterType === 'Pallet Sirkulasi' && item.palletType.toLowerCase().includes('sirkulasi'));
      const matchTypePallet = filterTypePallet === 'ALL' || formatTypePallet(item.typePallet) === filterTypePallet;
      const matchUnit = filterUnit === 'ALL' || item.unit?.toLowerCase() === filterUnit.toLowerCase();

      if (!matchMarket || !matchType || !matchTypePallet || !matchUnit) return false;

      // Jika user sedang mencari ukuran langsung, loloskan agar tetap muncul
      if (q && isSizeQuery) return true;

      // Filter Shift & Rentang Waktu (O(1) Set Lookup)
      if (activeShiftOrDateItemKeys) {
        const itemDate = item.lastUpdated ? item.lastUpdated.substring(0, 10) : '';
        const matchDateDirect = Boolean(itemDate) && (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
        const matchTxSet = activeShiftOrDateItemKeys.has(`${normItemSize}__${item.marketType}`);
        if (!matchDateDirect && !matchTxSet) return false;
      }

      return true;
    });
  }, [baseCatalogStocks, search, filterMarket, filterType, filterTypePallet, filterUnit, activeShiftOrDateItemKeys, startDate, endDate]);

  const totalQty = useMemo(() => {
    return filteredStocks.reduce((sum, s) => sum + Math.max(0, s.quantity), 0);
  }, [filteredStocks]);

  const uniquePalletTypes = useMemo(() => {
    const list = (masterTypes || []).filter(m => m.active).map(m => m.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);

  // --- TAB 2 COMPUTATIONS: Stok Tersedia di Hari Itu ---
  const dailyStockSummary = useMemo(() => {
    const targetDate = dailyEndDate || dailyStartDate || selectedDate;
    return calculateDailyStock(targetDate, baseCatalogStocks, transactions);
  }, [selectedDate, dailyStartDate, dailyEndDate, baseCatalogStocks, transactions]);

  const filteredDailyItems = useMemo(() => {
    let items = [...dailyStockSummary.items];
    const q = dailySearch.trim().toLowerCase();
    const normQ = normalizePalletDimension(q);

    // Jika user mencari ukuran tertentu di Tab 2 tapi belum ada saldo, munculkan placeholder 0
    if (normQ && /\d/.test(normQ)) {
      const hasMatch = items.some(it => normalizePalletDimension(it.palletSize) === normQ);
      if (!hasMatch) {
        items.push({
          id: `daily_placeholder_${normQ}`,
          palletSize: normQ,
          palletType: dailyFilterType !== 'ALL' ? dailyFilterType : 'Pallet Reamwrap',
          typePallet: dailyFilterTypePallet !== 'ALL' ? dailyFilterTypePallet : 'LS',
          marketType: dailyFilterMarket !== 'ALL' ? dailyFilterMarket : 'Lokal',
          unit: dailyFilterUnit !== 'ALL' ? dailyFilterUnit : 'Set',
          startOfDayQty: 0,
          inTodayQty: 0,
          outTodayQty: 0,
          availableTodayQty: 0,
          currentTotalStock: 0,
          activeColumns: [],
          lastUpdated: '-'
        });
      }
    }

    return items.filter((item) => {
      const normItemSize = normalizePalletDimension(item.palletSize);

      const itemType = formatTypePallet(item.typePallet).toUpperCase();
      const itemTypeFull = itemType === 'LS' ? 'long side' : 'short side';
      const qTokens = q ? q.split(/\s+/).filter(Boolean) : [];

      const colsStr = item.activeColumns.join(' ').toLowerCase();
      const searchableText = `${item.palletSize} ${normItemSize} ${itemType} ${itemTypeFull} ${item.palletType} ${item.marketType} ${item.unit} ${colsStr}`.toLowerCase();
      
      const isSizeQuery = Boolean(normQ) && normItemSize.includes(normQ);
      const matchSearch = qTokens.length === 0 ||
        qTokens.every(tok => searchableText.includes(tok)) ||
        isSizeQuery;

      if (!matchSearch) return false;

      const matchMarket = dailyFilterMarket === 'ALL' || item.marketType === dailyFilterMarket;
      const matchType =
        dailyFilterType === 'ALL' ||
        item.palletType === dailyFilterType ||
        (dailyFilterType === 'Pallet Reamwrap' && item.palletType.toLowerCase().includes('reamwrap')) ||
        (dailyFilterType === 'Pallet Bulkpack' && item.palletType.toLowerCase().includes('bulkpack')) ||
        (dailyFilterType === 'Pallet Racuk' && item.palletType.toLowerCase().includes('racuk')) ||
        (dailyFilterType === 'Pallet Sirkulasi' && item.palletType.toLowerCase().includes('sirkulasi'));
      const matchTypePallet = dailyFilterTypePallet === 'ALL' || formatTypePallet(item.typePallet) === dailyFilterTypePallet;
      const matchUnit = dailyFilterUnit === 'ALL' || item.unit?.toLowerCase() === dailyFilterUnit.toLowerCase();

      // Sesuai permintaan user: ketika mencari suatu ukuran, jika stoknya 0 tetap muncul dipencarian
      if (q && isSizeQuery) {
        return matchMarket && matchType && matchTypePallet && matchUnit;
      }

      // Shift Filter Tab 2
      const matchShift = dailyFilterShift === 'ALL' || transactions.some((t) =>
        normalizePalletDimension(t.palletSize) === normalizePalletDimension(item.palletSize) &&
        t.marketType === item.marketType &&
        t.shift === dailyFilterShift &&
        (!dailyStartDate || t.date >= dailyStartDate) &&
        (!dailyEndDate || t.date <= dailyEndDate)
      );

      // Rentang Waktu (s/d) Filter Tab 2
      const matchDateRange =
        (!dailyStartDate && !dailyEndDate) ||
        transactions.some((t) =>
          normalizePalletDimension(t.palletSize) === normalizePalletDimension(item.palletSize) &&
          t.marketType === item.marketType &&
          (!dailyStartDate || t.date >= dailyStartDate) &&
          (!dailyEndDate || t.date <= dailyEndDate)
        );

      return matchMarket && matchType && matchTypePallet && matchUnit && matchShift && matchDateRange;
    });
  }, [dailyStockSummary, dailySearch, dailyFilterMarket, dailyFilterType, dailyFilterTypePallet, dailyFilterUnit, dailyFilterShift, dailyStartDate, dailyEndDate, transactions]);

  // --- TAB 3 COMPUTATIONS: Mapping Kolom Peletakan ---
  // Filtered by column
  const filteredByColumn = useMemo(() => {
    const q = columnSearch.toLowerCase().trim();
    const qTokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return locationStockData.byColumn
      .map(col => {
        const filteredItems = col.items.filter(it => {
          const matchType = columnFilterTypePallet === 'ALL' || (it.typePallet || 'LS') === columnFilterTypePallet;
          const itTypeStr = (it.typePallet || 'LS').toLowerCase();
          const itTypeFull = itTypeStr === 'ls' ? 'long side' : 'short side';
          const itemText = `${col.columnName} ${it.palletSize} ${itTypeStr} ${itTypeFull} ${it.palletType} ${it.marketType}`.toLowerCase();
          const matchQ = qTokens.length === 0 || qTokens.every(tok => itemText.includes(tok));
          return matchType && matchQ;
        });

        const totalQty = filteredItems.reduce((sum, it) => sum + it.quantity, 0);
        return {
          ...col,
          items: filteredItems,
          totalQty
        };
      })
      .filter(col => col.items.length > 0);
  }, [locationStockData.byColumn, columnSearch, columnFilterTypePallet]);

  // Filtered by size
  const filteredBySize = useMemo(() => {
    const q = columnSearch.toLowerCase().trim();
    const normQ = normalizePalletDimension(q);
    const qTokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const result = locationStockData.bySize
      .map(sz => {
        const filteredCols = sz.columns.filter(c => {
          const matchType = columnFilterTypePallet === 'ALL' || (c.typePallet || 'LS') === columnFilterTypePallet;
          const cTypeStr = (c.typePallet || 'LS').toLowerCase();
          const cTypeFull = cTypeStr === 'ls' ? 'long side' : 'short side';
          const sizeText = `${sz.palletSize} ${c.columnName} ${cTypeStr} ${cTypeFull} ${c.palletType}`.toLowerCase();
          const matchQ = qTokens.length === 0 || qTokens.every(tok => sizeText.includes(tok));
          return matchType && matchQ;
        });

        const totalQty = filteredCols.reduce((sum, c) => sum + c.quantity, 0);
        return {
          ...sz,
          columns: filteredCols,
          totalQty
        };
      })
      .filter(sz => sz.columns.length > 0);

    // Jika user mencari ukuran tertentu tapi saat ini tidak tersimpan di kolom mana pun (stok 0)
    if (normQ && /\d/.test(normQ) && !result.some(s => normalizePalletDimension(s.palletSize) === normQ)) {
      result.push({
        palletSize: normQ,
        totalQty: 0,
        columns: []
      });
    }

    return result;
  }, [locationStockData.bySize, columnSearch, columnFilterTypePallet]);

  // Filtered overall columns
  const filteredOverallColumns = useMemo(() => {
    return filteredByColumn.map(col => {
      const uniqueSizes = Array.from(new Set(col.items.map(it => it.palletSize)));
      return {
        columnName: col.columnName,
        totalQty: col.totalQty,
        uniqueSizesCount: uniqueSizes.length,
        totalItemsCount: col.items.length,
        sizesList: uniqueSizes
      };
    });
  }, [filteredByColumn]);

  const overallColumnsGrandTotal = useMemo(() => {
    return filteredOverallColumns.reduce((acc, c) => acc + c.totalQty, 0);
  }, [filteredOverallColumns]);

  // --- EXPORT TO EXCEL & PRINT PAYLOAD ---
  const activeReportPayload = useMemo(() => {
    if (activeMainTab === 'saldo-aktual') {
      const headers = ['No', 'Ukuran Pallet', 'Region', 'Wrap Type', 'Pallet Runners', 'Satuan', 'Stok Aktual', 'Informasi Peletakan (Kolom)', 'Terakhir Update'];
      const rows = filteredStocks.map((s, idx) => {
        const sNormSize = normalizePalletDimension(s.palletSize);
        const sType = (s.palletType || '').trim().toLowerCase().replace(/^pallet\s+/i, '');
        const sTypePallet = (s.typePallet || 'LS').toUpperCase();
        const sMarket = (s.marketType || 'Lokal').trim().toLowerCase().replace(/^export$/, 'ekspor');
        const sUnit = (s.unit || 'Set').trim().toLowerCase();
        const sKey = `${sNormSize}__${sTypePallet}__${sType}__${sMarket}__${sUnit}`;
        const columnInfo = palletColumnBreakdownMap.get(sKey) || (s.quantity > 0 ? `Transit = ${s.quantity}` : '-');
        return [
          idx + 1,
          formatPalletDimension(s.palletSize),
          formatMarketType(s.marketType),
          formatJenisPallet(s.palletType),
          formatTypePallet(s.typePallet),
          formatSatuan(s.unit),
          s.quantity,
          columnInfo,
          s.lastUpdated
        ];
      });
      return {
        title: 'LAPORAN SALDO STOK FISIK PALLET AKTUAL',
        headers,
        rows,
        totals: {
          label: 'TOTAL STOK FISIK',
          values: { 6: totalQty }
        },
        totalsSummary: `Total Saldo Fisik: ${totalQty} Unit (${filteredStocks.length} Item Pallet)`,
        filenamePrefix: `Stok_Finish_Pallet_Aktual_${getToday()}`
      };
    } else if (activeMainTab === 'stok-harian') {
      const headers = [
        'No',
        'Ukuran Pallet',
        'Region',
        'Wrap Type',
        'Pallet Runners',
        'Satuan',
        'Stok Awal Hari Itu',
        'Produksi / Masuk (+)',
        'Keluar Hari Itu (-)',
        'Stok Akhir Hari Itu',
        'Tanggal'
      ];
      const rows = filteredDailyItems.map((item, idx) => {
        return [
          idx + 1,
          formatPalletDimension(item.palletSize),
          formatMarketType(item.marketType),
          formatJenisPallet(item.palletType),
          formatTypePallet(item.typePallet),
          formatSatuan(item.unit),
          item.startOfDayQty,
          item.inTodayQty,
          item.outTodayQty,
          item.availableTodayQty,
          item.lastUpdated
        ];
      });
      return {
        title: `LAPORAN STOK PALLET TERSEDIA HARIAN (PER TANGGAL ${selectedDate})`,
        headers,
        rows,
        totals: {
          label: 'TOTAL MUTASI HARIAN',
          values: {
            6: dailyStockSummary.totalStartOfDay,
            7: dailyStockSummary.totalInToday,
            8: dailyStockSummary.totalOutToday,
            9: dailyStockSummary.totalAvailableToday
          }
        },
        totalsSummary: `Stok Akhir Hari Itu: ${dailyStockSummary.totalAvailableToday} Unit | Masuk: +${dailyStockSummary.totalInToday} | Keluar: -${dailyStockSummary.totalOutToday}`,
        filenamePrefix: `Stok_Tersedia_Harian_${selectedDate}`
      };
    } else {
      if (mappingSubMode === 'by-column') {
        const headers = ['No', 'Kolom Peletakan', 'Ukuran Pallet', 'Region', 'Wrap Type', 'Pallet Runners', 'Quantity', 'Satuan'];
        const rows: (string | number)[][] = [];
        let rowIdx = 1;
        filteredByColumn.forEach((col) => {
          col.items.forEach((it) => {
            rows.push([
              rowIdx++,
              col.columnName,
              formatPalletDimension(it.palletSize),
              formatMarketType(it.marketType),
              formatJenisPallet(it.palletType),
              formatTypePallet(it.typePallet),
              it.quantity,
              formatSatuan(it.unit)
            ]);
          });
        });
        const currentTotal = filteredByColumn.reduce((acc, c) => acc + c.totalQty, 0);
        return {
          title: 'LAPORAN RINCIAN STOK PER KOLOM PELETAKAN YARD',
          headers,
          rows,
          totals: {
            label: 'TOTAL STOK SELURUH KOLOM',
            values: { 6: currentTotal }
          },
          totalsSummary: `Grand Total Stok Seluruh Kolom: ${currentTotal} Unit (${filteredByColumn.length} Kolom Aktif)`,
          filenamePrefix: `Rincian_Per_Kolom_Peletakan_${getToday()}`
        };
      } else if (mappingSubMode === 'by-size') {
        const headers = ['No', 'Ukuran Pallet', 'Region', 'Wrap Type', 'Pallet Runners', 'Kolom Peletakan', 'Quantity', 'Satuan'];
        const rows: (string | number)[][] = [];
        let rowIdx = 1;
        filteredBySize.forEach((sz) => {
          sz.columns.forEach((c) => {
            rows.push([
              rowIdx++,
              formatPalletDimension(sz.palletSize),
              formatMarketType(c.marketType),
              formatJenisPallet(c.palletType),
              formatTypePallet(c.typePallet),
              c.columnName,
              c.quantity,
              formatSatuan(c.unit)
            ]);
          });
        });
        const currentTotal = filteredBySize.reduce((acc, sz) => acc + sz.totalQty, 0);
        return {
          title: 'LAPORAN PERSEBARAN UKURAN PALLET PER KOLOM YARD',
          headers,
          rows,
          totals: {
            label: 'TOTAL STOK SELURUH UKURAN',
            values: { 6: currentTotal }
          },
          totalsSummary: `Grand Total Seluruh Ukuran: ${currentTotal} Unit (${filteredBySize.length} Ukuran)`,
          filenamePrefix: `Persebaran_Ukuran_Per_Kolom_${getToday()}`
        };
      } else {
        const headers = ['No', 'Nama Kolom Peletakan', 'Jumlah Varian Ukuran', 'Daftar Ukuran Tersimpan', 'Total Quantity'];
        const rows = filteredOverallColumns.map((c, idx) => [
          idx + 1,
          c.columnName,
          c.uniqueSizesCount,
          c.sizesList.join(', '),
          c.totalQty
        ]);
        return {
          title: 'LAPORAN REKAPITULASI STOK KESELURUHAN KOLOM YARD',
          headers,
          rows,
          totals: {
            label: 'GRAND TOTAL SELURUH KOLOM',
            values: { 4: overallColumnsGrandTotal }
          },
          totalsSummary: `Grand Total Seluruh Kolom Yard: ${overallColumnsGrandTotal} Unit (${filteredOverallColumns.length} Kolom)`,
          filenamePrefix: `Rekap_Keseluruhan_Kolom_Yard_${getToday()}`
        };
      }
    }
  }, [
    activeMainTab,
    filteredStocks,
    thresholds,
    totalQty,
    filteredDailyItems,
    selectedDate,
    dailyStockSummary,
    mappingSubMode,
    filteredByColumn,
    filteredBySize,
    filteredOverallColumns,
    overallColumnsGrandTotal,
    locationStockData,
    transactions
  ]);

  const handleExportExcel = async () => {
    try {
      const docDate = activeMainTab === 'stok-harian' ? selectedDate : getToday();
      await exportToExcel({
        filename: activeReportPayload.filenamePrefix,
        reportTitle: activeReportPayload.title,
        periodLabel: activeMainTab === 'stok-harian' ? `Tanggal: ${selectedDate}` : `Per Tanggal: ${getToday()}`,
        operatorName: 'Semua Operator Finish Pallet',
        docNumber: generateStockTakeDocNumber(undefined, undefined, docDate),
        headers: activeReportPayload.headers,
        rows: activeReportPayload.rows,
        totals: activeReportPayload.totals,
        signatures: true
      });
      showNotification('success', 'Excel Berhasil Diexport', 'Laporan resmi format .xlsx berhasil diunduh.');
    } catch (_) {
      showNotification('error', 'Gagal Export', 'Terjadi kesalahan saat membuat file Excel.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const docDate = activeMainTab === 'stok-harian' ? selectedDate : getToday();
      await exportToPDF({
        filename: activeReportPayload.filenamePrefix,
        reportTitle: activeReportPayload.title,
        periodLabel: activeMainTab === 'stok-harian' ? `Tanggal: ${selectedDate}` : `Per Tanggal: ${getToday()}`,
        operatorName: 'Semua Operator Finish Pallet',
        docNumber: generateStockTakeDocNumber(undefined, undefined, docDate),
        headers: activeReportPayload.headers,
        rows: activeReportPayload.rows,
        totalsSummary: activeReportPayload.totalsSummary,
        signatures: true
      });
      showNotification('success', 'PDF Berhasil Diexport', 'Laporan resmi format PDF (.pdf) berhasil diunduh.');
    } catch (_) {
      showNotification('error', 'Gagal Export PDF', 'Terjadi kesalahan saat membuat file PDF.');
    }
  };

  const handleSaveThresholds = () => {
    updateThresholds({
      safeMin: tempSafe,
      warningMin: tempWarning,
      criticalMax: tempWarning - 1
    });
    setShowThresholdModal(false);
  };

  const itemTransactions = useMemo(() => {
    if (!selectedStockForDetail) return [];
    const targetSize = selectedStockForDetail.palletSize.toLowerCase();
    const targetType = selectedStockForDetail.palletType.toLowerCase();
    const targetMarket = selectedStockForDetail.marketType.toLowerCase();
    const targetUnit = selectedStockForDetail.unit;
    const targetSide = selectedStockForDetail.typePallet || 'LS';

    return transactions
      .filter(t => {
        const matchSize = t.palletSize.toLowerCase() === targetSize;
        const matchMarket = (t.marketType || 'Lokal').toLowerCase() === targetMarket;
        const matchUnit = (t.unit || 'Set') === targetUnit;
        const matchSide = (t.typePallet || 'LS') === targetSide;
        if (!matchSize || !matchMarket || !matchUnit || !matchSide) return false;

        if (t.transactionType === 'UBAH_SPEK') {
          const isSource = t.palletType.toLowerCase() === targetType;
          const isTarget = t.targetPalletType && t.targetPalletType.toLowerCase() === targetType;
          return isSource || isTarget;
        }

        return t.palletType.toLowerCase() === targetType;
      })
      .sort((a, b) => {
        const dateA = `${a.date} ${a.time || '00:00'}`;
        const dateB = `${b.date} ${b.time || '00:00'}`;
        return dateB.localeCompare(dateA);
      });
  }, [selectedStockForDetail, transactions]);

  // Detected column distribution for selected detail stock item
  const selectedStockColumns = useMemo(() => {
    if (!selectedStockForDetail) return [];
    const matchedSize = locationStockData.bySize.find(
      s => s.palletSize.toLowerCase() === selectedStockForDetail.palletSize.toLowerCase()
    );
    if (!matchedSize) return [];
    return matchedSize.columns.filter(
      c =>
        c.palletType.toLowerCase() === selectedStockForDetail.palletType.toLowerCase() &&
        c.marketType.toLowerCase() === selectedStockForDetail.marketType.toLowerCase() &&
        c.unit === selectedStockForDetail.unit &&
        (!selectedStockForDetail.typePallet || !c.typePallet || c.typePallet === selectedStockForDetail.typePallet)
    );
  }, [selectedStockForDetail, locationStockData]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#3886B8] text-white">
              <Boxes className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">DATA STOK PALLET & MAPPING KOLOM</h1>
          </div>
          <p className="text-xs text-[#8CCCF0] mt-1 font-medium">
            Monitoring saldo stok fisik, stok tersedia per hari, serta mapping posisi peletakan kolom yard (F14, F10, dll).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isOperator && activeMainTab === 'saldo-aktual' && (
            <button
              onClick={() => setShowThresholdModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#112B43] hover:bg-[#1E4366] text-[#8CCCF0] border border-[#1E4366] rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8CCCF0]" />
              <span>Atur Batas Stok</span>
            </button>
          )}
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#112B43] hover:bg-[#1E4366] text-white border border-[#1E4366] rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Cetak format dokumen resmi A4"
          >
            <Printer className="w-3.5 h-3.5 text-[#8CCCF0]" />
            <span>Cetak Dokumen (A4)</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Unduh laporan langsung berformat PDF resmi (.pdf)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#16805D] hover:bg-[#136B4E] text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Unduh laporan berformat Excel resmi (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Offline Status Notice Banner */}
      {!isOnline && (
        <div className="bg-amber-950/70 border border-amber-600/70 rounded-xl p-3 sm:p-3.5 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-600/30 border border-amber-500/50 text-amber-300 shrink-0 mt-0.5 sm:mt-0">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-amber-300 text-xs sm:text-sm">
                Mode Pencarian Stok Offline Aktif (Sinyal Lemah / Terputus)
              </div>
              <div className="text-[11px] sm:text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                Data stok fisik, riwayat peletakan, dan mapping kolom yard tersimpan aman di memori HP/perangkat. Anda tetap dapat mencari ukuran, filter tipe, dan cek kolom tanpa kendala.
              </div>
            </div>
          </div>
          <span className="self-start sm:self-center px-2.5 py-1 rounded font-extrabold text-[10px] tracking-wide bg-amber-900/80 text-amber-300 border border-amber-600/60 uppercase shrink-0">
            Pencarian Lokal Siap
          </span>
        </div>
      )}

      {/* PRIMARY TAB CONTROLLER */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-1.5 shadow-2xs flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveMainTab('saldo-aktual')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'saldo-aktual'
              ? 'bg-[#3886B8] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <Boxes className={`w-4 h-4 ${activeMainTab === 'saldo-aktual' ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`} />
          <span>1. Saldo Stok Fisik (Aktual)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('stok-harian')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'stok-harian'
              ? 'bg-[#3886B8] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <Calendar className={`w-4 h-4 ${activeMainTab === 'stok-harian' ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`} />
          <span>2. Stok Tersedia Hari Ini</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('mapping-kolom')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'mapping-kolom'
              ? 'bg-[#3886B8] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <MapPin className={`w-4 h-4 ${activeMainTab === 'mapping-kolom' ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`} />
          <span>3. Posisi Peletakan & Kolom Yard</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SALDO STOK FISIK (AKTUAL)                                          */}
      {/* ========================================================================= */}
      {activeMainTab === 'saldo-aktual' && (
        <div className="space-y-4">
          {/* FILTER STOK CARD (Rentang Waktu, Ukuran, Shift, Lokal/Ekspor, Jenis Pallet, Type Pallet, Satuan - Tanpa No.Run) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 no-print shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide flex-wrap">
                <Filter className="w-3.5 h-3.5 text-emerald-700" />
                <span>Pencarian & Filter Stok</span>
                {(startDate || endDate) && (
                  <span className="text-[11px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-700" />
                    <span>
                      {startDate ? formatDateIndo(startDate) : 'Awal'} s/d {endDate ? formatDateIndo(endDate) : 'Akhir'}
                    </span>
                  </span>
                )}
                {search && (
                  <span className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                    Ukuran: {search}
                  </span>
                )}
                {filterShift !== 'ALL' && (
                  <span className="text-[11px] bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded font-mono font-bold">
                    Shift: {filterShift}
                  </span>
                )}
              </div>
              {(search || filterMarket !== 'ALL' || filterType !== 'ALL' || filterTypePallet !== 'ALL' || filterUnit !== 'ALL' || filterShift !== 'ALL' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStartDate('');
                    setEndDate('');
                    setFilterShift('ALL');
                    setFilterMarket('ALL');
                    setFilterType('ALL');
                    setFilterTypePallet('ALL');
                    setFilterUnit('ALL');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Semua Filter
                </button>
              )}
            </div>

            {/* Baris 1: Filter Waktu, Ukuran Pallet, Shift (Tanpa No.Run) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Filter Rentang Waktu (Tanggal Mulai s/d Tanggal Selesai) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-700" />
                    <span>Filter Waktu (s/d)</span>
                  </span>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      title="Hapus filter waktu"
                    >
                      ✕ Reset
                    </button>
                  )}
                </label>
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-300">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-1.5 py-1 text-[11px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-emerald-600"
                    title="Tanggal Mulai"
                  />
                  <span className="text-[10px] text-slate-500 font-bold shrink-0">s/d</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-1.5 py-1 text-[11px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-emerald-600"
                    title="Tanggal Selesai"
                  />
                </div>
              </div>

              {/* Ukuran Pallet */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ukuran Pallet
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ketik ukuran pallet (cth: 81x111)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-7 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-600 text-slate-900 bg-white"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Hapus filter ukuran"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Shift
                </label>
                <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  {['ALL', 'Shift 1', 'Shift 2', 'Shift 3'].map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setFilterShift(sh)}
                      className={`py-1.5 px-1 text-xs font-bold rounded transition-all cursor-pointer text-center truncate ${
                        filterShift === sh
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sh === 'ALL' ? 'Semua' : sh}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Baris 2: Lokal/Ekspor, Jenis Pallet, Type Pallet, Satuan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Lokal / Ekspor (Tinggal Klik) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Region
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFilterMarket('ALL')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterMarket === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMarket('Lokal')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterMarket === 'Lokal'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    Lokal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMarket('Ekspor')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterMarket === 'Ekspor'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Ekspor
                  </button>
                </div>
              </div>

              {/* Wrap Type (Tinggal Klik: RW, BP, RCK, SRKLS) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Wrap Type</span>
                  <span className="text-[10px] text-slate-500 normal-case font-normal">Tinggal Klik</span>
                </label>
                <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFilterType('ALL')}
                    className={`py-1.5 px-1 text-xs font-bold rounded transition-all cursor-pointer text-center truncate ${
                      filterType === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  {[
                    { code: 'RW', name: 'Pallet Reamwrap', label: 'RW' },
                    { code: 'BP', name: 'Pallet Bulkpack', label: 'BP' },
                    { code: 'RCK', name: 'Pallet Racuk', label: 'RCK' },
                    { code: 'SRKLS', name: 'Pallet Sirkulasi', label: 'SRKLS' }
                  ].map((j) => (
                    <button
                      key={j.code}
                      type="button"
                      onClick={() => setFilterType(filterType === j.name ? 'ALL' : j.name)}
                      className={`py-1.5 px-0.5 text-[11px] font-bold rounded transition-all cursor-pointer text-center truncate ${
                        filterType === j.name
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                      title={j.name}
                    >
                      {j.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pallet Runners (Tinggal Klik: Semua, LS, SS) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pallet Runners
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFilterTypePallet('ALL')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterTypePallet === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTypePallet('LS')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                      filterTypePallet === 'LS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-blue-800 hover:bg-blue-50'
                    }`}
                    title="LS (Long Side)"
                  >
                    <span>LS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTypePallet('SS')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                      filterTypePallet === 'SS'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-purple-800 hover:bg-purple-50'
                    }`}
                    title="SS (Short Side)"
                  >
                    <span>SS</span>
                  </button>
                </div>
              </div>

              {/* Satuan (SET / PCS - Tinggal Klik) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Satuan</span>
                  <span className="text-[10px] text-slate-500 normal-case font-normal">Tinggal Klik</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFilterUnit('ALL')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterUnit === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterUnit('Set')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterUnit === 'Set'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterUnit('Pcs')}
                    className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                      filterUnit === 'Pcs'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-blue-800 hover:bg-blue-50'
                    }`}
                  >
                    Pcs
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Ukuran Pallet</th>
                    <th className="py-3 px-3.5">Region</th>
                    <th className="py-3 px-3.5">Wrap Type</th>
                    <th className="py-3 px-3.5 text-center">Pallet Runners</th>
                    <th className="py-3 px-3.5">Satuan</th>
                    <th className="py-3 px-3.5 text-right">Saldo Stok</th>
                    <th className="py-3 px-3.5">Informasi Peletakan (Kolom)</th>
                    <th className="py-3 px-3.5">Status Kesiapan</th>
                    <th className="py-3 px-3.5">Terakhir Update</th>
                    <th className="py-3 px-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-500">
                        <Boxes className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <div className="font-semibold text-slate-800 text-sm">Belum Ada Data Stok Pallet</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Saldo stok masih kosong. Catat penerimaan pallet dari produksi untuk mulai menambah stok fisik di yard.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((item) => {
                      let status: 'AMAN' | 'PERHATIAN' | 'KRITIS' = 'AMAN';
                      if (item.quantity < thresholds.warningMin) {
                        status = 'KRITIS';
                      } else if (item.quantity < thresholds.safeMin) {
                        status = 'PERHATIAN';
                      }

                      const typeVal = item.typePallet || 'LS';

                      const normSize = normalizePalletDimension(item.palletSize);
                      const itType = (item.palletType || '').trim().toLowerCase().replace(/^pallet\s+/i, '');
                      const itTypePallet = (typeVal || 'LS').toUpperCase();
                      const itMarket = (item.marketType || 'Lokal').trim().toLowerCase().replace(/^export$/, 'ekspor');
                      const itUnit = (item.unit || 'Set').trim().toLowerCase();
                      const itemKey = `${normSize}__${itTypePallet}__${itType}__${itMarket}__${itUnit}`;

                      const colInfo = palletColumnBreakdownMap.get(itemKey) || (item.quantity > 0 ? `Transit = ${item.quantity}` : '-');

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-900 text-sm whitespace-nowrap">
                            {normalizePalletDimension(item.palletSize)}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {formatMarketType(item.marketType) === 'Lokal' ? (
                              <span className="text-emerald-800 font-semibold">Lokal</span>
                            ) : (
                              <span className="text-blue-800 font-semibold">Ekspor</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-medium text-slate-800 whitespace-nowrap">
                            {formatJenisPallet(item.palletType)}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                formatTypePallet(typeVal) === 'LS'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-purple-50 text-purple-800 border-purple-200'
                              }`}
                              title={formatTypePallet(typeVal) === 'LS' ? 'Long Side' : 'Short Side'}
                            >
                              {formatTypePallet(typeVal)}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px]">
                              {formatSatuan(item.unit)}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-sm text-slate-900 tabular-nums whitespace-nowrap">
                            {item.quantity <= 0 ? (
                              <span className="text-slate-500 font-bold">
                                0 <span className="text-xs font-normal text-slate-400">{formatSatuan(item.unit)}</span>
                              </span>
                            ) : (
                              <span>
                                {item.quantity.toLocaleString()} <span className="text-xs font-normal text-slate-500">{formatSatuan(item.unit)}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {colInfo === '-' ? (
                              <span className="text-slate-400 font-italic text-[11px]">-</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1">
                                {colInfo.split(', ').map((colPart) => (
                                  <span
                                    key={colPart}
                                    className="px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono text-[11px] font-bold"
                                  >
                                    {colPart}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {item.quantity <= 0 ? (
                              <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                STOK 0 (HABIS)
                              </div>
                            ) : status === 'AMAN' ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                AMAN
                              </div>
                            ) : status === 'PERHATIAN' ? (
                              <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                PERHATIAN
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                                KRITIS
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                            {item.lastUpdated}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedStockForDetail(item)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() =>
                                  onNavigateToHistory({
                                    size: item.palletSize,
                                    type: item.palletType,
                                    txType: 'ALL'
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-semibold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer flex items-center gap-1"
                                title="Buku Besar Semua Riwayat Ukuran Ini"
                              >
                                <History className="w-3 h-3 text-slate-600" />
                                Riwayat
                              </button>
                              <button
                                onClick={() =>
                                  onNavigateToHistory({
                                    size: item.palletSize,
                                    type: item.palletType,
                                    txType: 'PENGELUARAN'
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded cursor-pointer flex items-center gap-1"
                                title="Riwayat Pengeluaran Khusus Ukuran Ini"
                              >
                                <ArrowUpFromLine className="w-3 h-3 text-amber-600" />
                                Keluar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DATA STOK YANG TERSEDIA DI HARI ITU                                */}
      {/* ========================================================================= */}
      {activeMainTab === 'stok-harian' && (
        <div className="space-y-4">
          {/* Date Selector & Daily Controls */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Pilih Tanggal Stok Tersedia:
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-600 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(getToday())}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs text-slate-700 font-semibold cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold transition-colors cursor-pointer ml-1"
                  title="Cetak Laporan Stok Hari Ini (A4)"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cetak (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                  title="Unduh format Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics of That Day */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-500 block">Stok Awal ({selectedDate})</span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {dailyStockSummary.totalStartOfDay}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Saldo sebelum hari ini</span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-[11px] text-emerald-800 block font-semibold flex items-center gap-1">
                  <ArrowDownToLine className="w-3.5 h-3.5" /> Masuk Hari Itu (+)
                </span>
                <span className="text-lg font-bold font-mono text-emerald-900 tabular-nums">
                  +{dailyStockSummary.totalInToday}
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">Penerimaan produksi</span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-[11px] text-amber-800 block font-semibold flex items-center gap-1">
                  <ArrowUpFromLine className="w-3.5 h-3.5" /> Keluar Hari Itu (-)
                </span>
                <span className="text-lg font-bold font-mono text-amber-900 tabular-nums">
                  -{dailyStockSummary.totalOutToday}
                </span>
                <span className="text-[10px] text-amber-700 block mt-0.5">Pengiriman ke user</span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-[11px] text-blue-800 block font-bold">
                  Stok Tersedia Hari Itu
                </span>
                <span className="text-xl font-bold font-mono text-blue-950 tabular-nums">
                  {dailyStockSummary.totalAvailableToday}
                </span>
                <span className="text-[10px] text-blue-700 block mt-0.5">Saldo siap pakai</span>
              </div>
            </div>

            {/* Filter controls: Rentang Waktu, Ukuran, Shift, Lokal/Ekspor, Jenis Pallet, Type Pallet, Satuan (Tanpa No.Run) */}
            <div className="pt-2 space-y-3.5 border-t border-slate-100">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  <span>Filter Stok Tanggal Ini</span>
                  {(dailyStartDate || dailyEndDate) && (
                    <span className="text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      <span>
                        {dailyStartDate ? formatDateIndo(dailyStartDate) : 'Awal'} s/d {dailyEndDate ? formatDateIndo(dailyEndDate) : 'Akhir'}
                      </span>
                    </span>
                  )}
                  {dailySearch && (
                    <span className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                      Ukuran: {dailySearch}
                    </span>
                  )}
                  {dailyFilterShift !== 'ALL' && (
                    <span className="text-[11px] bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded font-mono font-bold">
                      Shift: {dailyFilterShift}
                    </span>
                  )}
                </div>
                {(dailySearch || dailyFilterMarket !== 'ALL' || dailyFilterType !== 'ALL' || dailyFilterTypePallet !== 'ALL' || dailyFilterUnit !== 'ALL' || dailyFilterShift !== 'ALL' || dailyStartDate || dailyEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDailySearch('');
                      setDailyStartDate('');
                      setDailyEndDate('');
                      setDailyFilterShift('ALL');
                      setDailyFilterMarket('ALL');
                      setDailyFilterType('ALL');
                      setDailyFilterTypePallet('ALL');
                      setDailyFilterUnit('ALL');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Semua Filter
                  </button>
                )}
              </div>

              {/* Baris 1: Filter Waktu, Ukuran Pallet, Shift (Tanpa No.Run) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Filter Rentang Waktu (Tanggal Mulai s/d Tanggal Selesai) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>Filter Waktu (s/d)</span>
                    </span>
                    {(dailyStartDate || dailyEndDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDailyStartDate('');
                          setDailyEndDate('');
                        }}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                        title="Hapus filter waktu"
                      >
                        ✕ Reset
                      </button>
                    )}
                  </label>
                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-300">
                    <input
                      type="date"
                      value={dailyStartDate}
                      onChange={(e) => setDailyStartDate(e.target.value)}
                      className="w-full px-1.5 py-1 text-[11px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-amber-600"
                      title="Tanggal Mulai"
                    />
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">s/d</span>
                    <input
                      type="date"
                      value={dailyEndDate}
                      onChange={(e) => setDailyEndDate(e.target.value)}
                      className="w-full px-1.5 py-1 text-[11px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-amber-600"
                      title="Tanggal Selesai"
                    />
                  </div>
                </div>

                {/* Ukuran Pallet */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ukuran Pallet
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Ketik ukuran pallet (cth: 81x111)..."
                      value={dailySearch}
                      onChange={(e) => setDailySearch(e.target.value)}
                      className="w-full pl-9 pr-7 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-600 text-slate-900 bg-white"
                    />
                    {dailySearch && (
                      <button
                        type="button"
                        onClick={() => setDailySearch('')}
                        className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Hapus filter ukuran"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Shift
                  </label>
                  <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {['ALL', 'Shift 1', 'Shift 2', 'Shift 3'].map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setDailyFilterShift(sh)}
                        className={`py-1.5 px-1 text-xs font-bold rounded transition-all cursor-pointer text-center truncate ${
                          dailyFilterShift === sh
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sh === 'ALL' ? 'Semua' : sh}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Baris 2: Region, Wrap Type, Pallet Runners, Satuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Region (Tinggal Klik) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Region
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDailyFilterMarket('ALL')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterMarket === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilterMarket('Lokal')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterMarket === 'Lokal'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      Lokal
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilterMarket('Ekspor')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterMarket === 'Ekspor'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Ekspor
                    </button>
                  </div>
                </div>

                {/* Wrap Type (Tinggal Klik: RW, BP, RCK, SRKLS) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Wrap Type</span>
                    <span className="text-[10px] text-slate-500 normal-case font-normal">Tinggal Klik</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDailyFilterType('ALL')}
                      className={`py-1.5 px-1 text-xs font-bold rounded transition-all cursor-pointer text-center truncate ${
                        dailyFilterType === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    {[
                      { code: 'RW', name: 'Pallet Reamwrap', label: 'RW' },
                      { code: 'BP', name: 'Pallet Bulkpack', label: 'BP' },
                      { code: 'RCK', name: 'Pallet Racuk', label: 'RCK' },
                      { code: 'SRKLS', name: 'Pallet Sirkulasi', label: 'SRKLS' }
                    ].map((j) => (
                      <button
                        key={j.code}
                        type="button"
                        onClick={() => setDailyFilterType(dailyFilterType === j.name ? 'ALL' : j.name)}
                        className={`py-1.5 px-0.5 text-[11px] font-bold rounded transition-all cursor-pointer text-center truncate ${
                          dailyFilterType === j.name
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-700 hover:bg-white'
                        }`}
                        title={j.name}
                      >
                        {j.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pallet Runners (Tinggal Klik: Semua, LS, SS) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pallet Runners
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDailyFilterTypePallet('ALL')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterTypePallet === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilterTypePallet('LS')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                        dailyFilterTypePallet === 'LS'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-blue-800 hover:bg-blue-50'
                      }`}
                      title="LS (Long Side)"
                    >
                      <span>LS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilterTypePallet('SS')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                        dailyFilterTypePallet === 'SS'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-purple-800 hover:bg-purple-50'
                      }`}
                      title="SS (Short Side)"
                    >
                      <span>SS</span>
                    </button>
                  </div>
                </div>

                {/* Satuan (SET / PCS - Tinggal Klik) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Satuan</span>
                    <span className="text-[10px] text-slate-500 normal-case font-normal">Tinggal Klik</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDailyFilterUnit('ALL')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterUnit === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilterUnit('Set')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterUnit === 'Set'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilterUnit('Pcs')}
                      className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                        dailyFilterUnit === 'Pcs'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-blue-800 hover:bg-blue-50'
                      }`}
                    >
                      Pcs
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Stock Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Ukuran Pallet</th>
                    <th className="py-3 px-3.5">Region</th>
                    <th className="py-3 px-3.5">Wrap Type</th>
                    <th className="py-3 px-3.5 text-center">Pallet Runners</th>
                    <th className="py-3 px-3.5">Satuan</th>
                    <th className="py-3 px-3.5 text-right">Stok Awal</th>
                    <th className="py-3 px-3.5 text-right text-emerald-800">Masuk (+)</th>
                    <th className="py-3 px-3.5 text-right text-amber-800">Keluar (-)</th>
                    <th className="py-3 px-3.5 text-right font-bold text-slate-900 bg-slate-100/60">Stok Akhir</th>
                    <th className="py-3 px-3.5">Kolom Peletakan</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDailyItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-500">
                        <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <div className="font-semibold text-slate-800 text-sm">Tidak Ada Transaksi / Stok Pada Tanggal {selectedDate}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Coba ganti tanggal atau periksa pencatatan penerimaan dan pengeluaran pallet.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDailyItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900 text-sm whitespace-nowrap">
                          {normalizePalletDimension(item.palletSize)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {formatMarketType(item.marketType) === 'Lokal' ? (
                            <span className="text-emerald-800 font-semibold">Lokal</span>
                          ) : (
                            <span className="text-blue-800 font-semibold">Ekspor</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-800 whitespace-nowrap">
                          {formatJenisPallet(item.palletType)}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              formatTypePallet(item.typePallet) === 'LS'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                            title={formatTypePallet(item.typePallet) === 'LS' ? 'Long Side' : 'Short Side'}
                          >
                            {formatTypePallet(item.typePallet)}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px]">
                            {formatSatuan(item.unit)}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {item.startOfDayQty}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-800 font-bold tabular-nums whitespace-nowrap">
                          {item.inTodayQty > 0 ? `+${item.inTodayQty}` : '0'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-800 font-bold tabular-nums whitespace-nowrap">
                          {item.outTodayQty > 0 ? `-${item.outTodayQty}` : '0'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-sm text-blue-950 bg-blue-50/40 tabular-nums whitespace-nowrap">
                          {item.availableTodayQty <= 0 ? (
                            <span className="text-slate-500 font-bold">
                              0 <span className="text-xs font-normal text-slate-400">{formatSatuan(item.unit)}</span>
                            </span>
                          ) : (
                            <span>
                              {item.availableTodayQty} <span className="text-xs font-normal text-slate-500">{formatSatuan(item.unit)}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {(() => {
                            const txsUpToDate = transactions.filter((t) => t.date <= selectedDate);
                            const colInfo = getPalletColumnDetailString({
                              transactions: txsUpToDate,
                              palletSize: item.palletSize,
                              palletType: item.palletType,
                              typePallet: item.typePallet || 'LS',
                              unit: item.unit,
                              marketType: item.marketType,
                              totalQuantity: item.availableTodayQty
                            });
                            if (colInfo === '-') {
                              return <span className="text-slate-400 font-italic text-[11px]">-</span>;
                            }
                            return (
                              <div className="flex flex-wrap items-center gap-1">
                                {colInfo.split(', ').map((colPart) => (
                                  <span
                                    key={colPart}
                                    className="px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono text-[11px] font-bold"
                                  >
                                    {colPart}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {item.availableTodayQty > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tersedia
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                              Habis (0)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POSISI PELETAKAN & KOLOM YARD                                       */}
      {/* ========================================================================= */}
      {activeMainTab === 'mapping-kolom' && (
        <div className="space-y-4">
          {/* Sub-Mode Switcher */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide block">
                  Tampilan Informasi Peletakan Yard
                </span>
                <span className="text-[11px] text-slate-500">
                  Pilih cara melihat peletakan: per kolom (cth: F14), per ukuran (cth: 81x111), atau rekap seluruh kolom.
                </span>
              </div>

              {/* Sub-Mode Buttons */}
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMappingSubMode('by-column')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    mappingSubMode === 'by-column'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Per Kolom (cth: F14)
                </button>
                <button
                  type="button"
                  onClick={() => setMappingSubMode('by-size')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    mappingSubMode === 'by-size'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Per Ukuran (cth: 81x111)
                </button>
                <button
                  type="button"
                  onClick={() => setMappingSubMode('rekap-semua')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    mappingSubMode === 'rekap-semua'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rekap Keseluruhan Kolom
                </button>
              </div>
            </div>

            {/* Search Bar & Type Pallet for Columns or Sizes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={
                    mappingSubMode === 'by-column'
                      ? 'Cari nama kolom / type (cth: F14, LS, SS)...'
                      : mappingSubMode === 'by-size'
                      ? 'Cari ukuran pallet / type (cth: 81x111, LS, SS)...'
                      : 'Cari nama kolom, ukuran atau type (cth: F14, LS, SS)...'
                  }
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-rose-600 text-slate-800 font-medium"
                />
              </div>

              <div>
                <select
                  value={columnFilterTypePallet}
                  onChange={(e) => setColumnFilterTypePallet(e.target.value as 'ALL' | 'LS' | 'SS')}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 font-semibold focus:outline-none focus:border-rose-600 bg-white"
                >
                  <option value="ALL">Semua Type (LS & SS)</option>
                  <option value="LS">Type LS (Long Side)</option>
                  <option value="SS">Type SS (Short Side)</option>
                </select>
              </div>
            </div>

            {(columnSearch || columnFilterTypePallet !== 'ALL') && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setColumnSearch('');
                    setColumnFilterTypePallet('ALL');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>

          {/* 3A: PER KOLOM PELETAKAN (Contoh: Di Kolom F14 ada ukuran apa saja & berapa qty) */}
          {mappingSubMode === 'by-column' && (
            <div className="space-y-4">
              {filteredByColumn.length === 0 ? (
                <div className="p-12 text-center bg-white border border-slate-200 rounded-lg text-slate-500">
                  <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-semibold text-slate-800 text-sm">Belum Ada Kolom Peletakan Terdata</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Saat menginput penerimaan atau pengeluaran pallet, ketik nama peletakan (cth: F14, F10) pada kolom peletakan.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredByColumn.map((colGroup) => (
                    <div
                      key={colGroup.columnName}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
                    >
                      {/* Column Header */}
                      <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-rose-600 text-white">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm tracking-wide">
                              KOLOM {colGroup.columnName.toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              Menyimpan {colGroup.items.length} varian pallet
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Total di Kolom Ini</span>
                          <span className="text-base font-bold font-mono text-amber-400">
                            {colGroup.totalQty} Total
                          </span>
                        </div>
                      </div>

                      {/* Items Inside This Column */}
                      <div className="p-3">
                        <table className="w-full text-left text-xs">
                          <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="pb-2">Ukuran Pallet</th>
                              <th className="pb-2 text-center">Type</th>
                              <th className="pb-2">Jenis & Pasar</th>
                              <th className="pb-2 text-right">Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {colGroup.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 font-bold text-slate-900 font-mono">
                                  {item.palletSize}
                                </td>
                                <td className="py-2 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      (item.typePallet || 'LS') === 'LS'
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : 'bg-purple-50 text-purple-800 border-purple-200'
                                    }`}
                                  >
                                    {item.typePallet || 'LS'}
                                  </span>
                                </td>
                                <td className="py-2 text-slate-600 text-[11px]">
                                  {item.palletType} ({item.marketType})
                                </td>
                                <td className="py-2 text-right font-mono font-bold text-slate-900">
                                  {item.quantity} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3B: PER UKURAN PALLET (Contoh: Ukuran 81x111 ada di kolom berapa aja dan quantity nya berapa) */}
          {mappingSubMode === 'by-size' && (
            <div className="space-y-4">
              {filteredBySize.length === 0 ? (
                <div className="p-12 text-center bg-white border border-slate-200 rounded-lg text-slate-500">
                  <Boxes className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-semibold text-slate-800 text-sm">Belum Ada Sebaran Ukuran Terdata</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Catat penerimaan pallet dengan peletakan kolom untuk memantau sebaran ukuran di area yard.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBySize.map((sizeGroup) => (
                    <div
                      key={sizeGroup.palletSize}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
                    >
                      {/* Pallet Size Header */}
                      <div className="p-3.5 bg-slate-800 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-blue-600 text-white">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm tracking-wide">
                              UKURAN {sizeGroup.palletSize}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              Tersebar di {sizeGroup.columns.length} kolom peletakan
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Total Akumulasi</span>
                          <span className="text-base font-bold font-mono text-emerald-400">
                            {sizeGroup.totalQty} Total
                          </span>
                        </div>
                      </div>

                      {/* Columns Where This Size Is Placed */}
                      <div className="p-3">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Rincian Kolom & Kuantitas:
                        </div>
                        {sizeGroup.columns.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200 font-medium">
                            Stok 0 (Habis di yard - saat ini tidak tersimpan di kolom mana pun).
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {sizeGroup.columns.map((colItem, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-mono font-bold text-xs">
                                    Kolom {colItem.columnName}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      (colItem.typePallet || 'LS') === 'LS'
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : 'bg-purple-50 text-purple-800 border-purple-200'
                                    }`}
                                    title={(colItem.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                                  >
                                    {colItem.typePallet || 'LS'}
                                  </span>
                                  <span className="text-slate-600 text-[11px]">
                                    {colItem.palletType} ({colItem.marketType})
                                  </span>
                                </div>
                                <div className="font-mono font-bold text-slate-900 text-sm">
                                  {colItem.quantity} <span className="text-xs font-normal text-slate-500">{colItem.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3C: DATA STOK KESELURUHAN KOLOM (Rekap Keseluruhan Kolom) */}
          {mappingSubMode === 'rekap-semua' && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Rekapitulasi Stok Keseluruhan Kolom Yard
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ringkasan total kuantitas pallet pada setiap kolom peletakan aktif di area Finish Pallet.
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-slate-800">
                  Total Kolom Aktif: <b className="text-rose-700">{filteredOverallColumns.length} Kolom</b>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">No</th>
                      <th className="py-3 px-3.5">Nama Kolom Peletakan</th>
                      <th className="py-3 px-3.5">Jumlah Varian Ukuran</th>
                      <th className="py-3 px-3.5">Daftar Ukuran Tersimpan</th>
                      <th className="py-3 px-3.5 text-right font-bold">Total Kuantitas di Kolom</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredOverallColumns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          Tidak ada data kolom peletakan yang ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredOverallColumns.map((col, idx) => (
                        <tr key={col.columnName} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-3.5 font-bold text-slate-900 font-mono text-sm whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-950 border border-amber-300 rounded font-bold">
                              <MapPin className="w-3.5 h-3.5 text-amber-700" />
                              Kolom {col.columnName}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-700 whitespace-nowrap">
                            {col.uniqueSizesCount} ukuran
                          </td>
                          <td className="py-3 px-3.5 text-slate-800 font-mono text-[11px]">
                            {col.sizesList.join(', ')}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-sm text-slate-900 tabular-nums whitespace-nowrap">
                            {col.totalQty.toLocaleString()} Total
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredOverallColumns.length > 0 && (
                    <tfoot className="bg-slate-900 text-white border-t-2 border-slate-950 font-bold">
                      <tr>
                        <td colSpan={4} className="py-3.5 px-3.5 uppercase tracking-wider text-right text-xs">
                          GRAND TOTAL STOK KESELURUHAN KOLOM YARD:
                        </td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-base text-amber-400 tabular-nums whitespace-nowrap">
                          {overallColumnsGrandTotal.toLocaleString()} Total
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL (With Column Location Breakdown)                             */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* DETAIL MODAL (With Column Location Breakdown & Catatan)                   */}
      {/* ========================================================================= */}
      {selectedStockForDetail && (() => {
        const latestTx = itemTransactions[0];
        const lastMovementText = latestTx
          ? `${latestTx.date} (${latestTx.shift || 'Shift 1'})`
          : (selectedStockForDetail.lastUpdated ? `${selectedStockForDetail.lastUpdated} (-)` : '-');

        const cleanWrap = selectedStockForDetail.palletType?.replace(/^pallet\s+/i, '') || '';
        const titleFullSpec = `Ukuran ${selectedStockForDetail.palletSize} ${selectedStockForDetail.marketType} ${cleanWrap} ${selectedStockForDetail.typePallet || 'LS'}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#112233] rounded-xl border border-slate-300 dark:border-[#1E3851] w-full max-w-3xl overflow-hidden shadow-2xl transition-colors">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-[#163653] text-white flex items-center justify-between border-b border-[#1E4366]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#3886B8] text-white">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide">
                      DETAIL SPESIFIKASI PALLET & DISTRIBUSI KOLOM
                    </h3>
                    <p className="text-xs text-[#8CCCF0]">
                      Informasi stok aktual fisik, pergerakan terakhir, dan sebaran kolom peletakan
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStockForDetail(null)}
                  className="text-slate-300 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
                {/* 1. Header Information Box (Concept: Ukuran + Spek langsung, Stok Aktual Fisik, Terakhir Bergerak) */}
                <div className="p-4 bg-slate-50 dark:bg-[#0E1A26] border border-slate-200 dark:border-[#1E3851] rounded-xl space-y-2.5">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#163653] dark:text-white">
                    {titleFullSpec}
                  </h2>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-200">
                        Stok Aktual Fisik :
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                        {selectedStockForDetail.quantity.toLocaleString()} {selectedStockForDetail.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-200">
                        Terakhir Bergerak :
                      </span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-[#1E3A52] text-blue-800 dark:text-white border border-blue-200 dark:border-[#3886B8]">
                        {lastMovementText}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Sebaran Kolom Peletakkan | Quantity | Catatan */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                      Sebaran Kolom Peletakkan Pallet (Yard)
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedStockColumns.length} Lokasi Kolom
                    </span>
                  </div>

                  <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#163653] text-white text-[11px] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="py-2.5 px-3.5">Sebaran Kolom Peletakkan</th>
                          <th className="py-2.5 px-3.5 text-center">Quantity</th>
                          <th className="py-2.5 px-3.5">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#0E1A26]">
                        {selectedStockColumns.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-5 px-3 text-center text-xs text-slate-400 italic">
                              Belum ada alokasi kolom spesifik (tersimpan di Area Transit atau kolom belum dicatat).
                            </td>
                          </tr>
                        ) : (
                          selectedStockColumns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                              <td className="py-2.5 px-3.5 font-bold font-mono text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                {col.columnName}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono font-black text-center text-blue-900 dark:text-white">
                                {col.quantity.toLocaleString()} {col.unit}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300 text-xs font-medium">
                                {col.notes?.trim() ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                    {col.notes}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {selectedStockColumns.length > 0 && (
                        <tfoot className="bg-slate-100 dark:bg-[#162738] font-bold border-t border-slate-200 dark:border-slate-800 text-xs">
                          <tr>
                            <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-200">
                              Total Tersebar di Kolom:
                            </td>
                            <td className="py-2.5 px-3.5 text-center font-mono text-emerald-800 dark:text-emerald-400">
                              {selectedStockColumns.reduce((acc, c) => acc + c.quantity, 0).toLocaleString()} {selectedStockForDetail.unit}
                            </td>
                            <td className="py-2.5 px-3.5 text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                              {selectedStockColumns.length} Kolom Aktif
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* 3. Riwayat Penerimaan Dan Pengeluaran (Urutan: waktu dan tanggal, shift, jenis mutasi, quantity, customer/user, operator, kolom, catatan) */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Riwayat Penerimaan Dan Pengeluaran
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {itemTransactions.length} Transaksi Terdata
                    </span>
                  </div>

                  {itemTransactions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-[#0E1A26] rounded-lg border border-slate-200 dark:border-slate-800">
                      Belum ada mutasi penerimaan atau pengeluaran untuk ukuran & spek ini.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#163653] text-white text-[10px] uppercase tracking-wider font-semibold sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Waktu & Tanggal</th>
                            <th className="py-2.5 px-3">Shift</th>
                            <th className="py-2.5 px-3">Jenis Mutasi</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3">Customer / User</th>
                            <th className="py-2.5 px-3">Operator</th>
                            <th className="py-2.5 px-3">Kolom</th>
                            <th className="py-2.5 px-3">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#0E1A26]">
                          {itemTransactions.map(tx => {
                            const isIncoming = tx.transactionType === 'PENERIMAAN';
                            const isOutgoing = tx.transactionType === 'PENGELUARAN';
                            const isMove = tx.transactionType === 'PINDAH_KOLOM';
                            const isChangeSpec = tx.transactionType === 'UBAH_SPEK';
                            const isTargetSpec = isChangeSpec && tx.targetPalletType?.toLowerCase() === selectedStockForDetail.palletType?.toLowerCase();

                            return (
                              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap text-slate-700 dark:text-slate-300">
                                  {tx.date} <span className="text-slate-400">{tx.time || ''}</span>
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                                  {tx.shift || '-'}
                                </td>
                                <td className="py-2 px-3 font-bold text-[11px] whitespace-nowrap">
                                  {isIncoming && (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                      + MASUK
                                    </span>
                                  )}
                                  {isOutgoing && (
                                    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                                      - KELUAR
                                    </span>
                                  )}
                                  {isMove && (
                                    <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400">
                                      PINDAH
                                    </span>
                                  )}
                                  {isChangeSpec && (
                                    <span className={`inline-flex items-center gap-1 ${isTargetSpec ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                      {isTargetSpec ? '+ UBAH SPEK' : '- UBAH SPEK'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                                  {isIncoming || isTargetSpec ? (
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                      +{tx.quantity} {tx.unit}
                                    </span>
                                  ) : isOutgoing || (isChangeSpec && !isTargetSpec) ? (
                                    <span className="text-red-700 dark:text-red-400">
                                      -{tx.quantity} {tx.unit}
                                    </span>
                                  ) : (
                                    <span className="text-blue-700 dark:text-blue-400">
                                      {tx.quantity} {tx.unit}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={tx.customer}>
                                  {tx.customer || '-'}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap">
                                  {tx.operator}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                  {isMove
                                    ? `${tx.kolomAsal || tx.pelatakanPallet || '-'} ➔ ${tx.kolomTujuan || '-'}`
                                    : isChangeSpec
                                    ? `${tx.pelatakanPallet || '-'} ➔ ${tx.kolomTujuan || tx.pelatakanPallet || '-'}`
                                    : (tx.pelatakanPallet || '-')}
                                </td>
                                <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px] max-w-[150px] truncate" title={tx.notes || ''}>
                                  {tx.notes || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-[#0E1A26] border-t border-slate-200 dark:border-[#1E3851] flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  PT Indah Kiat Karawang
                </span>
                <button
                  onClick={() => setSelectedStockForDetail(null)}
                  className="px-4 py-2 bg-[#163653] hover:bg-[#1E4366] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* THRESHOLD CONFIGURATION MODAL                                             */}
      {/* ========================================================================= */}
      {showThresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-slate-300 w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">KONFIGURASI BATAS STATUS STOK</h3>
              <button onClick={() => setShowThresholdModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batas Bawah AMAN (≥ unit)
                </label>
                <input
                  type="number"
                  min="5"
                  value={tempSafe}
                  onChange={(e) => setTempSafe(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batas Bawah PERHATIAN (unit)
                </label>
                <input
                  type="number"
                  min="1"
                  value={tempWarning}
                  onChange={(e) => setTempWarning(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono font-bold"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowThresholdModal(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveThresholds}
                className="px-4 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded hover:bg-emerald-600 cursor-pointer"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Print Preview & Print Modal */}
      <PrintReportModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        reportTitle={activeReportPayload.title}
        periodLabel={activeMainTab === 'stok-harian' ? `Tanggal: ${selectedDate}` : `Per Tanggal: ${getToday()}`}
        headers={activeReportPayload.headers}
        rows={activeReportPayload.rows}
        totalsSummary={activeReportPayload.totalsSummary}
        filenamePrefix={activeReportPayload.filenamePrefix}
        operatorName="Semua Operator Finish Pallet"
        docNumber={generateStockTakeDocNumber(
          undefined,
          undefined,
          activeMainTab === 'stok-harian' ? selectedDate : getToday()
        )}
        onDownloadExcel={handleExportExcel}
        onDownloadPDF={handleExportPDF}
      />
    </div>
  );
};

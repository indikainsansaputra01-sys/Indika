import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Table,
  ListFilter,
  Clock,
  Sparkles,
  RotateCcw,
  MessageSquare,
  X
} from 'lucide-react';
import { exportToExcel, exportToCSV, generateStockTakeDocNumber } from '../../utils/exportUtils';
import {
  exportToPDF,
  exportMonthlyStockMatrixToPDF,
  exportSingleDayStockToPDF,
  formatPalletDimension
} from '../../utils/pdfExportUtils';
import { PrintReportModal } from '../common/PrintReportModal';
import { SalinLaporanWAModal } from '../common/SalinLaporanWAModal';
import { PalletSideType } from '../../types';
import {
  calculateMonthlyStockMatrix,
  calculateSingleDayStockTake,
  getMonthlyDailyLedgerRows,
  exportMonthlyStockToExcel,
  exportSingleDayStockToExcel,
  getPrintableMonthlyMatrixHTML,
  getPrintableSingleDayHTML,
  formatDateIndo,
  getMonthName,
  MonthlyStockMatrixResult,
  SingleDayStockResult
} from '../../utils/monthlyStockUtils';

export const Laporan: React.FC = () => {
  const { transactions, stocks, currentUser, masterSizes, masterTypes, thresholds, showNotification } = useApp();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12
  const todayStr = today.toISOString().split('T')[0];

  // Active Main Report Tab
  // 1. 'stok-bulanan' = Laporan Stok Bulanan Per Tanggal (Stok Take)
  // 2. 'stok-harian'  = Laporan Stok 1 Hari Saja (Stock Take Harian)
  // 3. 'rekap-stok'   = Rekap Neraca Stok (Rentang Tanggal)
  // 4. 'rekap-in'     = Rekap Penerimaan (IN)
  // 5. 'rekap-out'    = Rekap Pengeluaran (OUT)
  const [activeTab, setActiveTab] = useState<
    'stok-bulanan' | 'stok-harian' | 'rekap-stok' | 'rekap-in' | 'rekap-out'
  >('stok-bulanan');

  // --- TAB 1: BULANAN STATE ---
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [monthlyViewMode, setMonthlyViewMode] = useState<'matrix' | 'ledger'>('matrix');
  const [monthlyDateRangeMode, setMonthlyDateRangeMode] = useState<'full' | 'part1' | 'part2' | 'part3'>('full');

  // --- UNIFIED FILTER SPESIFIKASI PALLET (Konsep Input Penerimaan) ---
  const [filterSize, setFilterSize] = useState<string>('');
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'Lokal' | 'Ekspor'>('ALL');
  const [filterWrap, setFilterWrap] = useState<'ALL' | string>('ALL');
  const [filterRunner, setFilterRunner] = useState<'ALL' | 'LS' | 'SS'>('ALL');
  const [filterUnit, setFilterUnit] = useState<'ALL' | 'Set' | 'Pcs'>('ALL');

  const isSpecFilterActive =
    filterSize.trim() !== '' ||
    filterMarket !== 'ALL' ||
    filterWrap !== 'ALL' ||
    filterRunner !== 'ALL' ||
    filterUnit !== 'ALL';

  const handleResetSpecFilter = () => {
    setFilterSize('');
    setFilterMarket('ALL');
    setFilterWrap('ALL');
    setFilterRunner('ALL');
    setFilterUnit('ALL');
  };

  const matchPalletSpec = (item: {
    palletSize: string;
    marketType?: string;
    palletType?: string;
    typePallet?: string;
    unit?: string;
  }) => {
    if (filterSize.trim()) {
      const q = filterSize.trim().toLowerCase();
      if (!item.palletSize.toLowerCase().includes(q)) return false;
    }
    if (filterMarket !== 'ALL') {
      const m = (item.marketType || 'Lokal').toLowerCase();
      if (m !== filterMarket.toLowerCase()) return false;
    }
    if (filterWrap !== 'ALL') {
      const itemWrap = (item.palletType || '').toLowerCase().replace(/^pallet\s+/i, '');
      const qWrap = filterWrap.toLowerCase().replace(/^pallet\s+/i, '');
      if (!itemWrap.includes(qWrap) && !qWrap.includes(itemWrap)) return false;
    }
    if (filterRunner !== 'ALL') {
      const r = (item.typePallet || 'LS').toUpperCase();
      if (r !== filterRunner) return false;
    }
    if (filterUnit !== 'ALL') {
      const u = (item.unit || 'Set').toLowerCase();
      if (u !== filterUnit.toLowerCase()) return false;
    }
    return true;
  };

  // --- TAB 2: HARIAN (1 HARI SAJA) STATE ---
  const [singleDate, setSingleDate] = useState<string>(todayStr);

  // --- TAB 3, 4, 5: DATE RANGE STATE ---
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // WhatsApp Modal State
  const [showWaModal, setShowWaModal] = useState<boolean>(false);
  const [waModalMode, setWaModalMode] = useState<'PENERIMAAN' | 'PENGELUARAN'>('PENERIMAAN');

  // Operator Name
  const operatorName = currentUser?.name || 'Indika (Operator)';

  // Distinct sizes and types for filter dropdowns
  const availableSizes = useMemo(() => {
    const list = masterSizes.filter(s => s.active).map(s => s.name);
    const defaults = ['81x111', '82x82', '67x102', '72x102', '92x122', '115x140'];
    const fromStocks = stocks.map(s => s.palletSize);
    return Array.from(new Set([...list, ...defaults, ...fromStocks])).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [masterSizes, stocks]);

  const availableTypes = useMemo(() => {
    const list = masterTypes.filter(t => t.active).map(t => t.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);

  // ==========================================
  // TAB 1: MONTHLY STOCK MATRIX COMPUTATION
  // ==========================================
  const rawMonthlyMatrix: MonthlyStockMatrixResult = useMemo(() => {
    return calculateMonthlyStockMatrix(selectedYear, selectedMonth, stocks, transactions);
  }, [selectedYear, selectedMonth, stocks, transactions]);

  // Filtered rows for UI presentation
  const filteredMonthlyRows = useMemo(() => {
    return rawMonthlyMatrix.rows.filter(r => matchPalletSpec(r));
  }, [rawMonthlyMatrix, filterSize, filterMarket, filterWrap, filterRunner, filterUnit]);

  // Determine active date slice for table matrix columns
  const activeDaysList = useMemo(() => {
    const totalDays = rawMonthlyMatrix.daysInMonth;
    if (monthlyDateRangeMode === 'part1') {
      return rawMonthlyMatrix.daysList.filter(d => d >= 1 && d <= 10);
    }
    if (monthlyDateRangeMode === 'part2') {
      return rawMonthlyMatrix.daysList.filter(d => d >= 11 && d <= 20);
    }
    if (monthlyDateRangeMode === 'part3') {
      return rawMonthlyMatrix.daysList.filter(d => d >= 21 && d <= totalDays);
    }
    return rawMonthlyMatrix.daysList;
  }, [rawMonthlyMatrix, monthlyDateRangeMode]);

  // Ledger rows for Tab 1
  const monthlyLedgerRows = useMemo(() => {
    const rows = getMonthlyDailyLedgerRows(rawMonthlyMatrix, filterSize);
    return rows.filter(r => matchPalletSpec(r));
  }, [rawMonthlyMatrix, filterSize, filterMarket, filterWrap, filterRunner, filterUnit]);

  // ==========================================
  // TAB 2: SINGLE DAY STOCK TAKE COMPUTATION
  // ==========================================
  const rawSingleDay: SingleDayStockResult = useMemo(() => {
    return calculateSingleDayStockTake(singleDate, stocks, transactions, thresholds);
  }, [singleDate, stocks, transactions, thresholds]);

  const filteredSingleDayRows = useMemo(() => {
    return rawSingleDay.rows.filter(r => matchPalletSpec(r));
  }, [rawSingleDay, filterSize, filterMarket, filterWrap, filterRunner, filterUnit]);

  // ==========================================
  // TAB 3, 4, 5: LEGACY MUTASI COMPUTATIONS
  // ==========================================
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    const todayStrNow = now.toISOString().split('T')[0];

    if (dateFilterMode === 'today') {
      return { startDate: todayStrNow, endDate: todayStrNow, periodLabel: `Hari Ini (${todayStrNow})` };
    } else if (dateFilterMode === 'week') {
      const past7 = new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0];
      return { startDate: past7, endDate: todayStrNow, periodLabel: `7 Hari Terakhir (${past7} s/d ${todayStrNow})` };
    } else if (dateFilterMode === 'month') {
      const past30 = new Date(now.getTime() - 29 * 86400000).toISOString().split('T')[0];
      return { startDate: past30, endDate: todayStrNow, periodLabel: `30 Hari Terakhir (${past30} s/d ${todayStrNow})` };
    } else {
      return { startDate: customStart, endDate: customEnd, periodLabel: `${customStart} s/d ${customEnd}` };
    }
  }, [dateFilterMode, customStart, customEnd]);

  const periodTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }, [transactions, startDate, endDate]);

  const rekapPenerimaan = useMemo(() => {
    const map: Record<string, {
      palletSize: string;
      palletType: string;
      typePallet: PalletSideType;
      customer: string;
      shift: string;
      marketType: string;
      unit: string;
      columns: Set<string>;
      quantity: number;
      txCount: number;
    }> = {};

    periodTransactions
      .filter(t => t.transactionType === 'PENERIMAAN')
      .forEach(t => {
        const txTypePallet = t.typePallet || 'LS';
        const key = `${t.palletSize}__${txTypePallet}__${t.palletType}__${t.customer}__${t.shift}__${t.marketType}__${t.unit}`;
        if (!map[key]) {
          map[key] = {
            palletSize: t.palletSize,
            palletType: t.palletType,
            typePallet: txTypePallet,
            customer: t.customer,
            shift: t.shift,
            marketType: t.marketType,
            unit: t.unit,
            columns: new Set(),
            quantity: 0,
            txCount: 0
          };
        }
        map[key].quantity += t.quantity;
        map[key].txCount += 1;
        if (t.pelatakanPallet && t.pelatakanPallet.trim()) {
          map[key].columns.add(t.pelatakanPallet.trim());
        }
      });

    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  }, [periodTransactions]);

  const rekapPengeluaran = useMemo(() => {
    const map: Record<string, {
      palletSize: string;
      palletType: string;
      typePallet: PalletSideType;
      customer: string;
      shift: string;
      marketType: string;
      unit: string;
      columns: Set<string>;
      quantity: number;
      txCount: number;
    }> = {};

    periodTransactions
      .filter(t => t.transactionType === 'PENGELUARAN')
      .forEach(t => {
        const txTypePallet = t.typePallet || 'LS';
        const key = `${t.palletSize}__${txTypePallet}__${t.palletType}__${t.customer}__${t.shift}__${t.marketType}__${t.unit}`;
        if (!map[key]) {
          map[key] = {
            palletSize: t.palletSize,
            palletType: t.palletType,
            typePallet: txTypePallet,
            customer: t.customer,
            shift: t.shift,
            marketType: t.marketType,
            unit: t.unit,
            columns: new Set(),
            quantity: 0,
            txCount: 0
          };
        }
        map[key].quantity += t.quantity;
        map[key].txCount += 1;
        if (t.pelatakanPallet && t.pelatakanPallet.trim()) {
          map[key].columns.add(t.pelatakanPallet.trim());
        }
      });

    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  }, [periodTransactions]);

  const rekapStok = useMemo(() => {
    return stocks.map(item => {
      const itemTypePallet = item.typePallet || 'LS';
      const matchingTxs = periodTransactions.filter(
        t =>
          (t.typePallet || 'LS') === itemTypePallet &&
          t.palletSize.toLowerCase() === item.palletSize.toLowerCase() &&
          t.palletType.toLowerCase() === item.palletType.toLowerCase() &&
          t.marketType.toLowerCase() === item.marketType.toLowerCase() &&
          t.unit === item.unit
      );

      const penerimaanPeriod = matchingTxs
        .filter(t => t.transactionType === 'PENERIMAAN')
        .reduce((sum, t) => sum + t.quantity, 0);

      const pengeluaranPeriod = matchingTxs
        .filter(t => t.transactionType === 'PENGELUARAN')
        .reduce((sum, t) => sum + t.quantity, 0);

      const stokAkhir = item.quantity;
      const stokAwal = Math.max(0, stokAkhir - penerimaanPeriod + pengeluaranPeriod);

      return {
        id: item.id,
        palletSize: item.palletSize,
        palletType: item.palletType,
        typePallet: itemTypePallet,
        marketType: item.marketType,
        unit: item.unit,
        stokAwal,
        penerimaan: penerimaanPeriod,
        pengeluaran: pengeluaranPeriod,
        stokAkhir
      };
    });
  }, [stocks, periodTransactions]);

  // Filtered Rekap lists according to active spec filter
  const filteredRekapStok = useMemo(() => {
    return rekapStok.filter(r => matchPalletSpec(r));
  }, [rekapStok, filterSize, filterMarket, filterWrap, filterRunner, filterUnit]);

  const filteredRekapPenerimaan = useMemo(() => {
    return rekapPenerimaan.filter(r => matchPalletSpec(r));
  }, [rekapPenerimaan, filterSize, filterMarket, filterWrap, filterRunner, filterUnit]);

  const filteredRekapPengeluaran = useMemo(() => {
    return rekapPengeluaran.filter(r => matchPalletSpec(r));
  }, [rekapPengeluaran, filterSize, filterMarket, filterWrap, filterRunner, filterUnit]);

  const totalInPeriod = filteredRekapPenerimaan.reduce((s, r) => s + r.quantity, 0);
  const totalOutPeriod = filteredRekapPengeluaran.reduce((s, r) => s + r.quantity, 0);

  // ==========================================
  // PRINT & EXCEL PAYLOAD COMPUTATION
  // ==========================================
  const activePrintPayload = useMemo(() => {
    if (activeTab === 'stok-bulanan') {
      const dayStart = activeDaysList[0] || 1;
      const dayEnd = activeDaysList[activeDaysList.length - 1] || rawMonthlyMatrix.daysInMonth;
      const stockDocNumber = generateStockTakeDocNumber(rawMonthlyMatrix.year, rawMonthlyMatrix.month);
      const customHtml = getPrintableMonthlyMatrixHTML({
        matrix: rawMonthlyMatrix,
        operatorName: 'Semua Operator Finish Pallet',
        dayStart,
        dayEnd
      });

      return {
        title: `LAPORAN STOK TAKE & SALDO MUTASI BULANAN (${rawMonthlyMatrix.monthName.toUpperCase()} ${rawMonthlyMatrix.year})`,
        periodLabel: `${rawMonthlyMatrix.monthName} ${rawMonthlyMatrix.year} (Tgl ${dayStart} s/d ${dayEnd})`,
        headers: [
          'No',
          'Ukuran Pallet',
          'Region',
          'Wrap Type',
          'Pallet Runners',
          'Satuan',
          'Stok Awal',
          'Total Penerimaan (+)',
          'Total Pengeluaran (-)',
          'Stok Akhir Bulan'
        ],
        rows: filteredMonthlyRows.map((r, i) => [
          i + 1,
          formatPalletDimension(r.palletSize),
          r.marketType,
          r.palletType,
          r.typePallet || 'LS',
          r.unit,
          r.startOfMonthQty,
          r.totalInMonth,
          r.totalOutMonth,
          r.endOfMonthQty
        ]),
        totalsSummary: `Total Stok Awal: ${rawMonthlyMatrix.totalStartMonth} | Penerimaan: +${rawMonthlyMatrix.totalInMonth} | Pengeluaran: -${rawMonthlyMatrix.totalOutMonth} | Stok Akhir: ${rawMonthlyMatrix.totalEndMonth} Unit`,
        filenamePrefix: `Stok_Bulanan_${rawMonthlyMatrix.monthName}_${rawMonthlyMatrix.year}`,
        customHtml,
        operatorName: 'Semua Operator Finish Pallet',
        docNumber: stockDocNumber,
        onDownloadExcel: () => exportMonthlyStockToExcel({ matrix: rawMonthlyMatrix, operatorName: 'Semua Operator Finish Pallet' })
      };
    } else if (activeTab === 'stok-harian') {
      const stockDocNumber = generateStockTakeDocNumber(undefined, undefined, rawSingleDay.targetDate);
      const customHtml = getPrintableSingleDayHTML({
        singleDay: rawSingleDay,
        operatorName: 'Semua Operator Finish Pallet'
      });

      return {
        title: `LAPORAN SALDO STOK HARIAN (STOCK TAKE 1 HARI)`,
        periodLabel: `${rawSingleDay.formattedDate} (${rawSingleDay.targetDate})`,
        headers: [
          'No',
          'Ukuran Pallet',
          'Region',
          'Wrap Type',
          'Pallet Runners',
          'Satuan',
          'Stok Awal',
          'Penerimaan (+)',
          'Pengeluaran (-)',
          'Stok Akhir'
        ],
        rows: filteredSingleDayRows.map((r, i) => [
          i + 1,
          formatPalletDimension(r.palletSize),
          r.marketType,
          r.palletType,
          r.typePallet || 'LS',
          r.unit,
          r.startOfDayQty,
          r.inToday,
          r.outToday,
          r.endOfDayQty
        ]),
        totalsSummary: `Total Stok Awal: ${rawSingleDay.totalStart} | Penerimaan: +${rawSingleDay.totalIn} | Pengeluaran: -${rawSingleDay.totalOut} | Stok Akhir: ${rawSingleDay.totalEnd} Unit`,
        filenamePrefix: `Stok_Harian_${rawSingleDay.targetDate}`,
        customHtml,
        operatorName: 'Semua Operator Finish Pallet',
        docNumber: stockDocNumber,
        onDownloadExcel: () => exportSingleDayStockToExcel({ singleDay: rawSingleDay, operatorName: 'Semua Operator Finish Pallet' })
      };
    } else if (activeTab === 'rekap-stok') {
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
        'Stok Akhir'
      ];
      const rows = filteredRekapStok.map((r, idx) => [
        idx + 1,
        formatPalletDimension(r.palletSize),
        r.marketType,
        r.palletType,
        r.typePallet || 'LS',
        r.unit,
        r.stokAwal,
        r.penerimaan,
        r.pengeluaran,
        r.stokAkhir
      ]);
      const totalAwal = filteredRekapStok.reduce((s, r) => s + r.stokAwal, 0);
      const totalIn = filteredRekapStok.reduce((s, r) => s + r.penerimaan, 0);
      const totalOut = filteredRekapStok.reduce((s, r) => s + r.pengeluaran, 0);
      const totalAkhir = filteredRekapStok.reduce((s, r) => s + r.stokAkhir, 0);
      const stockDocNumber = generateStockTakeDocNumber(undefined, undefined, endDate);

      return {
        title: 'LAPORAN NERACA SALDO & MUTASI STOK PALLET',
        periodLabel,
        headers,
        rows,
        totalsSummary: `Total Stok Awal: ${totalAwal} | Masuk (+): ${totalIn} | Keluar (-): ${totalOut} | Stok Akhir: ${totalAkhir} Unit`,
        filenamePrefix: `Rekap_Stok_${startDate}_sd_${endDate}`,
        customHtml: undefined,
        operatorName: 'Semua Operator Finish Pallet',
        docNumber: stockDocNumber,
        onDownloadExcel: () =>
          exportToExcel({
            filename: `Rekap_Stok_${startDate}_sd_${endDate}`,
            reportTitle: 'LAPORAN NERACA SALDO & MUTASI STOK PALLET',
            periodLabel,
            operatorName: 'Semua Operator Finish Pallet',
            docNumber: stockDocNumber,
            headers,
            rows,
            totals: {
              label: 'TOTAL AKUMULASI',
              values: { 6: totalAwal, 7: totalIn, 8: totalOut, 9: totalAkhir }
            },
            signatures: true
          })
      };
    } else if (activeTab === 'rekap-in') {
      const headers = [
        'No',
        'Ukuran Pallet',
        'Region',
        'Wrap Type',
        'Pallet Runners',
        'User / Customer',
        'Kolom Peletakan',
        'Shift',
        'Frekuensi Trx',
        'Total Masuk (Set/Pcs)'
      ];
      const rows = filteredRekapPenerimaan.map((item, idx) => [
        idx + 1,
        formatPalletDimension(item.palletSize),
        item.marketType,
        item.palletType,
        item.typePallet || 'LS',
        item.customer,
        Array.from(item.columns).join(', ') || '-',
        item.shift,
        `${item.txCount}x`,
        item.quantity
      ]);
      return {
        title: 'LAPORAN REKAPITULASI PENERIMAAN PALLET DARI PRODUKSI',
        periodLabel,
        headers,
        rows,
        totalsSummary: `Total Pallet Masuk: +${totalInPeriod} Unit (${filteredRekapPenerimaan.length} Varian Transaksi)`,
        filenamePrefix: `Rekap_Penerimaan_${startDate}_sd_${endDate}`,
        customHtml: undefined,
        onDownloadExcel: () =>
          exportToExcel({
            filename: `Rekap_Penerimaan_${startDate}_sd_${endDate}`,
            reportTitle: 'LAPORAN REKAPITULASI PENERIMAAN PALLET DARI PRODUKSI',
            periodLabel,
            operatorName,
            headers,
            rows,
            totals: { label: 'TOTAL PENERIMAAN', values: { 9: totalInPeriod } },
            signatures: true
          })
      };
    } else {
      const headers = [
        'No',
        'Ukuran Pallet',
        'Region',
        'Wrap Type',
        'Pallet Runners',
        'Dikirim ke User',
        'Kolom Peletakan',
        'Shift',
        'Frekuensi Trx',
        'Total Keluar (Set/Pcs)'
      ];
      const rows = filteredRekapPengeluaran.map((item, idx) => [
        idx + 1,
        formatPalletDimension(item.palletSize),
        item.marketType,
        item.palletType,
        item.typePallet || 'LS',
        item.customer,
        Array.from(item.columns).join(', ') || '-',
        item.shift,
        `${item.txCount}x`,
        item.quantity
      ]);
      return {
        title: 'LAPORAN REKAPITULASI PENGELUARAN & PENGIRIMAN PALLET KE USER',
        periodLabel,
        headers,
        rows,
        totalsSummary: `Total Pallet Keluar: -${totalOutPeriod} Unit (${filteredRekapPengeluaran.length} Varian Transaksi)`,
        filenamePrefix: `Rekap_Pengeluaran_${startDate}_sd_${endDate}`,
        customHtml: undefined,
        onDownloadExcel: () =>
          exportToExcel({
            filename: `Rekap_Pengeluaran_${startDate}_sd_${endDate}`,
            reportTitle: 'LAPORAN REKAPITULASI PENGELUARAN & PENGIRIMAN PALLET KE USER',
            periodLabel,
            operatorName,
            headers,
            rows,
            totals: { label: 'TOTAL PENGELUARAN', values: { 9: totalOutPeriod } },
            signatures: true
          })
      };
    }
  }, [
    activeTab,
    activeDaysList,
    rawMonthlyMatrix,
    filteredMonthlyRows,
    rawSingleDay,
    filteredSingleDayRows,
    rekapStok,
    rekapPenerimaan,
    rekapPengeluaran,
    periodLabel,
    startDate,
    endDate,
    totalInPeriod,
    totalOutPeriod,
    operatorName
  ]);

  // Export handlers
  const handleExportExcel = async () => {
    try {
      if (activePrintPayload.onDownloadExcel) {
        await activePrintPayload.onDownloadExcel();
      } else {
        await exportToExcel({
          filename: activePrintPayload.filenamePrefix,
          reportTitle: activePrintPayload.title,
          periodLabel: activePrintPayload.periodLabel,
          operatorName,
          headers: activePrintPayload.headers,
          rows: activePrintPayload.rows,
          signatures: true
        });
      }
      showNotification('success', 'Excel Berhasil Diunduh', 'File Excel (.xlsx) rapih & terverifikasi berhasil disimpan.');
    } catch (_) {
      showNotification('error', 'Gagal Export', 'Terjadi kendala saat membuat file Excel.');
    }
  };

  const handleExportPDF = async () => {
    try {
      if (activeTab === 'stok-bulanan') {
        await exportMonthlyStockMatrixToPDF(rawMonthlyMatrix, { operatorName });
      } else if (activeTab === 'stok-harian') {
        await exportSingleDayStockToPDF(rawSingleDay, { operatorName });
      } else {
        await exportToPDF({
          filename: activePrintPayload.filenamePrefix,
          reportTitle: activePrintPayload.title,
          periodLabel: activePrintPayload.periodLabel,
          operatorName,
          docNumber: (activePrintPayload as any).docNumber,
          headers: activePrintPayload.headers,
          rows: activePrintPayload.rows,
          totalsSummary: activePrintPayload.totalsSummary,
          signatures: true
        });
      }
      showNotification('success', 'PDF Berhasil Diunduh', 'Dokumen PDF resmi (.pdf) siap cetak & tanda tangan berhasil disimpan.');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      showNotification('error', 'Gagal Export PDF', 'Terjadi kendala saat membuat file PDF.');
    }
  };

  const handleExportCSV = () => {
    try {
      if (activeTab === 'stok-bulanan') {
        const headers = [
          'No',
          'Ukuran Pallet',
          'Jenis Pallet',
          'Pasar',
          'Satuan',
          'Stok Awal Bulan',
          ...rawMonthlyMatrix.daysList.map(d => `Tgl_${d}`),
          'Total_Masuk',
          'Total_Keluar',
          'Stok_Akhir_Bulan'
        ];
        const rows = rawMonthlyMatrix.rows.map((r, i) => [
          i + 1,
          formatPalletDimension(r.palletSize),
          r.palletType,
          r.marketType,
          r.unit,
          r.startOfMonthQty,
          ...rawMonthlyMatrix.daysList.map(d => r.dailyPoints.find(p => p.day === d)?.stock || 0),
          r.totalInMonth,
          r.totalOutMonth,
          r.endOfMonthQty
        ]);
        exportToCSV(`Stok_Bulanan_${rawMonthlyMatrix.monthName}_${rawMonthlyMatrix.year}.csv`, headers, rows);
      } else {
        exportToCSV(
          `${activePrintPayload.filenamePrefix}.csv`,
          activePrintPayload.headers,
          activePrintPayload.rows
        );
      }
      showNotification('success', 'CSV Diunduh', 'File data format .csv berhasil disimpan.');
    } catch (_) {
      showNotification('error', 'Gagal Export', 'Terjadi kendala saat membuat file CSV.');
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleSetCurrentMonth = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  };

  const renderDateRangeFilter = () => (
    <div className="bg-white dark:bg-[#112233] border border-slate-200 dark:border-[#1E3851] rounded-xl p-4 shadow-xs space-y-3 no-print transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0E1A26] p-1 rounded-lg border border-slate-200 dark:border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={() => setDateFilterMode('today')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              dateFilterMode === 'today'
                ? 'bg-[#163653] text-[#8CCCF0] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setDateFilterMode('week')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              dateFilterMode === 'week'
                ? 'bg-[#163653] text-[#8CCCF0] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            1 Minggu
          </button>
          <button
            type="button"
            onClick={() => setDateFilterMode('month')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              dateFilterMode === 'month'
                ? 'bg-[#163653] text-[#8CCCF0] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            1 Bulan
          </button>
          <button
            type="button"
            onClick={() => setDateFilterMode('custom')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              dateFilterMode === 'custom'
                ? 'bg-[#163653] text-[#8CCCF0] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Custom Tanggal
          </button>
        </div>

        {dateFilterMode === 'custom' && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Rentang:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0E1A26]"
            />
            <span className="text-slate-500 dark:text-slate-400">s/d</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0E1A26]"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderPalletSpecFilter = () => (
    <div className="bg-white dark:bg-[#112233] border border-slate-200 dark:border-[#1E3851] rounded-xl p-4 sm:p-5 shadow-xs space-y-4 no-print transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#163653] text-[#8CCCF0]">
            <ListFilter className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              FILTER SPESIFIKASI PALLET
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ketik ukuran dan pilih spesifikasi pallet untuk memfilter tabel laporan
            </p>
          </div>
        </div>

        {isSpecFilterActive && (
          <button
            type="button"
            onClick={handleResetSpecFilter}
            className="self-start sm:self-auto px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter Spek</span>
          </button>
        )}
      </div>

      {/* 1. Kolom Ketik Ukuran */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>
            Ukuran Pallet <span className="text-emerald-700 dark:text-emerald-400 font-semibold normal-case">(Ketik Sendiri)</span>
          </span>
          {filterSize && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
              Aktif: "{filterSize}"
            </span>
          )}
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={filterSize}
            onChange={(e) => setFilterSize(e.target.value)}
            placeholder="Ketik ukuran pallet (cth: 81x111, 82x82, 67x102, 72x102, 92x122, 115x140)..."
            list="laporan-pallet-sizes"
            className="w-full pl-9 pr-8 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-[#0E1A26] focus:outline-none focus:border-[#3886B8] placeholder-slate-400"
          />
          {filterSize && (
            <button
              type="button"
              onClick={() => setFilterSize('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              title="Hapus ketikan ukuran"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <datalist id="laporan-pallet-sizes">
            {availableSizes.map(sz => (
              <option key={sz} value={sz} />
            ))}
          </datalist>
        </div>

        {/* Quick Click Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Pilih Cepat:</span>
          {['81x111', '82x82', '67x102', '72x102', '92x122', '115x140'].map(quick => (
            <button
              key={quick}
              type="button"
              onClick={() => setFilterSize(filterSize === quick ? '' : quick)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors border ${
                filterSize === quick
                  ? 'bg-[#163653] text-[#8CCCF0] border-[#163653] font-bold shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {quick}
            </button>
          ))}
          {filterSize && (
            <button
              type="button"
              onClick={() => setFilterSize('')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Semua Ukuran
            </button>
          )}
        </div>
      </div>

      {/* 2. Opsi Spek Seperti Input Penerimaan (Region, Wrap Type, Pallet Runners, Satuan) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        {/* A. Region / Pasar */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Region / Pasar
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['ALL', 'Lokal', 'Ekspor'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setFilterMarket(m)}
                className={`py-1.5 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                  filterMarket === m
                    ? m === 'Lokal'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : m === 'Ekspor'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-[#163653] text-[#8CCCF0] border-[#163653] shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#0E1A26] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {m === 'ALL' ? 'Semua' : m}
              </button>
            ))}
          </div>
        </div>

        {/* B. Wrap Type (1-Click selection RW, BP, RCK, SRKLS) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Wrap Type</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold normal-case">Tinggal Klik</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { code: 'ALL', label: 'SEMUA', fullName: 'ALL' },
              { code: 'RW', label: 'RW', fullName: 'Pallet Reamwrap' },
              { code: 'BP', label: 'BP', fullName: 'Pallet Bulkpack' },
              { code: 'RCK', label: 'RCK', fullName: 'Pallet Racuk' },
              { code: 'SRKLS', label: 'SRKLS', fullName: 'Pallet Sirkulasi' }
            ].map(item => {
              const isSelected = filterWrap === item.fullName;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setFilterWrap(isSelected && item.code !== 'ALL' ? 'ALL' : item.fullName)}
                  className={`py-1.5 px-1 rounded border transition-colors cursor-pointer text-center text-xs ${
                    isSelected
                      ? 'bg-[#163653] text-[#8CCCF0] border-[#163653] font-bold shadow-2xs'
                      : 'bg-slate-50 dark:bg-[#0E1A26] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
                  }`}
                  title={item.fullName}
                >
                  <span className="block font-bold">{item.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* C. Pallet Runners (LS / SS) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Pallet Runners</span>
            <span className="text-[10px] text-slate-400 font-normal">LS / SS</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['ALL', 'LS', 'SS'] as const).map(rn => (
              <button
                key={rn}
                type="button"
                onClick={() => setFilterRunner(rn)}
                className={`py-1.5 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                  filterRunner === rn
                    ? 'bg-[#163653] text-[#8CCCF0] border-[#163653] shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#0E1A26] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {rn === 'ALL' ? 'Semua' : rn}
              </button>
            ))}
          </div>
        </div>

        {/* D. Satuan Ukur (Set / Pcs) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Satuan Ukur
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['ALL', 'Set', 'Pcs'] as const).map(u => (
              <button
                key={u}
                type="button"
                onClick={() => setFilterUnit(u)}
                className={`py-1.5 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                  filterUnit === u
                    ? 'bg-[#163653] text-[#8CCCF0] border-[#163653] shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#0E1A26] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {u === 'ALL' ? 'Semua' : u}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#3886B8] text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">
                  LAPORAN STOK TAKE & AUDIT PALLET
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#112B43] text-[#8CCCF0] border border-[#1E4366]">
                  Siap Cetak A4, PDF & Excel
                </span>
              </div>
              <p className="text-xs text-[#8CCCF0] mt-0.5 font-medium">
                PT Indah Kiat Karawang · Laporan stok bulanan per tanggal, stock take harian 1 hari, & neraca mutasi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          <button
            type="button"
            onClick={() => {
              setWaModalMode(activeTab === 'rekap-out' ? 'PENGELUARAN' : 'PENERIMAAN');
              setShowWaModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16805D] hover:bg-[#136B4E] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Salin Format Laporan WhatsApp Resmi (Hasil Produksi / Pengeluaran Terpisah)"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Salin Teks WA</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#112B43] hover:bg-[#1E4366] text-[#8CCCF0] border border-[#1E4366] rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Cetak langsung ke kertas A4 atau pratinjau dokumen resmi"
          >
            <Printer className="w-4 h-4 text-[#8CCCF0]" />
            <span>Cetak Dokumen (A4)</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Unduh laporan berformat PDF resmi (.pdf) dengan lembar 3 tanda tangan berjenjang"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PDF (.pdf)</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16805D] hover:bg-[#136B4E] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Unduh laporan berformat Microsoft Excel (.xlsx) dengan lembar tanda tangan"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#112B43] hover:bg-[#1E4366] text-slate-300 border border-[#1E4366] rounded-lg text-xs font-semibold transition-all cursor-pointer"
            title="Unduh format data mentah .CSV"
          >
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (5 Tabs) */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-1.5 shadow-xs flex flex-wrap items-center gap-1.5 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('stok-bulanan')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'stok-bulanan'
              ? 'bg-[#3886B8] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>1. Laporan Stok Bulanan (Per Tanggal)</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#112B43] text-[#8CCCF0] font-bold">
            STOK TAKE
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stok-harian')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'stok-harian'
              ? 'bg-[#3886B8] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>2. Laporan Stok 1 Hari Saja (Harian)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rekap-stok')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'rekap-stok'
              ? 'bg-[#163653] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>3. Rekap Neraca Saldo (Periode)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rekap-in')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'rekap-in'
              ? 'bg-[#16805D] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-[#16805D] dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>4. Rekap Penerimaan (+{totalInPeriod})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rekap-out')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'rekap-out'
              ? 'bg-[#D97706] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-200 hover:text-[#D97706] dark:hover:text-amber-300 hover:bg-amber-50/80 dark:hover:bg-[#1E3A52]'
          }`}
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          <span>5. Rekap Pengeluaran (-{totalOutPeriod})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: LAPORAN STOK BULANAN PER TANGGAL (STOK TAKE BULAN) */}
      {/* ========================================================= */}
      {activeTab === 'stok-bulanan' && (
        <div className="space-y-4">
          {/* Monthly Control & Filter Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4 no-print">
            {/* Top row: Month & Year Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                  title="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white cursor-pointer shadow-xs"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {getMonthName(m)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white cursor-pointer shadow-xs"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                  title="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleSetCurrentMonth}
                  className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Bulan Ini</span>
                </button>
              </div>

              {/* View Switch: Matriks 1-31 vs Buku Mutasi */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Tampilan:</span>
                <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMonthlyViewMode('matrix')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      monthlyViewMode === 'matrix'
                        ? 'bg-amber-900 text-amber-50 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Matriks Harian (Tgl 1 - {rawMonthlyMatrix.daysInMonth})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyViewMode('ledger')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      monthlyViewMode === 'ledger'
                        ? 'bg-amber-900 text-amber-50 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Buku Mutasi Per Tanggal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Date Slice Selector for Matrix view */}
            {monthlyViewMode === 'matrix' ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rentang Kolom Tanggal Matriks:
                </span>
                <select
                  value={monthlyDateRangeMode}
                  onChange={(e) => setMonthlyDateRangeMode(e.target.value as any)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-amber-900 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 shadow-2xs"
                >
                  <option value="full">1 Bulan Penuh (Tgl 1 - {rawMonthlyMatrix.daysInMonth})</option>
                  <option value="part1">Tgl 01 s/d Tgl 10</option>
                  <option value="part2">Tgl 11 s/d Tgl 20</option>
                  <option value="part3">Tgl 21 s/d Tgl {rawMonthlyMatrix.daysInMonth}</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-mono pt-1">
                <span>Total {monthlyLedgerRows.length} Baris Mutasi Per Tanggal</span>
              </div>
            )}
          </div>

          {/* PALLET SPECIFICATION FILTER PANEL */}
          {renderPalletSpecFilter()}

          {/* KPI Summary Cards for Month */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Stok Awal Bulan (Tgl 1)
              </span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {rawMonthlyMatrix.totalStartMonth.toLocaleString('id-ID')}
                <span className="text-xs text-slate-500 font-normal ml-1">Unit</span>
              </div>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Penerimaan Bulan Ini (+)
              </span>
              <div className="text-xl font-black text-emerald-800 mt-1 font-mono">
                +{rawMonthlyMatrix.totalInMonth.toLocaleString('id-ID')}
                <span className="text-xs text-emerald-700 font-normal ml-1">Unit</span>
              </div>
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                Pengeluaran Bulan Ini (-)
              </span>
              <div className="text-xl font-black text-red-800 mt-1 font-mono">
                -{rawMonthlyMatrix.totalOutMonth.toLocaleString('id-ID')}
                <span className="text-xs text-red-700 font-normal ml-1">Unit</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Stok Akhir Bulan ({rawMonthlyMatrix.monthName})
              </span>
              <div className="text-xl font-black text-amber-950 mt-1 font-mono">
                {rawMonthlyMatrix.totalEndMonth.toLocaleString('id-ID')}
                <span className="text-xs text-amber-800 font-normal ml-1">Unit</span>
              </div>
            </div>
          </div>

          {/* User Prompt Note Banner */}
          <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Laporan Stok Take Bulanan Per Tanggal:</span>{' '}
              Tabel di bawah mencatat posisi <span className="font-bold">stok akhir</span> untuk setiap ukuran, serta rincian <span className="text-emerald-800 font-bold">Penerimaan (+)</span> dan <span className="text-red-700 font-bold">Pengeluaran (-)</span> di tanggal itu untuk tracking mutasi harian secara akurat.
            </div>
          </div>

          {/* VIEW MODE A: MATRIKS TANGGAL (1 s/d 31) */}
          {monthlyViewMode === 'matrix' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase">
                    MATRIKS POSISI STOK PALLET PER TANGGAL · {rawMonthlyMatrix.monthName.toUpperCase()} {rawMonthlyMatrix.year}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Struktur kolom: Ukuran Pallet, Region, Wrap Type, Pallet Runners, Saldo Awal, dilanjutkan kolom tanggal dengan Stok Akhir, Penerimaan (+), dan Pengeluaran (-).
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                  Kolom Aktif: Tgl {activeDaysList[0]} s/d {activeDaysList[activeDaysList.length - 1]}
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="py-2 px-2 text-center w-8 sticky left-0 z-30 bg-slate-900 border-r border-slate-800">
                        No
                      </th>
                      <th className="py-2 px-3 text-left w-24 sticky left-8 z-30 bg-slate-900 border-r border-slate-800">
                        Ukuran Pallet
                      </th>
                      <th className="py-2 px-2 text-center w-16">Region</th>
                      <th className="py-2 px-3 text-left w-28">Wrap Type</th>
                      <th className="py-2 px-2 text-center w-16">Pallet Runners</th>
                      <th className="py-2 px-2 text-center w-12">Sat</th>
                      <th className="py-2 px-2 text-right w-16 bg-slate-800 border-r border-slate-700">
                        Awal
                      </th>
                      {/* Dynamic Date Columns */}
                      {activeDaysList.map(d => (
                        <th
                          key={d}
                          className="py-1.5 px-1 text-center min-w-[56px] border-r border-slate-800 font-mono text-[9.5px]"
                          title={`Tanggal ${d} ${rawMonthlyMatrix.monthName} (Stok Akhir, Penerimaan, Pengeluaran)`}
                        >
                          <div>Tgl {String(d).padStart(2, '0')}</div>
                          <div className="text-[8px] font-normal text-slate-400">Stok/In/Out</div>
                        </th>
                      ))}
                      <th className="py-2 px-2 text-right w-16 bg-emerald-900/90 text-emerald-200 border-l border-slate-700">
                        Penerimaan
                      </th>
                      <th className="py-2 px-2 text-right w-16 bg-red-900/90 text-red-200">
                        Pengeluaran
                      </th>
                      <th className="py-2 px-2 text-right w-20 bg-amber-900 text-amber-200 sticky right-0 z-30">
                        Saldo Akhir
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMonthlyRows.length === 0 ? (
                      <tr>
                        <td colSpan={10 + activeDaysList.length} className="py-12 text-center text-slate-400">
                          Tidak ada ukuran pallet yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredMonthlyRows.map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-amber-50/40 transition-colors ${
                              isEven ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <td className="py-2 px-2 text-center font-mono text-slate-400 sticky left-0 z-10 bg-inherit border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900 sticky left-8 z-10 bg-inherit border-r border-slate-200 whitespace-nowrap">
                              {row.palletSize}
                            </td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  row.marketType === 'Lokal'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {row.marketType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700 truncate max-w-[130px]" title={row.palletType}>
                              {row.palletType}
                            </td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  (row.typePallet || 'LS') === 'LS'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-purple-50 text-purple-800 border-purple-200'
                                }`}
                                title={(row.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                              >
                                {row.typePallet || 'LS'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-500">
                              {row.unit}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-slate-700 bg-slate-100/60 border-r border-slate-200">
                              {row.startOfMonthQty}
                            </td>

                            {/* Daily Stock Points: Stok Akhir + Penerimaan + Pengeluaran */}
                            {activeDaysList.map(d => {
                              const pt = row.dailyPoints.find(p => p.day === d);
                              const stockVal = pt ? pt.stock : 0;
                              const hasMut = pt && (pt.inQty > 0 || pt.outQty > 0);
                              return (
                                <td
                                  key={d}
                                  className={`py-1.5 px-1 text-right font-mono text-[11px] border-r border-slate-200 tabular-nums align-top ${
                                    hasMut
                                      ? 'bg-amber-100/90 border-amber-300'
                                      : stockVal > 0
                                      ? 'text-slate-800'
                                      : 'text-slate-300'
                                  }`}
                                  title={
                                    pt && hasMut
                                      ? `Tgl ${d}: Stok Akhir ${stockVal} ${row.unit} | Penerimaan: +${pt.inQty} | Pengeluaran: -${pt.outQty}`
                                      : `Tgl ${d}: Saldo ${stockVal} ${row.unit}`
                                  }
                                >
                                  <div className="font-extrabold text-slate-900 leading-tight">
                                    {stockVal > 0 ? (
                                      <span><span className="text-[9px] text-slate-500 font-normal">Stk:</span>{stockVal}</span>
                                    ) : '-'}
                                  </div>
                                  {hasMut && (
                                    <div className="flex flex-col text-[8.5px] font-bold leading-tight mt-0.5 space-y-0.5">
                                      {pt.inQty > 0 && (
                                        <span className="text-emerald-800 font-bold bg-emerald-50/80 rounded px-0.5 whitespace-nowrap">
                                          In:+{pt.inQty}
                                        </span>
                                      )}
                                      {pt.outQty > 0 && (
                                        <span className="text-red-700 font-bold bg-red-50/80 rounded px-0.5 whitespace-nowrap">
                                          Out:-{pt.outQty}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700 border-l border-slate-200">
                              +{row.totalInMonth}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-red-700">
                              -{row.totalOutMonth}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-black text-amber-950 bg-amber-50 sticky right-0 z-10 border-l border-amber-200">
                              {row.endOfMonthQty}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Summary Totals Footer */}
                  <tfoot className="bg-amber-100/80 text-amber-950 font-bold text-[11px] border-t-2 border-slate-900 sticky bottom-0 z-20">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-left uppercase sticky left-0 z-30 bg-amber-100">
                        TOTAL SALDO PALLET (UNIT)
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono border-r border-amber-200">
                        {rawMonthlyMatrix.totalStartMonth}
                      </td>
                      {activeDaysList.map(d => {
                        const dayTot = rawMonthlyMatrix.dailyTotals[d];
                        const totStock = dayTot?.stock || 0;
                        const hasMut = dayTot && (dayTot.inQty > 0 || dayTot.outQty > 0);
                        return (
                          <td
                            key={d}
                            className="py-2 px-1 text-right font-mono border-r border-amber-200 tabular-nums align-top"
                          >
                            <div className="font-extrabold leading-tight">
                              {totStock > 0 ? (
                                <span><span className="text-[8.5px] text-amber-800 font-normal">Stk:</span>{totStock}</span>
                              ) : 0}
                            </div>
                            {hasMut && (
                              <div className="flex flex-col text-[8.5px] font-bold leading-tight mt-0.5 space-y-0.5">
                                {dayTot.inQty > 0 && <span className="text-emerald-800 whitespace-nowrap">In:+{dayTot.inQty}</span>}
                                {dayTot.outQty > 0 && <span className="text-red-800 whitespace-nowrap">Out:-{dayTot.outQty}</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2 text-right font-mono text-emerald-800 border-l border-amber-200">
                        +{rawMonthlyMatrix.totalInMonth}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-red-800">
                        -{rawMonthlyMatrix.totalOutMonth}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-200 sticky right-0 z-30">
                        {rawMonthlyMatrix.totalEndMonth}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE B: BUKU MUTASI HARIAN PER TANGGAL */}
          {monthlyViewMode === 'ledger' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase">
                    BUKU MUTASI HARIAN PER TANGGAL · {rawMonthlyMatrix.monthName.toUpperCase()} {rawMonthlyMatrix.year}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Rincian per tanggal untuk stock take: stok awal, penerimaan, pengeluaran, dan saldo akhir setiap hari.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center">Tanggal</th>
                      <th className="py-2.5 px-3">Ukuran Pallet</th>
                      <th className="py-2.5 px-3 text-center">Region</th>
                      <th className="py-2.5 px-3">Wrap Type</th>
                      <th className="py-2.5 px-3 text-center">Pallet Runners</th>
                      <th className="py-2.5 px-2 text-center">Sat</th>
                      <th className="py-2.5 px-3 text-right">Stok Awal</th>
                      <th className="py-2.5 px-3 text-right text-emerald-700">Penerimaan (+)</th>
                      <th className="py-2.5 px-3 text-right text-red-700">Pengeluaran (-)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-900">Saldo Akhir</th>
                      <th className="py-2.5 px-3">Status Mutasi</th>
                      <th className="py-2.5 px-3">Kolom Yard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {monthlyLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-10 text-center text-slate-400">
                          Tidak ada data mutasi yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      monthlyLedgerRows.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700">
                            {formatDateIndo(item.date)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.palletSize}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.marketType === 'Lokal'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {item.marketType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {item.palletType}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                (item.typePallet || 'LS') === 'LS'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-purple-50 text-purple-800 border-purple-200'
                              }`}
                              title={(item.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                            >
                              {item.typePallet || 'LS'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                            {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {item.startQty}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {item.inQty > 0 ? `+${item.inQty}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700">
                            {item.outQty > 0 ? `-${item.outQty}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 bg-amber-50/60">
                            {item.endQty} {item.unit}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.inQty > 0 && item.outQty > 0
                                  ? 'bg-amber-100 text-amber-900'
                                  : item.inQty > 0
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : item.outQty > 0
                                  ? 'bg-red-100 text-red-900'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.shifts}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                            {item.columns}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LAPORAN STOK 1 HARI SAJA (STOCK TAKE HARIAN) */}
      {/* ========================================================= */}
      {activeTab === 'stok-harian' && (
        <div className="space-y-4">
          {/* Single Day Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Pilih Tanggal:</span>
                </span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-900 bg-white shadow-xs cursor-pointer focus:outline-emerald-600"
                />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSingleDate(todayStr)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                      singleDate === todayStr ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setSingleDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    Kemarin
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PALLET SPECIFICATION FILTER PANEL */}
          {renderPalletSpecFilter()}

          {/* KPI Cards for 1 Day */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Stok Awal ({rawSingleDay.targetDate})
              </span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {rawSingleDay.totalStart.toLocaleString('id-ID')}
                <span className="text-xs text-slate-500 font-normal ml-1">Unit</span>
              </div>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Masuk Hari Ini (+)
              </span>
              <div className="text-xl font-black text-emerald-800 mt-1 font-mono">
                +{rawSingleDay.totalIn.toLocaleString('id-ID')}
                <span className="text-xs text-emerald-700 font-normal ml-1">Unit</span>
              </div>
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                Keluar Hari Ini (-)
              </span>
              <div className="text-xl font-black text-red-800 mt-1 font-mono">
                -{rawSingleDay.totalOut.toLocaleString('id-ID')}
                <span className="text-xs text-red-700 font-normal ml-1">Unit</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Stok Akhir Hari Ini
              </span>
              <div className="text-xl font-black text-amber-950 mt-1 font-mono">
                {rawSingleDay.totalEnd.toLocaleString('id-ID')}
                <span className="text-xs text-amber-800 font-normal ml-1">Unit</span>
              </div>
            </div>
          </div>

          {/* Table for 1 Day */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  SALDO STOK & REKAP MUTASI TANGGAL {rawSingleDay.formattedDate.toUpperCase()}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Hasil stock take saldo awal, penerimaan, pengeluaran, dan saldo akhir pallet pada 1 hari ini.
                </p>
              </div>
              <div className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                Total {filteredSingleDayRows.length} Varian Pallet
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-3">Ukuran Pallet</th>
                    <th className="py-2.5 px-2 text-center">Region</th>
                    <th className="py-2.5 px-3">Wrap Type</th>
                    <th className="py-2.5 px-3 text-center">Pallet Runners</th>
                    <th className="py-2.5 px-2 text-center">Satuan</th>
                    <th className="py-2.5 px-3 text-right">Stok Awal</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">Penerimaan (+)</th>
                    <th className="py-2.5 px-3 text-right text-red-700">Pengeluaran (-)</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Stok Akhir</th>
                    <th className="py-2.5 px-3">Kolom Peletakan Yard</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSingleDayRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        Tidak ada data stok untuk tanggal {rawSingleDay.targetDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredSingleDayRows.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {r.palletSize}
                        </td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.marketType === 'Lokal'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {r.marketType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {r.palletType}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              (r.typePallet || 'LS') === 'LS'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                            title={(r.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                          >
                            {r.typePallet || 'LS'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                          {r.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 tabular-nums">
                          {r.startOfDayQty.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                          {r.inToday > 0 ? `+${r.inToday.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700 tabular-nums">
                          {r.outToday > 0 ? `-${r.outToday.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 tabular-nums bg-amber-50/50">
                          {r.endOfDayQty.toLocaleString('id-ID')} {r.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                          {r.activeColumns.join(', ') || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'KRITIS'
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : r.status === 'PERHATIAN'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-amber-100/70 text-amber-950 font-bold text-[11px] border-t-2 border-slate-900">
                  <tr>
                    <td colSpan={6} className="py-2.5 px-3 uppercase text-left">
                      TOTAL SALDO PALLET HARI INI
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {rawSingleDay.totalStart.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-800">
                      +{rawSingleDay.totalIn.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-800">
                      -{rawSingleDay.totalOut.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-amber-950 bg-amber-200/80">
                      {rawSingleDay.totalEnd.toLocaleString('id-ID')} Unit
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-center text-slate-500 font-normal">
                      Selesai Diaudit
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: REKAP NERACA SALDO STOK (RENTANG TANGGAL) */}
      {/* ========================================================= */}
      {activeTab === 'rekap-stok' && (
        <div className="space-y-4">
          {renderDateRangeFilter()}
          {renderPalletSpecFilter()}

          <div className="bg-white dark:bg-[#112233] border border-slate-200 dark:border-[#1E3851] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-[#0E1A26] border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                  REKAP NERACA STOK PALLET (PERIODE: {periodLabel})
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Rumus: STOK AKHIR = STOK AWAL + PENERIMAAN - PENGELUARAN
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Ukuran Pallet</th>
                    <th className="py-2.5 px-3 text-center">Region</th>
                    <th className="py-2.5 px-3">Wrap Type</th>
                    <th className="py-2.5 px-3 text-center">Pallet Runners</th>
                    <th className="py-2.5 px-3 text-center">Satuan</th>
                    <th className="py-2.5 px-3 text-right">Stok Awal</th>
                    <th className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-400">Penerimaan (+)</th>
                    <th className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-400">Pengeluaran (-)</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">Stok Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRekapStok.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        Tidak ada data neraca stok yang cocok dengan kriteria filter pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRekapStok.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{r.palletSize}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.marketType === 'Lokal'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {r.marketType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{r.palletType}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              (r.typePallet || 'LS') === 'LS'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            }`}
                            title={(r.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                          >
                            {r.typePallet || 'LS'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold dark:text-slate-300">{r.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                          {r.stokAwal}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{r.penerimaan}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          -{r.pengeluaran}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums bg-slate-50/50 dark:bg-slate-800/30">
                          {r.stokAkhir} {r.unit}
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

      {/* ========================================================= */}
      {/* TAB 4: REKAP PENERIMAAN (IN) */}
      {/* ========================================================= */}
      {activeTab === 'rekap-in' && (
        <div className="space-y-4">
          {renderDateRangeFilter()}
          {renderPalletSpecFilter()}

          <div className="bg-white dark:bg-[#112233] border border-slate-200 dark:border-[#1E3851] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 uppercase">
                  REKAP PENERIMAAN PALLET DARI PRODUKSI
                </h2>
                <p className="text-xs text-emerald-800 dark:text-emerald-400">
                  Total Masuk: <b>+{totalInPeriod} Unit</b> pada periode {periodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWaModalMode('PENERIMAAN');
                  setShowWaModal(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Salin Format WA (Penerimaan)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Ukuran Pallet</th>
                    <th className="py-2.5 px-3 text-center">Region</th>
                    <th className="py-2.5 px-3">Wrap Type</th>
                    <th className="py-2.5 px-3 text-center">Pallet Runners</th>
                    <th className="py-2.5 px-3">User / Customer</th>
                    <th className="py-2.5 px-3">Kolom Peletakan</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3 text-right">Frekuensi Trx</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-900 dark:text-emerald-300">Total Masuk (Set/Pcs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRekapPenerimaan.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        Tidak ada data penerimaan yang cocok dengan kriteria filter pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRekapPenerimaan.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{item.palletSize}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.marketType === 'Lokal'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {item.marketType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{item.palletType}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              (item.typePallet || 'LS') === 'LS'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            }`}
                            title={(item.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                          >
                            {item.typePallet || 'LS'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{item.customer}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {Array.from(item.columns).join(', ') || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono dark:text-slate-300">{item.shift}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">{item.txCount}x</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{item.quantity}
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

      {/* ========================================================= */}
      {/* TAB 5: REKAP PENGELUARAN (OUT) */}
      {/* ========================================================= */}
      {activeTab === 'rekap-out' && (
        <div className="space-y-4">
          {renderDateRangeFilter()}
          {renderPalletSpecFilter()}

          <div className="bg-white dark:bg-[#112233] border border-slate-200 dark:border-[#1E3851] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-amber-950 dark:text-amber-300 uppercase">
                  REKAP PENGELUARAN / PENGIRIMAN PALLET KE USER
                </h2>
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  Total Keluar: <b>-{totalOutPeriod} Unit</b> pada periode {periodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWaModalMode('PENGELUARAN');
                  setShowWaModal(true);
                }}
                className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Salin Format WA (Pengeluaran)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Ukuran Pallet</th>
                    <th className="py-2.5 px-3 text-center">Region</th>
                    <th className="py-2.5 px-3">Wrap Type</th>
                    <th className="py-2.5 px-3 text-center">Pallet Runners</th>
                    <th className="py-2.5 px-3">Dikirim ke User</th>
                    <th className="py-2.5 px-3">Kolom Peletakan</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3 text-right">Frekuensi Trx</th>
                    <th className="py-2.5 px-3 text-right font-bold text-amber-900 dark:text-amber-300">Total Keluar (Set/Pcs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRekapPengeluaran.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        Tidak ada data pengeluaran yang cocok dengan kriteria filter pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRekapPengeluaran.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{item.palletSize}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.marketType === 'Lokal'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {item.marketType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{item.palletType}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              (item.typePallet || 'LS') === 'LS'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            }`}
                            title={(item.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                          >
                            {item.typePallet || 'LS'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{item.customer}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {Array.from(item.columns).join(', ') || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono dark:text-slate-300">{item.shift}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">{item.txCount}x</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          -{item.quantity}
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

      {/* Official Print Preview & Print Modal */}
      <PrintReportModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        reportTitle={activePrintPayload.title}
        periodLabel={activePrintPayload.periodLabel}
        headers={activePrintPayload.headers}
        rows={activePrintPayload.rows}
        totalsSummary={activePrintPayload.totalsSummary}
        filenamePrefix={activePrintPayload.filenamePrefix}
        customHtml={activePrintPayload.customHtml}
        docNumber={(activePrintPayload as any).docNumber}
        operatorName={(activePrintPayload as any).operatorName}
        onDownloadExcel={activePrintPayload.onDownloadExcel}
        onDownloadPDF={handleExportPDF}
      />

      {/* Salin Laporan WhatsApp (Hasil Produksi & Pengeluaran Terpisah) */}
      <SalinLaporanWAModal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        initialMode={waModalMode}
      />
    </div>
  );
};

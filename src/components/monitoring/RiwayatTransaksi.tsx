import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  History,
  Search,
  Filter,
  Download,
  Printer,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Trash2,
  Eye,
  RotateCcw,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  ListFilter,
  MessageSquare,
  Edit2,
  Hash,
  Copy,
  Check
} from 'lucide-react';
import { exportToExcel, exportToCSV, generateDocNumber } from '../../utils/exportUtils';
import { exportToPDF, formatPalletDimension } from '../../utils/pdfExportUtils';
import { PrintReportModal } from '../common/PrintReportModal';
import { CetakLaporanShiftModal } from './CetakLaporanShiftModal';
import { SalinLaporanWAModal } from '../common/SalinLaporanWAModal';
import { TransactionRevisionModal } from '../common/TransactionRevisionModal';
import { NotaPengirimanModal } from '../operations/NotaPengirimanModal';
import { Transaction, ShiftType } from '../../types';
import {
  normalizePalletDimension,
  formatTypePallet,
  formatJenisPallet,
  formatMarketType
} from '../../utils/dimensionUtils';
import { formatDateIndo } from '../../utils/monthlyStockUtils';

export type RiwayatMode = 'ALL' | 'PENERIMAAN' | 'PENGELUARAN';

interface RiwayatTransaksiProps {
  initialFilter?: { size?: string; type?: string; txType?: RiwayatMode; noRun?: string };
  initialTab?: RiwayatMode;
  onSelectTransaction: (tx: Transaction) => void;
  onNavigateTab?: (tab: RiwayatMode) => void;
}

export const RiwayatTransaksi: React.FC<RiwayatTransaksiProps> = ({
  initialFilter,
  initialTab = 'ALL',
  onSelectTransaction,
  onNavigateTab
}) => {
  const {
    transactions,
    currentUser,
    deleteTransaction,
    isOperator,
    isAdmin,
    canEdit,
    activeShift,
    masterTypes,
    masterSizes,
    employees,
    showNotification
  } = useApp();

  const userCanModify = Boolean(isOperator || isAdmin || canEdit);

  // Active separation mode: ALL (gabungan) | PENERIMAAN (masuk saja) | PENGELUARAN (keluar saja)
  const [activeMode, setActiveMode] = useState<RiwayatMode>(() => {
    if (initialFilter?.txType) return initialFilter.txType;
    return initialTab;
  });

  // Keep activeMode in sync if initialTab prop changes from external navigation
  useEffect(() => {
    if (initialTab) {
      setActiveMode(initialTab);
    }
  }, [initialTab]);

  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);
  const [txToRevise, setTxToRevise] = useState<Transaction | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Nota Pengiriman Modal State
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [txForNota, setTxForNota] = useState<Transaction | null>(null);

  // Dedicated Shift Report Modal State
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftModalDate, setShiftModalDate] = useState<string | undefined>(undefined);
  const [shiftModalShift, setShiftModalShift] = useState<ShiftType | undefined>(undefined);

  // WhatsApp Report Modal State
  const [showWaModal, setShowWaModal] = useState(false);
  const [waModalMode, setWaModalMode] = useState<'PENERIMAAN' | 'PENGELUARAN'>('PENERIMAAN');
  const [waModalDate, setWaModalDate] = useState<string | undefined>(undefined);
  const [waModalShift, setWaModalShift] = useState<ShiftType | undefined>(undefined);

  // Filters
  const [search, setSearch] = useState('');
  const [filterNoRun, setFilterNoRun] = useState<string>(initialFilter?.noRun || '');
  const [copiedRunInfo, setCopiedRunInfo] = useState<boolean>(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPalletType, setFilterPalletType] = useState<string>('ALL');
  const [filterTypePallet, setFilterTypePallet] = useState<'ALL' | 'LS' | 'SS'>('ALL');
  const [filterSize, setFilterSize] = useState<string>(initialFilter?.size || '');
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterShift, setFilterShift] = useState<string>('ALL');
  const [filterMarket, setFilterMarket] = useState<string>('ALL');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterOperator, setFilterOperator] = useState<string>('ALL');

  // Keep filterNoRun in sync if initialFilter.noRun changes externally
  useEffect(() => {
    if (initialFilter?.noRun !== undefined) {
      setFilterNoRun(initialFilter.noRun);
    }
  }, [initialFilter?.noRun]);

  // Sub-view toggle: 'split' (Rekap Shift + Daftar), 'matrix' (Hanya Rekap Shift), 'table' (Hanya Tabel Transaksi)
  const [displayLayout, setDisplayLayout] = useState<'split' | 'matrix' | 'table'>('split');
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  const palletTypes = useMemo(() => {
    const list = (masterTypes || []).filter((m) => m.active).map((m) => m.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);



  // Matching transactions specifically queried by No.Run (for instant Officer Inquiry answer card)
  const matchingRunTransactions = useMemo(() => {
    const query = filterNoRun.trim().toLowerCase();
    if (!query) return [];
    return transactions.filter(
      (t) => t.noRun && t.noRun.toLowerCase().includes(query)
    );
  }, [transactions, filterNoRun]);

  // Copy structured answer for Officer inquiry directly to clipboard
  const handleCopyOfficerAnswer = () => {
    if (matchingRunTransactions.length === 0) return;
    const runQuery = filterNoRun.trim();
    const totalQty = matchingRunTransactions.reduce((acc, t) => acc + t.quantity, 0);
    const unitStr = Array.from(new Set(matchingRunTransactions.map((t) => t.unit))).join('/') || 'Set';

    const lines = [
      `📦 *INFORMASI PENGELUARAN PALLET - NO.RUN: ${runQuery.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...matchingRunTransactions.map((tx, idx) => {
        const itemHeader = matchingRunTransactions.length > 1 ? `*Item #${idx + 1}:*\n` : '';
        return (
          itemHeader +
          [
            `• *Ukuran Pallet* : *${tx.palletSize}* (Type ${tx.typePallet || 'LS'})`,
            `• *Jenis Pallet*  : ${tx.palletType} (${tx.marketType})`,
            `• *Jumlah Kirim*  : *${tx.quantity} ${tx.unit}*`,
            `• *User / Tujuan* : ${tx.customer}`,
            `• *Waktu Keluar*  : ${tx.date} ${tx.time} (${tx.shift})`,
            `• *Operator*      : ${tx.operator}`,
            tx.pelatakanPallet ? `• *Kolom Yard*    : ${tx.pelatakanPallet}` : '',
            `• *No. Transaksi* : ${tx.transactionNumber}`,
            tx.notes ? `• *Catatan*       : ${tx.notes}` : ''
          ]
            .filter(Boolean)
            .join('\n')
        );
      }),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Total Pengiriman : ${totalQty} ${unitStr}*`,
      `*Status : Selesai Dikeluarkan dari Finish Pallet*`
    ];

    const text = lines.join('\n');
    try {
      navigator.clipboard.writeText(text);
      setCopiedRunInfo(true);
      showNotification(
        'success',
        'Info No.Run Berhasil Disalin',
        `Informasi No.Run ${runQuery} siap dikirim ke WhatsApp / chat officer.`
      );
      setTimeout(() => setCopiedRunInfo(false), 3000);
    } catch {
      showNotification('error', 'Gagal Menyalin', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  // Mode change handler (keeps parent navigation aware)
  const handleModeChange = (mode: RiwayatMode) => {
    setActiveMode(mode);
    setHighlightDate(null);
    if (onNavigateTab) {
      onNavigateTab(mode);
    }
  };

  // Filtered transactions based on activeMode and 6 exact criteria:
  // 1. Ukuran, 2. Lokal/Ekspor, 3. Jenis Pallet, 4. Type Pallet, 5. Nomor Run, 6. Shift
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Primary Separation by Mode
      if (activeMode === 'PENERIMAAN' && t.transactionType !== 'PENERIMAAN') return false;
      if (activeMode === 'PENGELUARAN' && t.transactionType !== 'PENGELUARAN') return false;

      // Highlighted specific date from matrix click
      if (highlightDate && t.date !== highlightDate) return false;

      // 1. Ukuran Pallet
      const matchSize =
        !filterSize.trim() ||
        normalizePalletDimension(t.palletSize).includes(normalizePalletDimension(filterSize)) ||
        t.palletSize.toLowerCase().includes(filterSize.toLowerCase().trim());

      // 2. Lokal / Ekspor
      const matchMarket = filterMarket === 'ALL' || t.marketType === filterMarket;

      // 3. Jenis Pallet
      const matchPalletType =
        filterPalletType === 'ALL' ||
        t.palletType === filterPalletType ||
        (filterPalletType === 'Pallet Reamwrap' && t.palletType.toLowerCase().includes('reamwrap')) ||
        (filterPalletType === 'Pallet Bulkpack' && t.palletType.toLowerCase().includes('bulkpack')) ||
        (filterPalletType === 'Pallet Racuk' && t.palletType.toLowerCase().includes('racuk')) ||
        (filterPalletType === 'Pallet Sirkulasi' && t.palletType.toLowerCase().includes('sirkulasi'));

      // 4. Type Pallet (LS / SS)
      const matchTypePallet =
        filterTypePallet === 'ALL' || formatTypePallet(t.typePallet) === filterTypePallet;

      // 5. Nomor Run
      const matchNoRun =
        !filterNoRun.trim() ||
        (Boolean(t.noRun) && t.noRun!.toLowerCase().includes(filterNoRun.toLowerCase().trim()));

      // 6. Shift
      const matchShift = filterShift === 'ALL' || t.shift === filterShift;

      // 7. Satuan (SET / PCS)
      const matchUnit = filterUnit === 'ALL' || t.unit?.toUpperCase() === filterUnit.toUpperCase();

      // 8. Rentang Waktu (Tanggal Mulai s/d Tanggal Selesai)
      const matchDateRange =
        (!startDate || t.date >= startDate) &&
        (!endDate || t.date <= endDate);

      return (
        matchSize &&
        matchMarket &&
        matchPalletType &&
        matchTypePallet &&
        matchNoRun &&
        matchShift &&
        matchUnit &&
        matchDateRange
      );
    });
  }, [
    transactions,
    activeMode,
    highlightDate,
    startDate,
    endDate,
    filterSize,
    filterMarket,
    filterPalletType,
    filterTypePallet,
    filterNoRun,
    filterShift,
    filterUnit
  ]);

  // Daily & Shift Breakdown Matrix (Rekap Mutasi Per Tanggal & Shift)
  const shiftMatrix = useMemo(() => {
    const baseList = transactions.filter((t) => {
      if (activeMode === 'PENERIMAAN' && t.transactionType !== 'PENERIMAAN') return false;
      if (activeMode === 'PENGELUARAN' && t.transactionType !== 'PENGELUARAN') return false;

      const matchSize =
        !filterSize.trim() ||
        normalizePalletDimension(t.palletSize).includes(normalizePalletDimension(filterSize)) ||
        t.palletSize.toLowerCase().includes(filterSize.toLowerCase().trim());

      const matchMarket = filterMarket === 'ALL' || t.marketType === filterMarket;

      const matchPalletType =
        filterPalletType === 'ALL' ||
        t.palletType === filterPalletType ||
        (filterPalletType === 'Pallet Reamwrap' && t.palletType.toLowerCase().includes('reamwrap')) ||
        (filterPalletType === 'Pallet Bulkpack' && t.palletType.toLowerCase().includes('bulkpack')) ||
        (filterPalletType === 'Pallet Racuk' && t.palletType.toLowerCase().includes('racuk')) ||
        (filterPalletType === 'Pallet Sirkulasi' && t.palletType.toLowerCase().includes('sirkulasi'));

      const matchTypePallet =
        filterTypePallet === 'ALL' || formatTypePallet(t.typePallet) === filterTypePallet;

      const matchNoRun =
        !filterNoRun.trim() ||
        (Boolean(t.noRun) && t.noRun!.toLowerCase().includes(filterNoRun.toLowerCase().trim()));

      const matchShift = filterShift === 'ALL' || t.shift === filterShift;

      const matchUnit = filterUnit === 'ALL' || t.unit?.toUpperCase() === filterUnit.toUpperCase();

      const matchDateRange =
        (!startDate || t.date >= startDate) &&
        (!endDate || t.date <= endDate);

      return (
        matchSize &&
        matchMarket &&
        matchPalletType &&
        matchTypePallet &&
        matchNoRun &&
        matchShift &&
        matchUnit &&
        matchDateRange
      );
    });

    const groups: {
      [date: string]: {
        date: string;
        shift1In: number;
        shift1Out: number;
        shift1Qty: number;
        shift2In: number;
        shift2Out: number;
        shift2Qty: number;
        shift3In: number;
        shift3Out: number;
        shift3Qty: number;
        totalIn: number;
        totalOut: number;
        totalQty: number;
        units: Set<string>;
        customers: Set<string>;
        sizes: Set<string>;
        txCount: number;
      };
    } = {};

    baseList.forEach((t) => {
      if (!groups[t.date]) {
        groups[t.date] = {
          date: t.date,
          shift1In: 0,
          shift1Out: 0,
          shift1Qty: 0,
          shift2In: 0,
          shift2Out: 0,
          shift2Qty: 0,
          shift3In: 0,
          shift3Out: 0,
          shift3Qty: 0,
          totalIn: 0,
          totalOut: 0,
          totalQty: 0,
          units: new Set<string>(),
          customers: new Set<string>(),
          sizes: new Set<string>(),
          txCount: 0
        };
      }
      const g = groups[t.date];
      g.txCount += 1;
      g.totalQty += t.quantity;

      const isIn = t.transactionType === 'PENERIMAAN';
      if (isIn) {
        g.totalIn += t.quantity;
      } else {
        g.totalOut += t.quantity;
      }

      if (t.unit) g.units.add(t.unit);
      if (t.customer) g.customers.add(t.customer);
      if (t.palletSize) g.sizes.add(t.palletSize);

      if (t.shift === 'Shift 1') {
        if (isIn) g.shift1In += t.quantity;
        else g.shift1Out += t.quantity;
        g.shift1Qty += t.quantity;
      } else if (t.shift === 'Shift 2') {
        if (isIn) g.shift2In += t.quantity;
        else g.shift2Out += t.quantity;
        g.shift2Qty += t.quantity;
      } else if (t.shift === 'Shift 3') {
        if (isIn) g.shift3In += t.quantity;
        else g.shift3Out += t.quantity;
        g.shift3Qty += t.quantity;
      }
    });

    // Sort descending by date (terbaru lebih dahulu)
    return Object.values(groups)
      .map((g) => ({
        ...g,
        unitsList: Array.from(g.units).join('/'),
        customersList: Array.from(g.customers).slice(0, 3).join(', '),
        sizesList: Array.from(g.sizes).slice(0, 2).join(', ')
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    transactions,
    activeMode,
    search,
    filterNoRun,
    startDate,
    endDate,
    filterPalletType,
    filterTypePallet,
    filterSize,
    filterCustomer,
    filterShift,
    filterMarket,
    filterUnit,
    filterOperator
  ]);

  // Overall totals in the active selection
  const summary = useMemo(() => {
    let inSet = 0;
    let inPcs = 0;
    let outSet = 0;
    let outPcs = 0;
    let totalQty = 0;

    filteredTransactions.forEach((t) => {
      totalQty += t.quantity;
      if (t.transactionType === 'PENERIMAAN') {
        if (t.unit === 'Set') inSet += t.quantity;
        else inPcs += t.quantity;
      } else {
        if (t.unit === 'Set') outSet += t.quantity;
        else outPcs += t.quantity;
      }
    });

    return { inSet, inPcs, outSet, outPcs, totalQty };
  }, [filteredTransactions]);

  const handleResetFilters = () => {
    setSearch('');
    setFilterNoRun('');
    setStartDate('');
    setEndDate('');
    setFilterPalletType('ALL');
    setFilterTypePallet('ALL');
    setFilterSize('');
    setFilterCustomer('');
    setFilterShift('ALL');
    setFilterMarket('ALL');
    setFilterUnit('ALL');
    setFilterOperator('ALL');
    setHighlightDate(null);
  };

  // Report metadata depending on active mode
  const reportTitle = useMemo(() => {
    if (activeMode === 'PENGELUARAN') return 'BUKU RIWAYAT PENGELUARAN PALLET FINISH';
    if (activeMode === 'PENERIMAAN') return 'BUKU RIWAYAT PENERIMAAN PALLET FINISH';
    return 'BUKU BESAR RIWAYAT MUTASI TRANSAKSI PALLET';
  }, [activeMode]);

  const reportPayload = useMemo(() => {
    const headers = [
      'No',
      'No. Transaksi',
      'Tanggal',
      'Jam',
      'Jenis Mutasi',
      'Ukuran Pallet',
      'Lokal / Ekspor',
      'Jenis Pallet',
      'Type Pallet',
      'User / Customer',
      'No.Run',
      'Pelatakan',
      'Shift',
      'Quantity',
      'Satuan',
      'Operator',
      'Catatan'
    ];
    const rows = filteredTransactions.map((t, idx) => [
      idx + 1,
      t.transactionNumber,
      t.date,
      t.time,
      t.transactionType,
      formatPalletDimension(t.palletSize),
      t.marketType,
      t.palletType,
      t.typePallet || 'LS',
      t.customer,
      t.noRun || '-',
      t.pelatakanPallet || '-',
      t.shift,
      t.quantity,
      t.unit,
      t.operator,
      t.notes || ''
    ]);
    const totalQty = filteredTransactions.reduce((acc, t) => acc + t.quantity, 0);
    return {
      headers,
      rows,
      totals: {
        label: `TOTAL ${activeMode === 'PENGELUARAN' ? 'PENGELUARAN' : activeMode === 'PENERIMAAN' ? 'PENERIMAAN' : 'TRANSAKSI'}`,
        values: { 13: totalQty }
      },
      totalsSummary: `Total Mutasi: ${totalQty} Unit (${filteredTransactions.length} Transaksi Terpilih)`
    };
  }, [filteredTransactions, activeMode]);

  const handleExportExcel = async () => {
    try {
      const modePrefix =
        activeMode === 'PENGELUARAN' ? 'Pengeluaran' : activeMode === 'PENERIMAAN' ? 'Penerimaan' : 'Buku_Besar';
      await exportToExcel({
        filename: `Riwayat_${modePrefix}_Pallet_${new Date().toISOString().split('T')[0]}`,
        reportTitle,
        periodLabel: `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} ${filterSize ? `(Ukuran: ${filterSize})` : ''} ${filterNoRun ? `(No.Run: ${filterNoRun})` : ''}`,
        operatorName: currentUser?.name || 'Indika (Operator)',
        headers: reportPayload.headers,
        rows: reportPayload.rows,
        totals: reportPayload.totals,
        signatures: true
      });
      showNotification('success', 'Excel Berhasil Diexport', 'Laporan mutasi berhasil diunduh.');
    } catch (_) {
      showNotification('error', 'Gagal Export', 'Terjadi kesalahan saat memproses file Excel.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const modePrefix =
        activeMode === 'PENGELUARAN' ? 'Pengeluaran' : activeMode === 'PENERIMAAN' ? 'Penerimaan' : 'Buku_Besar';
      await exportToPDF({
        filename: `Riwayat_${modePrefix}_Pallet_${new Date().toISOString().split('T')[0]}`,
        reportTitle,
        periodLabel: `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} ${filterSize ? `(Ukuran: ${filterSize})` : ''} ${filterNoRun ? `(No.Run: ${filterNoRun})` : ''}`,
        operatorName: currentUser?.name || 'Indika (Operator)',
        docNumber: generateDocNumber(filterShift !== 'ALL' ? filterShift : 'Shift 1', startDate || new Date().toISOString().split('T')[0]),
        headers: reportPayload.headers,
        rows: reportPayload.rows,
        totalsSummary: reportPayload.totalsSummary,
        signatures: true
      });
      showNotification('success', 'PDF Berhasil Diexport', 'Laporan mutasi format PDF resmi (.pdf) berhasil diunduh.');
    } catch (_) {
      showNotification('error', 'Gagal Export PDF', 'Terjadi kesalahan saat memproses file PDF.');
    }
  };

  const handleDelete = (tx: Transaction) => {
    if (!userCanModify) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat membatalkan transaksi.');
      return;
    }
    setTxToDelete(tx);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete || isDeletingTx) return;
    setIsDeletingTx(true);
    try {
      await deleteTransaction(txToDelete.id, 'Dibatalkan oleh operator');
      setTxToDelete(null);
    } catch (err: any) {
      console.error('Error in handleConfirmDelete:', err);
      showNotification('error', 'Gagal Membatalkan', err?.message || 'Terjadi kesalahan saat membatalkan transaksi.');
      setTxToDelete(null);
    } finally {
      setIsDeletingTx(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 3-WAY SEGMENTED TAB SWITCHER (Opsi Riwayat Pengeluaran vs Penerimaan Dipisah) */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-1.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 no-print">
        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 flex-1">
          {/* Tab 1: Khusus Pengeluaran */}
          <button
            onClick={() => handleModeChange('PENGELUARAN')}
            className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'PENGELUARAN'
                ? 'bg-[#D97706] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#D97706] hover:bg-amber-50/80 dark:hover:bg-[#163653]'
            }`}
          >
            <ArrowUpFromLine
              className={`w-4 h-4 shrink-0 ${
                activeMode === 'PENGELUARAN' ? 'text-white' : 'text-[#D97706]'
              }`}
            />
            <span className="truncate">Riwayat Pengeluaran</span>
            <span
              className={`hidden md:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeMode === 'PENGELUARAN' ? 'bg-[#B45309] text-white' : 'bg-[#F1F5F9] dark:bg-[#163653] text-[#64748B] dark:text-slate-300'
              }`}
            >
              Keluar
            </span>
          </button>

          {/* Tab 2: Khusus Penerimaan */}
          <button
            onClick={() => handleModeChange('PENERIMAAN')}
            className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'PENERIMAAN'
                ? 'bg-[#16805D] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#16805D] hover:bg-emerald-50/80 dark:hover:bg-[#163653]'
            }`}
          >
            <ArrowDownToLine
              className={`w-4 h-4 shrink-0 ${
                activeMode === 'PENERIMAAN' ? 'text-white' : 'text-[#16805D]'
              }`}
            />
            <span className="truncate">Riwayat Penerimaan</span>
            <span
              className={`hidden md:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeMode === 'PENERIMAAN' ? 'bg-[#136B4E] text-white' : 'bg-[#F1F5F9] dark:bg-[#163653] text-[#64748B] dark:text-slate-300'
              }`}
            >
              Masuk
            </span>
          </button>

          {/* Tab 3: Semua Mutasi (Buku Besar) */}
          <button
            onClick={() => handleModeChange('ALL')}
            className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeMode === 'ALL'
                ? 'bg-[#3886B8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
            }`}
          >
            <History
              className={`w-4 h-4 shrink-0 ${activeMode === 'ALL' ? 'text-white' : 'text-[#3886B8]'}`}
            />
            <span className="truncate">Semua Riwayat</span>
            <span
              className={`hidden md:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeMode === 'ALL' ? 'bg-[#2D739E] text-white' : 'bg-[#F1F5F9] dark:bg-[#163653] text-[#64748B] dark:text-slate-300'
              }`}
            >
              Buku Besar
            </span>
          </button>
        </div>

        {/* Sub-view Layout Buttons (Split vs Rekap Only vs Table Only) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600 border border-slate-200">
          <button
            onClick={() => setDisplayLayout('split')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              displayLayout === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Rekap + Detail
          </button>
          <button
            onClick={() => setDisplayLayout('matrix')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              displayLayout === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Hanya Rekap Shift
          </button>
          <button
            onClick={() => setDisplayLayout('table')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              displayLayout === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Hanya Tabel Detail
          </button>
        </div>
      </div>

      {/* Dynamic Themed Page Header */}
      <div
        className={`border rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-colors duration-200 ${
          activeMode === 'PENGELUARAN'
            ? 'bg-slate-900 border-amber-900/40 ring-1 ring-amber-500/20'
            : activeMode === 'PENERIMAAN'
            ? 'bg-slate-900 border-emerald-950/60 ring-1 ring-emerald-500/20'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg text-white shadow-sm ${
                activeMode === 'PENGELUARAN'
                  ? 'bg-gradient-to-br from-amber-600 to-amber-700'
                  : activeMode === 'PENERIMAAN'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-800'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            >
              {activeMode === 'PENGELUARAN' ? (
                <ArrowUpFromLine className="w-5 h-5 text-white" />
              ) : activeMode === 'PENERIMAAN' ? (
                <ArrowDownToLine className="w-5 h-5 text-white" />
              ) : (
                <History className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white uppercase font-sans">
                  {reportTitle}
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    activeMode === 'PENGELUARAN'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                      : activeMode === 'PENERIMAAN'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {activeMode === 'PENGELUARAN'
                    ? 'TERPISAH: PENGELUARAN'
                    : activeMode === 'PENERIMAAN'
                    ? 'TERPISAH: PENERIMAAN'
                    : 'GABUNGAN: BUKU BESAR'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {activeMode === 'PENGELUARAN'
                  ? 'Daftar pengeluaran pallet finish ke user, produksi, dan pasar dengan rincian per tanggal dan shift.'
                  : activeMode === 'PENERIMAAN'
                  ? 'Daftar penerimaan pallet finish dari workshop dan produksi dengan rincian per tanggal dan shift.'
                  : 'Buku besar gabungan seluruh mutasi masuk dan keluar pallet finish di lingkungan pabrik.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print self-end sm:self-auto">
          {/* Opsi Khusus: Salin Format WhatsApp */}
          <button
            onClick={() => {
              setWaModalMode(activeMode === 'PENGELUARAN' ? 'PENGELUARAN' : 'PENERIMAAN');
              setWaModalDate(startDate || new Date().toISOString().split('T')[0]);
              setWaModalShift(
                (filterShift !== 'ALL' ? filterShift : activeShift || 'Shift 2') as ShiftType
              );
              setShowWaModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Salin Format Laporan WhatsApp Resmi (Hasil Produksi / Pengeluaran Terpisah)"
          >
            <MessageSquare className="w-3.5 h-3.5 text-white" />
            <span>Salin Teks WA</span>
          </button>

          {/* Opsi Khusus: Laporan Per Shift (A4/PDF & Excel) */}
          <button
            onClick={() => {
              setShiftModalDate(startDate || new Date().toISOString().split('T')[0]);
              setShiftModalShift(
                (filterShift !== 'ALL' ? filterShift : activeShift || 'Shift 2') as ShiftType
              );
              setShowShiftModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Cetak & Unduh Laporan Penerimaan & Pengeluaran Per Shift (A4 / Excel)"
          >
            <Clock className="w-3.5 h-3.5 text-blue-100" />
            <span>Laporan Per Shift (A4/Excel)</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print Semua</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Unduh laporan riwayat langsung sebagai file PDF resmi (.pdf)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer ${
              activeMode === 'PENGELUARAN'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* FILTER TRANSAKSI CARD (Rentang Waktu, Ukuran, Lokal/Ekspor, Jenis Pallet, Type Pallet, Nomor Run, Shift, Satuan) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 no-print shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide flex-wrap">
            <Filter className="w-3.5 h-3.5 text-emerald-700" />
            <span>Filter Transaksi</span>
            {(startDate || endDate) && (
              <span className="text-[11px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-700" />
                <span>
                  {startDate ? formatDateIndo(startDate) : 'Awal'} s/d {endDate ? formatDateIndo(endDate) : 'Akhir'}
                </span>
              </span>
            )}
            {filterSize && (
              <span className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                Ukuran: {filterSize}
              </span>
            )}
            {filterNoRun && (
              <span className="text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                No.Run: {filterNoRun}
              </span>
            )}
          </div>
          {(filterSize || filterMarket !== 'ALL' || filterPalletType !== 'ALL' || filterTypePallet !== 'ALL' || filterNoRun || filterShift !== 'ALL' || filterUnit !== 'ALL' || startDate || endDate) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Semua Filter
            </button>
          )}
        </div>

        {/* Baris 1: Rentang Waktu, Ukuran, Nomor Run, Shift */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

          {/* 1. Ukuran Pallet */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ukuran Pallet
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ketik ukuran pallet (cth: 81x111)..."
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="w-full pl-9 pr-7 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-600 text-slate-900 bg-white"
              />
              {filterSize && (
                <button
                  type="button"
                  onClick={() => setFilterSize('')}
                  className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus filter ukuran"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Nomor Run */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nomor Run
            </label>
            <div className="relative">
              <Hash className="w-3.5 h-3.5 text-amber-600 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter No.Run (cth: 4509)..."
                value={filterNoRun}
                onChange={(e) => setFilterNoRun(e.target.value)}
                className="w-full pl-8 pr-7 py-2 border border-amber-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-amber-600 text-slate-900 bg-amber-50/20 placeholder:font-sans placeholder:font-normal"
              />
              {filterNoRun && (
                <button
                  type="button"
                  onClick={() => setFilterNoRun('')}
                  className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus filter No.Run"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* 2. Region (Tinggal Klik) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              2. Region
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

          {/* 3. Wrap Type (Tinggal Klik: RW, BP, RCK, SRKLS) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>3. Wrap Type</span>
              <span className="text-[10px] text-slate-500 normal-case font-normal">Tinggal Klik</span>
            </label>
            <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterPalletType('ALL')}
                className={`py-1.5 px-1 text-xs font-bold rounded transition-all cursor-pointer text-center truncate ${
                  filterPalletType === 'ALL'
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
                  onClick={() => setFilterPalletType(filterPalletType === j.name ? 'ALL' : j.name)}
                  className={`py-1.5 px-0.5 text-[11px] font-bold rounded transition-all cursor-pointer text-center truncate ${
                    filterPalletType === j.name
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

          {/* 4. Pallet Runners (Tinggal Klik: Semua, LS, SS) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              4. Pallet Runners
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

          {/* 7. Satuan (SET / PCS - Tinggal Klik) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>7. Satuan</span>
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

      {/* OFFICER NO.RUN INQUIRY CARD (Hasil Pengecekan Khusus No.Run yang Ditanyakan Officer) */}
      {filterNoRun.trim() && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/50 dark:from-slate-900 dark:via-amber-950/30 dark:to-slate-900 border-2 border-amber-400 dark:border-amber-600/70 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-600 text-white shadow-xs">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Hasil Inquiry No.Run Pallet:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                    #{filterNoRun.trim()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {matchingRunTransactions.length > 0
                    ? `Ditemukan ${matchingRunTransactions.length} transaksi pengiriman dengan No.Run ini.`
                    : `Tidak ditemukan pengeluaran pallet dengan No.Run "${filterNoRun.trim()}".`}
                </p>
              </div>
            </div>

            {matchingRunTransactions.length > 0 && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleCopyOfficerAnswer}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Salin hasil pencarian No.Run"
                >
                  {copiedRunInfo ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedRunInfo ? 'Tersalin!' : 'Salin Hasil Pencarian'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterNoRun('')}
                  className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>

          {matchingRunTransactions.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Card 1: UKURAN PALLET & TYPE (The exact answer requested by officer!) */}
                <div className="bg-white dark:bg-slate-800 border-2 border-emerald-500/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      📏 Ukuran Pallet (Yang Ditanyakan)
                    </span>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300 font-sans tracking-tight">
                        {Array.from(new Set(matchingRunTransactions.map((t) => t.palletSize))).join(', ')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300">
                        {Array.from(new Set(matchingRunTransactions.map((t) => t.typePallet || 'LS'))).join('/')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                    Jenis: {Array.from(new Set(matchingRunTransactions.map((t) => t.palletType))).join(', ')}
                  </div>
                </div>

                {/* Card 2: JUMLAH & SATUAN */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      🔢 Jumlah Pengiriman
                    </span>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                        {matchingRunTransactions.reduce((s, t) => s + t.quantity, 0)}{' '}
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {Array.from(new Set(matchingRunTransactions.map((t) => t.unit))).join('/')}
                        </span>
                      </span>
                      {matchingRunTransactions.length > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300">
                          {matchingRunTransactions.length}x Pengiriman Bertahap
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    Pasar: {Array.from(new Set(matchingRunTransactions.map((t) => t.marketType))).join(', ')}
                  </div>
                </div>

                {/* Card 3: USER / TUJUAN & KOLOM */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      🏢 User / Tujuan & Kolom
                    </span>
                    <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {Array.from(new Set(matchingRunTransactions.map((t) => t.customer))).join(', ')}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1 truncate">
                    <span>Kolom:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {Array.from(new Set(matchingRunTransactions.map((t) => t.pelatakanPallet).filter(Boolean))).join(', ') || '-'}
                    </span>
                  </div>
                </div>

                {/* Card 4: WAKTU, SHIFT & OPERATOR */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      🕒 Waktu, Shift & Operator
                    </span>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      {Array.from(new Set(matchingRunTransactions.map((t) => t.date))).length > 1
                        ? `${Array.from(new Set(matchingRunTransactions.map((t) => t.date))).length} Hari Pengiriman`
                        : `${matchingRunTransactions[0]?.date} • ${matchingRunTransactions[0]?.time}`}
                    </div>
                    <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">
                      {Array.from(new Set(matchingRunTransactions.map((t) => t.shift))).join(', ')}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    Operator: <span className="font-semibold">{Array.from(new Set(matchingRunTransactions.map((t) => t.operator))).join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* RINCIAN PENGIRIMAN BERTAHAP JIKA LEBIH DARI 1 TAHAP / SHIFT */}
              {matchingRunTransactions.length > 1 && (
                <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-3 border border-amber-200 dark:border-amber-800/60 shadow-xs">
                  <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Rincian Pengiriman Bertahap ({matchingRunTransactions.length} Tahap):</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      Total: <strong className="text-emerald-700 dark:text-emerald-400">{matchingRunTransactions.reduce((s, t) => s + t.quantity, 0)} {Array.from(new Set(matchingRunTransactions.map((t) => t.unit))).join('/')}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {matchingRunTransactions.map((tx, idx) => (
                      <div
                        key={tx.id || idx}
                        className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                              #{idx + 1}
                            </span>
                            <span>{tx.date}</span>
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">({tx.shift})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 ml-6">
                            Op: {tx.operator} • {tx.time}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                            {tx.quantity} {tx.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-amber-300 dark:border-amber-800 text-center">
              <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                Tidak ada data transaksi dengan No.Run <strong>"{filterNoRun.trim()}"</strong>.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Tips: Pastikan penulisan nomor run sudah benar, atau periksa filter tanggal/shift di atas jika sebelumnya dibatasi.
              </p>
              <button
                type="button"
                onClick={() => setFilterNoRun('')}
                className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Reset Pencarian No.Run
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-800">
            {activeMode === 'PENGELUARAN'
              ? 'Akumulasi Pengeluaran:'
              : activeMode === 'PENERIMAAN'
              ? 'Akumulasi Penerimaan:'
              : 'Akumulasi Filter:'}
          </span>
          {activeMode !== 'PENGELUARAN' && (
            <span className="text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              Masuk: +{summary.inSet} Set | +{summary.inPcs} Pcs
            </span>
          )}
          {activeMode !== 'PENERIMAAN' && (
            <span className="text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
              Keluar: -{summary.outSet} Set | -{summary.outPcs} Pcs
            </span>
          )}
          {filterSize && (
            <span className="text-slate-600 font-medium">
              Ukuran: <b className="text-slate-900">{filterSize}</b>
            </span>
          )}
          {filterNoRun && (
            <span className="text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1 font-mono">
              <Hash className="w-3 h-3 text-amber-600" />
              No.Run: <b className="text-amber-950 font-bold">{filterNoRun}</b>
            </span>
          )}
        </div>
        <div className="text-slate-500 text-xs font-medium">
          Total: <b className="text-slate-900 font-bold">{filteredTransactions.length}</b> transaksi
          {highlightDate && (
            <button
              onClick={() => setHighlightDate(null)}
              className="ml-2 text-rose-600 underline font-sans text-xs cursor-pointer"
            >
              (Tampilkan Semua Tanggal)
            </button>
          )}
        </div>
      </div>

      {/* THE KILLER FEATURE: REKAP MUTASI PER TANGGAL & SHIFT (MATRIKS HARIAN & SHIFT) */}
      {(displayLayout === 'split' || displayLayout === 'matrix') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-md text-white ${
                    activeMode === 'PENGELUARAN'
                      ? 'bg-amber-600'
                      : activeMode === 'PENERIMAAN'
                      ? 'bg-emerald-700'
                      : 'bg-slate-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide font-sans">
                  REKAP {activeMode === 'PENGELUARAN' ? 'PENGELUARAN' : activeMode === 'PENERIMAAN' ? 'PENERIMAAN' : 'MUTASI'} PER TANGGAL & SHIFT
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rincian kuantitas per hari di <b>Shift 1, Shift 2, dan Shift 3</b>{' '}
                {filterSize ? (
                  <span>
                    untuk ukuran <b className="text-slate-900 font-mono">{filterSize}</b>
                  </span>
                ) : (
                  <span>(semua ukuran pallet terpilih)</span>
                )}
                . Klik baris tanggal untuk melihat detail transaksinya.
              </p>
            </div>

            {shiftMatrix.length > 0 && (
              <div className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
                Tercatat di <b className="text-slate-900">{shiftMatrix.length}</b> hari berbeda
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3 text-center bg-blue-50/50 text-blue-900">
                    Shift 1 (07-15)
                  </th>
                  <th className="py-2.5 px-3 text-center bg-indigo-50/50 text-indigo-900">
                    Shift 2 (15-23)
                  </th>
                  <th className="py-2.5 px-3 text-center bg-amber-50/50 text-amber-900">
                    Shift 3 (23-07)
                  </th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50">
                    Total Harian
                  </th>
                  <th className="py-2.5 px-3">User / Customer Terkait</th>
                  <th className="py-2.5 px-3 text-center">Jml Transaksi</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shiftMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada rekapan data untuk filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  shiftMatrix.map((row) => {
                    const isSelected = highlightDate === row.date;
                    return (
                      <tr
                        key={row.date}
                        onClick={() => setHighlightDate(isSelected ? null : row.date)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/80 font-semibold'
                            : 'hover:bg-slate-50/90'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{row.date}</span>
                          </div>
                        </td>
                        <td
                          onClick={(e) => {
                            if (row.shift1Qty > 0) {
                              e.stopPropagation();
                              setShiftModalDate(row.date);
                              setShiftModalShift('Shift 1');
                              setShowShiftModal(true);
                            }
                          }}
                          className={`py-2 px-3 text-center whitespace-nowrap bg-blue-50/20 ${
                            row.shift1Qty > 0 ? 'hover:bg-blue-100/60 cursor-pointer' : ''
                          }`}
                          title={row.shift1Qty > 0 ? `Klik untuk Cetak / Unduh Laporan Shift 1 (${row.date})` : undefined}
                        >
                          {row.shift1Qty > 0 ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              {row.shift1In > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] transition-colors">
                                  <span>In: +{row.shift1In.toLocaleString()}</span>
                                  <Printer className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                              {row.shift1Out > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] transition-colors">
                                  <span>Out: -{row.shift1Out.toLocaleString()}</span>
                                  <Printer className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td
                          onClick={(e) => {
                            if (row.shift2Qty > 0) {
                              e.stopPropagation();
                              setShiftModalDate(row.date);
                              setShiftModalShift('Shift 2');
                              setShowShiftModal(true);
                            }
                          }}
                          className={`py-2 px-3 text-center whitespace-nowrap bg-indigo-50/20 ${
                            row.shift2Qty > 0 ? 'hover:bg-indigo-100/60 cursor-pointer' : ''
                          }`}
                          title={row.shift2Qty > 0 ? `Klik untuk Cetak / Unduh Laporan Shift 2 (${row.date})` : undefined}
                        >
                          {row.shift2Qty > 0 ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              {row.shift2In > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] transition-colors">
                                  <span>In: +{row.shift2In.toLocaleString()}</span>
                                  <Printer className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                              {row.shift2Out > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] transition-colors">
                                  <span>Out: -{row.shift2Out.toLocaleString()}</span>
                                  <Printer className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td
                          onClick={(e) => {
                            if (row.shift3Qty > 0) {
                              e.stopPropagation();
                              setShiftModalDate(row.date);
                              setShiftModalShift('Shift 3');
                              setShowShiftModal(true);
                            }
                          }}
                          className={`py-2 px-3 text-center whitespace-nowrap bg-amber-50/20 ${
                            row.shift3Qty > 0 ? 'hover:bg-amber-100/60 cursor-pointer' : ''
                          }`}
                          title={row.shift3Qty > 0 ? `Klik untuk Cetak / Unduh Laporan Shift 3 (${row.date})` : undefined}
                        >
                          {row.shift3Qty > 0 ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              {row.shift3In > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] transition-colors">
                                  <span>In: +{row.shift3In.toLocaleString()}</span>
                                  <Printer className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                              {row.shift3Out > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] transition-colors">
                                  <span>Out: -{row.shift3Out.toLocaleString()}</span>
                                  <Printer className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50/60 whitespace-nowrap tabular-nums">
                          <div className="flex flex-col items-end gap-0.5">
                            {row.totalIn > 0 && (
                              <span className="text-emerald-800 font-extrabold text-xs">
                                Masuk: +{row.totalIn.toLocaleString()} {row.unitsList || 'Set'}
                              </span>
                            )}
                            {row.totalOut > 0 && (
                              <span className="text-amber-700 font-extrabold text-xs">
                                Keluar: -{row.totalOut.toLocaleString()} {row.unitsList || 'Set'}
                              </span>
                            )}
                            {row.totalIn === 0 && row.totalOut === 0 && (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-[200px] truncate">
                          {row.customersList || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            {row.txCount} tx
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWaModalMode(activeMode === 'PENGELUARAN' ? 'PENGELUARAN' : 'PENERIMAAN');
                                setWaModalDate(row.date);
                                setWaModalShift(
                                  (filterShift !== 'ALL' ? filterShift : activeShift || 'Shift 2') as ShiftType
                                );
                                setShowWaModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title={`Salin format laporan WhatsApp untuk tanggal ${row.date} (${activeMode === 'PENGELUARAN' ? 'Pengeluaran' : 'Hasil Produksi/Penerimaan'})`}
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              <span>Salin WA</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShiftModalDate(row.date);
                                setShiftModalShift('Shift 2');
                                setShowShiftModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title={`Buka cetak laporan shift untuk tanggal ${row.date}`}
                            >
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>Laporan Shift</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setHighlightDate(isSelected ? null : row.date)}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-1 py-1 cursor-pointer"
                            >
                              <span>{isSelected ? 'Tutup' : 'Detail'}</span>
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
      )}

      {/* TRANSACTIONS DETAIL TABLE */}
      {(displayLayout === 'split' || displayLayout === 'table') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-slate-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                DAFTAR DETAIL TRANSAKSI {activeMode === 'PENGELUARAN' ? 'PENGELUARAN' : activeMode === 'PENERIMAAN' ? 'PENERIMAAN' : ''}
              </h2>
              {highlightDate && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                  Hanya Tanggal: {highlightDate}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {filteredTransactions.length} baris
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Waktu</th>
                  <th className="py-3 px-3">Jenis</th>
                  <th className="py-3 px-3">Ukuran</th>
                  <th className="py-3 px-3">Region</th>
                  <th className="py-3 px-3">Wrap Type</th>
                  <th className="py-3 px-3 text-center">Pallet Runners</th>
                  <th className="py-3 px-3">User Tujuan</th>
                  <th className="py-3 px-3">No.Run</th>
                  <th className="py-3 px-3">Peletakkan</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-center">Satuan</th>
                  <th className="py-3 px-3">Operator</th>
                  <th className="py-3 px-3 text-center no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      Tidak ditemukan data transaksi yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Waktu: Tanggal Bulan Tahun lalu di bawahnya Shift berapanya */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs">
                            {formatDateIndo(tx.date)}
                          </span>
                          {tx.isRevised && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
                              title={`Telah direvisi oleh ${tx.revisedBy || tx.lastModifiedBy}: ${tx.revisionReason || ''}`}
                            >
                              REVISI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              tx.shift === 'Shift 1'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : tx.shift === 'Shift 2'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {tx.shift}
                          </span>
                          {tx.time && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {tx.time}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Jenis: Keluar / Masuk / Relokasi */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {tx.transactionType === 'PENERIMAAN' ? (
                          <span className="text-emerald-800 font-bold flex items-center gap-1 text-xs">
                            <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                            Masuk
                          </span>
                        ) : tx.transactionType === 'PINDAH_KOLOM' ? (
                          <span className="text-blue-800 font-bold flex items-center gap-1 text-xs">
                            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                            Relokasi
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold flex items-center gap-1 text-xs">
                            <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-600" />
                            Keluar
                          </span>
                        )}
                      </td>

                      {/* 3. Ukuran */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <span
                          className={
                            filterNoRun && tx.noRun && tx.noRun.toLowerCase().includes(filterNoRun.toLowerCase().trim())
                              ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-black ring-1 ring-emerald-400'
                              : ''
                          }
                        >
                          {tx.palletSize}
                          {filterNoRun && tx.noRun && tx.noRun.toLowerCase().includes(filterNoRun.toLowerCase().trim()) && (
                            <span className="text-[10px] text-emerald-700 font-semibold">(Dicari)</span>
                          )}
                        </span>
                      </td>

                      {/* 4. Pasar: Lokal / Ekspor */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {tx.marketType === 'Lokal' ? (
                          <span className="text-emerald-800 font-bold">Lokal</span>
                        ) : (
                          <span className="text-blue-800 font-bold">Ekspor</span>
                        )}
                      </td>

                      {/* 5. Jenis Pallet */}
                      <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                        {formatJenisPallet(tx.palletType)}
                      </td>

                      {/* 6. Type Pallet: LS / SS */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            (tx.typePallet || 'LS') === 'LS'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}
                          title={(tx.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                        >
                          {tx.typePallet || 'LS'}
                        </span>
                      </td>

                      {/* 7. User Tujuan */}
                      <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                        {tx.customer}
                      </td>

                      {/* 8. No.Run */}
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {tx.noRun ? (
                          <button
                            type="button"
                            onClick={() => setFilterNoRun(tx.noRun!)}
                            title={`Klik untuk mencari & cek detail No.Run: ${tx.noRun}`}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              filterNoRun && tx.noRun.toLowerCase().includes(filterNoRun.toLowerCase().trim())
                                ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-xs'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            #{tx.noRun}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 9. Peletakkan */}
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {tx.transactionType === 'PINDAH_KOLOM' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-900 font-mono">
                            <span>{tx.pelatakanPallet || '-'}</span>
                            <span className="text-blue-500">➔</span>
                            <span className="text-emerald-700">{tx.kolomTujuan || '-'}</span>
                          </span>
                        ) : tx.pelatakanPallet ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-800">
                            {tx.pelatakanPallet}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 10. Quantity */}
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {tx.transactionType === 'PENERIMAAN' ? (
                          <span className="text-emerald-700 font-extrabold text-sm">+{tx.quantity}</span>
                        ) : tx.transactionType === 'PINDAH_KOLOM' ? (
                          <span className="text-blue-700 font-bold text-sm">⇄ {tx.quantity}</span>
                        ) : (
                          <span className="text-amber-700 font-extrabold text-sm">-{tx.quantity}</span>
                        )}
                      </td>

                      {/* 11. Satuan */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-[11px] text-slate-800">
                          {tx.unit}
                        </span>
                      </td>

                      {/* 12. Operator */}
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {tx.operator}
                      </td>

                      {/* 13. Aksi */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap no-print">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectTransaction(tx)}
                            title="Lihat Detail Transaksi"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {userCanModify && (
                            <button
                              onClick={() => setTxToRevise(tx)}
                              title="Revisi / Koreksi Data Transaksi (Operator)"
                              className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {userCanModify && (
                            <button
                              onClick={() => handleDelete(tx)}
                              title="Hapus / Batalkan Transaksi (Operator)"
                              className="p-1 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete/Cancel Transaction */}
      {txToDelete && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget && !isDeletingTx) setTxToDelete(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-[#0E1E2E] border border-slate-300 dark:border-[#1E3A52] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-lg">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Batalkan Transaksi {txToDelete.transactionNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Konfirmasi Pembatalan Mutasi Pallet</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#162C42] border border-slate-200 dark:border-[#224566] rounded-lg text-xs text-slate-700 dark:text-slate-200 space-y-1 font-mono">
              <div>
                Jenis: <span className="font-bold text-slate-900 dark:text-white">{txToDelete.transactionType}</span>
              </div>
              <div>
                Ukuran: <span className="font-bold text-slate-900 dark:text-white">{txToDelete.palletSize}</span> ({txToDelete.palletType})
              </div>
              <div>
                Kuantitas: <span className="font-bold text-slate-900 dark:text-white">{txToDelete.quantity} {txToDelete.unit}</span>
              </div>
              <div>User: {txToDelete.customer}</div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Transaksi ini akan dihapus dari buku catatan dan saldo stok pallet akan otomatis disesuaikan kembali.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-[#1E3A52]">
              <button
                type="button"
                disabled={isDeletingTx}
                onClick={() => setTxToDelete(null)}
                className="min-h-[42px] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#163653] border border-slate-300 dark:border-[#224566] rounded-lg cursor-pointer transition-colors disabled:opacity-50 touch-manipulation"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isDeletingTx}
                onClick={handleConfirmDelete}
                className="min-h-[42px] px-5 py-2.5 text-xs font-bold bg-rose-700 hover:bg-rose-800 active:bg-rose-900 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm touch-manipulation select-none"
              >
                {isDeletingTx ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sedang Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Batalkan Transaksi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Print Preview & Print Modal */}
      <PrintReportModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        reportTitle={reportTitle}
        periodLabel={`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} ${filterSize ? `(Ukuran: ${filterSize})` : ''}`}
        headers={reportPayload.headers}
        rows={reportPayload.rows}
        totalsSummary={reportPayload.totalsSummary}
        filenamePrefix={
          activeMode === 'PENGELUARAN'
            ? 'Riwayat_Pengeluaran_Pallet'
            : activeMode === 'PENERIMAAN'
            ? 'Riwayat_Penerimaan_Pallet'
            : 'Riwayat_Transaksi_Pallet'
        }
        onDownloadExcel={handleExportExcel}
        onDownloadPDF={handleExportPDF}
      />

      {/* Official Shift Report (Penerimaan & Pengeluaran Per Shift) Modal */}
      <CetakLaporanShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        initialDate={shiftModalDate}
        initialShift={shiftModalShift}
      />

      {/* Salin Laporan WhatsApp (Hasil Produksi & Pengeluaran Terpisah) */}
      <SalinLaporanWAModal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        initialMode={waModalMode}
        initialDate={waModalDate}
        initialShift={waModalShift}
      />

      {/* Modal Revisi Transaksi Lengkap */}
      {txToRevise && (
        <TransactionRevisionModal
          transaction={txToRevise}
          isOpen={!!txToRevise}
          onClose={() => setTxToRevise(null)}
        />
      )}
    </div>
  );
};

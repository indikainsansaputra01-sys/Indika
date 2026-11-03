import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Timer,
  ArrowDownToLine,
  ArrowUpFromLine,
  User,
  Calendar,
  Activity,
  CheckCircle2,
  Copy,
  Layers,
  ListFilter,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  Edit2
} from 'lucide-react';
import { ShiftType, Transaction } from '../../types';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import { getOperationalDate } from '../../utils/shiftReportUtils';
import { TransactionRevisionModal } from '../common/TransactionRevisionModal';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

/**
 * Interface item ringkasan transaksi shift dengan format singkatan khusus:
 * Ukuran - Lokal/Ekspor (L/E) - Jenis Pallet (RW/BP/RCK/SRKLS) - Type Pallet (LS/SS) - user - quantity set/pcs
 * Contoh: 72x102 L RW LS ( Finishing Sheet ) 25 Set
 */
interface ShiftSummaryItem {
  id?: string;
  size: string;
  marketShort: 'L' | 'E';
  jenisShort: string;
  rawJenis: string;
  typeShort: 'LS' | 'SS';
  user: string;
  quantity: number;
  unit: string;
  qtySatuan: string;
  fullText: string;
  time?: string;
  shift?: string;
  txCount?: number;
  columns?: string[];
  breakdowns?: { column: string; qty: number; time?: string; txId?: string }[];
}

/**
 * Format transaksi ke format ringkasan khusus Monitoring Shift
 */
function formatShiftTx(t: {
  id?: string;
  palletSize?: string;
  marketType?: string;
  palletType?: string;
  typePallet?: string;
  customer?: string;
  quantity: number;
  unit?: string;
  time?: string;
  shift?: string;
  pelatakanPallet?: string;
}): ShiftSummaryItem {
  // 1. Ukuran: e.g. "63x88", "72x102" (selalu ternormalisasi)
  const normSize = normalizePalletDimension(t.palletSize || '-');
  const size = normSize || '-';

  // 2. Lokal / Ekspor disingkat: "L" atau "E"
  const rawMarket = String(t.marketType || 'Lokal').trim().toLowerCase();
  const marketShort: 'L' | 'E' = rawMarket.startsWith('e') ? 'E' : 'L';

  // 3. Jenis Pallet disingkat: "RW", "BP", "RCK", "SRKLS"
  const rawJenis = String(t.palletType || '').trim();
  const lowerJenis = rawJenis.toLowerCase();
  let jenisShort = 'RW';
  if (lowerJenis.includes('rw') || lowerJenis.includes('reamwrap')) {
    jenisShort = 'RW';
  } else if (lowerJenis.includes('bp') || lowerJenis.includes('bulkpack')) {
    jenisShort = 'BP';
  } else if (lowerJenis.includes('rck') || lowerJenis.includes('racuk')) {
    jenisShort = 'RCK';
  } else if (lowerJenis.includes('srkls') || lowerJenis.includes('sirkulasi')) {
    jenisShort = 'SRKLS';
  } else if (rawJenis) {
    jenisShort = rawJenis.toUpperCase();
  }

  // 4. Type Pallet disingkat: "LS" atau "SS"
  const rawType = String(t.typePallet || 'LS').trim().toUpperCase();
  const typeShort: 'LS' | 'SS' = rawType.includes('SS') || rawType.includes('SHORT') ? 'SS' : 'LS';

  // 5. User tujuan: "Finishing Sheet"
  const user = t.customer && t.customer.trim() ? t.customer.trim() : 'Finishing Sheet';

  // 6. Quantity Set/Pcs: e.g. "25 Set"
  const rawUnit = String(t.unit || 'Set').trim().toLowerCase();
  const unit = rawUnit === 'pcs' ? 'Pcs' : 'Set';
  const qtySatuan = `${t.quantity} ${unit}`;

  // Format lengkap: 72x102 L RW LS ( Finishing Sheet ) 25 Set
  const fullText = `${size} ${marketShort} ${jenisShort} ${typeShort} ( ${user} ) ${qtySatuan}`;

  const colName = t.pelatakanPallet && t.pelatakanPallet.trim() ? t.pelatakanPallet.trim() : 'Area Transit';

  return {
    id: t.id,
    size,
    marketShort,
    jenisShort,
    rawJenis,
    typeShort,
    user,
    quantity: t.quantity,
    unit,
    qtySatuan,
    fullText,
    time: t.time,
    shift: t.shift,
    columns: [colName],
    breakdowns: [{ column: colName, qty: t.quantity, time: t.time, txId: t.id }]
  };
}

/**
 * Akumulasi item jika ukuran, pasar, jenis, tipe, user, dan satuan sama.
 * Meskipun pengambilan pallet diambil dari kolom yang berbeda (contoh: 100, 15, dan 3),
 * di Monitoring Shift tetap diakumulasikan menjadi satu baris (contoh: 63x88 118 Set).
 */
function aggregateShiftSummary(items: ShiftSummaryItem[]): ShiftSummaryItem[] {
  const map = new Map<string, ShiftSummaryItem>();

  for (const item of items) {
    const normSize = normalizePalletDimension(item.size);
    const normUser = (item.user || '').trim().toLowerCase();
    const key = `${normSize}|${item.marketShort}|${item.jenisShort}|${item.typeShort}|${normUser}|${item.unit.toLowerCase()}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      existing.txCount = (existing.txCount || 1) + 1;
      existing.qtySatuan = `${existing.quantity} ${existing.unit}`;
      existing.fullText = `${existing.size} ${existing.marketShort} ${existing.jenisShort} ${existing.typeShort} ( ${existing.user} ) ${existing.qtySatuan}`;
      if (item.columns && item.columns.length > 0) {
        existing.columns = Array.from(new Set([...(existing.columns || []), ...item.columns]));
      }
      if (item.breakdowns && item.breakdowns.length > 0) {
        existing.breakdowns = [...(existing.breakdowns || []), ...item.breakdowns];
      }
    } else {
      map.set(key, {
        ...item,
        size: normSize,
        txCount: 1,
        columns: item.columns ? [...item.columns] : [],
        breakdowns: item.breakdowns ? [...item.breakdowns] : []
      });
    }
  }

  return Array.from(map.values());
}

export const MonitoringShift: React.FC = () => {
  const { transactions, activeShift } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(() => getOperationalDate());

  // Tab per shift: 'PENERIMAAN' | 'PENGELUARAN' (default 'PENERIMAAN')
  const [shiftTxTab, setShiftTxTab] = useState<Record<string, 'PENERIMAAN' | 'PENGELUARAN'>>({});
  // Mode tampilan per shift: default 'rekap' (otomatis diakumulasikan sesuai instruksi user)
  const [shiftViewMode, setShiftViewMode] = useState<Record<string, 'detail' | 'rekap'>>({});

  // Expanded card untuk melihat rincian kolom pada item yang diakumulasikan
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);

  // Global summary state (bagian rekap komprehensif di bawah, default 'rekap' akumulasi)
  const [globalShiftFilter, setGlobalShiftFilter] = useState<'ALL' | ShiftType>('ALL');
  const [globalTypeTab, setGlobalTypeTab] = useState<'PENERIMAAN' | 'PENGELUARAN'>('PENERIMAAN');
  const [globalViewMode, setGlobalViewMode] = useState<'detail' | 'rekap'>('rekap');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Status salin ke clipboard
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal revisi transaksi langsung dari Monitoring Shift
  const [selectedTxForRevision, setSelectedTxForRevision] = useState<Transaction | null>(null);

  const handleOpenRevision = (txId?: string) => {
    if (!txId) return;
    const targetTx = transactions.find(t => t.id === txId);
    if (targetTx) {
      setSelectedTxForRevision(targetTx);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const shifts: { name: ShiftType; timeRange: string; color: string }[] = [
    { name: 'Shift 1', timeRange: '07:00 - 15:00', color: 'border-emerald-600' },
    { name: 'Shift 2', timeRange: '15:00 - 23:00', color: 'border-blue-600' },
    { name: 'Shift 3', timeRange: '23:00 - 07:00', color: 'border-purple-600' }
  ];

  // Transaksi hari terpilih
  const dayTransactions = useMemo(() => {
    return transactions.filter(t => t.date === selectedDate);
  }, [transactions, selectedDate]);

  // Statistik dan data transaksi terformat per shift
  const shiftData = useMemo(() => {
    return shifts.map(s => {
      const txs = dayTransactions.filter(t => t.shift === s.name);

      const penerimaanTxs = txs.filter(t => t.transactionType === 'PENERIMAAN');
      const pengeluaranTxs = txs.filter(t => t.transactionType === 'PENGELUARAN');

      const penerimaanQty = penerimaanTxs.reduce((sum, t) => sum + t.quantity, 0);
      const pengeluaranQty = pengeluaranTxs.reduce((sum, t) => sum + t.quantity, 0);

      const totalAktivitas = txs.length;

      // Operator aktif
      const operatorCounts: Record<string, number> = {};
      txs.forEach(t => {
        operatorCounts[t.operator] = (operatorCounts[t.operator] || 0) + 1;
      });

      const activeOperators = Object.entries(operatorCounts).map(([name, count]) => ({
        name,
        txCount: count
      }));

      // Item terformat khusus Monitoring Shift
      const formattedPenerimaan = penerimaanTxs.map(formatShiftTx);
      const formattedPengeluaran = pengeluaranTxs.map(formatShiftTx);

      // Akumulasi otomatis (meskipun dari kolom yang berbeda)
      const rekapPenerimaan = aggregateShiftSummary(formattedPenerimaan);
      const rekapPengeluaran = aggregateShiftSummary(formattedPengeluaran);

      return {
        ...s,
        penerimaan: penerimaanQty,
        pengeluaran: pengeluaranQty,
        totalAktivitas,
        activeOperators,
        transactions: txs,
        penerimaanTxs,
        pengeluaranTxs,
        formattedPenerimaan,
        formattedPengeluaran,
        rekapPenerimaan,
        rekapPengeluaran
      };
    });
  }, [shifts, dayTransactions]);

  // Transaksi untuk bagian Ringkasan Komprehensif di bawah
  const filteredGlobalTxs = useMemo(() => {
    let list = dayTransactions;
    if (globalShiftFilter !== 'ALL') {
      list = list.filter(t => t.shift === globalShiftFilter);
    }
    list = list.filter(t => t.transactionType === globalTypeTab);

    let formatted = list.map(formatShiftTx);

    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      const normQ = normalizePalletDimension(q);
      formatted = formatted.filter(
        item =>
          item.size.toLowerCase().includes(q) ||
          item.size.includes(normQ) ||
          item.user.toLowerCase().includes(q) ||
          item.jenisShort.toLowerCase().includes(q) ||
          item.typeShort.toLowerCase().includes(q)
      );
    }

    // Default akumulasi
    if (globalViewMode === 'detail') {
      return formatted;
    }
    return aggregateShiftSummary(formatted);
  }, [dayTransactions, globalShiftFilter, globalTypeTab, globalViewMode, globalSearch]);

  const copyAllGlobalText = () => {
    if (filteredGlobalTxs.length === 0) return;
    const header = `*RINGKASAN ${globalTypeTab} - ${globalShiftFilter === 'ALL' ? 'SEMUA SHIFT' : globalShiftFilter.toUpperCase()} (${selectedDate})*`;
    const lines = filteredGlobalTxs.map((item, idx) => `${idx + 1}. ${item.fullText}`);
    const totalSet = filteredGlobalTxs.filter(i => i.unit === 'Set').reduce((s, i) => s + i.quantity, 0);
    const totalPcs = filteredGlobalTxs.filter(i => i.unit === 'Pcs').reduce((s, i) => s + i.quantity, 0);
    const summaryFooter = `Total: ${totalSet} Set${totalPcs > 0 ? ` | ${totalPcs} Pcs` : ''}`;
    const fullMessage = [header, ...lines, summaryFooter].join('\n');
    handleCopyText(fullMessage, 'global-all');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      {/* Page Header */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#3886B8] text-white shadow-xs">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">MONITORING SHIFT OPERASIONAL</h1>
              <p className="text-xs text-white/90 mt-0.5 font-medium">
                Evaluasi pergerakan pallet, rincian penerimaan & pengeluaran terakumulasi, serta kinerja operator per shift kerja.
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-[#112B43] p-1.5 rounded-lg border border-[#1E4366]">
          <Calendar className="w-4 h-4 text-white ml-1.5" />
          <span className="text-xs text-white font-semibold">Tanggal:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2.5 py-1 bg-[#163653] border border-[#1E4366] rounded text-xs text-white font-mono focus:outline-none focus:border-[#3886B8] cursor-pointer"
          />
        </div>
      </div>

      {/* 3 SHIFT COLUMNS (Shift 1, Shift 2, Shift 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {shiftData.map((shift) => {
          const isCurrentlyActive = shift.name === activeShift;
          const net = shift.penerimaan - shift.pengeluaran;

          // Tab aktif untuk shift ini ('PENERIMAAN' atau 'PENGELUARAN')
          const currentTab = shiftTxTab[shift.name] || 'PENERIMAAN';
          // Default mode 'rekap' (otomatis diakumulasikan meskipun dari kolom berbeda)
          const viewMode = shiftViewMode[shift.name] || 'rekap';

          // Data sesuai tab yang dipilih
          const isPenerimaan = currentTab === 'PENERIMAAN';
          const rawItems = isPenerimaan ? shift.formattedPenerimaan : shift.formattedPengeluaran;
          const rekapItems = isPenerimaan ? shift.rekapPenerimaan : shift.rekapPengeluaran;
          const displayItems = viewMode === 'detail' ? rawItems : rekapItems;

          const totalSet = rawItems.filter(i => i.unit === 'Set').reduce((s, i) => s + i.quantity, 0);
          const totalPcs = rawItems.filter(i => i.unit === 'Pcs').reduce((s, i) => s + i.quantity, 0);

          // Salin ringkasan shift ini
          const copyShiftSummaryText = () => {
            if (rawItems.length === 0) return;
            const header = `*RINGKASAN ${currentTab} - ${shift.name.toUpperCase()} (${selectedDate})*`;
            const lines = displayItems.map((item, idx) => `${idx + 1}. ${item.fullText}`);
            const footer = `Total: ${totalSet} Set${totalPcs > 0 ? ` | ${totalPcs} Pcs` : ''}`;
            const fullMessage = [header, ...lines, footer].join('\n');
            handleCopyText(fullMessage, `${shift.name}-${currentTab}`);
          };

          return (
            <div
              key={shift.name}
              className={`bg-white dark:bg-[#0F1D2F] border rounded-xl overflow-hidden shadow-xs flex flex-col justify-between ${
                isCurrentlyActive
                  ? 'border-emerald-600 ring-2 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-[#1E3A52]'
              }`}
            >
              <div>
                {/* Header Shift Card */}
                <div className="p-4 bg-[#163653] text-white flex items-center justify-between border-b border-[#1E4366]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold tracking-wide text-white">{shift.name}</h2>
                      {isCurrentlyActive && (
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold animate-pulse tracking-wide">
                          BERJALAN
                        </span>
                      )}
                    </div>
                    {/* Jam Shift: Font Putih Jelas */}
                    <span className="text-xs text-white font-mono font-bold">{shift.timeRange}</span>
                  </div>
                  <div className="text-right">
                    {/* Total Aktivitas: Judul dan Angka Font Putih Jelas */}
                    <span className="text-[11px] text-white block font-bold">Total Aktivitas</span>
                    <span className="text-base font-extrabold font-mono text-white">{shift.totalAktivitas} Trx</span>
                  </div>
                </div>

                {/* Stat Cards Inside Shift */}
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700/60 rounded-lg">
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Penerimaan
                      </div>
                      <div className="text-xl font-black font-mono text-emerald-900 dark:text-white tabular-nums mt-1">
                        +{shift.penerimaan}
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Set / Pcs Masuk</div>
                    </div>

                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700/60 rounded-lg">
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Pengeluaran
                      </div>
                      <div className="text-xl font-black font-mono text-amber-900 dark:text-white tabular-nums mt-1">
                        -{shift.pengeluaran}
                      </div>
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Set / Pcs Keluar</div>
                    </div>
                  </div>

                  {/* Net Flow */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#16263B] border border-slate-200 dark:border-[#223A57] rounded-lg text-xs">
                    <span className="text-slate-600 dark:text-white font-semibold">Net Pallet Shift:</span>
                    <span className={`font-mono font-bold ${net >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {net >= 0 ? `+${net}` : net} Unit
                    </span>
                  </div>

                  {/* Operator Aktif */}
                  <div>
                    <h3 className="text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
                      Operator Aktif:
                    </h3>
                    {shift.activeOperators.length === 0 ? (
                      <div className="p-2 text-center text-[11px] text-slate-400 dark:text-slate-300 bg-slate-50 dark:bg-[#16263B] rounded-lg border border-dashed border-slate-200 dark:border-[#223A57]">
                        Belum ada aktivitas operator tercatat.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {shift.activeOperators.map(op => (
                          <span
                            key={op.name}
                            className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-[#1E3A52] border border-slate-200 dark:border-[#2A4C6B] rounded-lg text-xs font-medium text-slate-800 dark:text-white shadow-2xs"
                          >
                            <EmployeeAvatar
                              name={op.name}
                              size="xs"
                              initialsPosition="corner"
                            />
                            <span className="font-bold text-slate-900 dark:text-white">{op.name}</span>
                            <span className="font-mono text-[10px] bg-white dark:bg-[#0F1D2F] px-1.5 py-0.2 rounded border border-slate-200 dark:border-[#2A4C6B] text-slate-600 dark:text-white font-bold">
                              {op.txCount} Trx
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ============================================================== */}
                  {/* RINGKASAN TRANSAKSI SHIFT: DUA BAGIAN (PENERIMAAN / PENGELUARAN) */}
                  {/* Otomatis diakumulasikan meskipun dari kolom yard yang berbeda    */}
                  {/* ============================================================== */}
                  <div className="pt-3 border-t border-slate-200 dark:border-[#223A57] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                        <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                          Ringkasan Transaksi:
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Toggle Mode: Akumulasi (Default) vs Rincian Trx */}
                        <div className="flex items-center bg-slate-100 dark:bg-[#16263B] p-0.5 rounded border border-slate-200 dark:border-[#223A57] text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              setShiftViewMode(prev => ({ ...prev, [shift.name]: 'rekap' }))
                            }
                            className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                              viewMode === 'rekap'
                                ? 'bg-white dark:bg-[#0F1D2F] text-slate-900 dark:text-white shadow-2xs'
                                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Akumulasikan total quantity (meskipun dari kolom berbeda)"
                          >
                            Akumulasi
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setShiftViewMode(prev => ({ ...prev, [shift.name]: 'detail' }))
                            }
                            className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                              viewMode === 'detail'
                                ? 'bg-white dark:bg-[#0F1D2F] text-slate-900 dark:text-white shadow-2xs'
                                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Tampilkan rincian per baris transaksi"
                          >
                            Rincian
                          </button>
                        </div>

                        {/* Tombol Salin Ringkasan */}
                        {rawItems.length > 0 && (
                          <button
                            type="button"
                            onClick={copyShiftSummaryText}
                            className="p-1 text-slate-600 dark:text-slate-200 hover:text-blue-700 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#1E3A52] rounded transition-colors cursor-pointer"
                            title={`Salin semua baris ${currentTab.toLowerCase()} shift ini`}
                          >
                            {copiedKey === `${shift.name}-${currentTab}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-white" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* DUA BAGIAN KLIK: PENERIMAAN / PENGELUARAN */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-[#16263B] rounded-lg border border-slate-200 dark:border-[#223A57]">
                      <button
                        type="button"
                        onClick={() =>
                          setShiftTxTab(prev => ({ ...prev, [shift.name]: 'PENERIMAAN' }))
                        }
                        className={`py-1.5 px-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          currentTab === 'PENERIMAAN'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-[#1E3A52]'
                        }`}
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>Penerimaan ({shift.rekapPenerimaan.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setShiftTxTab(prev => ({ ...prev, [shift.name]: 'PENGELUARAN' }))
                        }
                        className={`py-1.5 px-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          currentTab === 'PENGELUARAN'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-[#1E3A52]'
                        }`}
                      >
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                        <span>Pengeluaran ({shift.rekapPengeluaran.length})</span>
                      </button>
                    </div>

                    {/* DAFTAR BARIS FORMAT SINGKATAN KHUSUS (TERAKUMULASI LANGSUNG) */}
                    {displayItems.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-300 bg-slate-50 dark:bg-[#16263B] rounded-lg border border-dashed border-slate-200 dark:border-[#223A57]">
                        Tidak ada transaksi {currentTab.toLowerCase()} pada {shift.name}.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                        {displayItems.map((item, idx) => {
                          const itemKey = `${shift.name}-${currentTab}-${item.id || idx}`;
                          const isExpanded = expandedItemKey === itemKey;
                          const hasMultiCols = item.breakdowns && item.breakdowns.length > 1;

                          return (
                            <div
                              key={itemKey}
                              className="p-2 bg-slate-50 dark:bg-[#16263B] hover:bg-slate-100/90 dark:hover:bg-[#1E3A52] rounded-lg border border-slate-200 dark:border-[#223A57] transition-colors flex flex-col gap-1.5 group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-mono text-xs font-bold text-slate-900 dark:text-white leading-relaxed flex items-center gap-1.5 flex-wrap">
                                  {/* Format Standar: 72x102 L RW LS ( Finishing Sheet ) 25 Set */}
                                  <span className="text-slate-950 dark:text-white font-black">{item.size}</span>
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-200 dark:bg-[#233B58] text-slate-800 dark:text-white"
                                    title={item.marketShort === 'L' ? 'Lokal' : 'Ekspor'}
                                  >
                                    {item.marketShort}
                                  </span>
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-[#1E3A52] text-blue-900 dark:text-white border dark:border-[#3886B8]"
                                    title={`Wrap Type: ${item.rawJenis}`}
                                  >
                                    {item.jenisShort}
                                  </span>
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border dark:border-purple-800"
                                    title={`Pallet Runners: ${item.typeShort}`}
                                  >
                                    {item.typeShort}
                                  </span>
                                  <span className="text-slate-700 dark:text-slate-200 font-semibold font-sans">
                                    ( {item.user} )
                                  </span>
                                  <span
                                    className={`font-black ml-1 text-sm ${
                                      isPenerimaan ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                                    }`}
                                  >
                                    {item.qtySatuan}
                                  </span>

                                  {/* Badge jika terakumulasi dari beberapa kolom yang berbeda */}
                                  {hasMultiCols && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedItemKey(isExpanded ? null : itemKey)}
                                      className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 hover:bg-amber-200 dark:hover:bg-amber-900 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 cursor-pointer transition-colors"
                                      title="Klik untuk melihat rincian kolom pengambilan"
                                    >
                                      <MapPin className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                                      <span>{item.breakdowns!.length} Kolom</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-2.5 h-2.5" />
                                      ) : (
                                        <ChevronDown className="w-2.5 h-2.5" />
                                      )}
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Tombol Revisi Langsung */}
                                  {(item.id || (item.breakdowns && item.breakdowns.length === 1 && item.breakdowns[0].txId)) && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRevision(item.id || (item.breakdowns && item.breakdowns[0].txId))}
                                      className="p-1 text-slate-400 dark:text-slate-300 hover:text-blue-700 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#1E3A52] rounded transition-colors cursor-pointer"
                                      title="Revisi transaksi ini langsung"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(item.fullText, itemKey)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white transition-opacity cursor-pointer shrink-0"
                                    title={`Salin: "${item.fullText}"`}
                                  >
                                    {copiedKey === itemKey ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Rincian kolom jika di-expand */}
                              {isExpanded && item.breakdowns && item.breakdowns.length > 0 && (
                                <div className="p-2 bg-amber-50/80 dark:bg-amber-950/60 rounded border border-amber-200 dark:border-amber-800/60 text-[11px] space-y-1">
                                  <div className="font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wide text-[10px]">
                                    Rincian Kolom Pengambilan:
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.breakdowns.map((b, bIdx) => (
                                      <span
                                        key={bIdx}
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-[#0F1D2F] border border-amber-300 dark:border-amber-700 rounded font-mono font-bold text-slate-800 dark:text-white text-[10px]"
                                      >
                                        <span>{b.column}: <strong className="text-amber-800 dark:text-amber-300">{b.qty} {item.unit}</strong></span>
                                        {b.time && <span className="text-slate-400 dark:text-slate-300 font-normal font-sans">({b.time})</span>}
                                        {b.txId && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenRevision(b.txId)}
                                            className="text-blue-600 dark:text-sky-300 hover:text-blue-800 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#1E3A52] px-1 py-0.5 rounded cursor-pointer inline-flex items-center gap-0.5 transition-colors"
                                            title="Revisi transaksi ini"
                                          >
                                            <Edit2 className="w-2.5 h-2.5" />
                                            <span className="text-[9px] font-sans">Revisi</span>
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Subtotal Footer */}
                    {rawItems.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-[#223A57] flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-200 font-medium">
                        <span>
                          Total {currentTab === 'PENERIMAAN' ? 'Masuk' : 'Keluar'}:{' '}
                          <strong className={isPenerimaan ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-amber-800 dark:text-amber-400 font-bold'}>
                            {totalSet} Set{totalPcs > 0 ? ` | ${totalPcs} Pcs` : ''}
                          </strong>
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {rawItems.length} mutasi ({displayItems.length} jenis pallet)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SECTION KEDUA: REKAPITULASI RINGKASAN LENGKAP SHIFT HARI INI               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0F1D2F] border border-slate-200 dark:border-[#1E3A52] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#1E3A52]">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                Rekapitulasi Ringkasan Transaksi Shift
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
              Format ringkasan terstandarisasi: <strong>Ukuran L/E Jenis Type ( User ) Qty</strong> (otomatis terakumulasi).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyAllGlobalText}
              disabled={filteredGlobalTxs.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                filteredGlobalTxs.length === 0
                  ? 'bg-slate-100 dark:bg-[#16263B] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer active:scale-95'
              }`}
              title="Salin seluruh daftar ringkasan sesuai filter ke clipboard"
            >
              {copiedKey === 'global-all' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Salin Semua Ringkasan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Bar: Shift, Bagian (Penerimaan/Pengeluaran), Mode (Detail/Rekap), dan Pencarian */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#16263B] p-3 rounded-lg border border-slate-200 dark:border-[#223A57]">
          {/* 1. Pilih Bagian: Penerimaan / Pengeluaran (Tinggal Klik) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-wider mb-1">
              Bagian Transaksi
            </label>
            <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#0F1D2F] p-1 rounded-lg border border-slate-200 dark:border-[#223A57]">
              <button
                type="button"
                onClick={() => setGlobalTypeTab('PENERIMAAN')}
                className={`py-1.5 px-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  globalTypeTab === 'PENERIMAAN'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-[#1E3A52]'
                }`}
              >
                <ArrowDownToLine className="w-3 h-3" />
                <span>Penerimaan</span>
              </button>
              <button
                type="button"
                onClick={() => setGlobalTypeTab('PENGELUARAN')}
                className={`py-1.5 px-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  globalTypeTab === 'PENGELUARAN'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-[#1E3A52]'
                }`}
              >
                <ArrowUpFromLine className="w-3 h-3" />
                <span>Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* 2. Pilih Shift: Semua / Shift 1 / Shift 2 / Shift 3 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-wider mb-1">
              Filter Shift
            </label>
            <div className="grid grid-cols-4 gap-1 bg-white dark:bg-[#0F1D2F] p-1 rounded-lg border border-slate-200 dark:border-[#223A57]">
              {(['ALL', 'Shift 1', 'Shift 2', 'Shift 3'] as const).map(sh => (
                <button
                  key={sh}
                  type="button"
                  onClick={() => setGlobalShiftFilter(sh)}
                  className={`py-1.5 px-1 text-xs font-bold rounded transition-all cursor-pointer text-center truncate ${
                    globalShiftFilter === sh
                      ? 'bg-slate-900 dark:bg-[#3886B8] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
                  }`}
                >
                  {sh === 'ALL' ? 'Semua' : sh.replace('Shift ', 'S')}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Tampilan: Akumulasi vs Per Transaksi */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-wider mb-1">
              Format Tampilan
            </label>
            <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#0F1D2F] p-1 rounded-lg border border-slate-200 dark:border-[#223A57]">
              <button
                type="button"
                onClick={() => setGlobalViewMode('rekap')}
                className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                  globalViewMode === 'rekap'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
                }`}
                title="Akumulasikan total quantity (meskipun dari kolom berbeda)"
              >
                Akumulasi
              </button>
              <button
                type="button"
                onClick={() => setGlobalViewMode('detail')}
                className={`py-1.5 px-2 text-xs font-bold rounded transition-all cursor-pointer text-center ${
                  globalViewMode === 'detail'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3A52]'
                }`}
                title="Tampilkan per baris transaksi"
              >
                Per Transaksi
              </button>
            </div>
          </div>

          {/* 4. Filter Cari Ukuran / User */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-wider mb-1">
              Cari Ukuran / User
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari cth: 63x88 atau Finishing..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs font-medium bg-white dark:bg-[#0F1D2F] border border-slate-200 dark:border-[#223A57] rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2 top-2 text-xs text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* DAFTAR HASIL RINGKASAN REKAPITULASI */}
        {filteredGlobalTxs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-300 bg-slate-50 dark:bg-[#16263B] rounded-xl border border-dashed border-slate-200 dark:border-[#223A57]">
            <ListFilter className="w-8 h-8 text-slate-300 dark:text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">
              Tidak ditemukan transaksi {globalTypeTab.toLowerCase()} untuk kriteria shift dan tanggal ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredGlobalTxs.map((item, idx) => {
                const globalItemKey = `global-${item.id || idx}`;
                const hasMultiCols = item.breakdowns && item.breakdowns.length > 1;

                return (
                  <div
                    key={globalItemKey}
                    className="p-2.5 bg-slate-50 dark:bg-[#16263B] hover:bg-slate-100/90 dark:hover:bg-[#1E3A52] rounded-lg border border-slate-200 dark:border-[#223A57] transition-all flex items-center justify-between gap-2 group"
                  >
                    <div className="flex items-center gap-2 flex-wrap font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {item.shift && (
                        <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                          {item.shift}
                        </span>
                      )}
                      {globalViewMode === 'detail' && item.time && (
                        <span className="text-[10px] text-slate-500 dark:text-white bg-white dark:bg-[#0F1D2F] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2A4C6B] font-bold">
                          {item.time}
                        </span>
                      )}
                      <span className="text-slate-950 dark:text-white font-black">{item.size}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-200 dark:bg-[#233B58] text-slate-800 dark:text-white"
                        title={item.marketShort === 'L' ? 'Lokal' : 'Ekspor'}
                      >
                        {item.marketShort}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-[#1E3A52] text-blue-900 dark:text-white border dark:border-[#3886B8]"
                        title={`Jenis Pallet: ${item.rawJenis}`}
                      >
                        {item.jenisShort}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border dark:border-purple-800"
                        title={`Type Pallet: ${item.typeShort}`}
                      >
                        {item.typeShort}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 font-semibold font-sans">
                        ( {item.user} )
                      </span>
                      <span
                        className={`font-black ml-1 text-sm ${
                          globalTypeTab === 'PENERIMAAN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {item.qtySatuan}
                      </span>

                      {/* Info kolom jika diambil dari beberapa kolom */}
                      {hasMultiCols && globalViewMode === 'rekap' && (
                        <span
                          className="text-[10px] font-sans font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700"
                          title={item.breakdowns!.map(b => `${b.column}: ${b.qty} ${item.unit}`).join(', ')}
                        >
                          {item.breakdowns!.length} Kolom
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(item.id || (item.breakdowns && item.breakdowns.length === 1 && item.breakdowns[0].txId)) && (
                        <button
                          type="button"
                          onClick={() => handleOpenRevision(item.id || (item.breakdowns && item.breakdowns[0].txId))}
                          className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-blue-700 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#1E3A52] rounded transition-colors cursor-pointer"
                          title="Revisi transaksi ini langsung"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyText(item.fullText, globalItemKey)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-white dark:hover:bg-[#1E3A52] rounded transition-all cursor-pointer"
                        title={`Salin: "${item.fullText}"`}
                      >
                        {copiedKey === globalItemKey ? (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Footer Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-[#16263B] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 mt-2 border dark:border-[#223A57]">
              <div className="flex items-center gap-3">
                <span>
                  Total {globalTypeTab === 'PENERIMAAN' ? 'Penerimaan' : 'Pengeluaran'}:{' '}
                  <strong className={globalTypeTab === 'PENERIMAAN' ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-amber-800 dark:text-amber-400 font-bold'}>
                    {filteredGlobalTxs.filter(i => i.unit === 'Set').reduce((s, i) => s + i.quantity, 0)} Set
                    {filteredGlobalTxs.some(i => i.unit === 'Pcs') && (
                      <> | {filteredGlobalTxs.filter(i => i.unit === 'Pcs').reduce((s, i) => s + i.quantity, 0)} Pcs</>
                    )}
                  </strong>
                </span>
                <span className="text-slate-400 dark:text-slate-500">·</span>
                <span>{filteredGlobalTxs.length} baris ringkasan</span>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-300 font-mono">
                Contoh: 63x88 L RW LS ( Finishing Sheet ) 118 Set
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Revisi Transaksi Langsung */}
      {selectedTxForRevision && (
        <TransactionRevisionModal
          isOpen={Boolean(selectedTxForRevision)}
          transaction={selectedTxForRevision}
          onClose={() => setSelectedTxForRevision(null)}
          onSuccess={() => setSelectedTxForRevision(null)}
        />
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Globe2,
  MapPin,
  Layers,
  Activity,
  Plus,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Transaction } from '../../types';
import { ShiftRosterTable } from './ShiftRosterTable';
import { getDutyOperatorForShift } from '../../utils/rosterUtils';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: {
      date: string;
      label: string;
      fullDate: string;
      masuk: number;
      keluar: number;
      net: number;
    };
  }>;
  label?: string;
}

const TrendCustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload;
    return (
      <div className="bg-white dark:bg-[#0E1E2E] p-3 rounded-xl border border-slate-200 dark:border-[#1E3A52] shadow-xl text-xs space-y-2 min-w-[210px]">
        <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#1E3A52] pb-1.5 flex items-center justify-between">
          <span>{item.fullDate || label}</span>
          <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#163653] text-slate-700 dark:text-slate-300">
            {item.date}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs" />
              Masuk (+In):
            </span>
            <span className="font-mono tabular-nums">+{item.masuk.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs" />
              Keluar (-Out):
            </span>
            <span className="font-mono tabular-nums">-{item.keluar.toLocaleString()}</span>
          </div>
        </div>
        <div className="pt-1.5 border-t border-slate-100 dark:border-[#1E3A52] flex items-center justify-between text-[11px] font-bold">
          <span className="text-slate-600 dark:text-slate-300">Net Mutasi:</span>
          <span
            className={`font-mono tabular-nums ${
              item.net >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {item.net >= 0 ? `+${item.net.toLocaleString()}` : item.net.toLocaleString()} unit
          </span>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardProps {
  onNavigate: (view: string) => void;
  onSelectTransaction: (tx: Transaction) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectTransaction }) => {
  const { stocks, transactions, activeShift, currentUser, theme } = useApp();
  const [trendChartType, setTrendChartType] = useState<'area' | 'bar'>('area');

  const todayStr = new Date().toISOString().split('T')[0];

  // Trend 7 Hari Terakhir (Pallet Masuk vs Keluar)
  const trend7DaysData = useMemo(() => {
    const days: {
      date: string;
      label: string;
      fullDate: string;
      masuk: number;
      keluar: number;
      net: number;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      const fullDate = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const masuk = transactions
        .filter(t => t.date === dateStr && t.transactionType === 'PENERIMAAN')
        .reduce((sum, t) => sum + t.quantity, 0);

      const keluar = transactions
        .filter(t => t.date === dateStr && t.transactionType === 'PENGELUARAN')
        .reduce((sum, t) => sum + t.quantity, 0);

      days.push({
        date: dateStr,
        label: dayName,
        fullDate,
        masuk,
        keluar,
        net: masuk - keluar
      });
    }

    return days;
  }, [transactions]);

  const trend7DaysSummary = useMemo(() => {
    const totalMasuk = trend7DaysData.reduce((sum, d) => sum + d.masuk, 0);
    const totalKeluar = trend7DaysData.reduce((sum, d) => sum + d.keluar, 0);
    const net = totalMasuk - totalKeluar;
    const avgPerHari = Math.round((totalMasuk + totalKeluar) / 7);
    return { totalMasuk, totalKeluar, net, avgPerHari };
  }, [trend7DaysData]);

  // Operator bertugas sesuai jadwal shift rotasi (A, B, C, D)
  const dutyOperator = useMemo(() => {
    return getDutyOperatorForShift(activeShift, todayStr);
  }, [activeShift, todayStr]);

  // Computations
  const stats = useMemo(() => {
    const totalStock = stocks.reduce((sum, item) => sum + item.quantity, 0);

    const todayTxs = transactions.filter(t => t.date === todayStr);

    const penerimaanHariIni = todayTxs
      .filter(t => t.transactionType === 'PENERIMAAN')
      .reduce((sum, t) => sum + t.quantity, 0);

    const pengeluaranHariIni = todayTxs
      .filter(t => t.transactionType === 'PENGELUARAN')
      .reduce((sum, t) => sum + t.quantity, 0);

    const stokLokal = stocks
      .filter(s => s.marketType === 'Lokal')
      .reduce((sum, s) => sum + s.quantity, 0);

    const stokEkspor = stocks
      .filter(s => s.marketType === 'Ekspor')
      .reduce((sum, s) => sum + s.quantity, 0);

    const stokRacuk = stocks
      .filter(s => s.palletType.toLowerCase().includes('racuk'))
      .reduce((sum, s) => sum + s.quantity, 0);

    const stokLS = stocks
      .filter(s => (s.typePallet || 'LS') === 'LS')
      .reduce((sum, s) => sum + s.quantity, 0);

    const stokSS = stocks
      .filter(s => (s.typePallet || 'LS') === 'SS')
      .reduce((sum, s) => sum + s.quantity, 0);

    const transaksiHariIni = todayTxs.length;

    return {
      totalStock,
      penerimaanHariIni,
      pengeluaranHariIni,
      stokLokal,
      stokEkspor,
      stokRacuk,
      stokLS,
      stokSS,
      transaksiHariIni
    };
  }, [stocks, transactions, todayStr]);

  // Chart 1: Stok per Ukuran
  const stockBySize = useMemo(() => {
    const map: Record<string, number> = {};
    stocks.forEach(s => {
      map[s.palletSize] = (map[s.palletSize] || 0) + s.quantity;
    });
    return Object.entries(map)
      .map(([size, qty]) => ({ size, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [stocks]);

  const maxStockSize = Math.max(...stockBySize.map(s => s.qty), 1);

  // Chart 2: Penerimaan vs Pengeluaran (Last 5 Days)
  const dailyFlow = useMemo(() => {
    const days: { date: string; label: string; inQty: number; outQty: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'numeric' });
      
      const inQty = transactions
        .filter(t => t.date === dateStr && t.transactionType === 'PENERIMAAN')
        .reduce((sum, t) => sum + t.quantity, 0);

      const outQty = transactions
        .filter(t => t.date === dateStr && t.transactionType === 'PENGELUARAN')
        .reduce((sum, t) => sum + t.quantity, 0);

      days.push({ date: dateStr, label: dayName, inQty, outQty });
    }
    return days;
  }, [transactions]);

  const maxDailyFlow = Math.max(
    ...dailyFlow.map(d => Math.max(d.inQty, d.outQty)),
    10
  );

  // Chart 3: Stok Lokal vs Ekspor
  const totalMarket = (stats.stokLokal + stats.stokEkspor);
  const pctLokal = totalMarket > 0 ? Math.round((stats.stokLokal / totalMarket) * 100) : 0;
  const pctEkspor = totalMarket > 0 ? 100 - pctLokal : 0;

  // Chart 4: Aktivitas per Shift
  const shiftActivities = useMemo(() => {
    const shifts = ['Shift 1', 'Shift 2', 'Shift 3'] as const;
    return shifts.map(shift => {
      const inQty = transactions
        .filter(t => t.shift === shift && t.transactionType === 'PENERIMAAN')
        .reduce((sum, t) => sum + t.quantity, 0);
      const outQty = transactions
        .filter(t => t.shift === shift && t.transactionType === 'PENGELUARAN')
        .reduce((sum, t) => sum + t.quantity, 0);
      return { shift, inQty, outQty, total: inQty + outQty };
    });
  }, [transactions]);

  const maxShiftQty = Math.max(...shiftActivities.map(s => Math.max(s.inQty, s.outQty)), 10);

  // Recent 7 transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 7);
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions: Enterprise Deep Navy #163653 */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
        {/* Subtle Ambient Sky Blue Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-[#8CCCF0]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-[#3886B8]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Brand & Dual Logos (PT Indah Kiat Karawang + Finish Pallet) */}
        <div className="flex flex-col items-start gap-2.5 relative min-w-0">
          <div className="flex items-center gap-3 shrink-0 py-0.5">
            {/* PT Indah Kiat Karawang Corporate Logo */}
            <div className="relative h-10 sm:h-11 flex items-center justify-center">
              <img
                src="/assets/aistudio/pt_indah_kiat_logo_white_stroke.png"
                alt="Logo PT Indah Kiat Karawang"
                className="h-8 sm:h-9 w-auto max-w-[140px] sm:max-w-[155px] object-contain transition-transform hover:scale-105"
                style={{
                  filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 1px 3px rgba(0,0,0,0.7))'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png';
                  target.style.filter = 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 4px #fff)';
                }}
              />
            </div>

            {/* Garis Pembatas Lembut */}
            <div className="h-7 w-px bg-[#1E4366]" />

            {/* Finish Pallet Logo */}
            <div className="relative h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center shrink-0">
              <img
                src="/splash-pallet-logo-transparent.png"
                alt="Logo Finish Pallet"
                className="w-full h-full object-contain transition-transform hover:scale-105 drop-shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/splash-pallet-logo.jpg';
                }}
              />
            </div>
          </div>

          <div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white font-sans leading-tight">
              Finish Pallet Management System
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-[#112B43] text-white border border-[#1E4366]">
              <span className="w-2 h-2 rounded-full bg-[#16805D] shrink-0"></span>
              <span className="text-white">Area Finish Pallet</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#112B43] text-white border border-[#1E4366]">
              <Clock className="w-3.5 h-3.5 text-white shrink-0" />
              <span>{activeShift}</span>
            </span>
          </div>

          {/* Petugas Jaga : (Sesuai Jadwal Shift Rotasi Resmi) */}
          <div className="flex flex-wrap items-center gap-2 text-xs bg-[#112B43] px-3.5 py-2 rounded-lg border border-[#1E4366]">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold">Petugas Jaga :</span>
              <span className="font-extrabold text-white tracking-wide text-[13.5px]">
                {dutyOperator?.name || currentUser?.name || 'Harun'}
              </span>
              {dutyOperator && (
                <span className="text-white font-extrabold text-[11px] bg-white/15 px-2 py-0.5 rounded border border-white/25">
                  {dutyOperator.groupName} · {activeShift}
                </span>
              )}
            </div>
            {currentUser && currentUser.name && dutyOperator?.name && currentUser.name.toLowerCase() !== dutyOperator.name.toLowerCase() && (
              <span className="text-[11px] text-slate-200 border-l border-[#1E4366] pl-2.5">
                Akun Login: <span className="text-white font-bold">{currentUser.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:items-center gap-2 relative">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              onClick={() => onNavigate('penerimaan')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-[#16805D] hover:bg-[#136B4E] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Catat Pemasukan / Penerimaan Pallet Baru"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Pemasukan (+In)</span>
            </button>

            <button
              onClick={() => onNavigate('pengeluaran')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-[#D97706] hover:bg-[#B45309] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Catat Pengeluaran Pallet ke User"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Pengeluaran (-Out)</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center">
            <button
              onClick={() => onNavigate('stok')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[#112B43] hover:bg-[#1E4366] text-white border border-[#1E4366] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Buka Data Stok Pallet"
            >
              <Boxes className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">Stok</span>
            </button>

            <button
              onClick={() => onNavigate('riwayat-masuk')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[#112B43] hover:bg-[#1E4366] text-emerald-300 border border-[#1E4366] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Buka khusus Riwayat Penerimaan"
            >
              <span className="truncate">R. Masuk</span>
            </button>

            <button
              onClick={() => onNavigate('riwayat-keluar')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[#112B43] hover:bg-[#1E4366] text-amber-300 border border-[#1E4366] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Buka khusus Riwayat Pengeluaran"
            >
              <span className="truncate">R. Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7 Clean White Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. Total Stok */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] hover:border-[#3886B8] rounded-xl p-3.5 shadow-2xs transition-colors">
          <div className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center justify-between">
            <span>Total Stok Pallet</span>
            <Boxes className="w-3.5 h-3.5 text-[#3886B8] dark:text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] dark:text-white mt-1 tabular-nums">
            {stats.totalStock.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Pallet Di Lapangan</div>
        </div>

        {/* 2. Penerimaan Hari Ini (Pemasukan) -> SUCCESS GREEN */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-emerald-300 dark:border-emerald-700 hover:border-[#16805D] rounded-xl p-3.5 shadow-2xs transition-colors">
          <div className="text-[11px] font-extrabold text-[#16805D] dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pemasukan Hari Ini</span>
            <span className="w-2 h-2 rounded-full bg-[#16805D] inline-block"></span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#16805D] dark:text-emerald-400 mt-1 tabular-nums">
            +{stats.penerimaanHariIni.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Hasil Produksi</div>
        </div>

        {/* 3. Pengeluaran Hari Ini -> WARNING ORANGE */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-amber-300 dark:border-amber-700 hover:border-[#D97706] rounded-xl p-3.5 shadow-2xs transition-colors">
          <div className="text-[11px] font-extrabold text-[#D97706] dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pengeluaran Hari Ini</span>
            <span className="w-2 h-2 rounded-full bg-[#D97706] inline-block"></span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#D97706] dark:text-amber-400 mt-1 tabular-nums">
            -{stats.pengeluaranHariIni.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Kirim ke user</div>
        </div>

        {/* 4. Stok Lokal -> SAMA DENGAN STOK EKSPOR */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] hover:border-[#163653] rounded-xl p-3.5 shadow-2xs transition-colors">
          <div className="text-[11px] font-extrabold text-[#163653] dark:text-white uppercase tracking-wider flex items-center justify-between">
            <span>Stok Lokal</span>
            <MapPin className="w-3.5 h-3.5 text-[#163653] dark:text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] dark:text-white mt-1 tabular-nums">
            {stats.stokLokal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Area Domestik</div>
        </div>

        {/* 5. Stok Ekspor -> DEEP NAVY */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] hover:border-[#163653] rounded-xl p-3.5 shadow-2xs transition-colors">
          <div className="text-[11px] font-extrabold text-[#163653] dark:text-white uppercase tracking-wider flex items-center justify-between">
            <span>Stok Ekspor</span>
            <Globe2 className="w-3.5 h-3.5 text-[#163653] dark:text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] dark:text-white mt-1 tabular-nums">
            {stats.stokEkspor.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Pasar Ekspor</div>
        </div>

        {/* 6. Stok Racuk -> SKY ACCENT */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] hover:border-[#3886B8] rounded-xl p-3.5 shadow-2xs transition-colors">
          <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
            <span>Stok Racuk</span>
            <Layers className="w-3.5 h-3.5 text-[#3886B8]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] dark:text-white mt-1 tabular-nums">
            {stats.stokRacuk.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Pallet Racukan</div>
        </div>

        {/* 7. Transaksi Hari Ini */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] hover:border-slate-400 rounded-xl p-3.5 shadow-2xs transition-colors col-span-2 sm:col-span-1">
          <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
            <span>Transaksi Hari Ini</span>
            <Activity className="w-3.5 h-3.5 text-[#3886B8]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] dark:text-white mt-1 tabular-nums">
            {stats.transaksiHariIni}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Aktivitas shift</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECHARTS: TREN JUMLAH PALLET MASUK VS KELUAR 7 HARI TERAKHIR               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Header Tren 7 Hari */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#1E3A52]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#16805D] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#163653] dark:text-white uppercase tracking-wide flex items-center gap-2 flex-wrap">
                <span>Tren Pallet Masuk vs Keluar</span>
                <span className="text-[11px] normal-case font-extrabold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#163653] text-[#3886B8] dark:text-white border border-blue-200 dark:border-[#233B58]">
                  7 Hari Terakhir
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 font-medium">
                Visualisasi dinamika pergerakan stok pallet dari hasil penerimaan produksi vs pengeluaran ke user.
              </p>
            </div>
          </div>

          {/* Toggle View: Area Chart vs Bar Chart */}
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <div className="flex items-center bg-slate-100 dark:bg-[#16263B] p-1 rounded-lg border border-slate-200 dark:border-[#223A57] text-xs">
              <button
                type="button"
                onClick={() => setTrendChartType('area')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  trendChartType === 'area'
                    ? 'bg-white dark:bg-[#0F1D2F] text-[#163653] dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilan grafik garis & area tren"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Area Tren</span>
              </button>
              <button
                type="button"
                onClick={() => setTrendChartType('bar')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  trendChartType === 'bar'
                    ? 'bg-white dark:bg-[#0F1D2F] text-[#163653] dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilan grafik batang komparasi"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Batang</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Summary Pills for 7-Day Performance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1">
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Total Masuk (7H)
              </span>
            </div>
            <div className="text-xl font-black font-mono text-emerald-900 dark:text-white tabular-nums mt-1">
              +{trend7DaysSummary.totalMasuk.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-emerald-700 dark:text-emerald-300 font-medium">Set / Pcs Hasil Produksi</div>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1">
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                Total Keluar (7H)
              </span>
            </div>
            <div className="text-xl font-black font-mono text-amber-900 dark:text-white tabular-nums mt-1">
              -{trend7DaysSummary.totalKeluar.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-amber-700 dark:text-amber-300 font-medium">Set / Pcs Dikirim ke User</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-[#16263B] border border-slate-200 dark:border-[#223A57] rounded-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white">
              <span>Net Selisih (7H)</span>
            </div>
            <div
              className={`text-xl font-black font-mono tabular-nums mt-1 ${
                trend7DaysSummary.net >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {trend7DaysSummary.net >= 0
                ? `+${trend7DaysSummary.net.toLocaleString()}`
                : trend7DaysSummary.net.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-300 font-medium">Akumulasi Selisih Unit</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-[#16263B] border border-slate-200 dark:border-[#223A57] rounded-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white">
              <span>Rata-rata Mutasi</span>
            </div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white tabular-nums mt-1">
              {trend7DaysSummary.avgPerHari.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-300 font-medium">Unit Pallet / Hari</div>
          </div>
        </div>

        {/* Recharts Chart Canvas */}
        <div className="w-full h-72 sm:h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {trendChartType === 'area' ? (
              <AreaChart data={trend7DaysData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendColorMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="trendColorKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme === 'dark' ? '#1E3A52' : '#E2E8F0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={theme === 'dark' ? '#CBD5E1' : '#64748B'}
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: theme === 'dark' ? '#1E3A52' : '#CBD5E1' }}
                />
                <YAxis
                  stroke={theme === 'dark' ? '#CBD5E1' : '#64748B'}
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<TrendCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs font-bold text-slate-700 dark:text-white mr-2">
                      {value}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="masuk"
                  name="Pallet Masuk (+In)"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trendColorMasuk)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#FFFFFF' }}
                />
                <Area
                  type="monotone"
                  dataKey="keluar"
                  name="Pallet Keluar (-Out)"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trendColorKeluar)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#FFFFFF' }}
                />
              </AreaChart>
            ) : (
              <BarChart data={trend7DaysData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme === 'dark' ? '#1E3A52' : '#E2E8F0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={theme === 'dark' ? '#CBD5E1' : '#64748B'}
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: theme === 'dark' ? '#1E3A52' : '#CBD5E1' }}
                />
                <YAxis
                  stroke={theme === 'dark' ? '#CBD5E1' : '#64748B'}
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<TrendCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs font-bold text-slate-700 dark:text-white mr-2">
                      {value}
                    </span>
                  )}
                />
                <Bar
                  dataKey="masuk"
                  name="Pallet Masuk (+In)"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="keluar"
                  name="Pallet Keluar (-Out)"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Jadwal Shift Roster Matrix */}
      <ShiftRosterTable />

      {/* 4 Clean Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Grafik 1: Stok Pallet per Ukuran */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E3A52] mb-4">
            <h2 className="text-sm font-bold text-[#163653] dark:text-white uppercase tracking-wide">
              Grafik 1 — Stok Berdasarkan Ukuran Pallet
            </h2>
            <span className="text-xs text-[#64748B] dark:text-slate-400 font-medium">Unit</span>
          </div>

          <div className="space-y-3">
            {stockBySize.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">Belum ada data stok</div>
            ) : (
              stockBySize.map((item) => {
                const pct = Math.round((item.qty / maxStockSize) * 100);
                return (
                  <div key={item.size} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#172B3A] dark:text-slate-200">{item.size}</span>
                      <span className="font-mono font-bold text-[#163653] dark:text-[#8CCCF0] tabular-nums">
                        {item.qty} unit
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#F1F5F9] dark:bg-[#163653] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#3886B8] rounded-xs transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Grafik 2: Penerimaan vs Pengeluaran (Harian) */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E3A52] mb-4">
            <h2 className="text-sm font-bold text-[#163653] dark:text-white uppercase tracking-wide">
              Grafik 2 — Pemasukan vs Pengeluaran (5 Hari)
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[#16805D] font-bold">
                <span className="w-2.5 h-2.5 bg-[#16805D] rounded-xs inline-block" /> Masuk (+In)
              </span>
              <span className="flex items-center gap-1.5 text-[#D97706] font-bold">
                <span className="w-2.5 h-2.5 bg-[#D97706] rounded-xs inline-block" /> Keluar (-Out)
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {dailyFlow.map((day) => {
              const pctIn = Math.round((day.inQty / maxDailyFlow) * 100);
              const pctOut = Math.round((day.outQty / maxDailyFlow) * 100);
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#172B3A] dark:text-slate-200 font-medium">{day.label}</span>
                    <span className="font-mono text-[#64748B] dark:text-slate-400 tabular-nums text-[11px]">
                      In: <b className="text-[#16805D]">+{day.inQty}</b> | Out: <b className="text-[#D97706]">-{day.outQty}</b>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-2.5 bg-[#F1F5F9] dark:bg-[#163653] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#16805D] rounded-xs"
                        style={{ width: `${Math.max(pctIn, 2)}%` }}
                        title={`Masuk: ${day.inQty}`}
                      />
                    </div>
                    <div className="h-2.5 bg-[#F1F5F9] dark:bg-[#163653] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#D97706] rounded-xs"
                        style={{ width: `${Math.max(pctOut, 2)}%` }}
                        title={`Keluar: ${day.outQty}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grafik 3: Stok Lokal vs Ekspor */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E3A52] mb-4">
            <h2 className="text-sm font-bold text-[#163653] dark:text-white uppercase tracking-wide">
              Grafik 3 — Komposisi Stok Lokal vs Ekspor
            </h2>
            <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono">
              Total {stats.totalStock} Unit
            </span>
          </div>

          <div className="space-y-4">
            <div className="w-full h-5 bg-[#F1F5F9] dark:bg-[#163653] rounded-xs overflow-hidden flex">
              <div
                className="bg-[#3886B8] h-full flex items-center justify-center text-[10px] text-white font-mono font-bold"
                style={{ width: `${pctLokal}%` }}
                title={`Stok Lokal: ${stats.stokLokal}`}
              >
                {pctLokal > 15 ? `${pctLokal}%` : ''}
              </div>
              <div
                className="bg-[#163653] h-full flex items-center justify-center text-[10px] text-white font-mono font-bold border-l border-white/20"
                style={{ width: `${pctEkspor}%` }}
                title={`Stok Ekspor: ${stats.stokEkspor}`}
              >
                {pctEkspor > 15 ? `${pctEkspor}%` : ''}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#163653]/10 dark:bg-[#163653]/40 border border-[#163653]/30 rounded-lg text-left">
                <div className="text-xs text-[#163653] dark:text-white font-bold">Stok Lokal</div>
                <div className="text-xl font-bold font-mono text-[#163653] dark:text-white tabular-nums mt-0.5">
                  {stats.stokLokal} <span className="text-xs font-normal">Unit</span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-300 mt-1 font-mono">{pctLokal}% Porsi Total</div>
              </div>

              <div className="p-3 bg-[#163653]/10 dark:bg-[#163653]/40 border border-[#163653]/30 rounded-lg text-left">
                <div className="text-xs text-[#163653] dark:text-white font-bold">Stok Ekspor</div>
                <div className="text-xl font-bold font-mono text-[#163653] dark:text-white tabular-nums mt-0.5">
                  {stats.stokEkspor} <span className="text-xs font-normal">Unit</span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-300 mt-1 font-mono">{pctEkspor}% Porsi Total</div>
              </div>
            </div>
          </div>
        </div>

        {/* Grafik 4: Aktivitas per Shift */}
        <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E3A52] mb-4">
            <h2 className="text-sm font-bold text-[#163653] dark:text-white uppercase tracking-wide">
              Grafik 4 — Aktivitas per Shift
            </h2>
            <button
              onClick={() => onNavigate('shift')}
              className="text-xs text-[#3886B8] hover:text-[#163653] dark:text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              Detail Shift <ArrowRight className="w-3 h-3 text-white" />
            </button>
          </div>

          <div className="space-y-3.5">
            {shiftActivities.map((s) => {
              const inPct = Math.round((s.inQty / maxShiftQty) * 100);
              const outPct = Math.round((s.outQty / maxShiftQty) * 100);
              return (
                <div key={s.shift} className="p-2.5 bg-[#F8FAFC] dark:bg-[#163653]/30 border border-[#E2E8F0] dark:border-[#1E3A52] rounded-lg">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-[#172B3A] dark:text-white">{s.shift}</span>
                    <span className="text-[#64748B] dark:text-slate-400 text-[11px] font-mono">
                      Masuk: <b className="text-[#16805D]">+{s.inQty}</b> · Keluar: <b className="text-[#D97706]">-{s.outQty}</b>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 bg-[#E2E8F0] dark:bg-[#1E3A52] rounded-xs overflow-hidden">
                      <div className="h-full bg-[#16805D]" style={{ width: `${Math.max(inPct, 2)}%` }} />
                    </div>
                    <div className="h-2 bg-[#E2E8F0] dark:bg-[#1E3A52] rounded-xs overflow-hidden">
                      <div className="h-full bg-[#D97706]" style={{ width: `${Math.max(outPct, 2)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section TRANSAKSI TERBARU */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] dark:border-[#1E3A52] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0E1E2E]">
          <div>
            <h2 className="text-sm font-bold text-[#163653] dark:text-white uppercase tracking-wide">
              TRANSAKSI TERBARU
            </h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
              Aktivitas keluar-masuk pallet terkini di area Finish Pallet
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('riwayat-keluar')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#D97706] border border-amber-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Riwayat Pengeluaran</span>
            </button>
            <button
              onClick={() => onNavigate('riwayat-masuk')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#16805D] border border-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-[#16805D]" />
              <span>Riwayat Penerimaan</span>
            </button>
            <button
              onClick={() => onNavigate('riwayat')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#163653] hover:bg-[#1E4366] text-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <span>Semua Transaksi</span>
              <ArrowRight className="w-3 h-3 text-[#8CCCF0]" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F1F5F9] dark:bg-[#112B43] text-slate-900 dark:text-white uppercase text-[10.5px] font-extrabold tracking-wider border-b-2 border-[#CBD5E1] dark:border-[#1E3A52]">
              <tr>
                <th className="py-2.5 px-3">Tanggal & Jam</th>
                <th className="py-2.5 px-3">Jenis Transaksi</th>
                <th className="py-2.5 px-3">Ukuran Pallet</th>
                <th className="py-2.5 px-3 text-center">Pallet Runners</th>
                <th className="py-2.5 px-3">Wrap Type</th>
                <th className="py-2.5 px-3">User / Tujuan</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-center">Satuan</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CBD5E1] dark:divide-[#1E3A52]">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#F1F5F9] dark:hover:bg-[#163653]/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[#0F172A] dark:text-white whitespace-nowrap">
                    <div className="font-bold">{tx.date}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{tx.time}</div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {tx.transactionType === 'PENERIMAAN' ? (
                      <span className="text-[#16805D] dark:text-emerald-300 font-extrabold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 rounded flex items-center gap-1 w-fit shadow-2xs">
                        <ArrowDownToLine className="w-3 h-3 text-[#16805D] dark:text-emerald-300" />
                        PENERIMAAN
                      </span>
                    ) : (
                      <span className="text-[#D97706] dark:text-amber-300 font-extrabold bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded flex items-center gap-1 w-fit shadow-2xs">
                        <ArrowUpFromLine className="w-3 h-3 text-[#D97706] dark:text-amber-300" />
                        PENGELUARAN
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-extrabold text-[#0F172A] dark:text-white whitespace-nowrap">
                    {tx.palletSize}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-extrabold border ${
                        (tx.typePallet || 'LS') === 'LS'
                          ? 'bg-[#F1F5F9] text-[#163653] border-[#CBD5E1] dark:bg-[#1E3A52] dark:text-white dark:border-[#2A4C6B]'
                          : 'bg-[#E2E8F0] text-[#0F172A] border-slate-400 dark:bg-[#1E3A52] dark:text-white'
                      }`}
                      title={(tx.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                    >
                      {tx.typePallet || 'LS'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#0F172A] dark:text-slate-100 font-bold whitespace-nowrap">
                    {tx.palletType}
                    <span className="text-[10.5px] text-slate-600 dark:text-slate-300 font-medium ml-1">({tx.marketType})</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-[#0F172A] dark:text-slate-100 whitespace-nowrap">
                    {tx.customer}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-mono font-bold whitespace-nowrap">
                    {tx.shift}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                    {tx.transactionType === 'PENERIMAAN' ? (
                      <span className="text-[#16805D] dark:text-emerald-400 font-extrabold">+{tx.quantity}</span>
                    ) : (
                      <span className="text-[#D97706] dark:text-amber-400 font-extrabold">-{tx.quantity}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1E3A52] text-[10.5px] font-mono font-extrabold text-[#163653] dark:text-white border border-[#CBD5E1] dark:border-[#2A4C6B]">
                      {tx.unit}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#0F172A] dark:text-slate-100 font-bold whitespace-nowrap">
                    {tx.operator}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => onSelectTransaction(tx)}
                      className="px-3 py-1 text-[11px] font-bold text-[#3886B8] hover:text-[#163653] dark:text-white dark:bg-[#1E3A52] dark:border-[#2A4C6B] dark:hover:bg-[#254A6F] bg-white hover:bg-slate-100 border border-[#3886B8] rounded cursor-pointer transition-colors shadow-2xs"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

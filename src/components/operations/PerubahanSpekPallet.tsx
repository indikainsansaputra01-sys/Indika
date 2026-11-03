import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeftRight,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  MapPin,
  Boxes,
  Layers,
  ArrowRight,
  Info,
  Shield,
  Lock,
  Sparkles,
  Shuffle
} from 'lucide-react';
import { ShiftType, MarketType, QuantityUnit, PalletSideType, Transaction } from '../../types';
import { getAvailableColumnsForPallet } from '../../utils/stockLocationUtils';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import { copyTextToClipboard } from '../../utils/whatsappReportUtils';
import { getOperatorShiftForDate } from '../../utils/rosterUtils';

export const PerubahanSpekPallet: React.FC = () => {
  const {
    currentUser,
    convertPalletSpec,
    getStock,
    masterSizes,
    masterTypes,
    isOperator,
    transactions,
    showNotification
  } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const getShiftTime = (s: ShiftType) => {
    if (s === 'Shift 1') return '08:00';
    if (s === 'Shift 2') return '16:00';
    return '00:00';
  };

  // State Form
  const [date, setDate] = useState(todayStr);
  const [palletSize, setPalletSize] = useState('');
  const [marketType, setMarketType] = useState<MarketType>('Lokal');
  const [typePallet, setTypePallet] = useState<PalletSideType>('LS');
  const [unit, setUnit] = useState<QuantityUnit>('Set');

  // Wrap Type Asal & Tujuan
  const [sourcePalletType, setSourcePalletType] = useState('Pallet Reamwrap');
  const [targetPalletType, setTargetPalletType] = useState('Pallet Bulkpack');

  // Lokasi Kolom
  const [kolomAsal, setKolomAsal] = useState('');
  const [kolomTujuan, setKolomTujuan] = useState('');

  // Kuantitas & Catatan
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // Operator otomatis terkunci sesuai akun login
  const operator = useMemo(() => {
    return currentUser?.name || 'Indika';
  }, [currentUser]);

  // Jadwal Shift otomatis sesuai Roster Resmi
  const operatorSchedule = useMemo(() => {
    return getOperatorShiftForDate(operator, date);
  }, [operator, date]);

  const shift = useMemo<ShiftType>(() => {
    return (operatorSchedule.isOff ? 'Shift 1' : operatorSchedule.shiftLabel) as ShiftType;
  }, [operatorSchedule]);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);

  // Daftar Pilihan Wrap Type Resmi
  const palletTypes = useMemo(() => {
    const list = (masterTypes || []).filter(m => m.active).map(m => m.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);

  // Target wrap types excludes source wrap type
  const targetTypeOptions = useMemo(() => {
    return palletTypes.filter(t => t.toLowerCase() !== sourcePalletType.toLowerCase());
  }, [palletTypes, sourcePalletType]);

  // Sinkronisasi target wrap type jika sama dengan source
  React.useEffect(() => {
    if (targetPalletType.toLowerCase() === sourcePalletType.toLowerCase()) {
      const alternative = palletTypes.find(t => t.toLowerCase() !== sourcePalletType.toLowerCase());
      if (alternative) setTargetPalletType(alternative);
    }
  }, [sourcePalletType, targetPalletType, palletTypes]);

  // Sinkronisasi default kolom tujuan sama dengan kolom asal jika belum diubah
  const handleSelectKolomAsal = (col: string) => {
    setKolomAsal(col);
    if (!kolomTujuan.trim() || kolomTujuan.trim() === kolomAsal.trim()) {
      setKolomTujuan(col);
    }
  };

  // Total stok fisik untuk spek asal
  const currentSourceStock = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize || !sourcePalletType) return 0;
    return getStock(cleanSize, sourcePalletType, marketType, unit, typePallet);
  }, [palletSize, sourcePalletType, marketType, unit, typePallet, getStock]);

  // Total stok fisik untuk spek target saat ini
  const currentTargetStock = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize || !targetPalletType) return 0;
    return getStock(cleanSize, targetPalletType, marketType, unit, typePallet);
  }, [palletSize, targetPalletType, marketType, unit, typePallet, getStock]);

  // Deteksi kolom-kolom penyimpan stok spek asal yang aktif
  const detectedAvailableColumns = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) return [];
    return getAvailableColumnsForPallet({
      transactions,
      palletSize: cleanSize,
      palletType: sourcePalletType,
      typePallet,
      unit,
      marketType
    });
  }, [palletSize, sourcePalletType, typePallet, unit, marketType, transactions]);

  // Stok yang tersedia di Kolom Asal yang dipilih
  const maxStockInSourceCol = useMemo(() => {
    if (!kolomAsal.trim()) return null;
    const match = detectedAvailableColumns.find(
      c => c.col.toUpperCase() === kolomAsal.trim().toUpperCase()
    );
    return match ? match.qty : null;
  }, [detectedAvailableColumns, kolomAsal]);

  const requestedQty = parseInt(quantity, 10) || 0;
  const isOverTotalStock = requestedQty > currentSourceStock;
  const isOverColStock = maxStockInSourceCol !== null && requestedQty > maxStockInSourceCol;

  // Riwayat perubahan spek hari ini
  const todayChanges = useMemo(() => {
    return transactions.filter(
      t => t.transactionType === 'UBAH_SPEK' && t.date === date
    );
  }, [transactions, date]);

  // Format teks WA laporan perubahan spek shift
  const generateWaText = (): string => {
    const currentShiftChanges = todayChanges.filter(t => t.shift === shift);
    const lines = [
      `*LAPORAN PERUBAHAN SPEK PALLET (WRAP TYPE)*`,
      `PT Indah Kiat Pulp & Paper Tbk - Finish Pallet`,
      `Tanggal: ${date} (${shift})`,
      `Petugas: ${operator}`,
      `Total Aktivitas: ${currentShiftChanges.length} Perubahan`,
      `------------------------------------`
    ];

    if (currentShiftChanges.length === 0) {
      lines.push(`(Belum ada catatan perubahan spek pada shift ini)`);
    } else {
      currentShiftChanges.forEach((t, idx) => {
        lines.push(
          `${idx + 1}. *${t.palletSize}* ${t.marketType === 'Ekspor' ? 'Ekspor' : 'Lokal'} ${t.typePallet || 'LS'} : *${t.quantity} ${t.unit}*` +
          `\n   ↳ *${t.palletType}* ➔ *${t.targetPalletType || 'Pallet Bulkpack'}*` +
          `\n   ↳ Ambil: *Kolom ${t.pelatakanPallet || '-'}* ➔ Ditempatkan: *Kolom ${t.kolomTujuan || t.pelatakanPallet || '-'}*` +
          `${t.notes ? `\n   ↳ Ket: ${t.notes}` : ''}`
        );
      });
    }

    lines.push(`------------------------------------`);
    lines.push(`*Catatan:* Perubahan wrap type internal disesuaikan dengan instruksi produksi.`);
    return lines.join('\n');
  };

  const handleCopyWA = async () => {
    const ok = await copyTextToClipboard(generateWaText());
    if (ok) {
      setQuickCopied(true);
      showNotification('success', 'Teks WA Disalin!', 'Rangkuman perubahan spek siap dibagikan ke WhatsApp.');
      setTimeout(() => setQuickCopied(false), 2500);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!isOperator) {
      setStatusMessage({ type: 'error', text: 'Hanya Operator yang memiliki izin untuk memproses perubahan spek.' });
      return;
    }

    if (operatorSchedule.isOff) {
      setStatusMessage({
        type: 'error',
        text: `Operator ${operator} sedang libur (OFF) pada ${date} sesuai jadwal roster. Tidak dapat menginput transaksi.`
      });
      return;
    }

    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) {
      setStatusMessage({ type: 'error', text: 'Ukuran pallet wajib diisi!' });
      return;
    }

    if (!kolomAsal.trim()) {
      setStatusMessage({ type: 'error', text: 'Pilih atau ketik kolom asal tempat pallet diambil!' });
      return;
    }

    if (sourcePalletType.toLowerCase() === targetPalletType.toLowerCase()) {
      setStatusMessage({ type: 'error', text: 'Wrap type tujuan harus berbeda dari wrap type asal!' });
      return;
    }

    if (requestedQty <= 0) {
      setStatusMessage({ type: 'error', text: 'Jumlah pallet yang diubah harus lebih besar dari 0!' });
      return;
    }

    if (isOverTotalStock) {
      setStatusMessage({
        type: 'error',
        text: `Jumlah yang diubah (${requestedQty} ${unit}) melebihi total stok ${sourcePalletType} yang ada (${currentSourceStock} ${unit})!`
      });
      return;
    }

    if (isOverColStock) {
      setStatusMessage({
        type: 'error',
        text: `Jumlah yang diubah (${requestedQty} ${unit}) melebihi stok yang ada di kolom ${kolomAsal.toUpperCase()} (${maxStockInSourceCol} ${unit})!`
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await convertPalletSpec({
        date,
        time: getShiftTime(shift),
        shift,
        palletSize: cleanSize,
        sourcePalletType,
        targetPalletType,
        typePallet,
        marketType,
        unit,
        quantity: requestedQty,
        kolomAsal: kolomAsal.trim().toUpperCase(),
        kolomTujuan: (kolomTujuan.trim() || kolomAsal.trim()).toUpperCase(),
        operator,
        notes: notes.trim()
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Perubahan spek ${requestedQty} ${unit} ${cleanSize} (${sourcePalletType} ➔ ${targetPalletType}) berhasil disimpan! Sisa ${sourcePalletType}: ${res.remainingSourceStock} ${unit}.`
        });

        // Reset form input dinamis
        setQuantity('');
        setNotes('');
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Terjadi kendala: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-6 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#3886B8] text-white">
                <Shuffle className="w-5 h-5" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                PERUBAHAN SPESIFIKASI PALLET (WRAP TYPE)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#8CCCF0]">
              Konversi kemasan pallet (Reamwrap ➔ Bulkpack, dsb) dari stok aktif tanpa merubah fisik ukuran.
            </p>
          </div>

          {/* Operator Bertugas & Status Shift */}
          <div className="flex flex-wrap items-center gap-2 text-xs bg-[#112B43] px-3.5 py-2.5 rounded-lg border border-[#1E4366]">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-bold">Operator:</span>
              <span className="font-extrabold text-white text-[13px]">{operator}</span>
            </div>
            <div className="border-l border-[#1E4366] pl-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white" />
              <span className="font-bold text-white">{shift}</span>
              {operatorSchedule.isOff ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                  LIBUR (OFF)
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#16805D] text-white">
                  {operatorSchedule.group ? `Grup ${operatorSchedule.group}` : operatorSchedule.shiftLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Warning jika operator libur */}
      {operatorSchedule.isOff && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <b className="text-sm font-bold block text-rose-900">Akses Input Dikunci: Sedang Libur (OFF)</b>
            Sesuai jadwal rotasi resmi 12-hari 4-grup, akun <b>{operator}</b> berstatus <b>OFF</b> pada tanggal {date}. Sistem mengunci formulir agar data transaksi tetap tertib dan akurat sesuai operator yang bertugas di lapangan.
          </div>
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] rounded-xl p-4 sm:p-6 shadow-2xs space-y-6">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-lg text-xs font-semibold flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
          </div>
        )}

        {/* 1. Baris Informasi Waktu & Dimensi Pallet */}
        <div>
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3886B8]"></span>
            <span>1. Identifikasi Pallet Asal yang Akan Diubah</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Tanggal */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Tanggal Operasional *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!isOperator || operatorSchedule.isOff}
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs font-semibold focus:outline-none focus:border-[#3886B8]"
                required
              />
            </div>

            {/* Ukuran Pallet */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Ukuran Pallet (Ketik Bebas) *
              </label>
              <input
                type="text"
                list="sizes-perubahan-list"
                value={palletSize}
                onChange={(e) => setPalletSize(e.target.value)}
                disabled={!isOperator || operatorSchedule.isOff}
                placeholder="cth: 81x111, 72x102..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs font-bold font-mono focus:outline-none focus:border-[#3886B8]"
                required
              />
              <datalist id="sizes-perubahan-list">
                {masterSizes.filter(s => s.active).map(s => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            {/* Market Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Kategori Pasar *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMarketType('Lokal')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    marketType === 'Lokal'
                      ? 'bg-[#163653] text-white border-[#163653] shadow-2xs'
                      : 'bg-white dark:bg-[#111E30] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3A52] hover:bg-slate-50'
                  }`}
                >
                  Lokal
                </button>
                <button
                  type="button"
                  onClick={() => setMarketType('Ekspor')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    marketType === 'Ekspor'
                      ? 'bg-[#163653] text-white border-[#163653] shadow-2xs'
                      : 'bg-white dark:bg-[#111E30] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3A52] hover:bg-slate-50'
                  }`}
                >
                  Ekspor
                </button>
              </div>
            </div>

            {/* Type Pallet (LS / SS) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Sisi Pallet (LS / SS) *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTypePallet('LS')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    typePallet === 'LS'
                      ? 'bg-[#3886B8] text-white border-[#3886B8] shadow-2xs'
                      : 'bg-white dark:bg-[#111E30] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3A52] hover:bg-slate-50'
                  }`}
                >
                  LS (Long)
                </button>
                <button
                  type="button"
                  onClick={() => setTypePallet('SS')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    typePallet === 'SS'
                      ? 'bg-[#3886B8] text-white border-[#3886B8] shadow-2xs'
                      : 'bg-white dark:bg-[#111E30] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3A52] hover:bg-slate-50'
                  }`}
                >
                  SS (Short)
                </button>
              </div>
            </div>

            {/* Satuan Unit */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Satuan Ukur *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setUnit('Set')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    unit === 'Set'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white dark:bg-[#111E30] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3A52]'
                  }`}
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('Pcs')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    unit === 'Pcs'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white dark:bg-[#111E30] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3A52]'
                  }`}
                >
                  Pcs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Pemilihan Wrap Type Asal & Saldo Kolom Penyimpan */}
        <div className="p-4 bg-[#F8FAFC] dark:bg-[#0B1522] border border-[#CBD5E1] dark:border-[#1E3A52] rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CBD5E1] dark:border-[#1E3A52] pb-3">
            <div>
              <h2 className="text-xs font-bold text-[#163653] dark:text-[#8CCCF0] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3886B8]" />
                <span>2. Wrap Type Asal & Kolom Pengambilan Yard</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pilih kemasan awal pallet yang ingin dikonversi serta tentukan dari kolom mana pallet tersebut diambil.
              </p>
            </div>

            {/* Saldo Stok Fisik Tersedia Badge */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#111E30] border border-[#CBD5E1] dark:border-[#1E3A52] px-3 py-1.5 rounded-lg shrink-0">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Total Stok Asal:</span>
              <span className="text-sm font-bold font-mono text-[#0F172A] dark:text-white tabular-nums">
                {currentSourceStock.toLocaleString()} {unit}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wrap Type Asal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Wrap Type Asal (Kemasan Semula) *
              </label>
              <select
                value={sourcePalletType}
                onChange={(e) => setSourcePalletType(e.target.value)}
                disabled={!isOperator || operatorSchedule.isOff}
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs font-bold focus:outline-none focus:border-[#3886B8] cursor-pointer"
              >
                {palletTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Input Kolom Asal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Kolom Asal (Lokasi Pengambilan Yard) *
              </label>
              <input
                type="text"
                value={kolomAsal}
                onChange={(e) => setKolomAsal(e.target.value.toUpperCase())}
                disabled={!isOperator || operatorSchedule.isOff}
                placeholder="cth: F9, F10, F11..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs font-bold font-mono focus:outline-none focus:border-[#3886B8]"
                required
              />
              {maxStockInSourceCol !== null ? (
                <span className="text-[11px] text-[#16805D] dark:text-emerald-400 font-semibold mt-1 block">
                  Stok di kolom <b>{kolomAsal}</b> saat ini: <b>{maxStockInSourceCol} {unit}</b>
                </span>
              ) : kolomAsal.trim() ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
                  Kolom kustom / baru dipilih
                </span>
              ) : null}
            </div>
          </div>

          {/* Quick Click Kolom-kolom yang Memiliki Stok Ukuran & Wrap Type Ini */}
          {detectedAvailableColumns.length > 0 && (
            <div className="p-3 bg-white dark:bg-[#111E30] border border-[#CBD5E1] dark:border-[#1E3A52] rounded-lg space-y-1.5">
              <span className="text-[11px] font-bold text-[#163653] dark:text-[#8CCCF0] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#3886B8]" />
                <span>Kolom Yard yang Menyimpan Spek {sourcePalletType} Ini:</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {detectedAvailableColumns.map(({ col, qty }) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleSelectKolomAsal(col)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold cursor-pointer transition-all border ${
                      kolomAsal.toUpperCase() === col.toUpperCase()
                        ? 'bg-[#3886B8] text-white border-[#3886B8] shadow-xs scale-102'
                        : 'bg-[#F1F5F9] dark:bg-[#16263B] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#1E3A52] hover:border-[#3886B8]'
                    }`}
                  >
                    <span>{col}:</span>
                    <span className={kolomAsal.toUpperCase() === col.toUpperCase() ? 'text-white font-extrabold' : 'text-[#3886B8] font-extrabold'}>
                      {qty} {unit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Baris Target Wrap Type Baru & Kuantitas */}
        <div className="p-4 bg-[#F8FAFC] dark:bg-[#0B1522] border border-[#CBD5E1] dark:border-[#1E3A52] rounded-xl space-y-4">
          <h2 className="text-xs font-bold text-[#163653] dark:text-[#8CCCF0] uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3886B8]" />
            <span>3. Spesifikasi Baru (Target Perubahan) & Penempatan</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Wrap Type Baru */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Ubah Menjadi Wrap Type *
              </label>
              <select
                value={targetPalletType}
                onChange={(e) => setTargetPalletType(e.target.value)}
                disabled={!isOperator || operatorSchedule.isOff}
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs font-bold focus:outline-none focus:border-[#3886B8] cursor-pointer"
                required
              >
                {targetTypeOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Kuantitas yang Diubah */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Jumlah yang Diubah ({unit}) *
                </label>
                {maxStockInSourceCol !== null && maxStockInSourceCol > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuantity(String(maxStockInSourceCol))}
                    className="text-[11px] font-bold text-[#3886B8] hover:underline cursor-pointer"
                  >
                    Maks Kolom ({maxStockInSourceCol})
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                max={maxStockInSourceCol || currentSourceStock || undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!isOperator || operatorSchedule.isOff}
                placeholder="0"
                className={`w-full px-3 py-2 border rounded-lg text-xs font-bold font-mono text-right focus:outline-none ${
                  isOverTotalStock || isOverColStock
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                    : 'border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white focus:border-[#3886B8]'
                }`}
                required
              />
              {(isOverTotalStock || isOverColStock) && (
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 block">
                  Jumlah melebihi stok yang tersedia!
                </span>
              )}
            </div>

            {/* Kolom Penempatan Hasil Ubah Spek */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Kolom Penempatan Baru *
              </label>
              <input
                type="text"
                value={kolomTujuan}
                onChange={(e) => setKolomTujuan(e.target.value.toUpperCase())}
                disabled={!isOperator || operatorSchedule.isOff}
                placeholder="Sama dengan kolom asal atau ketik baru..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs font-bold font-mono focus:outline-none focus:border-[#3886B8]"
                required
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Default sama dengan kolom asal ({kolomAsal || '-'}), atau ganti jika dipindahkan.
              </span>
            </div>
          </div>

          {/* Catatan Perubahan Spek */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Catatan / No. Perintah Produksi (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isOperator || operatorSchedule.isOff}
              placeholder="cth: Order user mendadak, Instruksi Leadershift Finishing, dll..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-[#1E3A52] bg-white dark:bg-[#111E30] text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-[#3886B8]"
            />
          </div>
        </div>

        {/* 4. Live Simulation Card: Perbandingan Sebelum & Sesudah */}
        {requestedQty > 0 && palletSize.trim() && (
          <div className="p-4 bg-[#8CCCF0]/10 border border-[#8CCCF0]/30 rounded-xl space-y-2.5">
            <div className="text-xs font-bold text-[#163653] dark:text-[#8CCCF0] uppercase tracking-wide flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#3886B8]" />
              <span>Simulasi Perubahan Saldo Stok:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Spek Asal */}
              <div className="p-3 bg-white dark:bg-[#111E30] border border-rose-200 dark:border-rose-900/40 rounded-lg">
                <span className="text-[11px] text-rose-700 dark:text-rose-400 font-bold block uppercase">
                  Spek Asal ({sourcePalletType}):
                </span>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {currentSourceStock} {unit} ➔ <span className="text-rose-600 font-extrabold">{Math.max(0, currentSourceStock - requestedQty)} {unit}</span>
                  <span className="text-xs text-rose-600 font-semibold ml-1.5">(-{requestedQty})</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Diambil dari Kolom <b>{kolomAsal || '-'}</b>
                </div>
              </div>

              {/* Spek Baru */}
              <div className="p-3 bg-white dark:bg-[#111E30] border border-emerald-200 dark:border-emerald-900/40 rounded-lg">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold block uppercase">
                  Spek Baru ({targetPalletType}):
                </span>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {currentTargetStock} {unit} ➔ <span className="text-emerald-600 font-extrabold">{currentTargetStock + requestedQty} {unit}</span>
                  <span className="text-xs text-emerald-600 font-semibold ml-1.5">(+{requestedQty})</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Ditempatkan di Kolom <b>{kolomTujuan || kolomAsal || '-'}</b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setPalletSize('');
              setQuantity('');
              setKolomAsal('');
              setKolomTujuan('');
              setNotes('');
              setStatusMessage(null);
            }}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#16263B] dark:hover:bg-[#1C3652] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Reset Form
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !isOperator || operatorSchedule.isOff || requestedQty <= 0 || isOverTotalStock || isOverColStock}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#3886B8] hover:bg-[#2B6B94] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Memproses Perubahan Spek...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Konfirmasi & Simpan Perubahan Spek</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 5. Riwayat Perubahan Spek Hari Ini (Shift Ini) */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#CBD5E1] dark:border-[#1E3A52] rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CBD5E1] dark:border-[#1E3A52] pb-3">
          <div>
            <h2 className="text-xs font-bold text-[#163653] dark:text-[#8CCCF0] uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#3886B8]" />
              <span>Riwayat Perubahan Spek Hari Ini ({todayChanges.length} Transaksi)</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar transaksi konversi wrap type pallet pada tanggal {date}.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyWA}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#16805D] hover:bg-[#136B4E] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {quickCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{quickCopied ? 'Tersalin!' : 'Salin Laporan WA Perubahan Spek'}</span>
          </button>
        </div>

        {todayChanges.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-[#F8FAFC] dark:bg-[#0B1522] rounded-lg border border-dashed border-slate-300 dark:border-[#1E3A52]">
            Belum ada catatan perubahan spek pallet pada tanggal {date}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1E3A52]">
            {todayChanges.map((t) => (
              <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#163653] dark:text-[#8CCCF0]">
                      {t.transactionNumber}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#8CCCF0]/20 text-[#163653] dark:text-[#8CCCF0]">
                      {t.shift}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">{t.time}</span>
                  </div>

                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    <b className="font-mono">{t.palletSize}</b>
                    <span>{t.marketType} {t.typePallet || 'LS'}:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{t.palletType}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t.targetPalletType || 'Pallet Bulkpack'}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ({t.quantity} {t.unit})
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span>Kolom: <b>{t.pelatakanPallet || '-'}</b> ➔ <b>{t.kolomTujuan || t.pelatakanPallet || '-'}</b></span>
                    <span>&middot;</span>
                    <span>Petugas: <b>{t.operator}</b></span>
                    {t.notes && (
                      <>
                        <span>&middot;</span>
                        <span className="italic">Ket: &ldquo;{t.notes}&rdquo;</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

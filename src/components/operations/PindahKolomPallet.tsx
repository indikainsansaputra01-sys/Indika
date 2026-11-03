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
  Eye,
  MapPin,
  Boxes,
  Share2,
  Layers,
  ArrowRight,
  Info,
  Shield,
  Lock
} from 'lucide-react';
import { ShiftType, MarketType, QuantityUnit, PalletSideType, Transaction } from '../../types';
import { formatIndoDate } from '../../utils/shiftReportUtils';
import { getAvailableColumnsForPallet } from '../../utils/stockLocationUtils';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import { copyTextToClipboard } from '../../utils/whatsappReportUtils';
import { getOperatorShiftForDate } from '../../utils/rosterUtils';

export const PindahKolomPallet: React.FC = () => {
  const {
    currentUser,
    addTransaction,
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
  const [palletType, setPalletType] = useState('Pallet Reamwrap');
  const [typePallet, setTypePallet] = useState<PalletSideType>('LS');
  const [unit, setUnit] = useState<QuantityUnit>('Set');

  // Kolom Asal & Kolom Tujuan
  const [kolomAsal, setKolomAsal] = useState('');
  const [kolomTujuan, setKolomTujuan] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // Operator yang memindahkan otomatis terkunci sesuai akun karyawan yang sedang login
  const operator = useMemo(() => {
    return currentUser?.name || 'Indika';
  }, [currentUser]);

  // Otomatis sinkronisasi Shift sesuai Roster Resmi Pabrik (12-Hari / 4-Grup)
  const operatorSchedule = useMemo(() => {
    return getOperatorShiftForDate(operator, date);
  }, [operator, date]);

  // Shift terkunci otomatis sesuai jadwal operator pada tanggal terpilih
  const shift = useMemo<ShiftType>(() => {
    return (operatorSchedule.isOff ? 'Shift 1' : operatorSchedule.shiftLabel) as ShiftType;
  }, [operatorSchedule]);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);

  const primaryOperators = ['Indika', 'Agus', 'Harun', 'Riffky'];

  // Pilihan Jenis Pallet
  const palletTypes = useMemo(() => {
    const list = (masterTypes || []).filter(m => m.active).map(m => m.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);

  // Total stok terpusat di pabrik untuk ukuran & spek ini
  const totalPhysicalStock = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize || !palletType) return 0;
    return getStock(cleanSize, palletType, marketType, unit, typePallet);
  }, [palletSize, palletType, marketType, unit, typePallet, getStock]);

  // Kolom yang saat ini menyimpan stok ukuran ini
  const detectedAvailableColumns = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) return [];
    return getAvailableColumnsForPallet({
      transactions,
      palletSize: cleanSize,
      palletType,
      typePallet,
      unit,
      marketType
    });
  }, [palletSize, palletType, typePallet, unit, marketType, transactions]);

  // Stok yang tersedia di Kolom Asal yang dipilih
  const maxStockInSourceCol = useMemo(() => {
    if (!kolomAsal.trim()) return null;
    const match = detectedAvailableColumns.find(
      c => c.col.toUpperCase() === kolomAsal.trim().toUpperCase()
    );
    return match ? match.qty : null;
  }, [detectedAvailableColumns, kolomAsal]);

  // Riwayat transaksi relokasi hari ini
  const todayRelocations = useMemo(() => {
    return transactions.filter(
      t => t.transactionType === 'PINDAH_KOLOM' && t.date === date
    );
  }, [transactions, date]);

  // Teks WA Laporan Relokasi Shift
  const generateWaRelokasiText = (): string => {
    const currentShiftRelocations = todayRelocations.filter(t => t.shift === shift);
    const lines = [
      `*LAPORAN RELOKASI / PINDAH KOLOM PALLET*`,
      `PT Indah Kiat Pulp & Paper Tbk - Finish Pallet`,
      `Tanggal: ${date} (${shift})`,
      `Petugas: ${operator}`,
      `Total Relokasi: ${currentShiftRelocations.length} Aktivitas`,
      `------------------------------------`
    ];

    if (currentShiftRelocations.length === 0) {
      lines.push(`(Belum ada catatan pemindahan kolom pada shift ini)`);
    } else {
      currentShiftRelocations.forEach((t, idx) => {
        lines.push(
          `${idx + 1}. *${t.palletSize}* ${t.marketType === 'Ekspor' ? 'E' : 'L'} ${t.typePallet || 'LS'} : *${t.quantity} ${t.unit}*` +
          `\n   ↳ Dari *${t.pelatakanPallet || '-'}* ➔ Pindah ke *${t.kolomTujuan || '-'}*` +
          `${t.notes ? ` (${t.notes})` : ''}`
        );
      });
    }

    lines.push(`------------------------------------`);
    lines.push(`*Catatan:* Pemindahan internal tidak merubah jumlah total stok.`);
    return lines.join('\n');
  };

  const handleCopyWA = async () => {
    const ok = await copyTextToClipboard(generateWaRelokasiText());
    if (ok) {
      setQuickCopied(true);
      showNotification('success', 'Teks WA Relokasi Disalin!', 'Rangkuman pemindahan kolom siap dibagikan ke WhatsApp.');
      setTimeout(() => setQuickCopied(false), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!isOperator) {
      setStatusMessage({
        type: 'error',
        text: `Akses Terbatas: Akun Anda (${currentUser?.name}) berada dalam mode Monitoring. Hanya Operator (Indika, Agus, Harun, Riffky) yang dapat memindahkan pallet.`
      });
      return;
    }

    if (operatorSchedule.isOff) {
      setStatusMessage({
        type: 'error',
        text: `Penginputan Ditolak: Anda (${operator}) dijadwalkan LIBUR (OFF) pada ${formatIndoDate(date)} sesuai jadwal roster pabrik. Pemindahan kolom tidak dapat disimpan pada hari libur.`
      });
      return;
    }

    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) {
      setStatusMessage({ type: 'error', text: 'Ukuran pallet wajib diisi!' });
      return;
    }

    const cleanAsal = kolomAsal.trim().toUpperCase();
    const cleanTujuan = kolomTujuan.trim().toUpperCase();

    if (!cleanAsal) {
      setStatusMessage({ type: 'error', text: 'Kolom Asal (tempat pallet saat ini) wajib diisi!' });
      return;
    }

    if (!cleanTujuan) {
      setStatusMessage({ type: 'error', text: 'Kolom Tujuan (tempat pallet dipindahkan) wajib diisi!' });
      return;
    }

    if (cleanAsal === cleanTujuan) {
      setStatusMessage({
        type: 'error',
        text: 'Kolom Tujuan tidak boleh sama dengan Kolom Asal! Pallet harus dipindahkan ke kolom yang berbeda.'
      });
      return;
    }

    const qtyNumber = parseInt(quantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setStatusMessage({ type: 'error', text: 'Jumlah pallet yang dipindahkan harus lebih dari 0!' });
      return;
    }

    // Validasi stok kolom asal jika terdeteksi
    if (maxStockInSourceCol !== null && qtyNumber > maxStockInSourceCol) {
      setStatusMessage({
        type: 'error',
        text: `Stok tidak cukup: Di ${cleanAsal} hanya terdapat ${maxStockInSourceCol} ${unit}. Tidak bisa memindahkan ${qtyNumber} ${unit}!`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addTransaction({
        transactionType: 'PINDAH_KOLOM',
        date,
        time: getShiftTime(shift),
        palletSize: cleanSize,
        palletType,
        typePallet,
        customer: `Relokasi Internal (${cleanAsal} ➔ ${cleanTujuan})`,
        shift,
        marketType,
        quantity: qtyNumber,
        unit,
        pelatakanPallet: cleanAsal,
        kolomTujuan: cleanTujuan,
        operator,
        notes: notes.trim() ? `[Pindah Kolom] ${notes.trim()}` : `Relokasi dari ${cleanAsal} ke ${cleanTujuan}`
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Relokasi berhasil disimpan! Pallet ${cleanSize} sebanyak ${qtyNumber} ${unit} berhasil dipindahkan dari ${cleanAsal} ke ${cleanTujuan}. Total stok pabrik tetap: ${res.currentStock} ${unit}.`
        });
        // Clear quantity & locations for next move
        setQuantity('');
        setKolomAsal('');
        setKolomTujuan('');
        setNotes('');
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Terjadi kendala saat menyimpan ke database: ' + (err.message || String(err))
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#3886B8] text-white">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              FORM PINDAH KOLOM (RELOKASI PALLET)
            </h1>
          </div>
          <p className="text-xs text-[#8CCCF0] mt-1 font-medium">
            Mencatat perpindahan fisik pallet antar kolom di gudang. Total stok terpusat tetap sama persis (net 0).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyWA}
            className="px-3.5 py-1.5 bg-[#3886B8] hover:bg-[#2D739E] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Salin Rangkuman Pemindahan Kolom untuk WhatsApp"
          >
            {quickCopied ? <Check className="w-3.5 h-3.5 text-[#8CCCF0]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{quickCopied ? 'Tersalin!' : `Salin WA Relokasi (${shift})`}</span>
          </button>
          <span className="text-xs font-mono bg-[#112B43] text-[#8CCCF0] border border-[#1E4366] px-2.5 py-1 rounded hidden sm:inline-block font-semibold">
            RELOKASI
          </span>
        </div>
      </div>

      {/* Mode Monitoring Warning */}
      {!isOperator && (
        <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-lg text-xs text-blue-900 flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <b>Mode Monitoring:</b> Anda masuk sebagai <b>{currentUser?.name}</b> ({currentUser?.title}). Perpindahan pallet fisik hanya dapat dicatat oleh 4 Operator (Indika, Agus, Harun, Riffky).
          </div>
        </div>
      )}

      {/* Status Message Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold">
              {statusMessage.type === 'success' ? '✓ RELOKASI BERHASIL DISIMPAN' : '❌ KENDALA PENYIMPANAN'}
            </div>
            <div>{statusMessage.text}</div>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl p-5 sm:p-6 shadow-2xs">
        {/* Roster Shift Banner (Auto-Sync) */}
        {operatorSchedule.isOff ? (
          <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-sm text-rose-950 flex items-center gap-2">
                <span>RELOKASI DIKUNCI: ANDA SEDANG LIBUR / OFF</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-200 text-rose-900 font-bold uppercase">
                  SOP Roster Pabrik
                </span>
              </div>
              <div>
                Akun Anda: <b>{operator}</b> ({operatorSchedule.group ? `Grup ${operatorSchedule.group}` : ''}) terjadwal <b>LIBUR (OFF)</b> pada tanggal <b>{formatIndoDate(date)}</b>.
              </div>
              <div className="text-rose-700">
                Sesuai jadwal roster kerja resmi pabrik, operator yang sedang libur tidak dapat mencatat pemindahan kolom. Tombol simpan dinonaktifkan dan operator terkunci otomatis ke akun login Anda.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-md bg-blue-50/80 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2">
              <Clock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                Jadwal Roster Terdeteksi: <span className="font-bold text-blue-900">{operatorSchedule.shiftLabel}</span> · Operator: <span className="font-bold text-blue-900">{operator}</span> ({operatorSchedule.group ? `Grup ${operatorSchedule.group}` : ''}) · <span className="text-blue-800 font-medium">{operatorSchedule.phaseDescription}</span> pada {formatIndoDate(date)}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-blue-700 text-white shadow-2xs shrink-0">
              <Lock className="w-3 h-3" />
              Shift Terkunci Otomatis
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Tanggal, Shift, Operator */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Tanggal</span>
                {date !== todayStr && (
                  <span className="text-[10px] text-amber-700 font-semibold">(Manual)</span>
                )}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!isOperator}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Shift Relokasi</span>
                <span className="text-[10px] text-blue-700 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Terkunci Roster
                </span>
              </label>
              <div
                className={`w-full px-3 py-2 border rounded text-xs font-bold flex items-center justify-between ${
                  operatorSchedule.isOff
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-blue-50/80 border-blue-300 text-blue-900'
                }`}
                title="Shift relokasi terkunci otomatis mengikuti kalender roster operator untuk mencegah salah input"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span>{operatorSchedule.isOff ? 'SEDANG LIBUR / OFF' : operatorSchedule.shiftLabel}</span>
                </div>
                <span className="text-[11px] font-normal opacity-80 truncate ml-1">
                  {operatorSchedule.phaseDescription}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Operator yang Memindahkan</span>
                <span className="text-[10px] text-blue-800 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Terkunci Akun Login
                </span>
              </label>
              <div
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold bg-slate-100 text-slate-900 flex items-center justify-between shadow-2xs"
                title={`Operator yang memindahkan terkunci otomatis sesuai akun login Anda (${operator}) untuk mematuhi roster kerja pabrik`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="font-extrabold text-slate-900">{operator}</span>
                  {operatorSchedule.group && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                      Grup {operatorSchedule.group}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {currentUser?.role === 'operator' ? 'Operator' : currentUser?.title || 'Monitoring'}
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Ukuran Pallet (Ketik Sendiri) + Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ukuran Pallet yang Dipindahkan *
              </label>
              {palletSize.trim() && (
                <span className="text-xs text-slate-600">
                  Total Stok Pabrik: <b className="text-slate-900 font-mono">{totalPhysicalStock} {unit}</b>
                </span>
              )}
            </div>
            <input
              type="text"
              value={palletSize}
              onChange={(e) => setPalletSize(e.target.value)}
              onBlur={() => {
                if (palletSize.trim()) {
                  setPalletSize(normalizePalletDimension(palletSize));
                }
              }}
              disabled={!isOperator}
              placeholder="Ketik ukuran pallet (cth: 72x102, 63x88, 81x111, 82x82, 115x140)..."
              list="sizes-datalist"
              className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-blue-600 placeholder-slate-400 font-medium disabled:bg-slate-100"
              required
              autoFocus={isOperator}
            />
            <datalist id="sizes-datalist">
              {masterSizes.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
              <span className="font-medium text-slate-500">Pilihan Cepat:</span>
              {['72x102', '63x88', '81x111', '82x82', '67x102', '92x122', '115x140'].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setPalletSize(quick)}
                  className="px-2 py-0.5 border rounded text-[11px] font-mono cursor-pointer disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Spesifikasi (1. Region, 2. Wrap Type, 3. Pallet Runners, 4. Satuan) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            {/* 1. Region (Lokal / Ekspor) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Region *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setMarketType('Lokal')}
                  className={`py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    marketType === 'Lokal'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Lokal
                </button>
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setMarketType('Ekspor')}
                  className={`py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    marketType === 'Ekspor'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Ekspor
                </button>
              </div>
            </div>

            {/* 2. Wrap Type: 1-Click Button Selection (RW, BP, RCK, SRKLS) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Wrap Type *</span>
                <span className="text-[10px] text-blue-800 font-bold normal-case">Tinggal Klik</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { code: 'RW', label: 'REAMWRAP', fullName: 'Pallet Reamwrap' },
                  { code: 'BP', label: 'BULKPACK', fullName: 'Pallet Bulkpack' },
                  { code: 'RCK', label: 'RACUK', fullName: 'Pallet Racuk' },
                  { code: 'SRKLS', label: 'SIRKULASI', fullName: 'Pallet Sirkulasi' }
                ].map((item) => {
                  const isSelected =
                    palletType === item.fullName ||
                    palletType.toLowerCase().includes(item.label.toLowerCase()) ||
                    palletType.toUpperCase() === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      disabled={!isOperator}
                      onClick={() => setPalletType(item.fullName)}
                      className={`py-1 px-1 rounded border transition-colors cursor-pointer text-center flex flex-col items-center justify-center leading-tight ${
                        isSelected
                          ? 'bg-blue-700 text-white border-blue-700 shadow-xs font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 font-semibold'
                      }`}
                      title={item.fullName}
                    >
                      <span className="text-xs font-black tracking-wide">{item.code}</span>
                      <span className="text-[9px] font-medium opacity-90 tracking-tight">
                        ( {item.label} )
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Pallet Runners (LS / SS) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Pallet Runners *</span>
                <span className="text-[10px] text-slate-500 font-semibold lowercase">LS / SS</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setTypePallet('LS')}
                  className={`py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    typePallet === 'LS'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="LS = Long Side"
                >
                  LS (Long Side)
                </button>
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setTypePallet('SS')}
                  className={`py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    typePallet === 'SS'
                      ? 'bg-purple-700 text-white border-purple-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="SS = Short Side"
                >
                  SS (Short Side)
                </button>
              </div>
            </div>

            {/* 4. Satuan (Set / Pcs) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Satuan *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setUnit('Set')}
                  className={`py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    unit === 'Set'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Set
                </button>
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setUnit('Pcs')}
                  className={`py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    unit === 'Pcs'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Pcs
                </button>
              </div>
            </div>
          </div>

          {/* DETEKSI KOLOM ASAL YANG MEMILIKI STOK */}
          {palletSize.trim() && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                  <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Deteksi Kolom Asal (Klik untuk memilih asal pemindahan):</span>
                </div>
                <span className="text-[11px] text-blue-800 font-medium">
                  {detectedAvailableColumns.length} kolom terdeteksi
                </span>
              </div>

              {detectedAvailableColumns.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-2 bg-white rounded border border-dashed border-slate-300">
                  Belum ada riwayat stok terdeteksi di kolom manapun untuk ukuran ini. Anda dapat tetap mengetik nama kolom asal secara manual di bawah.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {detectedAvailableColumns.map((c) => {
                    const isSelected = kolomAsal.toUpperCase() === c.col.toUpperCase();
                    return (
                      <button
                        key={c.col}
                        type="button"
                        onClick={() => {
                          setKolomAsal(c.col);
                          // Suggest entire qty by default if empty
                          if (!quantity) setQuantity(String(c.qty));
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white hover:bg-blue-100/60 text-slate-800 border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold flex items-center justify-between">
                          <span>{c.col}</span>
                          {isSelected && <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded">Terpilih</span>}
                        </div>
                        <div className={`text-[11px] mt-0.5 font-mono ${isSelected ? 'text-blue-100' : 'text-slate-600'}`}>
                          Tersedia: <b>{c.qty}</b> {unit}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Row 4: Dari Kolom Asal ➔ Pindah ke Kolom Tujuan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            {/* Kolom Asal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>1. Dari Kolom Asal *</span>
                {maxStockInSourceCol !== null && (
                  <span className="text-xs text-blue-700 font-bold font-mono">
                    Stok Kolom: {maxStockInSourceCol} {unit}
                  </span>
                )}
              </label>
              <input
                type="text"
                value={kolomAsal}
                onChange={(e) => setKolomAsal(e.target.value)}
                disabled={!isOperator}
                placeholder="Ketik atau pilih kolom asal (cth: F14, A2, Bay 1)..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-600 uppercase bg-white disabled:bg-slate-100"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Lokasi tempat pallet saat ini diletakkan di yard.
              </p>
            </div>

            {/* Kolom Tujuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5 text-blue-800">
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                <span>2. Pindah ke Kolom Tujuan *</span>
              </label>
              <input
                type="text"
                value={kolomTujuan}
                onChange={(e) => setKolomTujuan(e.target.value)}
                disabled={!isOperator}
                placeholder="Ketik kolom baru tujuan pemindahan (cth: B03, F11, G1)..."
                className="w-full px-3 py-2.5 border border-blue-400 rounded text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-600 uppercase bg-blue-50/30 disabled:bg-slate-100"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Lokasi baru tempat forklift memindahkan tumpukan pallet.
              </p>
            </div>
          </div>

          {/* Row 5: Jumlah yang Dipindahkan (Quantity) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Jumlah Pallet yang Dipindahkan ({unit}) *
              </label>
              {maxStockInSourceCol !== null && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Cepat:</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(String(maxStockInSourceCol))}
                    className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded text-[11px] cursor-pointer"
                  >
                    Pindah Semua ({maxStockInSourceCol})
                  </button>
                  {maxStockInSourceCol > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuantity(String(Math.floor(maxStockInSourceCol / 2)))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-[11px] cursor-pointer"
                    >
                      Setengah ({Math.floor(maxStockInSourceCol / 2)})
                    </button>
                  )}
                </div>
              )}
            </div>
            <input
              type="number"
              min="1"
              max={maxStockInSourceCol !== null ? maxStockInSourceCol : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!isOperator}
              placeholder={`Masukkan jumlah ${unit} yang dipindahkan...`}
              className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
              required
            />
          </div>

          {/* Row 6: Alasan / Catatan Pemindahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Alasan Pemindahan / Catatan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isOperator}
              placeholder="Contoh: Penataan ruang jalur forklift, pemisahan pesanan ekspor..."
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
              <span>Alasan Cepat:</span>
              {[
                'Penataan ruang jalur forklift',
                'Pemisahan tumpukan ekspor',
                'Beri ruang produksi baru',
                'Konsolidasi kolom kosong'
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setNotes(reason)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPalletSize('');
                setKolomAsal('');
                setKolomTujuan('');
                setQuantity('');
                setNotes('');
                setStatusMessage(null);
              }}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Bersihkan Form</span>
            </button>

            <button
              type="submit"
              disabled={!isOperator || isSubmitting || operatorSchedule.isOff}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed active:scale-98"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>
                {operatorSchedule.isOff
                  ? 'Ditolak (Anda Sedang Libur / OFF)'
                  : isSubmitting
                  ? 'Menyimpan Pemindahan...'
                  : 'Simpan Pindah Kolom'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Daftar Riwayat Relokasi Terkini (Hari Ini) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-blue-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Riwayat Relokasi Tanggal Ini ({date})
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {todayRelocations.length} aktivitas
          </span>
        </div>

        {todayRelocations.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 italic">
            Belum ada aktivitas pemindahan kolom yang tercatat untuk tanggal {date}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Ukuran Pallet</th>
                  <th className="py-2.5 px-3">Pallet Runners</th>
                  <th className="py-2.5 px-3">Perpindahan Kolom</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayRelocations.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-700">
                      <div>{t.time || '-'}</div>
                      <div className="text-[10px] text-blue-700 font-semibold">{t.shift}</div>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {t.palletSize}
                      <span className="text-[10px] text-slate-500 font-normal ml-1">
                        ({t.marketType})
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {t.typePallet || 'LS'}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-bold">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono text-xs">
                        <span>{t.pelatakanPallet || '-'}</span>
                        <ArrowRight className="w-3 h-3 text-blue-600" />
                        <span className="text-emerald-700">{t.kolomTujuan || '-'}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-800 whitespace-nowrap">
                      {t.quantity.toLocaleString('id-ID')} {t.unit}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {t.operator}
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-[11px] max-w-[200px] truncate">
                      {t.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

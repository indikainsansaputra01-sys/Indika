import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Save,
  RotateCcw,
  AlertTriangle,
  Eye,
  MessageSquare,
  Copy,
  Check,
  Share2,
  Sparkles,
  Shield,
  Lock
} from 'lucide-react';
import { ShiftType, MarketType, QuantityUnit, PalletSideType } from '../../types';
import {
  generateWhatsAppPenerimaanText,
  copyTextToClipboard
} from '../../utils/whatsappReportUtils';
import { SalinLaporanWAModal } from '../common/SalinLaporanWAModal';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import { formatIndoDate } from '../../utils/shiftReportUtils';
import { getOperatorShiftForDate } from '../../utils/rosterUtils';

export const PenerimaanPallet: React.FC = () => {
  const {
    currentUser,
    activeShift,
    addTransaction,
    masterSizes,
    masterTypes,
    masterCustomers,
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

  const [date, setDate] = useState(todayStr);
  // FREE TEXT INPUT AS REQUESTED:
  const [palletSize, setPalletSize] = useState('');
  const [customer, setCustomer] = useState('');
  // 3 JENIS PALLET SAJA
  const [palletType, setPalletType] = useState('Pallet Reamwrap');
  // TYPE PALLET: LS (Long Side) atau SS (Short Side)
  const [typePallet, setTypePallet] = useState<PalletSideType>('LS');
  const [marketType, setMarketType] = useState<MarketType>('Lokal');
  const [quantity, setQuantity] = useState<string>('');
  // PILIHAN SATUAN: SET ATAU PCS
  const [unit, setUnit] = useState<QuantityUnit>('Set');
  // KOLOM PELATAKAN PALLET (ISI MANUAL SAJA)
  const [pelatakanPallet, setPelatakanPallet] = useState('');
  // Operator bertugas otomatis terkunci sesuai akun karyawan yang sedang login
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
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWAModal, setShowWAModal] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);

  // Modal Konfirmasi Satuan Pallet Khusus (Mencegah salah input PCS vs SET)
  const [unitConfirmModal, setUnitConfirmModal] = useState<{
    isOpen: boolean;
    question: string;
    targetUnit: QuantityUnit;
    recommendedUnit: QuantityUnit;
    palletType: string;
    explanation: string;
    actionAfterConfirm?: 'switch-unit' | 'submit';
  } | null>(null);

  // Menyimpan kombinasi wrap type + satuan yang telah dikonfirmasi 'Yakin' oleh user
  const [confirmedUnitCombo, setConfirmedUnitCombo] = useState<string | null>(null);

  // Live WA text for current selected date & shift
  const liveWAText = useMemo(() => {
    return generateWhatsAppPenerimaanText({
      transactions,
      date,
      shift,
      includeTotal: true
    });
  }, [transactions, date, shift]);

  const todayShiftTxCount = useMemo(() => {
    return transactions.filter(t => t.transactionType === 'PENERIMAAN' && t.date === date && t.shift === shift).length;
  }, [transactions, date, shift]);

  const handleQuickCopyWA = async () => {
    const ok = await copyTextToClipboard(liveWAText);
    if (ok) {
      setQuickCopied(true);
      showNotification('success', 'Teks WA Berhasil Disalin!', 'Format laporan hasil produksi siap ditempel ke grup WhatsApp.');
      setTimeout(() => setQuickCopied(false), 2500);
    }
  };

  // 4 Operator utama
  const primaryOperators = ['Indika', 'Agus', 'Harun', 'Riffky'];

  // Pilihan Jenis Pallet Resmi
  const palletTypes = useMemo(() => {
    const list = (masterTypes || []).filter(m => m.active).map(m => m.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);

  // Helper deteksi wrap type
  const isReamwrapOrBulkpack = (type: string) => {
    const l = (type || '').toLowerCase();
    return l.includes('reamwrap') || l.includes('bulkpack') || l === 'rw' || l === 'bp';
  };

  const isRacukOrSirkulasi = (type: string) => {
    const l = (type || '').toLowerCase();
    return l.includes('racuk') || l.includes('sirkulasi') || l === 'rck' || l === 'srkls';
  };

  // Helper validasi apakah satuan yang dipilih berpotensi salah (Permintaan User: RW/BP harus Set, RCK/SRKLS harus Pcs)
  const getUnitMismatchedInfo = (type: string, u: QuantityUnit) => {
    if (isReamwrapOrBulkpack(type) && u === 'Pcs') {
      return {
        isMismatched: true,
        question: 'Apakah anda yakin satuan nya PCS?',
        targetUnit: 'Pcs' as QuantityUnit,
        recommendedUnit: 'Set' as QuantityUnit,
        explanation: 'Wrap type Reamwrap dan Bulkpack umumnya menggunakan satuan SET. Mohon pastikan kembali data dari produksi apakah benar bersatuan PCS.'
      };
    }
    if (isRacukOrSirkulasi(type) && u === 'Set') {
      return {
        isMismatched: true,
        question: 'Apakah anda yakin satuannya SET?',
        targetUnit: 'Set' as QuantityUnit,
        recommendedUnit: 'Pcs' as QuantityUnit,
        explanation: 'Wrap type Racuk dan Sirkulasi umumnya menggunakan satuan PCS. Mohon pastikan kembali data dari produksi apakah benar bersatuan SET.'
      };
    }
    return {
      isMismatched: false,
      question: '',
      targetUnit: u,
      recommendedUnit: u,
      explanation: ''
    };
  };

  // Saat memilih satuan Set / Pcs pada form
  const handleSelectUnit = (targetUnit: QuantityUnit) => {
    if (targetUnit === unit) return;

    const mismatch = getUnitMismatchedInfo(palletType, targetUnit);
    if (mismatch.isMismatched) {
      // Munculkan notifikasi konfirmasi terlebih dahulu
      setUnitConfirmModal({
        isOpen: true,
        question: mismatch.question,
        targetUnit: mismatch.targetUnit,
        recommendedUnit: mismatch.recommendedUnit,
        palletType,
        explanation: mismatch.explanation,
        actionAfterConfirm: 'switch-unit'
      });
    } else {
      setUnit(targetUnit);
      setConfirmedUnitCombo(null);
    }
  };

  // Saat memilih wrap type (otomatis sesuaikan default satuan standar)
  const handleSelectPalletType = (newType: string) => {
    setPalletType(newType);
    // Otomatis sesuaikan satuan standar agar operator tidak perlu repot:
    // Reamwrap / Bulkpack -> default SET
    // Racuk / Sirkulasi -> default PCS
    if (isReamwrapOrBulkpack(newType) && unit === 'Pcs' && confirmedUnitCombo !== `${newType}_Pcs`) {
      setUnit('Set');
      setConfirmedUnitCombo(null);
    } else if (isRacukOrSirkulasi(newType) && unit === 'Set' && confirmedUnitCombo !== `${newType}_Set`) {
      setUnit('Pcs');
      setConfirmedUnitCombo(null);
    }
  };

  // Modal konfirmasi satuan: Saat user klik "Ya, Saya Yakin"
  const handleConfirmUnitModal = async () => {
    if (!unitConfirmModal) return;
    const targetUnit = unitConfirmModal.targetUnit;
    const action = unitConfirmModal.actionAfterConfirm;
    const comboKey = `${unitConfirmModal.palletType}_${targetUnit}`;

    setUnit(targetUnit);
    setConfirmedUnitCombo(comboKey);
    setUnitConfirmModal(null);

    if (action === 'submit') {
      await executeSubmit(targetUnit);
    } else {
      showNotification('info', 'Satuan Dikonfirmasi', `Satuan ${targetUnit} untuk ${unitConfirmModal.palletType} telah dikonfirmasi yakin.`);
    }
  };

  // Modal konfirmasi satuan: Saat user klik "Bukan, Ganti ke [Standar]"
  const handleCancelUnitModal = () => {
    if (!unitConfirmModal) return;
    const recUnit = unitConfirmModal.recommendedUnit;
    setUnit(recUnit);
    setConfirmedUnitCombo(null);
    setUnitConfirmModal(null);
    showNotification('info', 'Satuan Disesuaikan', `Satuan disesuaikan menjadi standar ${recUnit}.`);
  };

  const executeSubmit = async (overrideUnit?: QuantityUnit) => {
    const finalUnit = overrideUnit || unit;
    const qtyNumber = parseInt(quantity, 10);
    const cleanSize = normalizePalletDimension(palletSize);

    setIsSubmitting(true);
    try {
      const res = await addTransaction({
        transactionType: 'PENERIMAAN',
        date,
        time: getShiftTime(shift),
        palletSize: cleanSize,
        palletType,
        typePallet,
        customer: customer.trim(),
        shift,
        marketType,
        quantity: qtyNumber,
        unit: finalUnit,
        pelatakanPallet: pelatakanPallet.trim(),
        operator,
        notes: notes.trim()
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Penerimaan pallet berhasil disimpan ke cloud. Sisa stok ${cleanSize} (${typePallet} - ${palletType} - ${marketType} - ${finalUnit}) saat ini: ${res.currentStock} ${finalUnit}.`
        });
        showNotification('success', 'Penerimaan Disimpan', `${cleanSize} ${finalUnit} ${palletType} berhasil dicatat.`);
        // Retain date, shift, operator for continuous rapid entry
        setPalletSize('');
        setCustomer('');
        setQuantity('');
        setPelatakanPallet('');
        setNotes('');
        setConfirmedUnitCombo(null);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Terjadi kendala saat menyimpan ke database cloud: ' + (err.message || String(err)) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!isOperator) {
      setStatusMessage({
        type: 'error',
        text: `Akses Terbatas: Akun Anda (${currentUser?.name} - ${currentUser?.title}) berada dalam mode Monitoring. Hanya Operator (Indika, Agus, Harun, Riffky) yang dapat menyimpan penerimaan.`
      });
      return;
    }

    if (operatorSchedule.isOff) {
      setStatusMessage({
        type: 'error',
        text: `Penginputan Ditolak: Operator ${operator} dijadwalkan LIBUR (OFF) pada ${formatIndoDate(date)} sesuai jadwal roster pabrik. Transaksi tidak dapat disimpan pada hari libur.`
      });
      return;
    }

    const qtyNumber = parseInt(quantity, 10);
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) {
      setStatusMessage({ type: 'error', text: 'Ukuran pallet wajib diketik!' });
      return;
    }
    if (!customer.trim()) {
      setStatusMessage({ type: 'error', text: 'Nama User/Tujuan wajib diketik!' });
      return;
    }
    if (!pelatakanPallet.trim()) {
      setStatusMessage({ type: 'error', text: 'Kolom peletakan pallet wajib diisi (contoh: A1, B2, C15, F11, dll)!' });
      return;
    }
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setStatusMessage({ type: 'error', text: 'Quantity harus lebih besar dari 0!' });
      return;
    }

    // VALIDASI SATUAN KHUSUS (PERMINTAAN USER):
    // 1. Reamwrap / Bulkpack dengan satuan PCS -> Konfirmasi "Apakah anda yakin satuan nya PCS?"
    // 2. Racuk / Sirkulasi dengan satuan SET -> Konfirmasi "Apakah anda yakin satuannya SET?"
    const mismatch = getUnitMismatchedInfo(palletType, unit);
    const comboKey = `${palletType}_${unit}`;
    if (mismatch.isMismatched && confirmedUnitCombo !== comboKey) {
      setUnitConfirmModal({
        isOpen: true,
        question: mismatch.question,
        targetUnit: mismatch.targetUnit,
        recommendedUnit: mismatch.recommendedUnit,
        palletType,
        explanation: mismatch.explanation,
        actionAfterConfirm: 'submit'
      });
      return;
    }

    await executeSubmit();
  };

  const handleResetForm = () => {
    setPalletSize('');
    setCustomer('');
    setQuantity('');
    setPelatakanPallet('');
    setNotes('');
    setConfirmedUnitCombo(null);
    setStatusMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#16805D] text-white">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              FORM PENERIMAAN PALLET DARI PRODUKSI
            </h1>
          </div>
          <p className="text-xs text-[#8CCCF0] mt-1 font-medium">
            Pencatatan pallet hasil produksi. Ukuran dan User dapat diketik bebas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWAModal(true)}
            className="px-3.5 py-1.5 bg-[#16805D] hover:bg-[#136B4E] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Buka & Salin Format Laporan WhatsApp Hasil Produksi"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Salin Teks WA ({shift})</span>
          </button>
          <span className="text-xs font-mono bg-[#112B43] text-[#8CCCF0] border border-[#1E4366] px-2.5 py-1 rounded hidden sm:inline-block font-semibold">
            INCOMING
          </span>
        </div>
      </div>

      {/* Monitoring Only Warning Banner */}
      {!isOperator && (
        <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-lg text-xs text-blue-900 flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <b>Mode Monitoring:</b> Anda masuk sebagai <b>{currentUser?.name}</b> ({currentUser?.title}). Anda hanya memiliki hak akses untuk memantau data. Entri dan edit data transaksi khusus dilakukan oleh 4 Operator (Indika, Agus, Harun, Riffky).
          </div>
        </div>
      )}

      {/* Feedback banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg border text-xs font-medium flex flex-col gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                {statusMessage.type === 'success' ? '✓ TRANSAKSI BERHASIL DISIMPAN' : 'PERHATIAN'}
              </div>
              <div>{statusMessage.text}</div>
            </div>
          </div>

          {/* Quick WA Copy Button directly inside success notification */}
          {statusMessage.type === 'success' && (
            <div className="mt-1 pt-2.5 border-t border-emerald-200/80 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleQuickCopyWA}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                {quickCopied ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{quickCopied ? 'Teks WA Tersalin!' : `Salin Teks WA (${shift})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWAModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Buka / Edit Format WA</span>
              </button>
              <span className="text-[11px] text-emerald-700 font-medium">
                Siap dikirim ke grup WhatsApp pengiriman
              </span>
            </div>
          )}
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
                <span>PENGINPUTAN DIKUNCI: ANDA SEDANG LIBUR / OFF</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-200 text-rose-900 font-bold uppercase">
                  SOP Roster Pabrik
                </span>
              </div>
              <div>
                Akun Anda: <b>{operator}</b> ({operatorSchedule.group ? `Grup ${operatorSchedule.group}` : ''}) terjadwal <b>LIBUR (OFF)</b> pada tanggal <b>{formatIndoDate(date)}</b>.
              </div>
              <div className="text-rose-700">
                Sesuai jadwal roster kerja resmi pabrik, operator yang sedang libur tidak dapat mencatat penerimaan. Tombol simpan dinonaktifkan dan operator terkunci otomatis ke akun login Anda.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-md bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                Jadwal Roster Terdeteksi: <span className="font-bold text-emerald-900">{operatorSchedule.shiftLabel}</span> · Operator: <span className="font-bold text-emerald-900">{operator}</span> ({operatorSchedule.group ? `Grup ${operatorSchedule.group}` : ''}) · <span className="text-emerald-800 font-medium">{operatorSchedule.phaseDescription}</span> pada {formatIndoDate(date)}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-700 text-white shadow-2xs shrink-0">
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
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-600 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Shift Produksi</span>
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Terkunci Roster
                </span>
              </label>
              <div
                className={`w-full px-3 py-2 border rounded text-xs font-bold flex items-center justify-between ${
                  operatorSchedule.isOff
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                }`}
                title="Shift terkunci otomatis mengikuti kalender roster operator untuk mencegah salah input"
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
                <span>Operator Bertugas</span>
                <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Terkunci Akun Login
                </span>
              </label>
              <div
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold bg-slate-100 text-slate-900 flex items-center justify-between shadow-2xs"
                title={`Operator bertugas terkunci otomatis sesuai akun login Anda (${operator}) untuk mematuhi roster kerja pabrik`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="font-extrabold text-slate-900">{operator}</span>
                  {operatorSchedule.group && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
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

          {/* Row 2: Ukuran Pallet (KETIK SENDIRI) & Untuk User (KETIK SENDIRI) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ukuran Pallet <span className="text-emerald-700 font-semibold normal-case">(Ketik Sendiri)</span> *
              </label>
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
                placeholder="Ketik ukuran pallet (cth: 81x111, 82x82, 67x102, 72x102, 92x122, 115x140)..."
                list="pallet-sizes-list"
                className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-emerald-600 placeholder-slate-400 font-medium disabled:bg-slate-100"
                required
                autoFocus={isOperator}
              />
              <datalist id="pallet-sizes-list">
                {masterSizes.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
                <span className="font-medium text-slate-500">Cepat:</span>
                {['81x111', '82x82', '67x102', '72x102', '92x122', '115x140'].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    disabled={!isOperator}
                    onClick={() => setPalletSize(quick)}
                    className="px-1.5 py-0.5 border rounded text-[11px] font-mono cursor-pointer disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Untuk User / Customer <span className="text-emerald-700 font-semibold normal-case">(Ketik Sendiri)</span> *
              </label>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                disabled={!isOperator}
                placeholder="Ketik nama user (cth: Finishing Sheet, FG ROLL PM 1, BU 19, BU 17)..."
                list="customers-list"
                className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-emerald-600 placeholder-slate-400 font-medium disabled:bg-slate-100"
                required
              />
              <datalist id="customers-list">
                {masterCustomers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
                <span className="font-medium text-slate-500">Cepat:</span>
                {[
                  'Finishing Sheet(PD1)',
                  'BU19(Order Finishing)',
                  'Finishing Sheet',
                  'BU 19',
                  'FG ROLL PM 1',
                  'BU 17'
                ].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    disabled={!isOperator}
                    onClick={() => setCustomer(quick)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded text-[11px] text-slate-800 cursor-pointer disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Pallet Runners (LS / SS), Wrap Type, Region, Quantity + Satuan (SET ATAU PCS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. Region (Lokal / Ekspor) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Region *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setMarketType('Lokal')}
                  className={`py-2 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                    marketType === 'Lokal'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Lokal
                </button>
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setMarketType('Ekspor')}
                  className={`py-2 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                    marketType === 'Ekspor'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Ekspor
                </button>
              </div>
            </div>

            {/* 2. Wrap Type: 1-Click Button Selection (RW, BP, RCK, SRKLS) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Wrap Type *</span>
                <span className="text-[10px] text-emerald-800 font-bold normal-case">Tinggal Klik</span>
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
                      onClick={() => handleSelectPalletType(item.fullName)}
                      className={`py-1.5 px-1 rounded border transition-colors cursor-pointer text-center flex flex-col items-center justify-center leading-tight ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100 font-semibold'
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Pallet Runners *</span>
                <span className="text-[10px] text-slate-500 font-semibold lowercase">LS / SS</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setTypePallet('LS')}
                  className={`py-2 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                    typePallet === 'LS'
                      ? 'bg-blue-800 text-white border-blue-800 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="LS = Long Side (Bukaan garpu forklift sisi panjang)"
                >
                  LS (Long Side)
                </button>
                <button
                  type="button"
                  disabled={!isOperator}
                  onClick={() => setTypePallet('SS')}
                  className={`py-2 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                    typePallet === 'SS'
                      ? 'bg-purple-800 text-white border-purple-800 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="SS = Short Side (Bukaan garpu forklift sisi pendek)"
                >
                  SS (Short Side)
                </button>
              </div>
            </div>

            {/* Quantity dengan pilihan Satuan: SET atau PCS */}
            {/* Quantity & Satuan: Kolom Mengetik Jumlah Diperkecil + Opsi Set & Pcs Menyamping (Tinggal Klik) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Quantity & Satuan *</span>
                <span className="text-[10px] text-emerald-800 font-bold normal-case">Tinggal Klik</span>
              </label>
              <div className="flex items-center gap-1.5">
                {/* Kolom Mengetik Jumlah Diperkecil */}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!isOperator}
                  placeholder="Qty..."
                  className="w-20 sm:w-24 px-2 py-2 border border-slate-300 rounded text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-100 text-center"
                  required
                />
                {/* Opsi Set & Pcs Menyamping (1-Click) */}
                <div className="grid grid-cols-2 gap-1 flex-1">
                  <button
                    type="button"
                    disabled={!isOperator}
                    onClick={() => handleSelectUnit('Set')}
                    className={`py-2 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                      unit === 'Set'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    disabled={!isOperator}
                    onClick={() => handleSelectUnit('Pcs')}
                    className={`py-2 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                      unit === 'Pcs'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Pcs
                  </button>
                </div>
              </div>

              {/* Status Satuan Indicator jika tidak biasa atau sudah dikonfirmasi */}
              {(() => {
                const mismatch = getUnitMismatchedInfo(palletType, unit);
                const comboKey = `${palletType}_${unit}`;
                const isConfirmed = confirmedUnitCombo === comboKey;
                if (mismatch.isMismatched) {
                  return (
                    <div className={`mt-1.5 px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 ${
                      isConfirmed
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-50 text-amber-900 border border-amber-300'
                    }`}>
                      {isConfirmed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Dikonfirmasi Yakin: <b>{unit}</b> ({palletType})</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Perlu konfirmasi: Satuan <b>{unit}</b></span>
                        </>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Row 4: Kolom Peletakan Pallet (Wajib Diisi) & Catatan Produksi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Kolom Peletakan Pallet *</span>
                <span className="text-[10px] text-red-600 font-bold normal-case">Wajib Diisi</span>
              </label>
              <input
                type="text"
                value={pelatakanPallet}
                onChange={(e) => setPelatakanPallet(e.target.value)}
                disabled={!isOperator}
                placeholder="Ketik kolom peletakan yard (cth: A1, B2, C15, F11, dll)..."
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-600 placeholder-slate-400 font-medium disabled:bg-slate-100"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Kolom / posisi yard penempatan pallet di area Finish Pallet
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan Produksi (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!isOperator}
                placeholder="Keterangan tambahan..."
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-600 placeholder-slate-400 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleResetForm}
              disabled={!isOperator}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Bersihkan Form</span>
            </button>
            <button
              type="submit"
              disabled={!isOperator || isSubmitting || operatorSchedule.isOff}
              className={`w-full sm:w-auto px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm ${
                !isOperator || isSubmitting || operatorSchedule.isOff
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer'
              }`}
            >
              <Save className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>
                {operatorSchedule.isOff
                  ? 'DITOLAK (ANDA SEDANG LIBUR / OFF)'
                  : isSubmitting
                  ? 'MENYIMPAN KE CLOUD...'
                  : isOperator
                  ? 'SIMPAN PENERIMAAN'
                  : 'SIMPAN (KHUSUS OPERATOR)'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Live WhatsApp Report Section for Fast Multi-Tasking */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-emerald-100 text-emerald-800">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase">
                Format Laporan WhatsApp (Hasil Produksi {shift})
              </h3>
              <p className="text-[11px] text-slate-500">
                Otomatis dihitung dari penerimaan yang telah diinput pada {shift} ({date})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {todayShiftTxCount} Transaksi
            </span>
            <button
              type="button"
              onClick={handleQuickCopyWA}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                quickCopied
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {quickCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{quickCopied ? 'Tersalin!' : 'Salin Teks WA'}</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(liveWAText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs inline-flex"
              title="Buka langsung di WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Kirim WA</span>
            </a>
          </div>
        </div>

        {/* Formatted Text Box */}
        <div className="relative">
          <textarea
            readOnly
            rows={5}
            value={liveWAText}
            className="w-full p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-lg border border-slate-800 focus:outline-none selection:bg-emerald-600 selection:text-white leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Urutan: <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded">Ukuran - Lokal/Ekspor - Jenis Pallet - Type Pallet = Total Set/Pcs</code>
          </span>
          <button
            type="button"
            onClick={() => setShowWAModal(true)}
            className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer"
          >
            Buka Jendela Lengkap & Pilihan Tanggal →
          </button>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <SalinLaporanWAModal
        isOpen={showWAModal}
        onClose={() => setShowWAModal(false)}
        initialMode="PENERIMAAN"
        initialDate={date}
        initialShift={shift}
      />

      {/* Modal Notifikasi Konfirmasi Satuan Pallet (Mencegah Salah Input PCS vs SET) */}
      {unitConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Dialog */}
            <div className="bg-amber-500/10 border-b border-amber-200 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                  Konfirmasi Satuan Pallet
                </h3>
                <p className="text-[11px] text-amber-800 font-medium">
                  Verifikasi Anti Salah Input Operasional Pabrik
                </p>
              </div>
            </div>

            {/* Body Dialog */}
            <div className="p-5 space-y-4">
              <div className="text-center py-2">
                <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  "{unitConfirmModal.question}"
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                  <span>Wrap Type: <b className="text-emerald-700">{unitConfirmModal.palletType}</b></span>
                  <span>•</span>
                  <span>Satuan Dipilih: <b className="text-rose-700">{unitConfirmModal.targetUnit}</b></span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span>Aturan Standar Satuan di Finish Pallet:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1 text-slate-600">
                  <li><b>Reamwrap & Bulkpack</b> standar umumnya bersatuan: <b className="text-emerald-700">SET</b></li>
                  <li><b>Racuk & Sirkulasi</b> standar umumnya bersatuan: <b className="text-emerald-700">PCS</b></li>
                </ul>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  {unitConfirmModal.explanation}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmUnitModal}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-lg text-xs font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Ya, Saya Yakin ({unitConfirmModal.targetUnit})</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelUnitModal}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Bukan, Ganti ke {unitConfirmModal.recommendedUnit}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

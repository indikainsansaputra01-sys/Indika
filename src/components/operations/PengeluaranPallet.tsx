import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Save,
  RotateCcw,
  Boxes,
  Eye,
  MessageSquare,
  Copy,
  Check,
  Share2,
  Sparkles,
  Plus,
  Trash2,
  Split,
  Layers,
  ArrowRight,
  Shield,
  Lock,
  User,
  Printer
} from 'lucide-react';
import { ShiftType, MarketType, QuantityUnit, PalletSideType, Transaction } from '../../types';
import {
  generateWhatsAppPengeluaranText,
  copyTextToClipboard
} from '../../utils/whatsappReportUtils';
import { SalinLaporanWAModal } from '../common/SalinLaporanWAModal';
import { NotaPengirimanModal } from './NotaPengirimanModal';
import { getAvailableColumnsForPallet } from '../../utils/stockLocationUtils';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import { formatIndoDate } from '../../utils/shiftReportUtils';
import { getOperatorShiftForDate } from '../../utils/rosterUtils';

export interface ColumnAllocation {
  id: string;
  column: string;
  qty: string;
}

export const PengeluaranPallet: React.FC = () => {
  const {
    currentUser,
    activeShift,
    addTransaction,
    getStock,
    masterSizes,
    masterTypes,
    masterCustomers,
    isOperator,
    transactions,
    employees,
    showNotification
  } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const getShiftTime = (s: ShiftType) => {
    if (s === 'Shift 1') return '08:00';
    if (s === 'Shift 2') return '16:00';
    return '00:00';
  };

  const [date, setDate] = useState(todayStr);
  // FREE TEXT AS REQUESTED:
  const [palletSize, setPalletSize] = useState('');
  const [customer, setCustomer] = useState('');
  const [noRun, setNoRun] = useState('');
  // Pilihan Jenis Pallet
  const [palletType, setPalletType] = useState('Pallet Reamwrap');
  // TYPE PALLET: LS (Long Side) atau SS (Short Side)
  const [typePallet, setTypePallet] = useState<PalletSideType>('LS');
  const [marketType, setMarketType] = useState<MarketType>('Lokal');
  const [quantity, setQuantity] = useState<string>('');
  // PILIHAN SATUAN: SET ATAU PCS
  const [unit, setUnit] = useState<QuantityUnit>('Set');
  // KOLOM PELETAKAN PALLET (DIISI MANUAL)
  const [pelatakanPallet, setPelatakanPallet] = useState('');
  // Mode Pengambilan: 'single' (Ambil dari 1 Kolom) | 'multi' (Ambil dari beberapa kolom/split)
  const [pickingMode, setPickingMode] = useState<'single' | 'multi'>('single');
  const [allocations, setAllocations] = useState<ColumnAllocation[]>([]);

  // Operator pengeluaran otomatis terkunci sesuai akun karyawan yang sedang login
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
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [lastSubmittedTx, setLastSubmittedTx] = useState<Transaction | null>(null);
  const [quickCopied, setQuickCopied] = useState(false);

  // Live WA text for current selected date & shift
  const liveWAText = useMemo(() => {
    return generateWhatsAppPengeluaranText({
      transactions,
      date,
      shift,
      includeTotal: true
    });
  }, [transactions, date, shift]);

  const todayShiftTxCount = useMemo(() => {
    return transactions.filter(t => t.transactionType === 'PENGELUARAN' && t.date === date && t.shift === shift).length;
  }, [transactions, date, shift]);

  const handleQuickCopyWA = async () => {
    const ok = await copyTextToClipboard(liveWAText);
    if (ok) {
      setQuickCopied(true);
      showNotification('success', 'Teks WA Pengeluaran Disalin!', 'Format laporan pengeluaran siap ditempel ke grup WhatsApp.');
      setTimeout(() => setQuickCopied(false), 2500);
    }
  };

  const primaryOperators = ['Indika', 'Agus', 'Harun', 'Riffky'];
  
  // Pilihan Jenis Pallet Resmi
  const palletTypes = useMemo(() => {
    const list = (masterTypes || []).filter(m => m.active).map(m => m.name);
    const defaults = ['Pallet Reamwrap', 'Pallet Bulkpack', 'Pallet Racuk', 'Pallet Sirkulasi'];
    return Array.from(new Set([...list, ...defaults]));
  }, [masterTypes]);

  // Detected yard columns holding live available stock for this pallet size (strictly chronological)
  const detectedColumnsForSize = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    return getAvailableColumnsForPallet({
      transactions,
      palletSize: cleanSize,
      palletType,
      typePallet,
      unit,
      marketType
    });
  }, [palletSize, palletType, typePallet, unit, marketType, transactions]);

  // Live stock check by size, type, market, and unit (pooled physical stock across all yard columns)
  const currentAvailableStock = useMemo(() => {
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize || !palletType) return 0;
    const baseStock = getStock(cleanSize, palletType, marketType, unit, typePallet);
    const colSum = detectedColumnsForSize.reduce((sum, c) => sum + (c.qty || 0), 0);
    return Math.max(baseStock, colSum);
  }, [palletSize, palletType, marketType, unit, typePallet, getStock, detectedColumnsForSize]);

  const requestedQty = parseInt(quantity, 10) || 0;
  const isOutOfStock = requestedQty > currentAvailableStock;

  // Stock available specifically in the single selected column
  const selectedSingleColStock = useMemo(() => {
    if (!pelatakanPallet.trim() || detectedColumnsForSize.length === 0) return null;
    const match = detectedColumnsForSize.find(
      c => c.col.toLowerCase().trim() === pelatakanPallet.toLowerCase().trim()
    );
    return match ? match.qty : null;
  }, [pelatakanPallet, detectedColumnsForSize]);

  // Flag if single column has less than requested qty (e.g. F11 only has 700, but requested 900)
  const isSingleColInsufficient = useMemo(() => {
    if (pickingMode !== 'single') return false;
    if (selectedSingleColStock === null) return false;
    return requestedQty > selectedSingleColStock;
  }, [pickingMode, selectedSingleColStock, requestedQty]);

  // Total qty allocated across multi-column rows
  const totalAllocated = useMemo(() => {
    return allocations.reduce((sum, a) => sum + (parseInt(a.qty, 10) || 0), 0);
  }, [allocations]);

  const allocationDiff = requestedQty - totalAllocated;

  // Auto-allocate across detected columns (e.g. F11 ambil 700, F9 ambil 200 = 900)
  const handleAutoAllocate = () => {
    if (requestedQty <= 0) {
      showNotification('error', 'Quantity Kosong', 'Isi jumlah quantity pengeluaran terlebih dahulu sebelum auto alokasi.');
      return;
    }

    let needed = requestedQty;
    const newAllocations: ColumnAllocation[] = [];

    // Prioritize detected columns that hold stock for this item
    for (const item of detectedColumnsForSize) {
      if (needed <= 0) break;
      const take = Math.min(needed, item.qty);
      if (take > 0) {
        newAllocations.push({
          id: 'alloc-' + Math.random().toString(36).substring(2, 7),
          column: item.col,
          qty: String(take)
        });
        needed -= take;
      }
    }

    // If still remaining or no detected columns, add single row
    if (newAllocations.length === 0) {
      newAllocations.push({
        id: 'alloc-' + Math.random().toString(36).substring(2, 7),
        column: pelatakanPallet.trim() || '',
        qty: String(requestedQty)
      });
    }

    setAllocations(newAllocations);
    setPickingMode('multi');
    showNotification(
      'info',
      'Alokasi Multi-Kolom Siap',
      `Otomatis membagi pengeluaran ke ${newAllocations.length} kolom sesuai ketersediaan stok.`
    );
  };

  const handleAddAllocationRow = (colName?: string) => {
    const usedCols = new Set(allocations.map(a => a.column.toLowerCase().trim()));
    const nextCol = colName || detectedColumnsForSize.find(c => !usedCols.has(c.col.toLowerCase()))?.col || '';
    const colStock = detectedColumnsForSize.find(c => c.col.toLowerCase() === nextCol.toLowerCase())?.qty || 0;
    const remaining = Math.max(0, requestedQty - totalAllocated);
    const defaultQty = colStock > 0 ? Math.min(remaining, colStock) : remaining;

    setAllocations(prev => [
      ...prev,
      {
        id: 'alloc-' + Math.random().toString(36).substring(2, 7),
        column: nextCol,
        qty: defaultQty > 0 ? String(defaultQty) : ''
      }
    ]);
  };

  const handleRemoveAllocationRow = (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAllocationRow = (id: string, field: 'column' | 'qty', val: string) => {
    setAllocations(prev =>
      prev.map(a => (a.id === id ? { ...a, [field]: val } : a))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!isOperator) {
      setStatusMessage({
        type: 'error',
        text: `Akses Terbatas: Akun Anda (${currentUser?.name} - ${currentUser?.title}) berada dalam mode Monitoring. Hanya Operator (Indika, Agus, Harun, Riffky) yang dapat mengeluarkan pallet.`
      });
      return;
    }

    if (operatorSchedule.isOff) {
      setStatusMessage({
        type: 'error',
        text: `Penginputan Ditolak: Anda (${operator}) dijadwalkan LIBUR (OFF) pada ${formatIndoDate(date)} sesuai jadwal roster pabrik. Pengeluaran pallet tidak dapat disimpan pada hari libur.`
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
      setStatusMessage({ type: 'error', text: 'Tujuan pengiriman (User) wajib diketik!' });
      return;
    }
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setStatusMessage({ type: 'error', text: 'Quantity harus lebih besar dari 0!' });
      return;
    }

    if (qtyNumber > currentAvailableStock) {
      setStatusMessage({
        type: 'error',
        text: `STOK TIDAK MENCUKUPI. Silakan periksa kembali jumlah pallet. Stok tersedia saat ini: ${currentAvailableStock} ${unit}.`
      });
      return;
    }

    // --- CASE 1: SINGLE COLUMN PICKING ---
    if (pickingMode === 'single') {
      if (!pelatakanPallet.trim()) {
        setStatusMessage({ type: 'error', text: 'Kolom peletakan pallet tempat pengambilan wajib diisi!' });
        return;
      }

      // STRICT VALIDATION: If column stock is known and requested > column stock
      if (selectedSingleColStock !== null && qtyNumber > selectedSingleColStock) {
        setStatusMessage({
          type: 'error',
          text: `STOK KOLOM TIDAK CUKUP: Di kolom ${pelatakanPallet.trim()} hanya ada ${selectedSingleColStock} ${unit}, sedangkan pengiriman meminta ${qtyNumber} ${unit} (kurang ${qtyNumber - selectedSingleColStock} ${unit}). Silakan gunakan opsi 'Ambil dari Beberapa Kolom (Split)' untuk mengambil sisa dari kolom lain!`
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await addTransaction({
          transactionType: 'PENGELUARAN',
          date,
          time: getShiftTime(shift),
          palletSize: cleanSize,
          palletType,
          typePallet,
          customer: customer.trim(),
          noRun: noRun.trim() || undefined,
          shift,
          marketType,
          quantity: qtyNumber,
          unit,
          pelatakanPallet: pelatakanPallet.trim(),
          operator,
          notes: notes.trim()
        });

        if (res.success) {
          if (res.createdTx) {
            setLastSubmittedTx(res.createdTx);
          }
          setStatusMessage({
            type: 'success',
            text: `Pengeluaran pallet berhasil disimpan ke cloud. Diambil dari kolom: ${pelatakanPallet.trim()}${noRun.trim() ? ` (No.Run: ${noRun.trim()})` : ''}. Sisa stok ${cleanSize} (${palletType} - ${marketType} - ${unit}): ${res.currentStock} ${unit}.`
          });
          setPalletSize('');
          setCustomer('');
          setNoRun('');
          setQuantity('');
          setPelatakanPallet('');
          setNotes('');
        } else {
          setStatusMessage({ type: 'error', text: res.message });
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: 'Terjadi kendala saat menyimpan ke database cloud: ' + (err.message || String(err)) });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // --- CASE 2: MULTI-COLUMN SPLIT PICKING ---
      if (allocations.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'Tentukan minimal 1 kolom pengambilan pada mode Multi-Kolom! Atau klik tombol "Alokasi Otomatis".'
        });
        return;
      }

      for (let i = 0; i < allocations.length; i++) {
        const a = allocations[i];
        if (!a.column.trim()) {
          setStatusMessage({ type: 'error', text: `Kolom baris ke-${i + 1} belum dipilih/diisi!` });
          return;
        }
        const aQty = parseInt(a.qty, 10);
        if (isNaN(aQty) || aQty <= 0) {
          setStatusMessage({ type: 'error', text: `Jumlah pallet yang diambil di kolom ${a.column} harus lebih besar dari 0!` });
          return;
        }

        // Validate against column's actual available stock
        const colStock = detectedColumnsForSize.find(
          c => c.col.toLowerCase().trim() === a.column.toLowerCase().trim()
        )?.qty;
        if (colStock !== undefined && aQty > colStock) {
          setStatusMessage({
            type: 'error',
            text: `Pengambilan di kolom ${a.column} (${aQty} ${unit}) melebihi stok yang tersedia di kolom tersebut (${colStock} ${unit})!`
          });
          return;
        }
      }

      if (totalAllocated !== qtyNumber) {
        setStatusMessage({
          type: 'error',
          text: totalAllocated < qtyNumber
            ? `Total alokasi kolom (${totalAllocated} ${unit}) masih KURANG ${qtyNumber - totalAllocated} ${unit} dari total permintaan pengiriman (${qtyNumber} ${unit})!`
            : `Total alokasi kolom (${totalAllocated} ${unit}) MELEBIHI total permintaan pengiriman (${qtyNumber} ${unit}) sebanyak ${totalAllocated - qtyNumber} ${unit}!`
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const allocSummary = allocations.map(a => `${a.column.trim().toUpperCase()} (${parseInt(a.qty, 10)} ${unit})`).join(', ');

        const res = await addTransaction({
          transactionType: 'PENGELUARAN',
          date,
          time: getShiftTime(shift),
          palletSize: cleanSize,
          palletType,
          typePallet,
          customer: customer.trim(),
          noRun: noRun.trim() || undefined,
          shift,
          marketType,
          quantity: qtyNumber,
          unit,
          pelatakanPallet: allocSummary,
          operator,
          notes: notes.trim()
        });

        if (!res.success) {
          throw new Error(res.message);
        }

        if (res.createdTx) {
          setLastSubmittedTx(res.createdTx);
        }

        setStatusMessage({
          type: 'success',
          text: `Pengeluaran ${qtyNumber} ${unit} pallet berhasil disimpan ke cloud! Terbagi di ${allocations.length} kolom: ${allocSummary}${noRun.trim() ? ` (No.Run: ${noRun.trim()})` : ''}. Sisa total stok: ${res.currentStock !== undefined ? res.currentStock : currentAvailableStock - qtyNumber} ${unit}.`
        });
        setPalletSize('');
        setCustomer('');
        setNoRun('');
        setQuantity('');
        setPelatakanPallet('');
        setAllocations([]);
        setPickingMode('single');
        setNotes('');
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: 'Terjadi kendala saat menyimpan ke database cloud: ' + (err.message || String(err)) });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleResetForm = () => {
    setPalletSize('');
    setCustomer('');
    setNoRun('');
    setQuantity('');
    setPelatakanPallet('');
    setAllocations([]);
    setPickingMode('single');
    setNotes('');
    setStatusMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D97706] text-white">
              <ArrowUpFromLine className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              FORM PENGELUARAN / PENGIRIMAN PALLET
            </h1>
          </div>
          <p className="text-xs text-[#8CCCF0] mt-1 font-medium">
            Pencatatan pengiriman pallet ke user dengan validasi stok per satuan Set / Pcs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!lastSubmittedTx) {
                const recentTx = transactions.find(t => t.transactionType === 'PENGELUARAN' && t.date === date);
                if (recentTx) setLastSubmittedTx(recentTx);
              }
              setShowNotaModal(true);
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Buka & Cetak Nota Pengiriman Pallet & Core Plug (A4 2 Rangkap)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Nota Pengiriman</span>
          </button>
          <button
            type="button"
            onClick={() => setShowWAModal(true)}
            className="px-3.5 py-1.5 bg-[#D97706] hover:bg-[#B45309] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Buka & Salin Format Laporan WhatsApp Pengeluaran"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Salin Teks WA ({shift})</span>
          </button>
          <span className="text-xs font-mono bg-[#112B43] text-[#8CCCF0] border border-[#1E4366] px-2.5 py-1 rounded hidden sm:inline-block font-semibold">
            DISPATCH
          </span>
        </div>
      </div>

      {/* Monitoring Warning Banner */}
      {!isOperator && (
        <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-lg text-xs text-blue-900 flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <b>Mode Monitoring:</b> Anda masuk sebagai <b>{currentUser?.name}</b> ({currentUser?.title}). Anda hanya memiliki hak akses untuk memantau data. Pengeluaran stok hanya dapat dilakukan oleh 4 Operator (Indika, Agus, Harun, Riffky).
          </div>
        </div>
      )}

      {/* Warning / Error / Success Message */}
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
                {statusMessage.type === 'success' ? '✓ PENGELUARAN BERHASIL DISIMPAN' : '❌ STOK TIDAK MENCUKUPI'}
              </div>
              <div>{statusMessage.text}</div>
            </div>
          </div>

          {/* Quick Actions directly inside success notification */}
          {statusMessage.type === 'success' && (
            <div className="mt-1 pt-2.5 border-t border-emerald-200/80 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNotaModal(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>🖨️ Cetak Nota Pengiriman (A4 2 Rangkap)</span>
              </button>
              <button
                type="button"
                onClick={handleQuickCopyWA}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                {quickCopied ? <Check className="w-3.5 h-3.5 text-amber-200" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{quickCopied ? 'Teks WA Tersalin!' : `Salin Teks WA (${shift})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWAModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Format WA</span>
              </button>
              <span className="text-[11px] text-emerald-800 font-medium">
                Nota siap dicetak untuk serah terima ke User
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
                <span>PENGELUARAN DIKUNCI: ANDA SEDANG LIBUR / OFF</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-200 text-rose-900 font-bold uppercase">
                  SOP Roster Pabrik
                </span>
              </div>
              <div>
                Akun Anda: <b>{operator}</b> ({operatorSchedule.group ? `Grup ${operatorSchedule.group}` : ''}) terjadwal <b>LIBUR (OFF)</b> pada tanggal <b>{formatIndoDate(date)}</b>.
              </div>
              <div className="text-rose-700">
                Sesuai jadwal roster kerja resmi pabrik, operator yang sedang libur tidak dapat mencatat pengeluaran. Tombol simpan dinonaktifkan dan operator terkunci otomatis ke akun login Anda.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-md bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                Jadwal Roster Terdeteksi: <span className="font-bold text-amber-900">{operatorSchedule.shiftLabel}</span> · Operator: <span className="font-bold text-amber-900">{operator}</span> ({operatorSchedule.group ? `Grup ${operatorSchedule.group}` : ''}) · <span className="text-amber-800 font-medium">{operatorSchedule.phaseDescription}</span> pada {formatIndoDate(date)}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-amber-700 text-white shadow-2xs shrink-0">
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
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-600 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Shift Pengiriman</span>
                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Terkunci Roster
                </span>
              </label>
              <div
                className={`w-full px-3 py-2 border rounded text-xs font-bold flex items-center justify-between ${
                  operatorSchedule.isOff
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-amber-50/80 border-amber-300 text-amber-900'
                }`}
                title="Shift pengiriman terkunci otomatis mengikuti kalender roster operator untuk mencegah salah input"
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
                <span>Operator Pengeluaran</span>
                <span className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Terkunci Akun Login
                </span>
              </label>
              <div
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold bg-slate-100 text-slate-900 flex items-center justify-between shadow-2xs"
                title={`Operator pengeluaran terkunci otomatis sesuai akun login Anda (${operator}) untuk mematuhi roster kerja pabrik`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="font-extrabold text-slate-900">{operator}</span>
                  {operatorSchedule.group && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
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

          {/* Row 2: Ukuran Pallet (KETIK SENDIRI), Dikirim ke User (KETIK SENDIRI), & No.Run (KETIK MANUAL, OPSIONAL) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ukuran Pallet <span className="text-amber-700 font-semibold normal-case">(Ketik Sendiri)</span> *
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
                list="sizes-pengeluaran-list"
                className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-amber-600 placeholder-slate-400 font-medium disabled:bg-slate-100"
                required
                autoFocus={isOperator}
              />
              <datalist id="sizes-pengeluaran-list">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dikirim ke User / Tujuan <span className="text-amber-700 font-semibold normal-case">(Tujuan Bebas)</span> *
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                  Bebas User Manapun
                </span>
              </div>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                disabled={!isOperator}
                placeholder="Ketik tujuan pengiriman (cth: BU 19, Finishing Sheet, FG ROLL PM 1, BU 17)..."
                list="customers-pengeluaran-list"
                className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-amber-600 placeholder-slate-400 font-medium disabled:bg-slate-100"
                required
              />
              <datalist id="customers-pengeluaran-list">
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
                    className="px-2 py-0.5 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded text-[11px] text-slate-800 cursor-pointer disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1">
                Stok bersifat akumulatif spesifikasi fisik. Bebas dikirimkan ke user manapun (misal ke <b>BU 19</b>) meskipun saat penerimaan produksi dicatat untuk <b>Finishing Sheet</b>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>No.Run</span>
                <span className="text-[10px] text-slate-400 font-semibold normal-case">(Ketik Manual, Opsional)</span>
              </label>
              <input
                type="text"
                value={noRun}
                onChange={(e) => setNoRun(e.target.value)}
                disabled={!isOperator}
                placeholder="cth: 12001281 (tidak wajib)..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-amber-600 placeholder-slate-400 font-mono disabled:bg-slate-100"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                <span>Format laporan WA: <code className="font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded text-[10px]">( No.Run 12001281 )</code></span>
              </div>
            </div>
          </div>

          {/* Row 3: Tujuan Distribusi (Lokal / Ekspor), Jenis Pallet, Type Pallet (LS / SS), Quantity + Satuan (SET ATAU PCS) */}
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
                <span className="text-[10px] text-amber-800 font-bold normal-case">Tinggal Klik</span>
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
                      className={`py-1.5 px-1 rounded border transition-colors cursor-pointer text-center flex flex-col items-center justify-center leading-tight ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold'
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

            {/* Quantity Pengeluaran & Satuan: Kolom Mengetik Jumlah Diperkecil + Opsi Set & Pcs Menyamping (Tinggal Klik) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Quantity & Satuan *</span>
                <span className="text-[10px] text-amber-800 font-bold normal-case">Tinggal Klik</span>
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
                  className={`w-20 sm:w-24 px-2.5 py-2 border rounded text-sm font-mono font-bold focus:outline-none disabled:bg-slate-100 text-center ${
                    isOutOfStock
                      ? 'border-rose-500 bg-rose-50 text-rose-900'
                      : 'border-slate-300 text-slate-900 focus:border-amber-600'
                  }`}
                  required
                />
                {/* Opsi Set & Pcs Menyamping (1-Click) */}
                <div className="grid grid-cols-2 gap-1 flex-1">
                  <button
                    type="button"
                    disabled={!isOperator}
                    onClick={() => setUnit('Set')}
                    className={`py-2 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                      unit === 'Set'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    disabled={!isOperator}
                    onClick={() => setUnit('Pcs')}
                    className={`py-2 px-1 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                      unit === 'Pcs'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Pcs
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LIVE STOCK INDICATOR BOX */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Boxes className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 block">Stok Aktual di Yard:</span>
                <span className="text-xs font-semibold text-slate-800">
                  {palletSize.trim() ? palletSize : '[Ketik ukuran]'} · Type: <b className={typePallet === 'LS' ? 'text-blue-800' : 'text-purple-800'}>{typePallet}</b> · {palletType} · {marketType} ({unit})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Saldo Tersedia:</span>
                <span
                  className={`text-lg font-bold font-mono tabular-nums ${
                    currentAvailableStock <= 0
                      ? 'text-rose-600'
                      : currentAvailableStock < 10
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {currentAvailableStock} {unit}
                </span>
              </div>

              {isOutOfStock && (
                <div className="px-2.5 py-1 bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-bold rounded flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Stok Tidak Cukup!
                </div>
              )}
            </div>
          </div>

          {/* Row 4: SISTEM ALOKASI KOLOM PENGAMBILAN YARD (SINGLE vs MULTI-COLUMN) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-700" />
                    <span>Kolom Peletakan Pallet (Pengambilan Yard) *</span>
                  </h3>
                  {detectedColumnsForSize.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      Tersedia di {detectedColumnsForSize.length} Kolom
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tentukan lokasi kolom yard tempat pallet diambil. Jika pallet tersebar di beberapa kolom, gunakan opsi multi-kolom.
                </p>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPickingMode('single')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    pickingMode === 'single'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Ambil 1 Kolom
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickingMode('multi');
                    if (allocations.length === 0) {
                      handleAutoAllocate();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pickingMode === 'multi'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Ambil Beberapa Kolom (Split)</span>
                </button>
              </div>
            </div>

            {/* List of Detected Columns with Live Stock */}
            {detectedColumnsForSize.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs">
                <span className="text-amber-900 font-bold text-[11px] uppercase tracking-wide">
                  Kolom Penyimpan Ukuran Ini:
                </span>
                {detectedColumnsForSize.map(({ col, qty }) => (
                  <button
                    key={col}
                    type="button"
                    disabled={!isOperator}
                    onClick={() => {
                      if (pickingMode === 'single') {
                        setPelatakanPallet(col);
                      } else {
                        handleAddAllocationRow(col);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-300 text-amber-950 rounded-md font-mono text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95"
                    title={`Klik untuk ${pickingMode === 'single' ? 'pilih kolom' : 'tambah kolom'} ${col}`}
                  >
                    <span>{col}:</span>
                    <span className="text-amber-700 font-semibold">{qty} {unit}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({pickingMode === 'single' ? 'Pilih' : '+Tambah'})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 1: SINGLE COLUMN PICKING MODE */}
            {/* ======================================================== */}
            {pickingMode === 'single' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Kolom Pengambilan (Ketik Bebas) *
                    </label>
                    <input
                      type="text"
                      value={pelatakanPallet}
                      onChange={(e) => setPelatakanPallet(e.target.value)}
                      disabled={!isOperator}
                      placeholder="Ketik kolom (cth: F11, F9, F14, dll)..."
                      className={`w-full px-3 py-2 border rounded text-xs font-bold font-mono focus:outline-none disabled:bg-slate-100 ${
                        isSingleColInsufficient
                          ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-600'
                          : 'border-slate-300 text-slate-900 focus:border-amber-600 bg-white'
                      }`}
                      required={pickingMode === 'single'}
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Ketik nama kolom atau klik tombol kolom di atas untuk mengisi otomatis.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Catatan Pengiriman (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={!isOperator}
                      placeholder="Keterangan pengeluaran..."
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-amber-600 placeholder-slate-400 disabled:bg-slate-100 bg-white"
                    />
                  </div>
                </div>

                {/* STRICT VALIDATION ALERT WHEN SINGLE COLUMN IS SHORT OF REQUESTED QUANTITY */}
                {isSingleColInsufficient && (
                  <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs uppercase tracking-wide text-rose-900">
                          PERINGATAN: STOK KOLOM {pelatakanPallet.toUpperCase()} TIDAK CUKUP!
                        </div>
                        <div className="text-xs text-rose-800 mt-0.5">
                          Di kolom <b>{pelatakanPallet}</b> hanya ada <b>{selectedSingleColStock} {unit}</b>, sedangkan permintaan order adalah <b>{requestedQty} {unit}</b> (<b>kurang {requestedQty - (selectedSingleColStock || 0)} {unit}</b>).
                        </div>
                        <div className="text-[11px] text-rose-700 mt-1">
                          Anda tidak bisa mengambil {requestedQty} {unit} dari kolom {pelatakanPallet} saja. Silakan pecah pengambilan ke beberapa kolom!
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                      <Split className="w-4 h-4" />
                      <span>Pecah ke Beberapa Kolom Otomatis</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 2: MULTI-COLUMN SPLIT PICKING MODE */}
            {/* ======================================================== */}
            {pickingMode === 'multi' && (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-amber-700" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase">
                        Rincian Alokasi Pengambilan Per Kolom Yard
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Total permintaan order: <b className="text-slate-900 font-mono">{requestedQty} {unit}</b>. Tentukan jumlah yang diambil dari masing-masing kolom.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-amber-300 shadow-2xs"
                      title="Otomatis ratakan dan habiskan stok kolom"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                      <span>Alokasi Otomatis</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddAllocationRow()}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Kolom</span>
                    </button>
                  </div>
                </div>

                {/* Allocation Rows */}
                {allocations.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-xs">
                    <p className="font-semibold">Belum ada kolom yang dipilih.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Klik <b>"Alokasi Otomatis"</b> untuk membagi stok kolom secara instan, atau klik <b>"+ Tambah Kolom"</b>.
                    </p>
                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      className="mt-3 px-3.5 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Jalankan Alokasi Otomatis Sekarang</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {allocations.map((alloc, idx) => {
                      const detected = detectedColumnsForSize.find(
                        c => c.col.toLowerCase().trim() === alloc.column.toLowerCase().trim()
                      );
                      const maxColStock = detected ? detected.qty : null;
                      const parsedAllocQty = parseInt(alloc.qty, 10) || 0;
                      const isRowOverStock = maxColStock !== null && parsedAllocQty > maxColStock;

                      return (
                        <div
                          key={alloc.id}
                          className={`p-3 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isRowOverStock
                              ? 'bg-rose-50/80 border-rose-300'
                              : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Col 1: Pilih / Ketik Kolom */}
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Kolom #{idx + 1}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={alloc.column}
                                onChange={(e) => handleUpdateAllocationRow(alloc.id, 'column', e.target.value)}
                                placeholder="cth: F11, F9..."
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-amber-600"
                              />
                            </div>
                            {maxColStock !== null ? (
                              <span className="text-[11px] text-slate-600 mt-1 block">
                                Stok tersedia di kolom ini: <b className="font-mono text-slate-900">{maxColStock} {unit}</b>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 mt-1 block">
                                Kolom kustom / baru
                              </span>
                            )}
                          </div>

                          {/* Col 2: Jumlah yang diambil */}
                          <div className="w-full md:w-56">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                              <span>Jumlah Diambil ({unit}):</span>
                              {maxColStock !== null && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAllocationRow(alloc.id, 'qty', String(maxColStock))}
                                  className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer"
                                >
                                  Maksimal ({maxColStock})
                                </button>
                              )}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max={maxColStock !== null ? maxColStock : undefined}
                                value={alloc.qty}
                                onChange={(e) => handleUpdateAllocationRow(alloc.id, 'qty', e.target.value)}
                                placeholder="0"
                                className={`w-full px-3 py-1.5 bg-white border rounded text-xs font-bold font-mono text-right focus:outline-none ${
                                  isRowOverStock
                                    ? 'border-rose-500 text-rose-900 bg-rose-50'
                                    : 'border-slate-300 text-slate-900 focus:border-amber-600'
                                }`}
                              />
                              <span className="text-xs font-mono font-bold text-slate-600">{unit}</span>
                            </div>
                            {isRowOverStock && (
                              <span className="text-[10px] text-rose-700 font-bold mt-1 block">
                                ⚠ Melebihi stok kolom (Maks {maxColStock})!
                              </span>
                            )}
                          </div>

                          {/* Col 3: Hapus baris */}
                          <div className="self-end md:self-center pt-1 md:pt-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveAllocationRow(alloc.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus baris kolom ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Allocation Summary & Match Check */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-medium ${
                    allocationDiff === 0 && totalAllocated > 0
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : allocationDiff > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {allocationDiff === 0 && totalAllocated > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold uppercase tracking-wider text-[11px]">
                        {allocationDiff === 0 && totalAllocated > 0
                          ? '✓ ALOKASI PAS & SIAP DISIMPAN'
                          : allocationDiff > 0
                          ? 'ALOKASI MASIH KURANG'
                          : 'ALOKASI MELEBIHI TARGET ORDER'}
                      </div>
                      <div className="text-[11px]">
                        Target Order: <b className="font-mono">{requestedQty} {unit}</b> · Dialokasikan:{' '}
                        <b className="font-mono">{totalAllocated} {unit}</b> (
                        {allocationDiff === 0 ? (
                          <span className="text-emerald-700 font-bold">Pas 100%</span>
                        ) : allocationDiff > 0 ? (
                          <span className="text-amber-800 font-bold">Kurang {allocationDiff} {unit}</span>
                        ) : (
                          <span className="text-rose-800 font-bold">Lebih {Math.abs(allocationDiff)} {unit}</span>
                        )}
                        )
                      </div>
                    </div>
                  </div>

                  {allocationDiff > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAddAllocationRow()}
                      className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold cursor-pointer transition-colors shrink-0"
                    >
                      + Ambil Sisa {allocationDiff} {unit} dari Kolom Lain
                    </button>
                  )}
                </div>

                {/* Notes Input in Multi-Mode */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Pengiriman (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!isOperator}
                    placeholder="Keterangan pengeluaran..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-amber-600 placeholder-slate-400 disabled:bg-slate-100 bg-white"
                  />
                </div>
              </div>
            )}
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
              disabled={
                !isOperator ||
                operatorSchedule.isOff ||
                isOutOfStock ||
                isSubmitting ||
                (pickingMode === 'single' && isSingleColInsufficient) ||
                (pickingMode === 'multi' && (allocationDiff !== 0 || allocations.length === 0))
              }
              className={`w-full sm:w-auto px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm ${
                !isOperator ||
                operatorSchedule.isOff ||
                isOutOfStock ||
                isSubmitting ||
                (pickingMode === 'single' && isSingleColInsufficient) ||
                (pickingMode === 'multi' && (allocationDiff !== 0 || allocations.length === 0))
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-700 hover:bg-amber-600 text-white cursor-pointer'
              }`}
            >
              <Save className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>
                {operatorSchedule.isOff
                  ? 'DITOLAK (ANDA SEDANG LIBUR / OFF)'
                  : isSubmitting
                  ? 'MENYIMPAN KE CLOUD...'
                  : isOperator
                  ? 'SIMPAN PENGELUARAN'
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
            <div className="p-1 rounded bg-amber-100 text-amber-800">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase">
                Format Laporan WhatsApp (Pengeluaran Pallet {shift})
              </h3>
              <p className="text-[11px] text-slate-500">
                Otomatis dihitung dari pengeluaran yang telah diinput pada {shift} ({date})
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
                  ? 'bg-amber-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {quickCopied ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
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
            className="w-full p-3 bg-slate-900 text-amber-300 font-mono text-xs rounded-lg border border-slate-800 focus:outline-none selection:bg-amber-600 selection:text-white leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Template WA: <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">1. Lebar x Panjang - Lokal/Ekspor - Jenis Pallet - Type Pallet = Total SET/PCS ( No.Run "Angka" )</code>
          </span>
          <button
            type="button"
            onClick={() => setShowWAModal(true)}
            className="text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer"
          >
            Buka Jendela Lengkap & Pilihan Tanggal →
          </button>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <SalinLaporanWAModal
        isOpen={showWAModal}
        onClose={() => setShowWAModal(false)}
        initialMode="PENGELUARAN"
        initialDate={date}
        initialShift={shift}
      />

      {/* Nota Pengiriman Pallet & Core Plug Modal (A4 2 Rangkap) */}
      <NotaPengirimanModal
        isOpen={showNotaModal}
        onClose={() => setShowNotaModal(false)}
        transaction={lastSubmittedTx}
        employees={employees}
        currentUser={currentUser}
      />
    </div>
  );
};

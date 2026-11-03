import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Copy,
  Check,
  Share2,
  X,
  Calendar,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ShiftType } from '../../types';
import {
  generateWhatsAppPenerimaanText,
  generateWhatsAppPengeluaranText,
  copyTextToClipboard
} from '../../utils/whatsappReportUtils';

export interface SalinLaporanWAModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'PENERIMAAN' | 'PENGELUARAN';
  initialDate?: string;
  initialShift?: ShiftType;
}

export const SalinLaporanWAModal: React.FC<SalinLaporanWAModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'PENERIMAAN',
  initialDate,
  initialShift
}) => {
  const { transactions, activeShift, masterCustomers, showNotification } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [activeMode, setActiveMode] = useState<'PENERIMAAN' | 'PENGELUARAN'>(initialMode);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [selectedShift, setSelectedShift] = useState<string>(initialShift || activeShift || 'Shift 2');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [includeShiftInTitle, setIncludeShiftInTitle] = useState<boolean>(true);
  const [copied, setCopied] = useState(false);
  const [includeTotal, setIncludeTotal] = useState(true);

  // Sync props when reopened
  React.useEffect(() => {
    if (isOpen) {
      if (initialMode) setActiveMode(initialMode);
      if (initialDate) setSelectedDate(initialDate);
      if (initialShift) setSelectedShift(initialShift);
      setCopied(false);
    }
  }, [isOpen, initialMode, initialDate, initialShift]);

  // List of distinct customers
  const userOptions = useMemo(() => {
    const listFromMaster = (masterCustomers || []).map((c) => c.name);
    const listFromTx = transactions
      .filter((t) => t.transactionType === 'PENGELUARAN')
      .map((t) => t.customer)
      .filter(Boolean);
    const defaults = ['Finishing Sheet', 'User Finishing Sheet', 'FG ROLL PM 1', 'BU 19', 'BU 17'];
    return Array.from(new Set([...listFromTx, ...listFromMaster, ...defaults]));
  }, [masterCustomers, transactions]);

  // Generate text based on activeMode (Strictly separated!)
  const generatedText = useMemo(() => {
    if (activeMode === 'PENERIMAAN') {
      return generateWhatsAppPenerimaanText({
        transactions,
        date: selectedDate,
        shift: selectedShift,
        includeTotal
      });
    } else {
      return generateWhatsAppPengeluaranText({
        transactions,
        date: selectedDate,
        shift: selectedShift,
        userFilter: selectedUser === 'ALL' ? undefined : selectedUser,
        includeShiftInTitle,
        includeTotal
      });
    }
  }, [activeMode, transactions, selectedDate, selectedShift, selectedUser, includeShiftInTitle, includeTotal]);

  // Count items matching current filter
  const currentCount = useMemo(() => {
    return transactions.filter(
      (t) => t.transactionType === activeMode && t.date === selectedDate && t.shift === selectedShift
    ).length;
  }, [transactions, activeMode, selectedDate, selectedShift]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const success = await copyTextToClipboard(generatedText);
    if (success) {
      setCopied(true);
      showNotification('success', 'Teks Berhasil Disalin!', 'Format laporan siap ditempel (Paste) ke grup WhatsApp.');
      setTimeout(() => setCopied(false), 2500);
    } else {
      showNotification('error', 'Gagal Menyalin', 'Silakan pilih dan salin teks secara manual.');
    }
  };

  const handleOpenWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(generatedText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 no-print animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Salin Laporan WhatsApp (WA)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Resmi & Rapi
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Format otomatis siap tempel ke grup WhatsApp pengiriman & laporan shift
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Separated Mode Tabs: Penerimaan vs Pengeluaran (Teks Terpisah!) */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveMode('PENERIMAAN');
              setCopied(false);
            }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeMode === 'PENERIMAAN'
                ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>1. LAPORAN PENERIMAAN (HASIL PRODUKSI)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('PENGELUARAN');
              setCopied(false);
            }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeMode === 'PENGELUARAN'
                ? 'bg-amber-700 text-white shadow-sm ring-2 ring-amber-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>2. LAPORAN PENGELUARAN PALLET</span>
          </button>
        </div>

        {/* Filter Controls: Tanggal, Shift, & Opsi */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Tanggal:</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCopied(false);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Shift Kerja:</span>
            </label>
            <select
              value={selectedShift}
              onChange={(e) => {
                setSelectedShift(e.target.value);
                setCopied(false);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="ALL">Semua Shift (1, 2, & 3)</option>
              <option value="Shift 1">Shift 1 (Pagi)</option>
              <option value="Shift 2">Shift 2 (Sore)</option>
              <option value="Shift 3">Shift 3 (Malam)</option>
              <option value="Non Shift">Non Shift</option>
            </select>
          </div>

          {activeMode === 'PENGELUARAN' ? (
            <div>
              <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1 flex items-center gap-1.5">
                <span>Tujuan User:</span>
              </label>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setCopied(false);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-600 cursor-pointer"
              >
                <option value="ALL">Semua User (Otomatis per User)</option>
                {userOptions.map((u, i) => (
                  <option key={i} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="hidden md:block" />
          )}

          <div className="flex flex-col justify-end space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={includeTotal}
                onChange={(e) => setIncludeTotal(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
              />
              <span>Sertakan Total</span>
            </label>

            {activeMode === 'PENGELUARAN' && (
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={includeShiftInTitle}
                  onChange={(e) => setIncludeShiftInTitle(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <span>Cantumkan Shift di Judul</span>
              </label>
            )}
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">
                Format: <code className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  {activeMode === 'PENGELUARAN'
                    ? '1. Lebar x Panjang - Lokal/Ekspor - Jenis Pallet - Type Pallet = Total SET/PCS ( No.Run "Angka" )'
                    : '1. Lebar x Panjang - Lokal/Ekspor - Jenis Pallet - Type Pallet = Total SET/PCS'}
                </code>
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-slate-500">
              {currentCount} transaksi ditemukan
            </span>
          </div>

          {/* Text Box Ready to Copy */}
          <div className="relative">
            <textarea
              readOnly
              rows={8}
              value={generatedText}
              className="w-full p-3.5 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl border border-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed selection:bg-emerald-600 selection:text-white"
            />
          </div>

          <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Teks di atas disusun khusus untuk laporan grup WhatsApp. Transaksi dengan ukuran, jenis, dan type yang sama pada shift ini otomatis direkap/dijumlahkan agar ketikan ringkas dan rapi.
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Mode Aktif: <b className="text-slate-800">{activeMode === 'PENERIMAAN' ? 'Penerimaan / Hasil Produksi' : 'Pengeluaran Pallet'}</b>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(generatedText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Buka langsung di aplikasi atau Web WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>Kirim ke WA</span>
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
                copied
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>TEKS TERSALIN!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>SALIN TEKS WHATSAPP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

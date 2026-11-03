import React, { useState, useMemo } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Download,
  X,
  Clock,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  FileText,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ShiftType, Transaction } from '../../types';
import {
  computeShiftStats,
  exportShiftReportToExcel,
  getPrintableShiftReportHTML,
  formatIndoDate,
  getShiftSchedule,
  getOperationalDate
} from '../../utils/shiftReportUtils';
import { printDocument } from '../../utils/exportUtils';
import { exportToPDF, formatPalletDimension } from '../../utils/pdfExportUtils';
import { SalinLaporanWAModal } from '../common/SalinLaporanWAModal';

interface CetakLaporanShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialShift?: ShiftType;
}

export const CetakLaporanShiftModal: React.FC<CetakLaporanShiftModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialShift = 'Shift 2'
}) => {
  const { transactions, currentUser, activeShift, showNotification } = useApp();
  const operatorName = currentUser?.name || 'Indika (Operator)';

  const defaultDateStr = useMemo(() => getOperationalDate(), []);
  const todayStr = defaultDateStr;

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || defaultDateStr);
  const [selectedShift, setSelectedShift] = useState<ShiftType>(initialShift || activeShift || 'Shift 2');
  const [txMode, setTxMode] = useState<'ALL' | 'PENERIMAAN' | 'PENGELUARAN'>('ALL');
  const [activeTab, setActiveTab] = useState<'preview' | 'data'>('preview');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showWaModal, setShowWaModal] = useState(false);

  // Sync date/shift if props change on open
  React.useEffect(() => {
    if (isOpen) {
      if (initialDate) setSelectedDate(initialDate);
      if (initialShift) setSelectedShift(initialShift);
    }
  }, [isOpen, initialDate, initialShift]);

  // Compute stats for current selection
  const stats = useMemo(() => {
    return computeShiftStats({
      date: selectedDate,
      shift: selectedShift,
      operatorName,
      transactions,
      transactionMode: txMode
    });
  }, [selectedDate, selectedShift, operatorName, transactions, txMode]);

  // Printable HTML string
  const printableHtml = useMemo(() => {
    return getPrintableShiftReportHTML({
      date: selectedDate,
      shift: selectedShift,
      operatorName,
      transactions,
      transactionMode: txMode
    });
  }, [selectedDate, selectedShift, operatorName, transactions, txMode]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const success = printDocument(printableHtml);
    if (success) {
      setNotice('Dialog cetak / simpan PDF dibuka di browser.');
      showNotification('success', 'Membuka Dialog Cetak', 'Silakan pilih cetak printer atau Simpan sebagai PDF (A4 Landscape).');
    } else {
      setNotice('Pencetakan langsung dibatasi browser preview. Gunakan tombol "Unduh Format A4 (.html)" atau "Buka di Tab Baru".');
    }
  };

  const handleOpenInNewTab = () => {
    try {
      const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank');
      if (!newWin) {
        handleDownloadHTML();
      } else {
        showNotification('success', 'Dokumen Dibuka', 'Pratonton resmi dibuka di tab baru.');
      }
    } catch (_) {
      handleDownloadHTML();
    }
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_${selectedShift.replace(/\s+/g, '_')}_${selectedDate}_${stats.docNumber.replace(/\//g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('success', 'File HTML A4 Diunduh', 'Dokumen format A4 siap cetak berhasil disimpan.');
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportShiftReportToExcel({
        date: selectedDate,
        shift: selectedShift,
        operatorName,
        transactions,
        transactionMode: txMode
      });
      showNotification('success', 'Excel Berhasil Diunduh', `File Excel resmi laporan ${selectedShift} berhasil diexport.`);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Gagal Export Excel', 'Terjadi kesalahan saat memproses laporan Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const allRows: (string | number)[][] = [];
      let rowNum = 1;
      if (txMode !== 'PENGELUARAN') {
        stats.inList.forEach((t) => {
          allRows.push([
            rowNum++,
            'PENERIMAAN',
            t.time,
            formatPalletDimension(t.palletSize),
            t.marketType,
            t.palletType,
            t.typePallet || 'LS',
            t.unit,
            t.quantity,
            t.pelatakanPallet || '-',
            t.customer,
            t.notes || ''
          ]);
        });
      }
      if (txMode !== 'PENERIMAAN') {
        stats.outList.forEach((t) => {
          allRows.push([
            rowNum++,
            'PENGELUARAN',
            t.time,
            formatPalletDimension(t.palletSize),
            t.marketType,
            t.palletType,
            t.typePallet || 'LS',
            t.unit,
            t.quantity,
            t.pelatakanPallet || '-',
            t.customer,
            t.notes || ''
          ]);
        });
      }
      const headers = ['No', 'Tipe', 'Jam', 'Ukuran Pallet', 'Region', 'Wrap Type', 'Pallet Runners', 'Satuan', 'Qty', 'Kolom', 'User / Sumber', 'Keterangan'];
      await exportToPDF({
        filename: `Laporan_${selectedShift.replace(/\s+/g, '_')}_${selectedDate}`,
        reportTitle: `LAPORAN OPERASIONAL ${selectedShift.toUpperCase()} - ${formatIndoDate(selectedDate).toUpperCase()}`,
        periodLabel: `${formatIndoDate(selectedDate)} (${selectedShift})`,
        operatorName,
        docNumber: stats.docNumber,
        shift: selectedShift,
        headers,
        rows: allRows,
        totalsSummary: `Total Masuk: +${stats.totalIn} | Total Keluar: -${stats.totalOut} | Net Mutasi: ${stats.totalIn - stats.totalOut}`,
        orientation: 'landscape',
        signatures: true
      });
      showNotification('success', 'PDF Berhasil Diunduh', `Laporan ${selectedShift} format PDF (.pdf) resmi berhasil disimpan.`);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Gagal Export PDF', 'Terjadi kesalahan saat memproses laporan PDF.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 no-print animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Laporan Operasional Shift (A4 & Excel)
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {stats.docNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cetak & ekspor rekap penerimaan & pengeluaran pallet resmi per shift untuk kebutuhan officer & supervisor.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Buka Pratonton di Tab Baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Tab Baru</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-6 shrink-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Tanggal Picker */}
            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Tanggal Operasional:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                    selectedDate === todayStr
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Pilih Hari Ini"
                >
                  Hari Ini
                </button>
              </div>
            </div>

            {/* Shift Picker */}
            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Pilih Shift:
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                {(['Shift 1', 'Shift 2', 'Shift 3'] as ShiftType[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedShift(s)}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      selectedShift === s
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Transaksi */}
            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Cakupan Transaksi:
              </label>
              <select
                value={txMode}
                onChange={(e) => setTxMode(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
              >
                <option value="ALL">Semua (Pemasukan & Pengeluaran)</option>
                <option value="PENERIMAAN">Hanya Penerimaan (Masuk)</option>
                <option value="PENGELUARAN">Hanya Pengeluaran (Keluar)</option>
              </select>
            </div>
          </div>

          {/* Registration Number & Metric Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-medium">Nomor Registrasi Resmi:</span>
              <span className="font-mono font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs tracking-wide">
                {stats.docNumber}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({getShiftSchedule(selectedShift)})
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono font-bold text-xs">
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Masuk: +{stats.totalIn} ({stats.inList.length} tx)
              </span>
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Keluar: -{stats.totalOut} ({stats.outList.length} tx)
              </span>
              <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                Net: {stats.netQty >= 0 ? `+${stats.netQty}` : stats.netQty}
              </span>
            </div>
          </div>
        </div>

        {/* Action Toolbar on Top */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Pratonton Dokumen A4
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'data'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Rincian Tabel ({stats.inList.length + stats.outList.length} Data)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWaModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              title="Salin Format Laporan WhatsApp Resmi (Penerimaan / Pengeluaran Terpisah)"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Salin Teks WA</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-100" />
              <span>Cetak A4 / PDF</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              title="Unduh laporan shift langsung sebagai file PDF resmi (.pdf)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF (.pdf)</span>
            </button>

            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Unduh file dokumen format A4 mandiri"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>Unduh A4 (.html)</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
              <span>{isExportingExcel ? 'Membuat...' : 'Unduh Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Notice if any */}
        {notice && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="font-bold text-amber-800 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 flex justify-center">
          {activeTab === 'preview' ? (
            /* Document Preview Card */
            <div className="w-full max-w-4xl bg-white border border-slate-300 rounded-sm shadow-md p-6 sm:p-8 space-y-4 text-slate-900 font-sans">
              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-950 uppercase">
                    PT INDAH KIAT PULP & PAPER TBK
                  </h1>
                  <div className="text-xs font-bold text-emerald-800">
                    WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-2 uppercase">
                    LAPORAN MUTASI PENERIMAAN & PENGELUARAN PALLET - {selectedShift.toUpperCase()}
                  </div>
                </div>

                <div className="text-right text-xs font-mono shrink-0 bg-slate-900 text-white p-2.5 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-300">NO. REGISTRASI DOKUMEN:</div>
                  <div className="text-sm font-extrabold text-amber-400">{stats.docNumber}</div>
                  <div className="text-[10px] text-emerald-300 mt-0.5">Resmi & Terverifikasi</div>
                </div>
              </div>

              {/* Metadata Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Tanggal Operasional:</span>
                  <span className="font-bold text-slate-900">{stats.formattedDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Shift Kerja:</span>
                  <span className="font-bold text-slate-900">{stats.shiftSchedule}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Petugas Operator:</span>
                  <span className="font-bold text-slate-900">Semua Operator Finish Pallet</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Transaksi:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {stats.inList.length + stats.outList.length} Transaksi Terdaftar
                  </span>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-700">Penerimaan (Masuk)</div>
                    <div className="text-base font-extrabold font-mono text-emerald-700">+{stats.totalIn} Unit</div>
                  </div>
                  <div className="text-[11px] font-mono opacity-80 text-right">{stats.totalInSet} Set<br/>{stats.totalInPcs} Pcs</div>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-700">Pengeluaran (Keluar)</div>
                    <div className="text-base font-extrabold font-mono text-amber-700">-{stats.totalOut} Unit</div>
                  </div>
                  <div className="text-[11px] font-mono opacity-80 text-right">{stats.totalOutSet} Set<br/>{stats.totalOutPcs} Pcs</div>
                </div>

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-blue-700">Net Mutasi Shift</div>
                    <div className={`text-base font-extrabold font-mono ${stats.netQty >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {stats.netQty >= 0 ? `+${stats.netQty}` : stats.netQty} Unit
                    </div>
                  </div>
                  <div className="text-[11px] opacity-80 text-right">Selisih Stok</div>
                </div>
              </div>

              {/* Section 1: Inbound Table */}
              {(txMode === 'ALL' || txMode === 'PENERIMAAN') && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200">
                    <span>1. RINCIAN PENERIMAAN (MASUK) PALLET</span>
                    <span>+{stats.totalIn} Unit ({stats.inList.length} Tx)</span>
                  </div>
                  <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                    <thead className="bg-slate-900 text-white uppercase text-[9.5px]">
                      <tr>
                        <th className="p-1.5 border border-slate-800 text-center w-8">No</th>
                        <th className="p-1.5 border border-slate-800 text-center w-14">Jam</th>
                        <th className="p-1.5 border border-slate-800">No. Transaksi</th>
                        <th className="p-1.5 border border-slate-800">Ukuran</th>
                        <th className="p-1.5 border border-slate-800 text-center w-10">Pallet Runners</th>
                        <th className="p-1.5 border border-slate-800">Wrap Type</th>
                        <th className="p-1.5 border border-slate-800">Asal / Supplier</th>
                        <th className="p-1.5 border border-slate-800 text-right w-16">Qty</th>
                        <th className="p-1.5 border border-slate-800 text-center w-12">Satuan</th>
                        <th className="p-1.5 border border-slate-800">Peletakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {stats.inList.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-4 text-center text-slate-400 italic">
                            Tidak ada transaksi penerimaan di shift ini.
                          </td>
                        </tr>
                      ) : (
                        stats.inList.map((t, idx) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="p-1.5 text-center font-mono">{idx + 1}</td>
                            <td className="p-1.5 text-center font-mono text-slate-600">{t.time}</td>
                            <td className="p-1.5 font-mono text-slate-700">{t.transactionNumber}</td>
                            <td className="p-1.5 font-bold text-slate-900">{t.palletSize}</td>
                            <td className="p-1.5 text-center">
                              <span className="px-1 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {t.typePallet || 'LS'}
                              </span>
                            </td>
                            <td className="p-1.5 text-slate-700">{t.palletType}</td>
                            <td className="p-1.5 text-slate-800 font-medium">{t.customer || '-'}</td>
                            <td className="p-1.5 text-right font-mono font-bold text-emerald-600">+{t.quantity}</td>
                            <td className="p-1.5 text-center font-mono">{t.unit}</td>
                            <td className="p-1.5 text-slate-600">{t.pelatakanPallet || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Section 2: Outbound Table */}
              {(txMode === 'ALL' || txMode === 'PENGELUARAN') && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded border border-amber-200">
                    <span>2. RINCIAN PENGELUARAN (KELUAR) PALLET</span>
                    <span>-{stats.totalOut} Unit ({stats.outList.length} Tx)</span>
                  </div>
                  <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                    <thead className="bg-slate-900 text-white uppercase text-[9.5px]">
                      <tr>
                        <th className="p-1.5 border border-slate-800 text-center w-8">No</th>
                        <th className="p-1.5 border border-slate-800 text-center w-14">Jam</th>
                        <th className="p-1.5 border border-slate-800">No. Transaksi</th>
                        <th className="p-1.5 border border-slate-800">Ukuran</th>
                        <th className="p-1.5 border border-slate-800 text-center w-10">Pallet Runners</th>
                        <th className="p-1.5 border border-slate-800">Wrap Type</th>
                        <th className="p-1.5 border border-slate-800">User / Tujuan</th>
                        <th className="p-1.5 border border-slate-800 text-right w-16">Qty</th>
                        <th className="p-1.5 border border-slate-800 text-center w-12">Satuan</th>
                        <th className="p-1.5 border border-slate-800">Peletakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {stats.outList.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-4 text-center text-slate-400 italic">
                            Tidak ada transaksi pengeluaran di shift ini.
                          </td>
                        </tr>
                      ) : (
                        stats.outList.map((t, idx) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="p-1.5 text-center font-mono">{idx + 1}</td>
                            <td className="p-1.5 text-center font-mono text-slate-600">{t.time}</td>
                            <td className="p-1.5 font-mono text-slate-700">{t.transactionNumber}</td>
                            <td className="p-1.5 font-bold text-slate-900">{t.palletSize}</td>
                            <td className="p-1.5 text-center">
                              <span className="px-1 py-0.2 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {t.typePallet || 'LS'}
                              </span>
                            </td>
                            <td className="p-1.5 text-slate-700">{t.palletType}</td>
                            <td className="p-1.5 text-slate-800 font-medium">{t.customer || '-'}</td>
                            <td className="p-1.5 text-right font-mono font-bold text-amber-600">-{t.quantity}</td>
                            <td className="p-1.5 text-center font-mono">{t.unit}</td>
                            <td className="p-1.5 text-slate-600">{t.pelatakanPallet || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Official 3-tier Signatures */}
              <div className="pt-6 border-t border-slate-300">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide text-center mb-4">
                  Lembar Verifikasi & Pengesahan Dokumen Operasional Shift
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  <div>
                    <p className="font-semibold text-slate-700">Dibuat / Dilaporkan Oleh:</p>
                    <p className="text-[10px] text-slate-500 font-medium">Operator Finish Pallet</p>
                    <div className="h-14 flex items-end justify-center">
                      <p className="font-mono text-slate-900 text-[11px]">
                        ( .................................................. )
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Tulis Nama Terang & TTD</p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700">Diperiksa Oleh:</p>
                    <p className="text-[10px] text-slate-500 font-medium">Supervisor Workshop Pallet & Coreplug</p>
                    <div className="h-14 flex items-end justify-center">
                      <p className="font-mono text-slate-900 text-[11px]">
                        ( .................................................. )
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Tulis Nama Terang & TTD</p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700">Disetujui Oleh:</p>
                    <p className="text-[10px] text-slate-500 font-medium">Manager Workshop Pallet & Coreplug</p>
                    <div className="h-14 flex items-end justify-center">
                      <p className="font-mono text-slate-900 text-[11px]">
                        ( .................................................. )
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Tulis Nama Terang & TTD</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab Data Rinci */
            <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Rekapitulasi Mutasi per Ukuran Pallet - {selectedShift} ({selectedDate})
              </h3>

              {stats.summaryBySize.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Tidak ada pergerakan stok pallet pada shift dan tanggal ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-slate-900 text-white uppercase text-[10px]">
                      <tr>
                        <th className="p-2 text-center w-8">No</th>
                        <th className="p-2">Ukuran Pallet</th>
                        <th className="p-2 text-center w-12">Type</th>
                        <th className="p-2">Jenis Pallet</th>
                        <th className="p-2 text-center w-12">Satuan</th>
                        <th className="p-2 text-right">Masuk (+)</th>
                        <th className="p-2 text-right">Keluar (-)</th>
                        <th className="p-2 text-right">Net Mutasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.summaryBySize.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-900">{s.palletSize}</td>
                          <td className="p-2 text-center font-bold">{s.typePallet}</td>
                          <td className="p-2 text-slate-700">{s.palletType}</td>
                          <td className="p-2 text-center font-mono">{s.unit}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600">+{s.inQty}</td>
                          <td className="p-2 text-right font-mono font-bold text-amber-600">-{s.outQty}</td>
                          <td className="p-2 text-right font-mono font-extrabold text-slate-900">
                            {s.netQty >= 0 ? `+${s.netQty}` : s.netQty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
            <span>Format Registrasi: <b>Shift/tanggalbulantahun/WSPCP</b></span>
            <span>·</span>
            <span>Contoh: <b>002/12102026/WSPCP</b></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Report Modal */}
      <SalinLaporanWAModal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        initialMode={txMode === 'PENGELUARAN' ? 'PENGELUARAN' : 'PENERIMAAN'}
        initialDate={selectedDate}
        initialShift={selectedShift}
      />
    </div>
  );
};

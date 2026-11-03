import React, { useState } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Download,
  X,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  printDocument,
  getPrintableHTML,
  downloadPrintableHTML,
  exportToExcel,
  generateDocNumber,
  generateStockTakeDocNumber
} from '../../utils/exportUtils';
import { exportToPDF } from '../../utils/pdfExportUtils';
import { useApp } from '../../context/AppContext';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  periodLabel: string;
  headers: string[];
  rows: (string | number)[][];
  totalsSummary?: string;
  filenamePrefix?: string;
  customHtml?: string;
  docNumber?: string;
  shift?: string;
  operatorName?: string;
  onDownloadExcel?: () => Promise<void> | void;
  onDownloadPDF?: () => Promise<void> | void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  reportTitle,
  periodLabel,
  headers,
  rows,
  totalsSummary,
  filenamePrefix = 'Laporan_Pallet',
  customHtml,
  docNumber,
  shift,
  operatorName: customOperatorName,
  onDownloadExcel,
  onDownloadPDF
}) => {
  const { currentUser, showNotification } = useApp();

  const [printNotice, setPrintNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const isStockTake =
    reportTitle.toLowerCase().includes('stok') ||
    reportTitle.toLowerCase().includes('stock') ||
    filenamePrefix.toLowerCase().includes('stok');

  const effectiveOperator =
    customOperatorName ||
    (isStockTake ? 'Semua Operator Finish Pallet' : (currentUser?.name || 'Indika (Operator)'));

  const effectiveDocNumber =
    docNumber ||
    (isStockTake
      ? generateStockTakeDocNumber(undefined, undefined, periodLabel)
      : generateDocNumber(shift || 'Shift 1', periodLabel));

  const printableHtml =
    customHtml ||
    getPrintableHTML(
      reportTitle,
      periodLabel,
      effectiveOperator,
      headers,
      rows,
      totalsSummary,
      effectiveDocNumber
    );

  const handleDirectPrint = () => {
    const success = printDocument(printableHtml);
    if (success) {
      setPrintNotice('Kotak dialog cetak printer / simpan PDF telah dikirim ke browser.');
      showNotification(
        'success',
        'Membuka Dialog Cetak',
        'Sistem sedang membuka opsi printer atau simpan sebagai PDF.'
      );
    } else {
      setPrintNotice(
        'Pencetakan langsung dibatasi oleh browser preview. Silakan klik "Unduh Format Cetak (A4)" di atas.'
      );
      showNotification(
        'info',
        'Format Cetak Siap',
        'Silakan unduh dokumen format cetak A4 atau buka di tab baru.'
      );
    }
  };

  const handleOpenInNewTab = () => {
    try {
      const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank');
      if (!newWin) {
        // Pop-up blocked, fallback to download
        handleDownloadPrintable();
      } else {
        showNotification('success', 'Dokumen Dibuka', 'Dokumen resmi dibuka di jendela baru siap cetak.');
      }
    } catch (_) {
      handleDownloadPrintable();
    }
  };

  const handleDownloadPrintable = () => {
    if (customHtml) {
      const blob = new Blob([customHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${filenamePrefix}_Siap_Cetak_${new Date().toISOString().split('T')[0]}.html`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      downloadPrintableHTML(
        `${filenamePrefix}_Siap_Cetak_${new Date().toISOString().split('T')[0]}`,
        reportTitle,
        periodLabel,
        effectiveOperator,
        headers,
        rows,
        totalsSummary,
        effectiveDocNumber
      );
    }
    showNotification(
      'success',
      'File Siap Cetak Diunduh',
      'File format cetak A4 berhasil disimpan. Anda dapat langsung mencetaknya kapan saja.'
    );
  };

  const handleDownloadPDF = async () => {
    try {
      if (onDownloadPDF) {
        await onDownloadPDF();
        return;
      }
      await exportToPDF({
        filename: `${filenamePrefix}_Resmi_${new Date().toISOString().split('T')[0]}`,
        reportTitle,
        periodLabel,
        operatorName: effectiveOperator,
        docNumber: effectiveDocNumber,
        headers,
        rows,
        totalsSummary,
        signatures: true
      });
      showNotification(
        'success',
        'PDF Resmi (.pdf) Diunduh',
        'Laporan resmi format PDF telah berhasil diunduh ke perangkat Anda.'
      );
    } catch (err) {
      console.error('Error generating PDF:', err);
      showNotification('error', 'Gagal Ekspor PDF', 'Terjadi kesalahan saat mengekspor dokumen PDF.');
    }
  };

  const handleDownloadExcel = async () => {
    if (onDownloadExcel) {
      await onDownloadExcel();
      return;
    }
    await exportToExcel({
      filename: `${filenamePrefix}_Resmi_${new Date().toISOString().split('T')[0]}`,
      reportTitle,
      periodLabel,
      operatorName: effectiveOperator,
      docNumber: effectiveDocNumber,
      headers,
      rows,
      signatures: true
    });
    showNotification(
      'success',
      'Excel Resmi (.xlsx) Diunduh',
      'Laporan format Excel rapih & terverifikasi berhasil disimpan.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Action Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-600 text-white">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">
                PRATONTON & CETAK DOKUMEN RESMI (A4)
              </h3>
              <p className="text-[11px] text-slate-400">
                PT Indah Kiat Pulp & Paper Tbk · Format Siap Cetak & Serah Terima ke Atasan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs active:scale-95"
              title="Cetak langsung ke printer atau simpan sebagai PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs active:scale-95"
              title="Unduh laporan langsung sebagai file PDF resmi (.pdf)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
              title="Unduh laporan rapih berformat Excel resmi (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unduh Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPrintable}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
              title="Unduh file format A4 untuk dicetak"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Format A4 (.html)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              title="Buka di tab baru"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer ml-1"
              title="Tutup dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice alert banner */}
        {printNotice && (
          <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-4 text-xs text-amber-900 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{printNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintNotice(null)}
              className="text-amber-700 hover:text-amber-950 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Document Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div className="w-full max-w-3xl bg-white border border-slate-300 rounded-sm shadow-md p-6 sm:p-8 space-y-5 text-slate-900">
            {/* Corporate Letterhead Banner */}
            <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 uppercase">
                  PT INDAH KIAT PULP & PAPER TBK
                </h1>
                <div className="text-xs font-semibold text-emerald-800">
                  WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM
                </div>
                <div className="text-sm font-bold text-slate-900 mt-2 uppercase">
                  {reportTitle}
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
                <div className="font-bold text-slate-800">No. Registrasi: {effectiveDocNumber}</div>
                <div>Status: Resmi / Terverifikasi</div>
              </div>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Periode:</span>
                <span className="font-bold text-slate-900">{periodLabel}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Petugas / Operator:</span>
                <span className="font-semibold text-slate-900">{effectiveOperator}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Waktu Cetak:</span>
                <span className="font-mono text-slate-700">
                  {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Total Baris:</span>
                <span className="font-mono font-bold text-emerald-800">{rows.length} Data Transaksi</span>
              </div>
            </div>

            {/* Document Table */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    {headers.map((h, idx) => (
                      <th
                        key={idx}
                        className={`py-2.5 px-2.5 border border-slate-800 ${
                          h.toLowerCase().includes('qty') ||
                          h.toLowerCase().includes('total') ||
                          h.toLowerCase().includes('masuk') ||
                          h.toLowerCase().includes('keluar') ||
                          h.toLowerCase().includes('stok')
                            ? 'text-right'
                            : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={headers.length} className="py-8 text-center text-slate-400">
                        Tidak ada data yang dicatat pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        {row.map((cell, cIdx) => {
                          const isNumber = typeof cell === 'number';
                          return (
                            <td
                              key={cIdx}
                              className={`py-2 px-2.5 border border-slate-200 ${
                                isNumber
                                  ? 'text-right font-mono font-bold text-slate-900'
                                  : 'text-slate-800'
                              }`}
                            >
                              {isNumber ? cell.toLocaleString('id-ID') : String(cell ?? '-')}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Box */}
            {totalsSummary && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-right font-bold text-xs text-amber-950 font-mono">
                {totalsSummary}
              </div>
            )}

            {/* Official 3-tier Signatures Block */}
            <div className="pt-6 border-t border-slate-200">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-4 text-center">
                Lembar Verifikasi & Pengesahan Dokumen Operasional Workshop
              </div>
              <div className="grid grid-cols-3 gap-4 text-center text-xs">
                <div>
                  <p className="font-semibold text-slate-700">Dibuat / Dilaporkan Oleh:</p>
                  <p className="text-[10px] text-slate-500 font-medium">Operator Finish Pallet</p>
                  <div className="h-14 flex items-end justify-center">
                    <p className="font-medium font-mono text-slate-900 text-[11px]">
                      ( .................................................. )
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Tulis Nama Terang & TTD</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-700">Diperiksa Oleh:</p>
                  <p className="text-[10px] text-slate-500 font-medium">Supervisor Workshop Pallet & Coreplug</p>
                  <div className="h-14 flex items-end justify-center">
                    <p className="font-medium font-mono text-slate-900 text-[11px]">
                      ( .................................................. )
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Tulis Nama Terang & TTD</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-700">Disetujui Oleh:</p>
                  <p className="text-[10px] text-slate-500 font-medium">Manager Workshop Pallet & Coreplug</p>
                  <div className="h-14 flex items-end justify-center">
                    <p className="font-medium font-mono text-slate-900 text-[11px]">
                      ( .................................................. )
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Tulis Nama Terang & TTD</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-500">
            Format resmi PT Indah Kiat Pulp & Paper Tbk · Dilengkapi lembar tanda tangan 3 rangkap untuk atasan.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded cursor-pointer transition-colors shadow-xs"
            >
              Cetak Langsung (A4)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded hover:bg-slate-700 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

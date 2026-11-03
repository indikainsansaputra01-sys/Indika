import React, { useState, useEffect } from 'react';
import { Transaction } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Edit2,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { TransactionRevisionModal } from './TransactionRevisionModal';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onOpenRevision?: (tx: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onOpenRevision
}) => {
  const { isOperator } = useApp();
  const [activeTx, setActiveTx] = useState<Transaction | null>(transaction);
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);

  useEffect(() => {
    setActiveTx(transaction);
  }, [transaction]);

  if (!activeTx) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <div className="bg-white rounded-xl border border-slate-300 w-full max-w-xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-lg text-white ${
                  activeTx.transactionType === 'PENERIMAAN'
                    ? 'bg-emerald-600'
                    : activeTx.transactionType === 'PINDAH_KOLOM'
                    ? 'bg-blue-600'
                    : 'bg-amber-600'
                }`}
              >
                {activeTx.transactionType === 'PENERIMAAN' ? (
                  <ArrowDownToLine className="w-4 h-4" />
                ) : activeTx.transactionType === 'PINDAH_KOLOM' ? (
                  <ArrowLeftRight className="w-4 h-4" />
                ) : (
                  <ArrowUpFromLine className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-wider">
                    {activeTx.transactionNumber}
                  </span>
                  {activeTx.isRevised && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      DIREVISI
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  DETAIL MUTASI PALLET · FINISH AREA
                </div>
              </div>
            </div>

            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
            {/* Revision Notice Banner */}
            {activeTx.isRevised && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <div className="font-bold">Transaksi Telah Mengalami Koreksi / Revisi:</div>
                  <div className="text-slate-700 mt-0.5">
                    Direvisi oleh <b>{activeTx.revisedBy || activeTx.lastModifiedBy}</b>
                    {activeTx.revisedAt && ` pada ${new Date(activeTx.revisedAt).toLocaleString('id-ID')}`}.
                  </div>
                  {activeTx.revisionReason && (
                    <div className="mt-1 text-blue-800 font-semibold bg-white/70 p-1.5 rounded border border-blue-200">
                      Alasan: &ldquo;{activeTx.revisionReason}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Badge & Quick Stats */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-slate-500 block text-[11px]">Jenis Transaksi</span>
                <span
                  className={`font-bold text-sm ${
                    activeTx.transactionType === 'PENERIMAAN'
                      ? 'text-emerald-800'
                      : activeTx.transactionType === 'PINDAH_KOLOM'
                      ? 'text-blue-800'
                      : 'text-amber-800'
                  }`}
                >
                  {activeTx.transactionType === 'PENERIMAAN'
                    ? 'PENERIMAAN (MASUK)'
                    : activeTx.transactionType === 'PINDAH_KOLOM'
                    ? 'PINDAH KOLOM (RELOKASI)'
                    : 'PENGELUARAN (KELUAR)'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Kuantitas & Satuan</span>
                <span className="font-mono font-extrabold text-xl text-slate-900 tabular-nums">
                  {activeTx.quantity.toLocaleString('id-ID')} {activeTx.unit}
                </span>
              </div>
            </div>

            {/* Key Specifications Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Ukuran Pallet</span>
                <span className="font-bold text-slate-900 text-sm font-mono mt-0.5 block">
                  {activeTx.palletSize}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Type Pallet</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      (activeTx.typePallet || 'LS') === 'LS'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                    }`}
                  >
                    {activeTx.typePallet || 'LS'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {(activeTx.typePallet || 'LS') === 'LS' ? 'Long Side' : 'Short Side'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Jenis Pallet</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {activeTx.palletType}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">User / Customer</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {activeTx.customer}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Klasifikasi Pasar</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {activeTx.marketType}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                  Pelatakan / Kolom Yard
                </span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block font-mono">
                  {activeTx.transactionType === 'PINDAH_KOLOM' ? (
                    <span className="text-blue-700">
                      {activeTx.pelatakanPallet || '-'} ➔ {activeTx.kolomTujuan || '-'}
                    </span>
                  ) : (
                    activeTx.pelatakanPallet || '-'
                  )}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                  No.Run (Nomor Run)
                </span>
                <span className="font-bold text-amber-900 text-sm mt-0.5 block font-mono">
                  {activeTx.noRun ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {activeTx.noRun}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal">-</span>
                  )}
                </span>
              </div>
            </div>

            {/* Operational Log Details */}
            <div className="grid grid-cols-3 gap-3 p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50">
              <div>
                <span className="text-slate-500 block text-[10px]">Tanggal & Jam</span>
                <span className="font-mono font-semibold text-slate-900">
                  {activeTx.date} {activeTx.time}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Shift Operasional</span>
                <span className="font-semibold text-slate-900">{activeTx.shift}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Operator Bertugas</span>
                <span className="font-semibold text-slate-900">{activeTx.operator}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <span className="text-slate-700 font-bold block mb-1">Catatan Tambahan:</span>
              <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic">
                {activeTx.notes || 'Tidak ada catatan khusus.'}
              </p>
            </div>

            {/* Metadata */}
            <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] text-slate-600 font-mono space-y-1">
              <div className="flex justify-between">
                <span>Dibuat Oleh:</span>
                <span className="text-slate-900 font-medium">
                  {activeTx.createdBy} ({activeTx.createdAt.substring(0, 16)})
                </span>
              </div>
              {activeTx.lastModifiedBy && (
                <div className="flex justify-between text-blue-900 font-medium">
                  <span>Terakhir Diubah:</span>
                  <span>
                    {activeTx.lastModifiedBy} ({activeTx.lastModifiedAt?.substring(0, 16)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div>
              {isOperator && (
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  title="Koreksi data transaksi (ukuran, jenis, tipe, qty, shift, tanggal, dll)"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Revisi / Koreksi Transaksi</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Revision Modal */}
      {showRevisionModal && (
        <TransactionRevisionModal
          transaction={activeTx}
          isOpen={showRevisionModal}
          onClose={() => setShowRevisionModal(false)}
          onSuccess={(updated) => {
            setActiveTx(updated);
            if (onOpenRevision) onOpenRevision(updated);
          }}
        />
      )}
    </>
  );
};

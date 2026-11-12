import React from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  X,
  Ruler,
  Layers,
  Calendar,
  MapPin
} from 'lucide-react';

export type OperationalWarningType = 'penerimaan' | 'pengeluaran';

interface OperationalWarningModalProps {
  isOpen: boolean;
  type: OperationalWarningType | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OperationalWarningModal: React.FC<OperationalWarningModalProps> = ({
  isOpen,
  type,
  onConfirm,
  onCancel
}) => {
  if (!isOpen || !type) return null;

  const isPenerimaan = type === 'penerimaan';

  const modalTitle = isPenerimaan
    ? 'Konfirmasi Operasional Penerimaan Produksi'
    : 'Konfirmasi Operasional Pengeluaran Pallet';

  const modalSubtitle = isPenerimaan
    ? 'Verifikasi Standar Anti-Salah Input Pallet Hasil Produksi (FPMS)'
    : 'Verifikasi Standar Anti-Salah Input Pengeluaran & Pengiriman Pallet (FPMS)';

  // Kalimat notifikasi persis sesuai instruksi user
  const mainMessage = isPenerimaan
    ? 'Pastikan Penginputan Pallet Hasil Produksi Sudah Benar Dari Ukuran, Spesifikasi, & Tanggal Penerimaannya'
    : 'Pastikan Penginputan Pengeluaran/Pengiriman Pallet  Sudah Benar Dari Ukuran, Spesifikasi, Kolom Pengambilan & Tanggal Pengiriman nya';

  const checklistItems = isPenerimaan
    ? [
        {
          label: 'Ukuran Pallet',
          desc: 'Periksa dimensi fisik (panjang × lebar × tebal) sesuai bukti produksi.',
          icon: Ruler
        },
        {
          label: 'Spesifikasi & Wrap Type',
          desc: 'Pastikan kesesuaian Reamwrap, Bulkpack, Racuk, Sirkulasi, serta orientasi LS/SS & Pasar Lokal/Ekspor.',
          icon: Layers
        },
        {
          label: 'Tanggal Penerimaan',
          desc: 'Pastikan tanggal transaksi dan shift kerja operator sesuai jam aktual produksi.',
          icon: Calendar
        }
      ]
    : [
        {
          label: 'Ukuran Pallet',
          desc: 'Pastikan ukuran yang dikeluarkan cocok dengan pesanan User pemohon.',
          icon: Ruler
        },
        {
          label: 'Spesifikasi & Wrap Type',
          desc: 'Verifikasi jenis pallet yang dikeluarkan (Lokal/Ekspor, Reamwrap/Bulkpack/Racuk).',
          icon: Layers
        },
        {
          label: 'Kolom Pengambilan',
          desc: 'Pastikan fisik pallet benar-benar diambil dari kolom yard yang dialokasikan di lapangan.',
          icon: MapPin
        },
        {
          label: 'Tanggal Pengiriman',
          desc: 'Pastikan tanggal pengeluaran dan shift operasional tercatat akurat untuk serah terima NPP.',
          icon: Calendar
        }
      ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0E1E2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1E3A52] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isPenerimaan
              ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                isPenerimaan
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isPenerimaan ? (
                <ArrowDownToLine className="w-5 h-5" />
              ) : (
                <ArrowUpFromLine className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide truncate">
                {modalTitle}
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                {modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1E3A52] transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-5 space-y-4">
          {/* Main Notification Box */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isPenerimaan
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-100'
                : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                isPenerimaan
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pemberitahuan Wajib:
              </span>
              <p className="text-sm sm:text-[15px] font-black leading-snug tracking-tight">
                "{mainMessage}"
              </p>
            </div>
          </div>

          {/* Checklist Verification Box */}
          <div className="bg-slate-50 dark:bg-[#112435] rounded-xl p-3.5 border border-slate-200 dark:border-[#1E3A52] space-y-2.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPenerimaan ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>Poin Verifikasi Sebelum Melanjutkan:</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {checklistItems.map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 bg-white dark:bg-[#0E1E2E] p-2.5 rounded-lg border border-slate-200/80 dark:border-[#1E3A52]/80 text-xs"
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        isPenerimaan
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      <ItemIcon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 ${
                isPenerimaan
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isPenerimaan
                  ? 'Saya Mengerti, Buka Penerimaan'
                  : 'Saya Mengerti, Buka Pengeluaran'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

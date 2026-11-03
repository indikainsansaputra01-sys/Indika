import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Monitor, Smartphone, Check, X, HelpCircle, ExternalLink, QrCode } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'header' | 'sidebar' | 'menu';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const appUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleTrigger = async () => {
    if (isInstallable) {
      const res = await install();
      if (!res) setShowGuide(true);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' && (
        <button
          onClick={handleTrigger}
          title="Pasang aplikasi di PC / Tablet pabrik (PWA)"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 transition-colors cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
            <span>{isInstalled ? 'Aplikasi Terpasang' : 'Instal Aplikasi (PWA)'}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
            {isInstalled ? 'AKTIF' : 'PASANG'}
          </span>
        </button>
      )}

      {variant === 'menu' && (
        <button
          onClick={handleTrigger}
          className="w-full flex items-center justify-between text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-3 py-2 rounded-lg transition-colors cursor-pointer font-medium"
        >
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{isInstalled ? 'Aplikasi Sudah Terpasang' : 'Instal Aplikasi Pabrik (PWA)'}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
            {isInstalled ? 'AKTIF' : 'PASANG'}
          </span>
        </button>
      )}

      {variant === 'header' && (
        <button
          onClick={handleTrigger}
          title="Pasang aplikasi di PC / Tablet pabrik"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-800/90 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/70 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-emerald-300" />
          <span className="hidden sm:inline">
            {isInstalled ? 'Aplikasi Terpasang' : 'Pasang di PC/Tablet'}
          </span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          onClick={handleTrigger}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Pasang Aplikasi</span>
        </button>
      )}

      {variant === 'full' && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-emerald-600 text-white shrink-0 mt-0.5">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-200">
                Pasang FPMS Sebagai Aplikasi Pabrik (PWA Offline-Ready)
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Jalankan sistem layaknya aplikasi desktop / mobile mandiri di tablet gudang, scanner, atau PC terminal tanpa bilah browser.
              </div>
            </div>
          </div>
          <button
            onClick={handleTrigger}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Pasang Sekarang</span>
          </button>
        </div>
      )}

      {/* Guide Modal for Factory Deployment */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-lg overflow-hidden shadow-2xl text-slate-900">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-emerald-600 text-white">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">PANDUAN PEMASANGAN APLIKASI PABRIK</h3>
                  <p className="text-[11px] text-slate-400">Finish Pallet Management System (PWA)</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Sistem Siap Digunakan di Pabrik
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Aplikasi ini dapat langsung dibuka oleh seluruh operator melalui browser apa pun di jaringan pabrik, atau dipasang ke layar utama / desktop agar terasa seperti software internal bawaan.
                </p>
              </div>

              {/* Instructions tabs or steps */}
              <div className="space-y-3">
                {/* 1. PC Terminal & Laptop (Google Chrome / MS Edge) */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs">
                    <Monitor className="w-4 h-4 text-emerald-700" />
                    Untuk PC Terminal / Komputer Gudang (Chrome / Edge):
                  </div>
                  <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Klik ikon <b>Install / Pasang Aplikasi</b> di bilah alamat browser (sebelah kanan URL).</li>
                    <li>Atau klik menu titik tiga di browser &rarr; pilih <b>"Simpan dan bagikan" / "Pasang FPMS Pallet"</b>.</li>
                    <li>Shortcut aplikasi akan otomatis muncul di Desktop & Taskbar komputer pabrik.</li>
                  </ol>
                </div>

                {/* 2. Tablet Android & Barcode Terminal */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs">
                    <Smartphone className="w-4 h-4 text-blue-700" />
                    Untuk Tablet Operator / HP Android:
                  </div>
                  <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Buka tautan ini di browser Google Chrome pada tablet.</li>
                    <li>Ketuk menu titik tiga (⋮) di pojok kanan atas.</li>
                    <li>Pilih <b>"Tambahkan ke Layar Utama" (Add to Home screen)</b> atau <b>"Pasang Aplikasi"</b>.</li>
                  </ol>
                </div>

                {/* 3. iPhone & iPad (Safari) */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs">
                    <Smartphone className="w-4 h-4 text-purple-700" />
                    Untuk iPhone / iPad (Safari):
                  </div>
                  <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                    <li>Buka tautan di browser <b>Safari</b>.</li>
                    <li>Ketuk tombol <b>Bagikan (Share)</b> di bilah bawah browser (ikon kotak berpanah ke atas).</li>
                    <li>Gulir ke bawah dan pilih <b>"Tambah ke Layar Utama" (Add to Home Screen)</b>.</li>
                  </ol>
                </div>

                {/* 4. Link URL Langsung */}
                <div className="p-3 border border-slate-200 rounded-lg">
                  <div className="font-bold text-slate-700 mb-1.5 text-[11px]">
                    Bagikan Tautan ke Operator / Supervisor:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={appUrl}
                      className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold text-[11px] shrink-0 cursor-pointer"
                    >
                      {copiedUrl ? 'Tersalin ✓' : 'Salin URL'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

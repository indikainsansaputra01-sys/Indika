import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 2400
}) => {
  const [fading, setFading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(10);
  const [statusText, setStatusText] = useState<string>('Memulai inisialisasi sistem FPMS...');

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentPct = Math.min(Math.round((elapsed / durationMs) * 100), 100);
      setProgress(currentPct);

      if (currentPct < 30) {
        setStatusText('Memuat basis data & konfigurasi operasional...');
      } else if (currentPct < 65) {
        setStatusText('Sinkronisasi jadwal roster & shift kerja operator...');
      } else if (currentPct < 90) {
        setStatusText('Memvalidasi saldo stok fisik & pemetaan kolom yard...');
      } else {
        setStatusText('Sistem siap digunakan. Membuka dashboard...');
      }

      if (elapsed >= durationMs) {
        clearInterval(interval);
      }
    }, 40);

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, Math.max(durationMs - 350, 800));

    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  const handleSkip = () => {
    setFading(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 150);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-white text-[#0F172A] select-none cursor-pointer transition-opacity duration-300 ease-out overflow-hidden ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Clean Light Gradient & Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-50/70 via-white to-slate-50" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-sky-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Identity */}
      <div className="relative z-10 w-full max-w-xl flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/pt_indah_kiat_logo_trimmed.png"
            alt="Logo Resmi PT Indah Kiat Pulp & Paper Karawang"
            className="h-8 sm:h-9 w-auto max-w-[170px] sm:max-w-[210px] object-contain drop-shadow-2xs"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/assets/aistudio/pt_indah_kiat_logo_white_stroke.png';
            }}
          />
          <div className="hidden sm:flex flex-col border-l border-slate-200 pl-3">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#163653] tracking-wide">
              KARAWANG MILL
            </span>
            <span className="text-[9px] text-slate-500 font-semibold">
              Workshop Pallet & Coreplug
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-[#163653] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>PORTAL OPERASIONAL</span>
        </div>
      </div>

      {/* Center Branding Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto py-8">
        {/* Central Logo Box: Crisp White Card with Gentle Shadow */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-sky-200/50 rounded-2xl blur-xl" />
          <div className="relative z-10 w-full h-full p-3 bg-white rounded-2xl border border-slate-200 shadow-xl flex items-center justify-center">
            <img
              src="/splash-pallet-logo-transparent.png"
              alt="Finish Pallet Logo"
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                // Fallback icon if custom image is missing
                const target = e.target as HTMLElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-[#163653]">
                      <svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  `;
                }
              }}
            />
          </div>
        </div>

        {/* System Title */}
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#163653] uppercase">
            Finished Goods Pallet
          </h1>
          <h2 className="text-sm sm:text-base font-bold tracking-wider text-[#3886B8] uppercase">
            Management System (FPMS)
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 font-normal max-w-md mt-3 leading-relaxed">
          Sistem Pengendalian Stok Pallet Hasil Produksi, Rekap Mutasi Shift, dan Pemetaan Kolom Yard Karawang
        </p>

        {/* Professional Loading Progress Bar in Crisp White Theme */}
        <div className="w-full max-w-xs sm:max-w-sm mt-8 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-600 font-medium truncate max-w-[220px]">
              {statusText}
            </span>
            <span className="text-[#163653] font-bold">
              {progress}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#3886B8] via-[#16805D] to-emerald-500 rounded-full transition-all duration-100 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] sm:text-[11px]">
        <div className="flex items-center gap-2 text-slate-600 font-semibold">
          <span>&copy; PT Indah Kiat Pulp & Paper Tbk</span>
          <span>&middot;</span>
          <span className="text-[#163653] font-black tracking-wide">Karawang Mill</span>
        </div>
        <div className="text-[#3886B8] hover:text-[#163653] font-bold underline decoration-[#3886B8]/50 hover:decoration-[#163653] transition-colors cursor-pointer flex items-center gap-1">
          <span>Ketuk layar untuk melewati</span>
          <span>&rarr;</span>
        </div>
      </div>
    </div>
  );
};

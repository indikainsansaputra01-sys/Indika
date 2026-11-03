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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-[#0F2336] text-white select-none cursor-pointer transition-opacity duration-300 ease-out overflow-hidden ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Subtle Tech Grid & Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1B4366]/40 via-[#0F2336] to-[#0A1826]" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#8CCCF0]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Identity */}
      <div className="relative z-10 w-full max-w-xl flex items-center justify-between border-b border-white/20 pb-4">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png"
            alt="PT Indah Kiat Karawang"
            className="h-8 sm:h-9 w-auto object-contain bg-white px-2 py-1 rounded shadow-xs"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <div className="text-[11px] sm:text-xs font-black tracking-widest text-white uppercase drop-shadow-xs">
              PT INDAH KIAT KARAWANG
            </div>
            <div className="text-[9px] sm:text-[10px] text-white font-semibold tracking-wide mt-0.5">
              Workshop Pallet & Coreplug
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F4568] border border-white/40 text-[10px] font-bold text-white shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PORTAL OPERASIONAL</span>
        </div>
      </div>

      {/* Center Branding Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto py-8">
        {/* Central Logo Box */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#8CCCF0]/20 rounded-2xl blur-xl" />
          <div className="relative z-10 w-full h-full p-3 bg-gradient-to-br from-[#163653] to-[#0E2437] rounded-2xl border border-white/20 shadow-2xl flex items-center justify-center">
            <img
              src="/splash-pallet-logo-transparent.png"
              alt="Finish Pallet Logo"
              className="w-full h-full object-contain drop-shadow"
              onError={(e) => {
                // Fallback icon if custom image is missing
                const target = e.target as HTMLElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-white">
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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase drop-shadow-sm">
            Finish Pallet
          </h1>
          <h2 className="text-sm sm:text-base font-bold tracking-wider text-[#93DCFF] uppercase drop-shadow-2xs">
            Management System (FPMS)
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-100 font-normal max-w-md mt-3 leading-relaxed">
          Sistem Pengendalian Stok Pallet Hasil Produksi, Rekap Mutasi Shift, dan Pemetaan Kolom Yard Karawang
        </p>

        {/* Professional Loading Progress Bar */}
        <div className="w-full max-w-xs sm:max-w-sm mt-8 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-white font-medium truncate max-w-[220px]">
              {statusText}
            </span>
            <span className="text-white font-bold">
              {progress}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#091522] rounded-full overflow-hidden border border-white/20 p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-300 rounded-full transition-all duration-100 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/20 pt-4 text-[10px] sm:text-[11px]">
        <div className="flex items-center gap-2 text-white font-semibold">
          <span>&copy; PT Indah Kiat Pulp & Paper Tbk</span>
          <span>&middot;</span>
          <span className="text-white font-black tracking-wide">Karawang Mill</span>
        </div>
        <div className="text-white font-bold underline decoration-white/70 hover:decoration-white transition-colors cursor-pointer flex items-center gap-1">
          <span>Ketuk layar untuk melewati</span>
          <span>&rarr;</span>
        </div>
      </div>
    </div>
  );
};

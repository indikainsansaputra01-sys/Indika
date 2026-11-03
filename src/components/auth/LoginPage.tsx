import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle, Sun, Moon } from 'lucide-react';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

export const LoginPage: React.FC = () => {
  const { login, employees, theme, toggleTheme } = useApp();
  const [selectedName, setSelectedName] = useState('');
  const [customName, setCustomName] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const operatorEmployees = employees.filter((e) => e.role === 'operator' && e.active);
  const monitoringEmployees = employees.filter((e) => e.role !== 'operator' && e.active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isManualInput ? customName.trim() : selectedName.trim();

    if (!finalName) {
      setError('Silakan pilih atau masukkan nama personil');
      return;
    }
    if (!password.trim()) {
      setError('Silakan masukkan kata sandi');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = login(finalName, password);
      if (!res.success) {
        setError(res.message || 'Nama atau kata sandi tidak sesuai.');
      }
    } catch {
      setError('Terjadi kendala saat memproses login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#163653] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C4266] via-[#163653] to-[#0E1E2E] flex flex-col justify-center items-center px-4 py-8">
      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-md flex justify-end mb-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#112B43]/90 hover:bg-[#1E4366] border border-[#234F77] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#8CCCF0]" />
              <span>Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md shadow-2xl rounded-2xl overflow-hidden border border-[#234F77]/70 bg-white dark:bg-[#0E1E2E]">
        {/* Brand Header with Deep Navy & Sky Blue Palette */}
        <div className="bg-[#112B43] border-b border-[#1E4366] p-6 text-center relative overflow-hidden">
          {/* Subtle Ambient Sky Blue Light Glow */}
          <div className="absolute -top-12 -left-12 w-36 h-36 bg-[#8CCCF0]/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-[#3886B8]/15 rounded-full blur-2xl pointer-events-none" />

          {/* Dual Logos: Sebelah Kiri Logo Indah Kiat, Sebelah Kanan Logo Finish Pallet */}
          <div className="flex items-center justify-center gap-3.5 sm:gap-4 mb-3.5 relative z-10">
            {/* Sebelah Kiri: Logo PT Indah Kiat Pulp & Paper */}
            <div className="flex items-center justify-center h-12 sm:h-14">
              <img
                src="/assets/aistudio/pt_indah_kiat_logo_white_stroke.png"
                alt="Logo PT Indah Kiat Pulp & Paper"
                className="h-10 sm:h-12 w-auto max-w-[145px] sm:max-w-[165px] object-contain transition-transform hover:scale-105 drop-shadow-md"
                style={{
                  filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/assets/aistudio/pt_indah_kiat_logo_trimmed.png';
                  target.style.filter = 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 4px #fff)';
                }}
              />
            </div>

            {/* Garis Pembatas Lembut */}
            <div className="h-9 w-px bg-[#234F77]" />

            {/* Sebelah Kanan: Logo Finish Pallet */}
            <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center shrink-0">
              <img
                src="/splash-pallet-logo-transparent.png"
                alt="Logo Finish Pallet"
                className="w-full h-full object-contain transition-transform hover:scale-105 drop-shadow-xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/splash-pallet-logo.jpg';
                }}
              />
            </div>
          </div>

          <h1 className="text-xl font-extrabold tracking-wide text-white uppercase font-sans">
            Finish Pallet Management System
          </h1>
          <p className="text-xs text-[#8CCCF0] font-medium mt-1">
            Area Finish Pallet &middot; Sistem Kontrol Logistik Pabrik
          </p>
        </div>

        {/* Login Form Body: Crisp White Card with Enterprise Styling */}
        <div className="bg-white dark:bg-[#0E1E2E] p-6 sm:p-8 space-y-5">
          <div className="border-b border-[#E2E8F0] dark:border-[#1E3A52] pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#172B3A] dark:text-white">Autentikasi Pengguna</h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">Silakan masuk menggunakan kredensial resmi personil</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#8CCCF0]/15 border border-[#8CCCF0]/30 flex items-center justify-center text-[#3886B8] dark:text-[#8CCCF0]">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
          </div>

          {error && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[#EF4444] rounded-lg font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Nama Pengguna */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#172B3A] dark:text-slate-200 uppercase tracking-wider">
                  Nama Personil
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualInput(!isManualInput);
                    setError('');
                  }}
                  className="text-[11px] text-[#3886B8] hover:text-[#163653] dark:hover:text-[#8CCCF0] font-semibold underline cursor-pointer"
                >
                  {isManualInput ? 'Pilih dari daftar' : 'Ketik manual'}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                  <User className="w-4 h-4" />
                </div>

                {isManualInput ? (
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setError('');
                    }}
                    placeholder="Ketik nama personil..."
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F8FAFC] dark:bg-[#163653]/40 border border-[#E2E8F0] dark:border-[#1E3A52] rounded-lg text-sm text-[#172B3A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#3886B8] focus:ring-1 focus:ring-[#3886B8] transition-colors"
                    required
                    autoFocus
                  />
                ) : (
                  <select
                    value={selectedName}
                    onChange={(e) => {
                      setSelectedName(e.target.value);
                      setError('');
                    }}
                    className="w-full pl-9 pr-8 py-2.5 bg-[#F8FAFC] dark:bg-[#163653]/40 border border-[#E2E8F0] dark:border-[#1E3A52] rounded-lg text-sm text-[#172B3A] dark:text-white focus:outline-none focus:border-[#3886B8] focus:ring-1 focus:ring-[#3886B8] cursor-pointer appearance-none transition-colors"
                    required
                  >
                    <option value="" className="text-gray-500">
                      -- Pilih Nama Karyawan --
                    </option>
                    <optgroup label="OPERATOR" className="font-semibold text-[#163653]">
                      {operatorEmployees.map((op) => (
                        <option key={op.id} value={op.name} className="text-[#172B3A]">
                          {op.name} ({op.title})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="MONITORING" className="font-semibold text-[#163653]">
                      {monitoringEmployees.map((m) => (
                        <option key={m.id} value={m.name} className="text-[#172B3A]">
                          {m.name} ({m.title})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                )}
              </div>

              {/* Preview Karakter Kartun Karyawan Terpilih */}
              {(() => {
                const targetName = (isManualInput ? customName : selectedName).trim().toLowerCase();
                const selectedEmp = employees.find((e) => e.name.toLowerCase() === targetName);
                if (!targetName) return null;
                return (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#8CCCF0]/10 border border-[#8CCCF0]/30 mt-2.5 animate-in fade-in duration-150">
                    <EmployeeAvatar
                      employee={selectedEmp || { name: isManualInput ? customName : selectedName }}
                      size="sm"
                      initialsPosition="corner"
                    />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="text-xs font-bold text-[#172B3A] dark:text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{selectedEmp ? selectedEmp.name : customName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#8CCCF0]/25 text-[#163653] dark:text-[#8CCCF0] border border-[#8CCCF0]/40 font-bold lowercase shrink-0">
                          {(selectedEmp ? selectedEmp.name : customName).slice(0, 2).toLowerCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                        {selectedEmp ? selectedEmp.title : 'Personil'} · Seragam Indah Kiat Karawang
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Input Kata Sandi */}
            <div>
              <label className="block text-xs font-bold text-[#172B3A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-9 pr-10 py-2.5 bg-[#F8FAFC] dark:bg-[#163653]/40 border border-[#E2E8F0] dark:border-[#1E3A52] rounded-lg text-sm text-[#172B3A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#3886B8] focus:ring-1 focus:ring-[#3886B8] tracking-wider transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748B] hover:text-[#172B3A] dark:hover:text-white cursor-pointer"
                  aria-label="Lihat sandi"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Tombol Submit Login: Primary Action Blue #3886B8 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#3886B8] hover:bg-[#2D739E] active:bg-[#163653] text-white font-bold rounded-lg text-sm transition-all shadow-sm cursor-pointer mt-3 disabled:opacity-50"
            >
              <span>{isLoading ? 'MEMPROSES...' : 'MASUK KE SISTEM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Catatan Keamanan */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E3A52] text-[11px] text-[#64748B] dark:text-slate-400 text-center space-y-1">
            <p>Sistem dilindungi autentikasi kata sandi personil terdaftar.</p>
            <p className="text-[#3886B8] dark:text-[#8CCCF0]">Hubungi Supervisor atau Admin jika memerlukan reset sandi.</p>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="bg-[#112B43] p-3 text-center text-xs text-[#8CCCF0] font-medium border-t border-[#1E4366]">
          Finish Pallet Control Station &middot; PT Indah Kiat Pulp & Paper Tbk
        </div>
      </div>
    </div>
  );
};

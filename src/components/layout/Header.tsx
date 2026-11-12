import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { LogOut, Clock, ChevronDown, Shield, Key, Sun, Moon, Link as LinkIcon, Check, Wifi, WifiOff, Menu, ChevronRight, RefreshCw } from 'lucide-react';
import { ShiftType } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

interface HeaderProps {
  currentView: string;
  onNavigate?: (view: string) => void;
  onOpenMobileMenu: () => void;
}

const VIEW_TITLES: Record<string, { title: string; category: string }> = {
  dashboard: { title: 'Dashboard', category: 'Ringkasan' },
  penerimaan: { title: 'Penerimaan Produksi', category: 'Operasional' },
  pengeluaran: { title: 'Pengeluaran Pallet', category: 'Operasional' },
  'pindah-kolom': { title: 'Pindah Kolom (Relokasi)', category: 'Operasional' },
  'ubah-spek': { title: 'Perubahan Spek Pallet', category: 'Operasional' },
  stok: { title: 'Data Stok Pallet', category: 'Operasional' },
  'riwayat-masuk': { title: 'Riwayat Penerimaan', category: 'Monitoring' },
  'riwayat-keluar': { title: 'Riwayat Pengeluaran', category: 'Monitoring' },
  riwayat: { title: 'Semua Riwayat Transaksi', category: 'Monitoring' },
  shift: { title: 'Monitoring Shift', category: 'Monitoring' },
  laporan: { title: 'Laporan & Rekap Stok', category: 'Monitoring' },
  'master-ukuran': { title: 'Master Ukuran', category: 'Master Data' },
  'master-jenis': { title: 'Master Wrap Type', category: 'Master Data' },
  'master-user': { title: 'Master User', category: 'Master Data' },
  'master-karyawan': { title: 'Master Karyawan', category: 'Master Data' },
  'audit-log': { title: 'Audit Log Sistem', category: 'Sistem' },
  pengaturan: { title: 'Pengaturan Sistem', category: 'Sistem' },
};

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onOpenMobileMenu }) => {
  const {
    currentUser,
    logout,
    activeShift,
    setActiveShift,
    isOperator,
    isAdmin,
    theme,
    setTheme,
    showNotification,
    appEnvironment,
    setAppEnvironment
  } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  const handleForceUpdateApp = async () => {
    setIsUpdating(true);
    showNotification('info', 'Memperbarui Aplikasi...', 'Membersihkan cache browser & memuat fitur terbaru...');
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + '?t=' + Date.now();
    }, 600);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCopyLink = () => {
    try {
      const url = window.location.origin;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showNotification('success', 'Tautan Web Disalin', `${url} berhasil disalin ke clipboard.`);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showNotification('info', 'Tautan Web', window.location.origin);
    }
  };

  const viewInfo = VIEW_TITLES[currentView] || { title: 'Finish Pallet', category: 'Sistem' };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#0E1E2E] border-b border-[#E2E8F0] dark:border-[#1E3A52] px-3 sm:px-6 flex items-center justify-between no-print transition-colors duration-200 shadow-2xs">
      {/* Zone 1: Mobile Trigger & Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-[#1E3A52] dark:text-slate-200 dark:hover:text-white rounded-lg focus:outline-none transition-colors shrink-0 cursor-pointer"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 min-w-0">
          <button
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="hover:text-[#3886B8] dark:hover:text-white font-bold transition-colors hidden sm:inline truncate cursor-pointer text-slate-800 dark:text-slate-200"
          >
            Finish Pallet
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 hidden sm:inline" />
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-white bg-[#163653] dark:bg-[#1E3A52] px-2 py-0.5 rounded text-[10px] hidden md:inline shrink-0">
            {viewInfo.category}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white truncate">
            {viewInfo.title}
          </span>
        </div>
      </div>

      {/* Zone 2: Shift Operasional & Connection Status */}
      <div className="hidden md:flex items-center gap-2.5 text-xs">
        {isOnline ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
            <span className="w-2 h-2 rounded-full bg-[#16805D] shrink-0"></span>
            <span className="text-[#16805D] dark:text-emerald-300 font-bold">Online Sync</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/80 text-[11px] text-amber-900 dark:text-amber-200 font-bold animate-pulse">
            <WifiOff className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
            <span className="text-amber-800 dark:text-amber-200 font-bold">Mode Offline</span>
          </div>
        )}

        <div className="flex items-center gap-2 bg-[#F1F5F9] dark:bg-[#163653]/80 border border-[#CBD5E1] dark:border-[#1E3A52] px-3 py-1.5 rounded-lg text-slate-900 dark:text-slate-100">
          <Clock className="w-3.5 h-3.5 text-[#3886B8] dark:text-white" />
          <span className="text-slate-700 dark:text-slate-300 text-xs font-bold">Shift:</span>
          <select
            value={activeShift}
            onChange={(e) => setActiveShift(e.target.value as ShiftType)}
            className="bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
          >
            <option value="Shift 1" className="bg-white dark:bg-[#163653] text-slate-900 dark:text-white">Shift 1 (07:00 - 15:00)</option>
            <option value="Shift 2" className="bg-white dark:bg-[#163653] text-slate-900 dark:text-white">Shift 2 (15:00 - 23:00)</option>
            <option value="Shift 3" className="bg-white dark:bg-[#163653] text-slate-900 dark:text-white">Shift 3 (23:00 - 07:00)</option>
          </select>
        </div>
      </div>

      {/* Zone 3: Profile Menu & User Info */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleForceUpdateApp}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 rounded-lg transition-all cursor-pointer active:scale-95 shadow-2xs"
          title="Perbarui aplikasi ke versi terbaru & bersihkan cache browser"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isUpdating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline font-bold">{isUpdating ? 'Memuat...' : 'Perbarui Fitur'}</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer border text-[#3886B8] dark:text-white hover:bg-slate-100 dark:hover:bg-[#163653] border-[#CBD5E1] dark:border-[#1E3A52]"
          title="Salin tautan website"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-[#16805D]" /> : <LinkIcon className="w-3.5 h-3.5" />}
          <span className="text-[11px] font-bold">
            {copiedLink ? 'Tersalin' : 'Salin Link Web'}
          </span>
        </button>

        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#163653] dark:hover:bg-[#1C4266] border border-[#CBD5E1] dark:border-[#1E3A52] p-1 sm:px-2.5 sm:py-1.5 rounded-lg transition-colors text-left cursor-pointer group"
              aria-label="Menu Pengguna"
            >
              <EmployeeAvatar
                employee={currentUser}
                size="sm"
                initialsPosition="corner"
                showAdminBadge={isAdmin}
              />
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span className="truncate max-w-[110px]">{currentUser.name}</span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#3886B8] text-white border border-[#3886B8]">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[110px]">
                  {currentUser.title}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-76 bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#1E3A52]">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      employee={currentUser}
                      size="md"
                      initialsPosition="corner"
                      showAdminBadge={isAdmin}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-[#0F172A] dark:text-white truncate">{currentUser.name}</p>
                        {isAdmin && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#3886B8] text-white border border-[#3886B8] flex items-center gap-0.5 shrink-0">
                            <Shield className="w-2.5 h-2.5 text-white" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold mt-0.5 truncate">{currentUser.title}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 text-[11px] p-2 rounded-lg bg-[#F1F5F9] dark:bg-[#163653]/70 border border-[#CBD5E1] dark:border-[#1E3A52] text-slate-800 dark:text-slate-200 leading-tight font-medium">
                    Hak Akses:{' '}
                    <b className={isAdmin ? 'text-[#3886B8] dark:text-white font-bold' : isOperator ? 'text-[#16805D] dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300 font-bold'}>
                      {isAdmin
                        ? 'Operator & Admin (Lihat Sandi & Kelola Karyawan)'
                        : isOperator
                        ? 'Operator (Bisa Edit Transaksi & Stok)'
                        : 'Monitoring Saja'}
                    </b>
                  </div>
                </div>

                {/* Theme Selector inside menu */}
                <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#1E3A52] bg-[#F8FAFC] dark:bg-[#0B1522]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-[#8CCCF0]" /> : <Sun className="w-3.5 h-3.5 text-[#D97706]" />}
                      Mode Tampilan
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-extrabold uppercase bg-white dark:bg-[#163653] text-[#0F172A] dark:text-white border border-[#CBD5E1] dark:border-[#1E3A52]">
                      {theme === 'dark' ? '🌙 GELAP' : '☀️ TERANG'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        theme === 'light'
                          ? 'bg-[#3886B8] text-white shadow-xs'
                          : 'bg-white dark:bg-[#163653] text-slate-700 dark:text-slate-200 hover:text-slate-900 border border-[#CBD5E1] dark:border-[#1E3A52]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Terang</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'bg-[#3886B8] text-white shadow-xs'
                          : 'bg-white dark:bg-[#163653] text-slate-700 dark:text-slate-200 hover:text-white border border-[#CBD5E1] dark:border-[#1E3A52]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Gelap</span>
                    </button>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  <PWAInstallButton variant="menu" />

                  <button
                    onClick={handleForceUpdateApp}
                    disabled={isUpdating}
                    className="w-full flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2 rounded-lg transition-colors cursor-pointer font-bold"
                    title="Bersihkan cache browser dan muat versi aplikasi paling mutakhir"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
                      <span>{isUpdating ? 'Memuat Ulang...' : 'Perbarui Fitur & Bersihkan Cache'}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded text-emerald-800 dark:text-emerald-200">
                      Sync
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      try {
                        const url = `${window.location.origin}/finishpalletikk`;
                        navigator.clipboard.writeText(url);
                        showNotification('success', 'Link Operasional Disalin', `${url} telah disalin.`);
                      } catch {}
                    }}
                    className="w-full flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Salin Link Operasional (/finishpalletikk)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded font-bold">Lama</span>
                  </button>

                  <button
                    onClick={() => {
                      try {
                        const url = `${window.location.origin}/stocktake`;
                        navigator.clipboard.writeText(url);
                        showNotification('success', 'Link Stok Take Disalin', `${url} telah disalin.`);
                      } catch {}
                    }}
                    className="w-full flex items-center justify-between text-xs text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 px-3 py-2 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>Salin Link Stok Take (/stocktake)</span>
                    </div>
                    <span className="text-[10px] font-mono text-sky-600 bg-sky-100 dark:bg-sky-900/60 px-1.5 py-0.2 rounded font-bold">Baru</span>
                  </button>

                  {onNavigate && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('master-karyawan');
                      }}
                      className="w-full flex items-center justify-start gap-2 text-xs text-[#172B3A] dark:text-slate-200 hover:bg-[#F1F5F9] dark:hover:bg-[#163653] px-3 py-2 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                      <Key className="w-4 h-4 text-[#D97706] shrink-0" />
                      <span>Kelola Sandi di Master Karyawan</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-start gap-2 text-xs text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Keluar Sistem (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  History,
  Timer,
  FileSpreadsheet,
  Ruler,
  Layers,
  Users,
  UserCheck,
  ShieldAlert,
  Settings,
  LogOut,
  X,
  Sun,
  Moon,
  Shuffle
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile
}) => {
  const { currentUser, logout, theme, toggleTheme } = useApp();
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

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

  const menuGroups: MenuGroup[] = [
    {
      items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
    },
    {
      title: 'OPERASIONAL',
      items: [
        { id: 'penerimaan', label: 'Penerimaan Produksi', icon: ArrowDownToLine },
        { id: 'pengeluaran', label: 'Pengeluaran Pallet', icon: ArrowUpFromLine },
        { id: 'pindah-kolom', label: 'Pindah Kolom (Relokasi)', icon: ArrowLeftRight },
        { id: 'ubah-spek', label: 'Perubahan Spek Pallet', icon: Shuffle },
        { id: 'stok', label: 'Data Stok', icon: Boxes }
      ]
    },
    {
      title: 'MONITORING',
      items: [
        { id: 'riwayat-masuk', label: 'Riwayat Penerimaan', icon: ArrowDownToLine },
        { id: 'riwayat-keluar', label: 'Riwayat Pengeluaran', icon: ArrowUpFromLine },
        { id: 'riwayat', label: 'Semua Riwayat Transaksi', icon: History },
        { id: 'shift', label: 'Monitoring Shift', icon: Timer },
        { id: 'laporan', label: 'Laporan & Stok Take', icon: FileSpreadsheet }
      ]
    },
    {
      title: 'MASTER DATA',
      items: [
        { id: 'master-ukuran', label: 'Master Ukuran', icon: Ruler },
        { id: 'master-jenis', label: 'Master Wrap Type', icon: Layers },
        { id: 'master-user', label: 'Master User', icon: Users },
        { id: 'master-karyawan', label: 'Master Karyawan', icon: UserCheck }
      ]
    },
    {
      title: 'SISTEM',
      items: [
        { id: 'audit-log', label: 'Audit Log', icon: ShieldAlert },
        { id: 'pengaturan', label: 'Pengaturan', icon: Settings }
      ]
    }
  ];

  const handleSelect = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[#0E1E2E]/80 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar container with Deep Navy #163653 */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#163653] text-white border-r border-[#1C4266] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } no-print shadow-xl lg:shadow-none`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#1E4366] bg-[#112B43]">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo Finish Pallet */}
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <img
                src="/splash-pallet-logo-transparent.png"
                alt="Finish Pallet Logo"
                className="w-full h-full object-contain drop-shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/splash-pallet-logo.jpg';
                }}
              />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="text-xs font-extrabold tracking-wider text-white block uppercase">
                FINISH PALLET
              </span>
              <span className="text-[10px] font-semibold text-slate-200 block truncate">
                Pallet Management System
              </span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-[#1E4366] rounded lg:hidden cursor-pointer"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4 text-sm scrollbar-thin">
          {menuGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {group.title && (
                <div className="px-3 pb-1.5 text-[10.5px] font-extrabold tracking-wider text-white uppercase">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-[#3886B8] text-white shadow-xs font-bold ring-1 ring-white/60'
                        : 'text-slate-100 font-semibold hover:bg-[#1E4366] hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-300'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer info & User section */}
        <div className="p-3 border-t border-[#1E4366] bg-[#112B43]/90 space-y-2">
          {/* PWA Install Button */}
          <PWAInstallButton variant="sidebar" />

          {/* Theme Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-slate-100 hover:text-white bg-[#163653] hover:bg-[#1E4366] border border-[#1E4366] transition-colors cursor-pointer group"
            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-white group-hover:-rotate-12 transition-transform shrink-0" />
              )}
              <span className="text-[11.5px] font-bold">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
            </div>
            <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-extrabold uppercase border ${
              theme === 'dark'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-[#112B43] text-white border-[#1E4366]'
            }`}>
              {theme === 'dark' ? 'DARK' : 'LIGHT'}
            </span>
          </button>

          {/* User Info Card */}
          {currentUser && (
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#163653] border border-[#1E4366]">
              <EmployeeAvatar
                employee={currentUser}
                size="sm"
                initialsPosition="corner"
              />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-xs font-bold text-white truncate flex items-center justify-between gap-1">
                  <span className="truncate">{currentUser.name}</span>
                  {currentUser.isAdmin && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/20 text-white font-extrabold border border-white/40 shrink-0">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-slate-200 font-medium truncate mt-0.5">{currentUser.title}</div>
              </div>
            </div>
          )}

          {/* Logout button */}
          {currentUser && (
            <button
              onClick={() => {
                onCloseMobile();
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-white hover:bg-rose-600/30 transition-colors font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Keluar (Logout)</span>
            </button>
          )}

          {/* Operational Area status */}
          <div className="flex items-center justify-between text-[11px] text-white font-medium px-1 pt-0.5">
            <span className="text-white font-semibold">Area Finish Pallet</span>
            {isOnline ? (
              <span className="font-mono text-[#8CCCF0] flex items-center gap-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#16805D] inline-block"></span>
                ONLINE
              </span>
            ) : (
              <span className="font-mono text-[#D97706] flex items-center gap-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#D97706] inline-block animate-pulse"></span>
                OFFLINE
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

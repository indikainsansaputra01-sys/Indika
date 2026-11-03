import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './components/auth/LoginPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { PenerimaanPallet } from './components/operations/PenerimaanPallet';
import { PengeluaranPallet } from './components/operations/PengeluaranPallet';
import { PindahKolomPallet } from './components/operations/PindahKolomPallet';
import { PerubahanSpekPallet } from './components/operations/PerubahanSpekPallet';
import { DataStok } from './components/operations/DataStok';
import { RiwayatTransaksi, RiwayatMode } from './components/monitoring/RiwayatTransaksi';
import { MonitoringShift } from './components/monitoring/MonitoringShift';
import { Laporan } from './components/monitoring/Laporan';
import { MasterUkuran } from './components/master/MasterUkuran';
import { MasterJenisPallet } from './components/master/MasterJenisPallet';
import { MasterUser } from './components/master/MasterUser';
import { MasterKaryawan } from './components/master/MasterKaryawan';
import { AuditLogView } from './components/system/AuditLogView';
import { Pengaturan } from './components/system/Pengaturan';
import { TransactionDetailModal } from './components/common/TransactionDetailModal';
import { ToastContainer } from './components/common/ToastContainer';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { SplashScreen } from './components/common/SplashScreen';
import { Transaction } from './types';

const VALID_VIEWS = new Set([
  'dashboard',
  'penerimaan',
  'pengeluaran',
  'pindah-kolom',
  'ubah-spek',
  'stok',
  'riwayat-masuk',
  'riwayat-keluar',
  'riwayat',
  'shift',
  'laporan',
  'master-ukuran',
  'master-jenis',
  'master-user',
  'master-karyawan',
  'audit-log',
  'pengaturan'
]);

const getInitialView = (): string => {
  try {
    const segments = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (segments[0] === 'finishpalletikk' && segments[1] && VALID_VIEWS.has(segments[1])) {
      return segments[1];
    }
  } catch {}
  return 'dashboard';
};

const AppContent: React.FC = () => {
  const { currentUser } = useApp();
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<string>(getInitialView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [historyFilter, setHistoryFilter] = useState<{ size?: string; type?: string; noRun?: string; txType?: RiwayatMode } | undefined>(undefined);

  // Synchronize URL pathname so it always features /finishpalletikk
  useEffect(() => {
    try {
      const targetPath = '/finishpalletikk' + (currentView !== 'dashboard' ? `/${currentView}` : '');
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({ view: currentView }, '', targetPath + (window.location.search || '') + (window.location.hash || ''));
      }
    } catch {}
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
      try {
        const segments = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
        if (segments[0] === 'finishpalletikk' && segments[1] && VALID_VIEWS.has(segments[1])) {
          setCurrentView(segments[1]);
        } else if (segments[0] === 'finishpalletikk' || segments[0] === '') {
          setCurrentView('dashboard');
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (view: string) => {
    const isTargetRiwayat = view === 'riwayat' || view === 'riwayat-masuk' || view === 'riwayat-keluar';
    if (!isTargetRiwayat) {
      setHistoryFilter(undefined);
    }
    setCurrentView(view);
    try {
      const targetPath = '/finishpalletikk' + (view !== 'dashboard' ? `/${view}` : '');
      window.history.pushState({ view }, '', targetPath);
    } catch {}
  };

  // Splash Screen Intro on initial opening
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} durationMs={2400} />;
  }

  // If user is not logged in, render the login page
  if (!currentUser) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  const navigateToHistory = (filterQuery: { size?: string; type?: string; txType?: 'ALL' | 'PENERIMAAN' | 'PENGELUARAN' }) => {
    setHistoryFilter(filterQuery);
    if (filterQuery.txType === 'PENERIMAAN') {
      handleNavigate('riwayat-masuk');
    } else if (filterQuery.txType === 'PENGELUARAN') {
      handleNavigate('riwayat-keluar');
    } else {
      handleNavigate('riwayat');
    }
  };

  const isRiwayatView = currentView === 'riwayat' || currentView === 'riwayat-masuk' || currentView === 'riwayat-keluar';

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-[#0A121E] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 lg:pl-64 min-w-0 transition-all duration-200">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {currentView === 'dashboard' && (
              <Dashboard
                onNavigate={handleNavigate}
                onSelectTransaction={(tx) => setSelectedTx(tx)}
              />
            )}

            {currentView === 'penerimaan' && <PenerimaanPallet />}

            {currentView === 'pengeluaran' && <PengeluaranPallet />}

            {currentView === 'pindah-kolom' && <PindahKolomPallet />}

            {currentView === 'ubah-spek' && <PerubahanSpekPallet />}

            {currentView === 'stok' && (
              <DataStok onNavigateToHistory={navigateToHistory} />
            )}

            {currentView === 'riwayat' && (
              <RiwayatTransaksi
                initialFilter={historyFilter}
                initialTab="ALL"
                onSelectTransaction={(tx) => setSelectedTx(tx)}
                onNavigateTab={(tab) => {
                  if (tab === 'PENERIMAAN') handleNavigate('riwayat-masuk');
                  else if (tab === 'PENGELUARAN') handleNavigate('riwayat-keluar');
                  else handleNavigate('riwayat');
                }}
              />
            )}

            {currentView === 'riwayat-masuk' && (
              <RiwayatTransaksi
                initialFilter={historyFilter}
                initialTab="PENERIMAAN"
                onSelectTransaction={(tx) => setSelectedTx(tx)}
                onNavigateTab={(tab) => {
                  if (tab === 'PENERIMAAN') setCurrentView('riwayat-masuk');
                  else if (tab === 'PENGELUARAN') setCurrentView('riwayat-keluar');
                  else setCurrentView('riwayat');
                }}
              />
            )}

            {currentView === 'riwayat-keluar' && (
              <RiwayatTransaksi
                initialFilter={historyFilter}
                initialTab="PENGELUARAN"
                onSelectTransaction={(tx) => setSelectedTx(tx)}
                onNavigateTab={(tab) => {
                  if (tab === 'PENERIMAAN') setCurrentView('riwayat-masuk');
                  else if (tab === 'PENGELUARAN') setCurrentView('riwayat-keluar');
                  else setCurrentView('riwayat');
                }}
              />
            )}

            {currentView === 'shift' && <MonitoringShift />}

            {currentView === 'laporan' && <Laporan />}

            {currentView === 'master-ukuran' && <MasterUkuran />}

            {currentView === 'master-jenis' && <MasterJenisPallet />}

            {currentView === 'master-user' && <MasterUser />}

            {currentView === 'master-karyawan' && <MasterKaryawan />}

            {currentView === 'audit-log' && <AuditLogView />}

            {currentView === 'pengaturan' && <Pengaturan />}
          </div>
        </main>
      </div>

      {/* Global Transaction Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />

      {/* Toast Alert System */}
      <ToastContainer />

      {/* Network Connectivity Indicator for Factory Floor */}
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

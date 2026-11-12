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
import { OperationalWarningModal, OperationalWarningType } from './components/common/OperationalWarningModal';
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
    if ((segments[0] === 'finishpalletikk' || segments[0] === 'stocktake') && segments[1] && VALID_VIEWS.has(segments[1])) {
      return segments[1];
    }
  } catch {}
  return 'dashboard';
};

const AppContent: React.FC = () => {
  const { currentUser, appEnvironment, setAppEnvironment, showNotification } = useApp();
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<string>(getInitialView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [historyFilter, setHistoryFilter] = useState<{ size?: string; type?: string; noRun?: string; txType?: RiwayatMode } | undefined>(undefined);
  const [operationalWarning, setOperationalWarning] = useState<OperationalWarningType | null>(null);

  // Synchronize URL pathname with active environment: /finishpalletikk or /stocktake
  useEffect(() => {
    try {
      const basePath = appEnvironment === 'stocktake' ? '/stocktake' : '/finishpalletikk';
      const targetPath = basePath + (currentView !== 'dashboard' ? `/${currentView}` : '');
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({ view: currentView, env: appEnvironment }, '', targetPath + (window.location.search || '') + (window.location.hash || ''));
      }
    } catch {}
  }, [currentView, appEnvironment]);

  useEffect(() => {
    const handlePopState = () => {
      try {
        const segments = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
        const base = segments[0];
        if (base === 'stocktake' && appEnvironment !== 'stocktake') {
          setAppEnvironment('stocktake');
        } else if (base === 'finishpalletikk' && appEnvironment !== 'operasional') {
          setAppEnvironment('operasional');
        }

        if ((base === 'finishpalletikk' || base === 'stocktake') && segments[1] && VALID_VIEWS.has(segments[1])) {
          setCurrentView(segments[1]);
        } else if (base === 'finishpalletikk' || base === 'stocktake' || base === '') {
          setCurrentView('dashboard');
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appEnvironment]);

  const executeNavigate = (view: string) => {
    const isTargetRiwayat = view === 'riwayat' || view === 'riwayat-masuk' || view === 'riwayat-keluar';
    if (!isTargetRiwayat) {
      setHistoryFilter(undefined);
    }
    setCurrentView(view);
    try {
      const basePath = appEnvironment === 'stocktake' ? '/stocktake' : '/finishpalletikk';
      const targetPath = basePath + (view !== 'dashboard' ? `/${view}` : '');
      window.history.pushState({ view, env: appEnvironment }, '', targetPath);
    } catch {}
  };

  const handleNavigate = (view: string) => {
    // Jika user memilih penerimaan dan belum di halaman penerimaan -> tampilkan notifikasi konfirmasi terlebih dahulu
    if (view === 'penerimaan' && currentView !== 'penerimaan') {
      setOperationalWarning('penerimaan');
      return;
    }

    // Jika user memilih pengeluaran dan belum di halaman pengeluaran -> tampilkan notifikasi konfirmasi terlebih dahulu
    if (view === 'pengeluaran' && currentView !== 'pengeluaran') {
      setOperationalWarning('pengeluaran');
      return;
    }

    executeNavigate(view);
  };

  const handleConfirmOperationalWarning = () => {
    if (operationalWarning) {
      const target = operationalWarning;
      setOperationalWarning(null);
      executeNavigate(target);
    }
  };

  const handleCancelOperationalWarning = () => {
    setOperationalWarning(null);
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

      {/* Modal Notifikasi Konfirmasi Operasional (Penerimaan / Pengeluaran) */}
      <OperationalWarningModal
        isOpen={operationalWarning !== null}
        type={operationalWarning}
        onConfirm={handleConfirmOperationalWarning}
        onCancel={handleCancelOperationalWarning}
      />

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

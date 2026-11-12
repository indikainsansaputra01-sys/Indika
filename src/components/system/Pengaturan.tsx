import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, SlidersHorizontal, RotateCcw, Shield, Database, Info, Check, Download, Upload, Monitor, Sun, Moon, Palette, Globe, Link as LinkIcon, Copy } from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

export const Pengaturan: React.FC = () => {
  const {
    thresholds,
    updateThresholds,
    resetDemoData,
    currentUser,
    isOperator,
    transactions,
    stocks,
    auditLogs,
    masterSizes,
    masterTypes,
    masterCustomers,
    employees,
    showNotification,
    theme,
    setTheme,
    appEnvironment,
    setAppEnvironment,
    syncStockTakeToProduction,
    importDatabaseBackup
  } = useApp();

  const [safeMin, setSafeMin] = useState(thresholds.safeMin);
  const [warningMin, setWarningMin] = useState(thresholds.warningMin);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [operatorPasswordInput, setOperatorPasswordInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedOpLink, setCopiedOpLink] = useState(false);
  const [copiedStkLink, setCopiedStkLink] = useState(false);
  const [showCutoverModal, setShowCutoverModal] = useState(false);
  const [isSyncingCutover, setIsSyncingCutover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyOpLink = () => {
    try {
      const url = `${window.location.origin}/finishpalletikk`;
      navigator.clipboard.writeText(url);
      setCopiedOpLink(true);
      showNotification('success', 'Link Operasional Disalin', `${url} berhasil disalin ke clipboard.`);
      setTimeout(() => setCopiedOpLink(false), 2500);
    } catch {
      showNotification('info', 'Link Operasional', `${window.location.origin}/finishpalletikk`);
    }
  };

  const handleCopyStkLink = () => {
    try {
      const url = `${window.location.origin}/stocktake`;
      navigator.clipboard.writeText(url);
      setCopiedStkLink(true);
      showNotification('success', 'Link Stok Take Disalin', `${url} berhasil disalin ke clipboard.`);
      setTimeout(() => setCopiedStkLink(false), 2500);
    } catch {
      showNotification('info', 'Link Stok Take', `${window.location.origin}/stocktake`);
    }
  };

  const handleConfirmCutover = async () => {
    setIsSyncingCutover(true);
    const res = await syncStockTakeToProduction();
    setIsSyncingCutover(false);
    setShowCutoverModal(false);
    if (res.success) {
      setAppEnvironment('operasional');
    }
  };

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOperator) return;
    updateThresholds({
      safeMin: Number(safeMin),
      warningMin: Number(warningMin),
      criticalMax: Number(warningMin) - 1
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleOpenResetModal = () => {
    setResetError('');
    setOperatorPasswordInput('');
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    setResetError('');
    const res = await resetDemoData(operatorPasswordInput);
    setIsResetting(false);
    if (res.success) {
      setShowResetModal(false);
    } else {
      setResetError(res.message);
    }
  };

  const handleDownloadBackup = () => {
    const backupData = {
      appName: 'Finish Pallet Management System',
      backupDate: new Date().toISOString(),
      backupBy: currentUser?.name || 'Operator',
      transactions,
      stocks,
      masterSizes,
      masterTypes,
      masterCustomers,
      employees,
      thresholds,
      auditLogs
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FPMS_BACKUP_LENGKAP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('success', 'Backup Lengkap Berhasil', 'File cadangan lengkap (stok, riwayat transaksi & master data) berhasil diunduh.');
  };

  const handleDownloadMasterOnly = () => {
    const masterData = {
      appName: 'Finish Pallet Management System - Master Data Only',
      exportDate: new Date().toISOString(),
      exportBy: currentUser?.name || 'Operator',
      isMasterOnly: true,
      masterSizes,
      masterTypes,
      masterCustomers,
      employees,
      thresholds
    };

    const blob = new Blob([JSON.stringify(masterData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FPMS_MASTER_DATA_SAJA_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('success', 'Master Data Berhasil Disimpan', 'File Master Data (Akun Karyawan, Ukuran Pallet, & Customer) berhasil diunduh tanpa riwayat transaksi.');
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsImporting(true);
        showNotification('info', 'Mengimpor Data...', 'Sedang membaca file dan menyimpan data stok ke Cloud Firestore...');
        const json = JSON.parse(event.target?.result as string);
        const res = await importDatabaseBackup(json);
        setIsImporting(false);
        if (res.success) {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      } catch (err: any) {
        setIsImporting(false);
        showNotification('error', 'Gagal Membaca File', 'File JSON tidak dapat diproses: ' + (err.message || String(err)));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 text-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-600 text-white">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">PENGATURAN SISTEM & PARAMETER OPERASIONAL</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pemasangan aplikasi di pabrik, cadangan database, dan batas stok operasional.
          </p>
        </div>
      </div>

      {/* PWA Installation Card */}
      <PWAInstallButton variant="full" />

      {/* Manajemen 2 Link Sistem: Link Operasional vs Link Stok Take Baru */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Manajemen 2 Link Sistem (Operasional Harian vs Stok Take Baru)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold uppercase border ${
              appEnvironment === 'stocktake'
                ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
            }`}>
              AKTIF: {appEnvironment === 'stocktake' ? 'LINK STOK TAKE' : 'LINK OPERASIONAL'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Sesuai kebutuhan lapangan pabrik, sistem telah disediakan dalam <b>2 link terpisah</b> agar operasional harian tidak terganggu saat Anda melakukan proses stok take fisik baru dari 0:
        </p>

        {/* 2 Links Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Link 1: Operasional Harian */}
          <div className={`p-4 rounded-xl border transition-all ${
            appEnvironment === 'operasional'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                Link 1: Operasional Berjalan
              </span>
              {appEnvironment === 'operasional' ? (
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-extrabold">
                  SEDANG DIBUKA
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAppEnvironment('operasional')}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                >
                  Buka Link Ini ➔
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              Dipakai harian untuk pengeluaran dan penerimaan saat ini. Data mutasi & saldo stok di link ini <b>aman dan tidak terganggu</b>.
            </p>

            <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-750 mb-3">
              <LinkIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <code className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 truncate select-all flex-1">
                {typeof window !== 'undefined' ? `${window.location.origin}/finishpalletikk` : '/finishpalletikk'}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyOpLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                {copiedOpLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOpLink ? 'Tersalin!' : 'Salin Link Operasional'}</span>
              </button>
              {appEnvironment !== 'operasional' && (
                <button
                  type="button"
                  onClick={() => setAppEnvironment('operasional')}
                  className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Buka
                </button>
              )}
            </div>
          </div>

          {/* Link 2: Stok Take Baru */}
          <div className={`p-4 rounded-xl border transition-all ${
            appEnvironment === 'stocktake'
              ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-400 dark:border-sky-700 ring-2 ring-sky-500/20'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0"></span>
                Link 2: Stok Take Baru (Bersih)
              </span>
              {appEnvironment === 'stocktake' ? (
                <span className="text-[10px] bg-sky-600 text-white px-2 py-0.5 rounded font-extrabold">
                  SEDANG DIBUKA
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAppEnvironment('stocktake')}
                  className="text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
                >
                  Buka Link Ini ➔
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              Khusus untuk menginput hasil stok take fisik baru dari 0. Seluruh master ukuran dan karyawan tetap tersedia sehingga Anda tidak perlu mengetik ulang akun/ukuran.
            </p>

            <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-750 mb-3">
              <LinkIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <code className="text-xs font-mono font-bold text-sky-700 dark:text-sky-300 truncate select-all flex-1">
                {typeof window !== 'undefined' ? `${window.location.origin}/stocktake` : '/stocktake'}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyStkLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                {copiedStkLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedStkLink ? 'Tersalin!' : 'Salin Link Stok Take'}</span>
              </button>
              {appEnvironment !== 'stocktake' && (
                <button
                  type="button"
                  onClick={() => setAppEnvironment('stocktake')}
                  className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Buka
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cutover Feature: Terapkan Hasil Stok Take ke Link Operasional */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Fitur Otomatis: Terapkan Hasil Stok Take ke Link Operasional (Cutover)</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Ketika Anda sudah selesai menginput seluruh saldo fisik terbaru di Link Stok Take (/stocktake), Anda dapat menerapkan hasilnya langsung ke Link Operasional dengan satu klik tanpa perlu reset manual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCutoverModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Terapkan ke Operasional ➔
          </button>
        </div>
      </div>

      {/* Theme Settings Card: Dark Mode & Light Mode */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Tema Tampilan Aplikasi (Mode Gelap & Terang)
            </h2>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750">
            {theme === 'dark' ? '🌙 AKTIF: GELAP' : '☀️ AKTIF: TERANG'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Pilih tema tampilan yang paling nyaman untuk Anda. Anda bebas mengganti mode gelap atau terang <b>kapan saja</b> di semua menu tanpa terpengaruh oleh jam operasional maupun jadwal shift kerja (Shift 1, Shift 2, ataupun Shift 3).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Option 1: Mode Terang */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              theme === 'light'
                ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className={`p-2.5 rounded-lg shrink-0 ${theme === 'light' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <Sun className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Mode Terang (Light)</span>
                {theme === 'light' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                    <Check className="w-3 h-3" /> Digunakan
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Latar belakang cerah dan bersih, cocok untuk kondisi pencahayaan terang atau di siang hari.
              </p>
            </div>
          </button>

          {/* Option 2: Mode Gelap */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              theme === 'dark'
                ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className={`p-2.5 rounded-lg shrink-0 ${theme === 'dark' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <Moon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Mode Gelap (Dark)</span>
                {theme === 'dark' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-700">
                    <Check className="w-3 h-3" /> Digunakan
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Latar belakang gelap pekat yang adem di mata, hemat baterai perangkat dan nyaman dipakai setiap saat.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Backup & Restore Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Database className="w-4 h-4 text-emerald-700" />
          <h2 className="text-sm font-bold text-slate-900 uppercase">
            Cadangan & Pemulihan Data Pabrik (Backup / Restore)
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Amankan seluruh catatan stok, transaksi, dan riwayat audit mutasi pallet ke dalam file cadangan JSON. Anda dapat mengunduhnya secara rutin untuk arsip fisik atau memindahkannya ke komputer/tablet lain.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group"
          >
            <div>
              <div className="font-bold text-xs text-emerald-950 dark:text-emerald-200 group-hover:text-emerald-900">
                1. Unduh Cadangan Lengkap
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Simpan stok, riwayat, & master data
              </div>
            </div>
            <Download className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={handleDownloadMasterOnly}
            className="p-3 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950/70 border border-sky-300 dark:border-sky-700 rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group"
          >
            <div>
              <div className="font-bold text-xs text-sky-950 dark:text-sky-200 group-hover:text-sky-900">
                2. Unduh Master Data Saja
              </div>
              <div className="text-[11px] text-sky-700 dark:text-sky-300">
                Untuk Website Baru (tanpa stok/transaksi)
              </div>
            </div>
            <Download className="w-4 h-4 text-sky-700 dark:text-sky-300 shrink-0" />
          </button>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadBackup}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-slate-800">
                  {isImporting ? 'Menyimpan ke Cloud Firestore...' : '3. Impor Hasil Stok Take / Cadangan'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isImporting ? 'Mohon tunggu sebentar...' : 'Terapkan saldo stok fisik langsung ke Cloud'}
                </div>
              </div>
              <Upload className={`w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0 ${isImporting ? 'animate-bounce text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Threshold Setting Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
          <h2 className="text-sm font-bold text-slate-900 uppercase">
            Konfigurasi Batas Kesiapan Stok Pallet (Thresholds)
          </h2>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            Pengaturan batas stok berhasil disimpan dan diterapkan pada seluruh sistem.
          </div>
        )}

        <form onSubmit={handleSaveThreshold} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batas Minimum Status AMAN (Unit)
              </label>
              <input
                type="number"
                min="5"
                value={safeMin}
                onChange={(e) => setSafeMin(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Jika stok &ge; nilai ini, indikator berstatus AMAN (Hijau). Default: 20 unit.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batas Minimum Status PERHATIAN (Unit)
              </label>
              <input
                type="number"
                min="1"
                value={warningMin}
                onChange={(e) => setWarningMin(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Di bawah nilai ini (&lt; {warningMin}), sistem memicu PERINGATAN KRITIS (Merah). Default: 10 unit.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded transition-colors shadow-sm cursor-pointer"
            >
              Simpan Perubahan Ambang Batas
            </button>
          </div>
        </form>
      </div>

      {/* Database & Demo Reset */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <RotateCcw className="w-4 h-4 text-rose-700" />
          <h2 className="text-sm font-bold text-slate-900 uppercase">
            Inisialisasi Ulang & Bersihkan Pengujian
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Jika Anda selesai melakukan uji coba penginputan dan ingin membersihkan seluruh data pengujian agar saldo stok pallet kembali mulai dari 0 untuk operasional pabrik yang baru, gunakan tombol di bawah ini.
        </p>

        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-bold text-xs text-rose-950 block">Bersihkan Data Pengujian & Reset Stok ke 0</span>
            <span className="text-[11px] text-rose-800">
              Menghapus semua transaksi pengujian di perangkat dan Firebase online. Seluruh stok kembali ke 0.
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenResetModal}
            className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Mulai Stok Dari 0</span>
          </button>
        </div>
      </div>

      {/* Technical Spec Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-slate-500" />
          Informasi Terminal Operasional Pabrik
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
          <div>Area Operasional: Finish Pallet Yard (Indoor/Outdoor)</div>
          <div>Dukungan Aplikasi: PWA Standalone (Offline-Ready)</div>
          <div>Mode Input: Cepat Bebas (Free-Text Sizes & Users)</div>
          <div>Pemeriksaan Stok: Validasi Relasional Otomatis</div>
        </div>
      </div>

      {/* In-App Confirmation Modal for Reset (No blocked browser alert/confirm) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2.5 bg-rose-100 rounded-lg">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Bersihkan Pengujian & Mulai Stok Dari 0
                </h3>
                <p className="text-xs text-slate-500">
                  Konfirmasi Inisialisasi Ulang Database Pabrik
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p className="font-bold">⚠️ PERINGATAN PENTING:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Semua data mutasi dan transaksi pengujian akan <strong>dihapus permanen</strong>.</li>
                <li>Seluruh saldo stok pallet akan di-reset menjadi <strong>0 (nol)</strong>.</li>
                <li>Perubahan langsung tersinkronisasi ke <strong>Firebase Online</strong> di seluruh HP/komputer operator.</li>
              </ul>
            </div>

            {!isOperator && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Kata Sandi Operator (Verifikasi)
                </label>
                <input
                  type="password"
                  value={operatorPasswordInput}
                  onChange={(e) => {
                    setOperatorPasswordInput(e.target.value);
                    setResetError('');
                  }}
                  placeholder="Masukkan kata sandi operator..."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 font-mono"
                />
              </div>
            )}

            {resetError && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 text-rose-800 rounded text-xs font-semibold">
                {resetError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-bold bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white rounded flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                {isResetting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Membersihkan...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Bersihkan & Mulai Dari 0</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal for Cutover / Terapkan Stok Take ke Operasional */}
      {showCutoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-sky-700 dark:text-sky-400">
              <div className="p-2.5 bg-sky-100 dark:bg-sky-950/80 rounded-lg">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Terapkan Hasil Stok Take ke Link Operasional
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cutover Otomatis Data Stok Fisik
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg text-xs text-sky-950 dark:text-sky-200 space-y-2 leading-relaxed">
              <p className="font-bold">📋 INFORMASI CUTOVER:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Semua saldo stok yang telah diinput di <b>/stocktake</b> akan disalin menjadi stok utama di <b>/finishpalletikk</b>.</li>
                <li>Operasional pabrik selanjutnya otomatis melanjutkan saldo fisik yang baru ini.</li>
                <li>Riwayat audit log cutover akan dicatat otomatis di sistem.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCutoverModal(false)}
                disabled={isSyncingCutover}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleConfirmCutover}
                disabled={isSyncingCutover}
                className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                {isSyncingCutover ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menerapkan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Ya, Terapkan ke Operasional</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


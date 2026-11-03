/**
 * Utilities for Generating Official Shift Reports (A4 Print / PDF & Excel)
 * PT Indah Kiat Pulp & Paper Tbk - Workshop Pallet dan Coreplug
 */
import ExcelJS from 'exceljs';
import { Transaction, ShiftType } from '../types';
import { generateDocNumber, printDocument, formatPalletDimension } from './exportUtils';
import { getLogoCleanBase64, getCompanyLogoCleanBase64 } from './logoUtils';

export interface ShiftReportOptions {
  date: string; // YYYY-MM-DD
  shift: string; // 'Shift 1' | 'Shift 2' | 'Shift 3'
  operatorName: string;
  transactions: Transaction[];
  transactionMode?: 'ALL' | 'PENERIMAAN' | 'PENGELUARAN';
}

export interface ShiftReportStats {
  docNumber: string;
  formattedDate: string;
  shiftSchedule: string;
  inList: Transaction[];
  outList: Transaction[];
  totalIn: number;
  totalOut: number;
  netQty: number;
  totalInSet: number;
  totalInPcs: number;
  totalOutSet: number;
  totalOutPcs: number;
  summaryBySize: {
    palletSize: string;
    typePallet: string;
    palletType: string;
    unit: string;
    inQty: number;
    outQty: number;
    netQty: number;
  }[];
}

export function getShiftSchedule(shift: string): string {
  if (shift.includes('1')) return 'Shift 1 (07:00 - 15:00 WIB)';
  if (shift.includes('2')) return 'Shift 2 (15:00 - 23:00 WIB)';
  if (shift.includes('3')) return 'Shift 3 (23:00 - 07:00 WIB)';
  return shift;
}

export function formatIndoDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  } catch (_) {
    return dateStr;
  }
}

export function formatDateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Menghitung Shift dan Tanggal Operasional Pabrik dengan Proteksi Toleransi 2 Jam:
 * Menjamin operator yang menginput data dari rumah setelah selesai shift
 * tidak keliru memilih shift maupun tanggal operasional.
 *
 * 1. Pukul 09:00 s/d 16:59 WIB:
 *    - Shift: Shift 1 (Normal: 07:00 - 15:00, toleransi +2 jam s/d 17:00 WIB)
 *    - Tanggal: Hari ini
 *
 * 2. Pukul 17:00 s/d 23:59 WIB:
 *    - Shift: Shift 2 (Normal: 15:00 - 23:00 WIB)
 *    - Tanggal: Hari ini
 *
 * 3. Pukul 00:00 s/d 00:59 WIB (Dini hari lewat tengah malam):
 *    - Shift: Shift 2 (Toleransi 2 jam setelah jam 23:00 malam kemarin)
 *    - Tanggal: Hari kemarin (karena operator menginput Shift 2 yang baru selesai di malam hari)
 *
 * 4. Pukul 01:00 s/d 08:59 WIB (Pagi hari):
 *    - Shift: Shift 3 (Normal: 23:00 - 07:00, toleransi +2 jam s/d 09:00 pagi)
 *    - Tanggal: Hari kemarin (Shift 3 malam berjalan lintas hari, tanggal tetap hari kemarin s/d jam 09:00 pagi)
 */
export function getOperationalShiftAndDate(refDate?: Date): {
  shift: ShiftType;
  date: string;
  isGracePeriod: boolean;
  graceDescription?: string;
} {
  const now = refDate || new Date();
  const hour = now.getHours();

  // Tanggal kalender hari ini
  const todayStr = formatDateToISO(now);

  // Tanggal kemarin
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateToISO(yesterday);

  // Shift 3: 23:00 malam s/d 06:59 pagi
  if (hour >= 23) {
    return {
      shift: 'Shift 3',
      date: todayStr,
      isGracePeriod: false
    };
  }
  if (hour < 7) {
    return {
      shift: 'Shift 3',
      date: yesterdayStr,
      isGracePeriod: false
    };
  }

  // Shift 2: 15:00 sore s/d 22:59 malam
  if (hour >= 15) {
    return {
      shift: 'Shift 2',
      date: todayStr,
      isGracePeriod: false
    };
  }

  // Shift 1: 07:00 pagi s/d 14:59 siang
  return {
    shift: 'Shift 1',
    date: todayStr,
    isGracePeriod: false
  };
}

export function getOperationalShift(refDate?: Date): ShiftType {
  return getOperationalShiftAndDate(refDate).shift;
}

export function getOperationalDate(refDate?: Date): string {
  return getOperationalShiftAndDate(refDate).date;
}

export function computeShiftStats(options: ShiftReportOptions): ShiftReportStats {
  const { date, shift, transactions, transactionMode = 'ALL' } = options;
  const docNumber = generateDocNumber(shift, date);
  const formattedDate = formatIndoDate(date);
  const shiftSchedule = getShiftSchedule(shift);

  // Filter matching shift & date
  const shiftTx = transactions.filter((t) => t.date === date && t.shift === shift);

  const inList = shiftTx.filter(
    (t) => t.transactionType === 'PENERIMAAN' && (transactionMode === 'ALL' || transactionMode === 'PENERIMAAN')
  );
  const outList = shiftTx.filter(
    (t) => t.transactionType === 'PENGELUARAN' && (transactionMode === 'ALL' || transactionMode === 'PENGELUARAN')
  );

  let totalIn = 0;
  let totalOut = 0;
  let totalInSet = 0;
  let totalInPcs = 0;
  let totalOutSet = 0;
  let totalOutPcs = 0;

  inList.forEach((t) => {
    totalIn += t.quantity;
    if (t.unit === 'Set') totalInSet += t.quantity;
    else totalInPcs += t.quantity;
  });

  outList.forEach((t) => {
    totalOut += t.quantity;
    if (t.unit === 'Set') totalOutSet += t.quantity;
    else totalOutPcs += t.quantity;
  });

  const netQty = totalIn - totalOut;

  // Aggregate by pallet size + type + palletType
  const sizeMap: { [key: string]: ShiftReportStats['summaryBySize'][0] } = {};
  [...inList, ...outList].forEach((t) => {
    const key = `${t.palletSize}_${t.typePallet || 'LS'}_${t.palletType}_${t.unit}`;
    if (!sizeMap[key]) {
      sizeMap[key] = {
        palletSize: t.palletSize,
        typePallet: t.typePallet || 'LS',
        palletType: t.palletType,
        unit: t.unit,
        inQty: 0,
        outQty: 0,
        netQty: 0
      };
    }
    if (t.transactionType === 'PENERIMAAN') {
      sizeMap[key].inQty += t.quantity;
    } else {
      sizeMap[key].outQty += t.quantity;
    }
    sizeMap[key].netQty = sizeMap[key].inQty - sizeMap[key].outQty;
  });

  const summaryBySize = Object.values(sizeMap).sort((a, b) =>
    a.palletSize.localeCompare(b.palletSize, undefined, { numeric: true })
  );

  return {
    docNumber,
    formattedDate,
    shiftSchedule,
    inList,
    outList,
    totalIn,
    totalOut,
    netQty,
    totalInSet,
    totalInPcs,
    totalOutSet,
    totalOutPcs,
    summaryBySize
  };
}

/**
 * Generates official clean printable A4 Landscape HTML for Shift Report
 */
export function getPrintableShiftReportHTML(options: ShiftReportOptions): string {
  const { date, shift, operatorName, transactionMode = 'ALL' } = options;
  const stats = computeShiftStats(options);
  const nowStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const renderTxRows = (list: Transaction[], isInbound: boolean) => {
    if (list.length === 0) {
      return `<tr><td colspan="10" style="padding: 10px; text-align: center; color: #94A3B8; font-style: italic;">Tidak ada transaksi ${isInbound ? 'penerimaan' : 'pengeluaran'} di shift ini.</td></tr>`;
    }
    return list
      .map((t, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        const typeBadge = t.typePallet === 'SS'
          ? `<span style="background: #F3E8FF; color: #6B21A8; border: 1px solid #D8B4FE; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px;">SS</span>`
          : `<span style="background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px;">LS</span>`;
        return `
          <tr style="background: ${bg};">
            <td style="padding: 5px; border: 1px solid #CBD5E1; text-align: center; font-size: 9.5px;">${idx + 1}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; text-align: center; font-family: monospace; font-size: 9.5px;">${t.time}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; font-family: monospace; font-size: 9.5px;">${t.transactionNumber}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; font-weight: bold; font-size: 10px;">${t.palletSize}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; text-align: center;">${typeBadge}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; font-size: 9.5px;">${t.palletType} <span style="color: #64748B; font-size: 8.5px;">(${t.marketType})</span></td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; font-size: 9.5px; font-weight: 600;">${t.customer || '-'}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; font-size: 10px; color: ${isInbound ? '#047857' : '#D97706'}; font-family: monospace;">
              ${isInbound ? '+' : '-'}${t.quantity.toLocaleString('id-ID')}
            </td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; text-align: center; font-size: 9px; font-family: monospace;">${t.unit}</td>
            <td style="padding: 5px; border: 1px solid #CBD5E1; font-size: 9px; color: #475569;">
              ${[t.noRun ? `[No.Run: ${t.noRun}]` : '', t.pelatakanPallet ? `Kolom: ${t.pelatakanPallet}` : '', t.notes].filter(Boolean).join(' | ') || '-'}
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const showIn = transactionMode === 'ALL' || transactionMode === 'PENERIMAAN';
  const showOut = transactionMode === 'ALL' || transactionMode === 'PENGELUARAN';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan Shift ${shift} - ${date} - PT Indah Kiat Pulp & Paper Tbk</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 8mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 12px;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company { font-size: 15px; font-weight: 800; color: #0F172A; }
    .unit { font-size: 9.5px; font-weight: 700; color: #047857; margin-top: 1px; }
    .title { font-size: 12px; font-weight: 800; margin-top: 3px; text-transform: uppercase; color: #1E293B; }
    
    .doc-reg-badge {
      background: #0F172A;
      color: #FFFFFF;
      border: 1px solid #334155;
      padding: 5px 10px;
      border-radius: 4px;
      text-align: right;
      font-family: monospace;
      font-size: 10px;
    }
    .doc-reg-number {
      font-size: 13px;
      font-weight: 800;
      color: #FBBF24;
      letter-spacing: 0.5px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 9.5px;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 8.5px; text-transform: uppercase; color: #64748B; font-weight: 600; }
    .meta-val { font-weight: 700; color: #0F172A; margin-top: 1px; }

    .summary-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .stat-card {
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-card.in { background: #ECFDF5; border-color: #A7F3D0; color: #065F46; }
    .stat-card.out { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }
    .stat-card.net { background: #EFF6FF; border-color: #BFDBFE; color: #1E40AF; }
    .stat-card.tx { background: #F8FAFC; border-color: #E2E8F0; color: #334155; }
    .stat-val { font-size: 14px; font-weight: 800; font-family: monospace; }

    .section-title {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 4px 8px;
      margin-top: 10px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      border-radius: 3px;
    }
    .section-title.in { background: #065F46; color: #FFFFFF; }
    .section-title.out { background: #92400E; color: #FFFFFF; }
    .section-title.summary { background: #1E293B; color: #FFFFFF; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th {
      padding: 5px 6px;
      border: 1px solid #334155;
      background: #1E293B;
      color: #FFFFFF;
      font-size: 9px;
      text-transform: uppercase;
    }

    .sig-section {
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .sig-heading {
      text-align: center;
      font-size: 9.5px;
      font-weight: bold;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .sig-grid {
      display: flex;
      justify-content: space-between;
      text-align: center;
      font-size: 9.5px;
    }
    .sig-box { width: 30%; }
    .sig-name {
      margin-top: 40px;
      font-weight: bold;
      text-decoration: underline;
    }
    .sig-desc { font-size: 8.5px; color: #64748B; margin-top: 1px; }

    .no-print-toolbar {
      margin-bottom: 10px;
      background: #0F172A;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-print {
      padding: 6px 14px;
      background: #047857;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 11px;
      cursor: pointer;
    }
    @media print {
      .no-print-toolbar { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <span style="font-size: 11px; font-weight: 600;">
      Pratonton Laporan Operasional Shift · No. Registrasi: <b>${stats.docNumber}</b>
    </span>
    <button class="btn-print" onclick="window.print()">Cetak Dokumen Sekarang (Print / PDF)</button>
  </div>

  <div class="header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; height: 46px; flex-shrink: 0;">
        <img src="/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png" alt="Logo PT Indah Kiat" style="height: 38px; width: auto; max-width: 130px; object-fit: contain; border-radius: 4px;" />
      </div>
      <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0;">
        <img src="/splash-pallet-logo.jpg" alt="Logo Finish Pallet" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px;" />
      </div>
      <div>
        <div class="company">PT INDAH KIAT PULP & PAPER TBK</div>
        <div class="unit">WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM</div>
        <div class="title">LAPORAN MUTASI PENERIMAAN & PENGELUARAN PALLET - ${shift.toUpperCase()}</div>
      </div>
    </div>
    <div class="doc-reg-badge">
      <div>NO. REGISTRASI DOKUMEN</div>
      <div class="doc-reg-number">${stats.docNumber}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Tanggal Operasional:</span>
      <span class="meta-val">${stats.formattedDate} (${date})</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Shift Kerja:</span>
      <span class="meta-val">${stats.shiftSchedule}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Petugas Operator:</span>
      <span class="meta-val">Semua Operator Finish Pallet</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Waktu Cetak:</span>
      <span class="meta-val">${nowStr} WIB</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Status Dokumen:</span>
      <span class="meta-val" style="color: #047857;">Resmi & Terverifikasi</span>
    </div>
  </div>

  <div class="summary-strip">
    <div class="stat-card in">
      <div>
        <div style="font-size: 8.5px; text-transform: uppercase;">Total Masuk (Penerimaan)</div>
        <div class="stat-val">+${stats.totalIn.toLocaleString('id-ID')} <span style="font-size: 9px; font-weight: normal;">Unit</span></div>
      </div>
      <div style="font-size: 9px; text-align: right; opacity: 0.85;">${stats.totalInSet} Set<br/>${stats.totalInPcs} Pcs</div>
    </div>

    <div class="stat-card out">
      <div>
        <div style="font-size: 8.5px; text-transform: uppercase;">Total Keluar (Pengeluaran)</div>
        <div class="stat-val">-${stats.totalOut.toLocaleString('id-ID')} <span style="font-size: 9px; font-weight: normal;">Unit</span></div>
      </div>
      <div style="font-size: 9px; text-align: right; opacity: 0.85;">${stats.totalOutSet} Set<br/>${stats.totalOutPcs} Pcs</div>
    </div>

    <div class="stat-card net">
      <div>
        <div style="font-size: 8.5px; text-transform: uppercase;">Net Mutasi Shift (In - Out)</div>
        <div class="stat-val" style="color: ${stats.netQty >= 0 ? '#047857' : '#B91C1C'};">
          ${stats.netQty >= 0 ? '+' : ''}${stats.netQty.toLocaleString('id-ID')} <span style="font-size: 9px; font-weight: normal;">Unit</span>
        </div>
      </div>
      <div style="font-size: 9px; text-align: right; opacity: 0.85;">Selisih Stok</div>
    </div>

    <div class="stat-card tx">
      <div>
        <div style="font-size: 8.5px; text-transform: uppercase;">Total Transaksi Terdaftar</div>
        <div class="stat-val">${stats.inList.length + stats.outList.length} <span style="font-size: 9px; font-weight: normal;">Tx</span></div>
      </div>
      <div style="font-size: 9px; text-align: right; opacity: 0.85;">${stats.inList.length} Masuk<br/>${stats.outList.length} Keluar</div>
    </div>
  </div>

  ${showIn ? `
    <div class="section-title in">
      <span>1. Rincian Penerimaan (Masuk) Pallet di Shift Ini</span>
      <span>Total: +${stats.totalIn.toLocaleString('id-ID')} Unit (${stats.inList.length} Transaksi)</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 25px;">No</th>
          <th style="width: 45px;">Jam</th>
          <th style="width: 120px;">No. Transaksi</th>
          <th>Ukuran Pallet</th>
          <th style="width: 45px;">Pallet Runners</th>
          <th>Wrap Type</th>
          <th>Asal / Supplier</th>
          <th style="width: 70px; text-align: right;">Quantity</th>
          <th style="width: 40px; text-align: center;">Satuan</th>
          <th>Peletakan / Ket</th>
        </tr>
      </thead>
      <tbody>
        ${renderTxRows(stats.inList, true)}
        ${stats.inList.length > 0 ? `
          <tr style="background: #ECFDF5; font-weight: bold; border-top: 2px solid #065F46; border-bottom: 2px double #065F46;">
            <td colspan="7" style="padding: 5px; text-align: left; font-size: 9.5px; color: #065F46;">TOTAL PENERIMAAN SHIFT</td>
            <td style="padding: 5px; text-align: right; font-size: 10.5px; color: #047857; font-family: monospace;">+${stats.totalIn.toLocaleString('id-ID')}</td>
            <td colspan="2" style="padding: 5px; font-size: 9px; color: #065F46;">${stats.totalInSet} Set | ${stats.totalInPcs} Pcs</td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  ` : ''}

  ${showOut ? `
    <div class="section-title out">
      <span>2. Rincian Pengeluaran (Keluar) Pallet di Shift Ini</span>
      <span>Total: -${stats.totalOut.toLocaleString('id-ID')} Unit (${stats.outList.length} Transaksi)</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 25px;">No</th>
          <th style="width: 45px;">Jam</th>
          <th style="width: 120px;">No. Transaksi</th>
          <th>Ukuran Pallet</th>
          <th style="width: 45px;">Pallet Runners</th>
          <th>Wrap Type</th>
          <th>User / Tujuan</th>
          <th style="width: 70px; text-align: right;">Quantity</th>
          <th style="width: 40px; text-align: center;">Satuan</th>
          <th>Peletakan / Ket</th>
        </tr>
      </thead>
      <tbody>
        ${renderTxRows(stats.outList, false)}
        ${stats.outList.length > 0 ? `
          <tr style="background: #FFFBEB; font-weight: bold; border-top: 2px solid #92400E; border-bottom: 2px double #92400E;">
            <td colspan="7" style="padding: 5px; text-align: left; font-size: 9.5px; color: #92400E;">TOTAL PENGELUARAN SHIFT</td>
            <td style="padding: 5px; text-align: right; font-size: 10.5px; color: #D97706; font-family: monospace;">-${stats.totalOut.toLocaleString('id-ID')}</td>
            <td colspan="2" style="padding: 5px; font-size: 9px; color: #92400E;">${stats.totalOutSet} Set | ${stats.totalOutPcs} Pcs</td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  ` : ''}

  ${stats.summaryBySize.length > 0 ? `
    <div class="section-title summary">
      <span>3. Rekapitulasi per Ukuran Pallet pada Shift Ini</span>
      <span>${stats.summaryBySize.length} Kombinasi Ukuran & Type</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 25px;">No</th>
          <th>Ukuran Pallet</th>
          <th style="width: 55px; text-align: center;">Pallet Runners</th>
          <th>Wrap Type</th>
          <th style="width: 50px; text-align: center;">Satuan</th>
          <th style="text-align: right; color: #34D399;">Masuk (+)</th>
          <th style="text-align: right; color: #FBBF24;">Keluar (-)</th>
          <th style="text-align: right;">Net Mutasi</th>
        </tr>
      </thead>
      <tbody>
        ${stats.summaryBySize.map((s, idx) => {
          const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          return `
            <tr style="background: ${bg}; font-size: 9.5px;">
              <td style="padding: 4px; border: 1px solid #CBD5E1; text-align: center;">${idx + 1}</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; font-weight: bold;">${s.palletSize}</td>
              <td style="padding: 4px; border: 1px solid #CBD5E1; text-align: center; font-weight: bold;">${s.typePallet}</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1;">${s.palletType}</td>
              <td style="padding: 4px; border: 1px solid #CBD5E1; text-align: center;">${s.unit}</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #047857; font-family: monospace;">+${s.inQty.toLocaleString('id-ID')}</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #D97706; font-family: monospace;">-${s.outQty.toLocaleString('id-ID')}</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; text-align: right; font-weight: 800; font-family: monospace; color: ${s.netQty >= 0 ? '#047857' : '#B91C1C'};">
                ${s.netQty >= 0 ? '+' : ''}${s.netQty.toLocaleString('id-ID')}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="sig-section">
    <div class="sig-heading">Lembar Verifikasi & Pengesahan Hasil Laporan Operasional Shift</div>
    <div class="sig-grid">
      <div class="sig-box">
        <div><b>Dibuat / Dilaporkan Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Operator Finish Pallet</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Diperiksa Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Supervisor Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Disetujui Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Manager Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 45px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc">Tulis Nama Terang & Tanda Tangan</div>
      </div>
    </div>
  </div>

  <div style="margin-top: 18px; padding-top: 6px; border-top: 1px dashed #CBD5E1; font-size: 8px; color: #94A3B8; display: flex; justify-content: space-between;">
    <span>PT Indah Kiat Pulp & Paper Tbk · Workshop Pallet dan Coreplug</span>
    <span>No. Registrasi: ${stats.docNumber} · Dicetak pada ${nowStr} WIB</span>
  </div>
</body>
</html>`;
}

/**
 * Exports dedicated executive Shift Report to Excel (.xlsx) using ExcelJS
 */
export async function exportShiftReportToExcel(options: ShiftReportOptions): Promise<void> {
  const { date, shift, operatorName } = options;
  const stats = computeShiftStats(options);
  const nowStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `Finish Pallet Management System (${operatorName})`;
  workbook.created = new Date();

  const [logoClean, companyLogoClean] = await Promise.all([
    getLogoCleanBase64(),
    getCompanyLogoCleanBase64()
  ]);

  const ws = workbook.addWorksheet(`Laporan ${shift}`, {
    views: [
      {
        state: 'frozen',
        xSplit: 7,
        ySplit: 13,
        topLeftCell: 'H14',
        activeCell: 'H14',
        showGridLines: true
      }
    ],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  const colCount = 11;

  // Logo Finish Pallet (Kolom 1 / A)
  if (logoClean) {
    try {
      const imgId = workbook.addImage({
        base64: logoClean,
        extension: 'png'
      });
      ws.addImage(imgId, {
        tl: { col: 0.08, row: 0.15 },
        ext: { width: 48, height: 48 }
      });
    } catch (e) {
      console.warn('Could not add logo to shift report ws', e);
    }
  }

  // Logo PT Indah Kiat (Berdampingan tepat di sebelah logo Finish Pallet, Kolom 2 / B)
  if (companyLogoClean) {
    try {
      const compImgId = workbook.addImage({
        base64: companyLogoClean,
        extension: 'png'
      });
      ws.addImage(compImgId, {
        tl: { col: 0.95, row: 0.18 },
        ext: { width: 110, height: 46 }
      });
    } catch (e) {
      console.warn('Could not add company logo to shift report ws', e);
    }
  }

  // Row 1: Company Title (dimulai dari kolom 3 agar kedua logo berdampingan rapih di kolom 1 & 2)
  ws.mergeCells(1, 3, 1, colCount);
  const r1 = ws.getCell(1, 3);
  r1.value = 'PT INDAH KIAT PULP & PAPER TBK';
  r1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  ws.getRow(1).height = 24;

  // Row 2: Sub-Unit
  ws.mergeCells(2, 3, 2, colCount);
  const r2 = ws.getCell(2, 3);
  r2.value = 'WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM';
  r2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
  ws.getRow(2).height = 18;

  // Row 3: Report Title
  ws.mergeCells(3, 3, 3, colCount);
  const r3 = ws.getCell(3, 3);
  r3.value = `LAPORAN PENERIMAAN & PENGELUARAN PALLET - ${shift.toUpperCase()}`;
  r3.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  r3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(3).height = 24;

  // Spacer
  ws.getRow(4).height = 8;

  // Metadata
  const metadata = [
    { label: 'No. Registrasi Dokumen:', val: stats.docNumber, bold: true },
    { label: 'Tanggal Operasional:', val: `${stats.formattedDate} (${date})`, bold: true },
    { label: 'Shift Kerja:', val: stats.shiftSchedule, bold: false },
    { label: 'Petugas Operator:', val: 'Semua Operator Finish Pallet', bold: true },
    { label: 'Waktu Generate:', val: `${nowStr} WIB`, bold: false }
  ];

  metadata.forEach((m, idx) => {
    const rowNum = 5 + idx;
    const lCell = ws.getCell(rowNum, 1);
    lCell.value = m.label;
    lCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF475569' } };

    const vCell = ws.getCell(rowNum, 2);
    vCell.value = m.val;
    vCell.font = { name: 'Calibri', size: 9.5, bold: m.bold, color: { argb: 'FF0F172A' } };
    ws.getRow(rowNum).height = 16;
  });

  // Summary box
  let curRow = 11;
  ws.mergeCells(curRow, 1, curRow, colCount);
  const sumCell = ws.getCell(curRow, 1);
  sumCell.value = `RINGKASAN MUTASI SHIFT: Total Masuk: +${stats.totalIn} Unit (${stats.totalInSet} Set / ${stats.totalInPcs} Pcs)  |  Total Keluar: -${stats.totalOut} Unit (${stats.totalOutSet} Set / ${stats.totalOutPcs} Pcs)  |  Net Mutasi: ${stats.netQty >= 0 ? '+' : ''}${stats.netQty} Unit`;
  sumCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };
  sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  sumCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sumCell.border = {
    top: { style: 'thin', color: { argb: 'FFFDE68A' } },
    bottom: { style: 'thin', color: { argb: 'FFFDE68A' } }
  };
  ws.getRow(curRow).height = 22;

  curRow += 2;

  // Table Headers
  const tableHeaders = [
    'No',
    'Jam',
    'No. Transaksi',
    'Ukuran Pallet',
    'Region',
    'Wrap Type',
    'Pallet Runners',
    'User / Pihak Terkait',
    'Quantity',
    'Satuan',
    'Peletakan / Ket'
  ];

  const renderSection = (title: string, list: Transaction[], isInbound: boolean, headerBg: string) => {
    ws.mergeCells(curRow, 1, curRow, colCount);
    const sTitleCell = ws.getCell(curRow, 1);
    sTitleCell.value = title;
    sTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
    sTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(curRow).height = 22;
    curRow++;

    // Header row
    const hRow = ws.getRow(curRow);
    hRow.height = 22;
    tableHeaders.forEach((h, cIdx) => {
      const cell = hRow.getCell(cIdx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: cIdx === 8 ? 'right' : cIdx === 0 || cIdx === 1 || cIdx === 4 || cIdx === 6 || cIdx === 9 ? 'center' : 'left'
      };
    });
    curRow++;

    if (list.length === 0) {
      ws.mergeCells(curRow, 1, curRow, colCount);
      const emptyCell = ws.getCell(curRow, 1);
      emptyCell.value = `Tidak ada transaksi ${isInbound ? 'penerimaan' : 'pengeluaran'} di shift ini.`;
      emptyCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF94A3B8' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(curRow).height = 20;
      curRow += 2;
      return;
    }

    list.forEach((t, idx) => {
      const dRow = ws.getRow(curRow);
      dRow.height = 18;
      const isEven = idx % 2 === 0;

      const vals = [
        idx + 1,
        t.time,
        t.transactionNumber,
        formatPalletDimension(t.palletSize),
        t.marketType,
        t.palletType,
        t.typePallet || 'LS',
        t.customer || '-',
        t.quantity,
        t.unit,
        [t.noRun ? `[No.Run: ${t.noRun}]` : '', t.pelatakanPallet ? `Kolom: ${t.pelatakanPallet}` : '', t.notes].filter(Boolean).join(' | ') || '-'
      ];

      vals.forEach((v, cIdx) => {
        const cell = dRow.getCell(cIdx + 1);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
        if (cIdx === 8) {
          cell.numFmt = isInbound ? '+#,##0' : '-#,##0';
          cell.font = {
            name: 'Calibri',
            size: 9.5,
            bold: true,
            color: { argb: isInbound ? 'FF047857' : 'FFD97706' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 0 || cIdx === 1 || cIdx === 4 || cIdx === 6 || cIdx === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
      curRow++;
    });

    // Total row
    const totRow = ws.getRow(curRow);
    totRow.height = 22;
    ws.mergeCells(curRow, 1, curRow, 8);
    const totLabel = totRow.getCell(1);
    totLabel.value = `TOTAL ${isInbound ? 'PENERIMAAN' : 'PENGELUARAN'} SHIFT`;
    totLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    totLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const totVal = totRow.getCell(9);
    const sumQty = list.reduce((a, b) => a + b.quantity, 0);
    totVal.value = sumQty;
    totVal.numFmt = isInbound ? '+#,##0' : '-#,##0';
    totVal.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: isInbound ? 'FF047857' : 'FFD97706' }
    };
    totVal.alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= colCount; c++) {
      const cell = totRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isInbound ? 'FFECFDF5' : 'FFFFFBEB' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      };
    }
    curRow += 2;
  };

  renderSection('1. RINCIAN PENERIMAAN (MASUK) PALLET', stats.inList, true, 'FF065F46');
  renderSection('2. RINCIAN PENGELUARAN (KELUAR) PALLET', stats.outList, false, 'FF92400E');

  // Official Signatures
  curRow += 1;
  ws.mergeCells(curRow, 1, curRow, colCount);
  const sigTitle = ws.getCell(curRow, 1);
  sigTitle.value = 'LEMBAR VERIFIKASI & PENGESAHAN DOKUMEN OPERASIONAL SHIFT';
  sigTitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  sigTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(curRow).height = 18;

  curRow += 2;
  const p1 = 1;
  const p2 = 5;
  const p3 = 9;

  const rRole = ws.getRow(curRow);
  rRole.getCell(p1).value = 'Dibuat / Dilaporkan Oleh:';
  rRole.getCell(p1).font = { name: 'Calibri', size: 9.5, bold: true };
  rRole.getCell(p1).alignment = { horizontal: 'center' };

  rRole.getCell(p2).value = 'Diperiksa Oleh:';
  rRole.getCell(p2).font = { name: 'Calibri', size: 9.5, bold: true };
  rRole.getCell(p2).alignment = { horizontal: 'center' };

  rRole.getCell(p3).value = 'Disetujui Oleh:';
  rRole.getCell(p3).font = { name: 'Calibri', size: 9.5, bold: true };
  rRole.getCell(p3).alignment = { horizontal: 'center' };

  curRow++;
  const rSub = ws.getRow(curRow);
  rSub.getCell(p1).value = 'Operator Finish Pallet';
  rSub.getCell(p1).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
  rSub.getCell(p1).alignment = { horizontal: 'center' };

  rSub.getCell(p2).value = 'Supervisor Workshop Pallet & Coreplug';
  rSub.getCell(p2).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
  rSub.getCell(p2).alignment = { horizontal: 'center' };

  rSub.getCell(p3).value = 'Manager Workshop Pallet & Coreplug';
  rSub.getCell(p3).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
  rSub.getCell(p3).alignment = { horizontal: 'center' };

  curRow += 3;
  const rName = ws.getRow(curRow);
  rName.getCell(p1).value = '( .................................................. )';
  rName.getCell(p1).font = { name: 'Calibri', size: 9.5, bold: true };
  rName.getCell(p1).alignment = { horizontal: 'center' };

  rName.getCell(p2).value = '( .................................................. )';
  rName.getCell(p2).font = { name: 'Calibri', size: 9.5, bold: true };
  rName.getCell(p2).alignment = { horizontal: 'center' };

  rName.getCell(p3).value = '( .................................................. )';
  rName.getCell(p3).font = { name: 'Calibri', size: 9.5, bold: true };
  rName.getCell(p3).alignment = { horizontal: 'center' };

  curRow++;
  const rDesc = ws.getRow(curRow);
  rDesc.getCell(p1).value = 'Tulis Nama Terang & TTD';
  rDesc.getCell(p1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  rDesc.getCell(p1).alignment = { horizontal: 'center' };

  rDesc.getCell(p2).value = 'Tulis Nama Terang & TTD';
  rDesc.getCell(p2).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  rDesc.getCell(p2).alignment = { horizontal: 'center' };

  rDesc.getCell(p3).value = 'Tulis Nama Terang & TTD';
  rDesc.getCell(p3).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  rDesc.getCell(p3).alignment = { horizontal: 'center' };

  // Set widths
  ws.columns = [
    { width: 6 },  // No
    { width: 10 }, // Jam
    { width: 22 }, // No. Transaksi
    { width: 18 }, // Ukuran Pallet
    { width: 14 }, // Lokal / Ekspor
    { width: 18 }, // Jenis Pallet
    { width: 12 }, // Type Pallet
    { width: 22 }, // User / Pihak Terkait
    { width: 14 }, // Quantity
    { width: 10 }, // Satuan
    { width: 20 }  // Peletakan / Ket
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const filename = `Laporan_${shift.replace(/\s+/g, '_')}_${date}_${stats.docNumber.replace(/\//g, '-')}`;
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

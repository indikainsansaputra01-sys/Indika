/**
 * PDF Export Utility for PT Indah Kiat Pulp & Paper Tbk
 * Workshop Pallet dan Coreplug - Finish Pallet Management System (FPMS)
 * Uses jsPDF and jspdf-autotable for pixel-perfect executive PDF generation.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateDocNumber, generateStockTakeDocNumber } from './exportUtils';
import { SingleDayStockResult, MonthlyStockMatrixResult } from './monthlyStockUtils';
import { getLogoBase64DataUrl, getCompanyLogoBase64DataUrl } from './logoUtils';

export interface PDFExportOptions {
  filename: string;
  reportTitle: string;
  periodLabel?: string;
  operatorName?: string;
  docNumber?: string;
  shift?: string;
  docDate?: string;
  headers: string[];
  rows: (string | number)[][];
  alignments?: ('left' | 'center' | 'right')[];
  totalsSummary?: string;
  orientation?: 'portrait' | 'landscape';
  signatures?: boolean;
  logoBase64?: string | null;
  companyLogoBase64?: string | null;
}

import {
  normalizePalletDimension,
  formatProfessionalCell,
  formatTypePallet,
  formatJenisPallet,
  formatMarketType,
  formatSatuan
} from './dimensionUtils';

export {
  formatProfessionalCell,
  formatTypePallet,
  formatJenisPallet,
  formatMarketType,
  formatSatuan
};

/**
 * Normalizes dimension string to canonical compact format (e.g. "81x111", "86x122")
 * Only touches actual dimension strings that contain digits and 'x'/'X'/'*'/'×'.
 */
export function formatPalletDimension(dim?: string | null): string {
  if (!dim) return '';
  const str = String(dim).trim();
  if (/^\d+(\.\d+)?\s*[xX×*]\s*\d+/.test(str)) {
    return normalizePalletDimension(str);
  }
  return str;
}

/**
 * Adds corporate header, document title, and metadata banner
 */
function drawCorporateHeader(
  doc: jsPDF,
  reportTitle: string,
  docNumber: string,
  periodLabel: string,
  operatorName: string,
  isLandscape: boolean,
  logoBase64?: string | null,
  companyLogoBase64?: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = isLandscape ? 8 : 12;
  let currentY = 9.5;

  // 1. Top Accent Brand Bar
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 0.8, 'F');
  currentY += 4.2;

  const hasLogo = Boolean(logoBase64);
  const hasCompanyLogo = Boolean(companyLogoBase64);
  const logoBoxSize = isLandscape ? 12 : 13;
  const companyLogoWidth = isLandscape ? 26 : 28;
  let textStartX = marginX;
  let currentBadgeX = marginX;

  // 1A. PT Indah Kiat Corporate Logo Badge
  if (hasCompanyLogo && companyLogoBase64) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(currentBadgeX, currentY, companyLogoWidth, logoBoxSize, 1.5, 1.5, 'FD');
      doc.addImage(companyLogoBase64, 'PNG', currentBadgeX + 1.2, currentY + 1.2, companyLogoWidth - 2.4, logoBoxSize - 2.4);
      currentBadgeX += companyLogoWidth + 2.5;
      textStartX = currentBadgeX;
    } catch (e) {
      console.warn('Could not render company logo in PDF header', e);
    }
  }

  // 1B. Finish Pallet Unit Logo Badge
  if (hasLogo && logoBase64) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(currentBadgeX, currentY, logoBoxSize, logoBoxSize, 1.5, 1.5, 'FD');
      doc.addImage(logoBase64, 'JPEG', currentBadgeX + 0.8, currentY + 0.8, logoBoxSize - 1.6, logoBoxSize - 1.6);
      currentBadgeX += logoBoxSize + 3.5;
      textStartX = currentBadgeX;
    } catch (e) {
      console.warn('Could not render logo in PDF header', e);
    }
  }

  // 2. Company Name & Department
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 11.5 : 12.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PT INDAH KIAT PULP & PAPER TBK', textStartX, currentY + (hasLogo || hasCompanyLogo ? 4.2 : 3.8));

  currentY += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 7.5 : 8.2);
  doc.setTextColor(4, 120, 87); // Emerald 700
  doc.text('WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM (FPMS)', textStartX, currentY + (hasLogo || hasCompanyLogo ? 4.2 : 3.8));

  currentY += (hasLogo || hasCompanyLogo ? 6.5 : 5);

  // 3. Document Title Box
  const titleBoxHeight = isLandscape ? 7 : 8;
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(marginX, currentY, pageWidth - marginX * 2, titleBoxHeight, 'F');
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.2);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, titleBoxHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 9 : 10);
  doc.setTextColor(30, 41, 59);
  doc.text(reportTitle.toUpperCase(), marginX + 3, currentY + (titleBoxHeight * 0.65));

  currentY += titleBoxHeight + 3.5;

  // 4. Metadata Grid (4 Key Data Points)
  const now = new Date();
  const printTimeStr = `${now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

  const colWidthMeta = (pageWidth - marginX * 2) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);

  // Left column metadata
  doc.text('No. Registrasi Dokumen:', marginX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(docNumber, marginX + 35, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Periode / Tanggal:', marginX, currentY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(periodLabel, marginX + 35, currentY + 3.8);

  // Right column metadata
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Petugas / Operator:', marginX + colWidthMeta, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(operatorName, marginX + colWidthMeta + 32, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Waktu Unduh & Verifikasi:', marginX + colWidthMeta, currentY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(printTimeStr, marginX + colWidthMeta + 32, currentY + 3.8);

  currentY += 8;
  return currentY;
}

/**
 * Renders official 3-tier signature boxes at the bottom
 */
function drawOfficialSignatures(
  doc: jsPDF,
  startY: number,
  isLandscape: boolean
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = isLandscape ? 8 : 12;
  const sigBoxHeight = isLandscape ? 22 : 24;

  let finalY = startY;
  if (finalY + sigBoxHeight + 8 > pageHeight - 12) {
    doc.addPage();
    finalY = 14;
  } else {
    finalY += 4;
  }

  const availableWidth = pageWidth - marginX * 2;
  const boxWidth = (availableWidth - 8) / 3;

  const signatureRoles = [
    {
      title: 'Diserahkan / Dibuat Oleh:',
      role: 'Operator Finish Pallet',
      desc: 'Tulis Nama Terang & Tanda Tangan'
    },
    {
      title: 'Diperiksa Oleh:',
      role: 'Supervisor Workshop Pallet & Coreplug',
      desc: 'Tulis Nama Terang & Tanda Tangan'
    },
    {
      title: 'Disetujui Oleh:',
      role: 'Manager Workshop Pallet & Coreplug',
      desc: 'Tulis Nama Terang & Tanda Tangan'
    }
  ];

  signatureRoles.forEach((sig, idx) => {
    const boxX = marginX + idx * (boxWidth + 4);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(boxX, finalY, boxWidth, sigBoxHeight, 'DF');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(sig.title, boxX + 2.5, finalY + 4);

    // Role
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.role, boxX + 2.5, finalY + 7.5);

    // Signature dotted line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('( ................................................. )', boxX + 2.5, finalY + (sigBoxHeight - 4.5));

    // Description note
    doc.setFontSize(5.8);
    doc.setTextColor(148, 163, 184);
    doc.text(sig.desc, boxX + 2.5, finalY + (sigBoxHeight - 1.5));
  });

  return finalY + sigBoxHeight + 4;
}

/**
 * Two-pass running footer for official page numbering ("Halaman X dari Y")
 */
function applyTwoPassPageNumbers(doc: jsPDF, isLandscape: boolean) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = isLandscape ? 8 : 12;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.line(marginX, pageHeight - 8, pageWidth - marginX, pageHeight - 8);

    doc.text(
      'PT Indah Kiat Pulp & Paper Tbk · Workshop Pallet dan Coreplug · Sistem Informasi Finish Pallet (FPMS)',
      marginX,
      pageHeight - 4.5
    );
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - marginX - 18,
      pageHeight - 4.5
    );
  }
}

/**
 * Universal PDF exporter for all FPMS tabular reports (Mutasi, Harian, dsb)
 */
export async function exportToPDF(options: PDFExportOptions): Promise<void> {
  const {
    filename,
    reportTitle,
    periodLabel = 'Bulan Berjalan',
    operatorName,
    docNumber,
    shift,
    docDate,
    headers,
    rows,
    alignments = [],
    totalsSummary,
    signatures = true
  } = options;

  // Determine landscape if more than 6 columns or explicitly set
  const isLandscape = options.orientation
    ? options.orientation === 'landscape'
    : headers.length > 6;

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = isLandscape ? 8 : 12;

  const isStockReport =
    reportTitle.toUpperCase().includes('STOK') ||
    reportTitle.toUpperCase().includes('STOCK') ||
    filename.toLowerCase().includes('stok');

  const effectiveDocNumber =
    docNumber ||
    (isStockReport
      ? generateStockTakeDocNumber(undefined, undefined, docDate || periodLabel)
      : generateDocNumber(shift || 'Shift 1', docDate || periodLabel));

  const effectiveOperator =
    isStockReport
      ? 'Semua Operator Finish Pallet'
      : (operatorName || 'Indika (Operator)');

  const effectiveLogo =
    options.logoBase64 !== undefined ? options.logoBase64 : await getLogoBase64DataUrl();
  const effectiveCompanyLogo =
    options.companyLogoBase64 !== undefined ? options.companyLogoBase64 : await getCompanyLogoBase64DataUrl();

  // 1. Draw Corporate Header
  const tableStartY = drawCorporateHeader(
    doc,
    reportTitle,
    effectiveDocNumber,
    periodLabel,
    effectiveOperator,
    isLandscape,
    effectiveLogo,
    effectiveCompanyLogo
  );

  // 2. Format Table Rows with clean professional capitalization and alignments
  const formattedRows = rows.map((r) =>
    r.map((cell, cIdx) => {
      if (typeof cell === 'string') {
        return formatProfessionalCell(cell, headers[cIdx]);
      }
      return cell;
    })
  );

  // 3. Determine Alignments
  const columnStyles: Record<number, any> = {};
  headers.forEach((h, idx) => {
    const customAlign = alignments[idx];
    if (customAlign) {
      columnStyles[idx] = { halign: customAlign };
    } else {
      const hLower = h.toLowerCase();
      if (
        hLower.includes('informasi peletakan') ||
        hLower.includes('detail peletakan') ||
        hLower.includes('posisi kolom')
      ) {
        columnStyles[idx] = { halign: 'left' };
      } else if (
        hLower.includes('qty') ||
        hLower.includes('jumlah') ||
        hLower.includes('total') ||
        hLower.includes('stok') ||
        hLower.includes('masuk') ||
        hLower.includes('keluar') ||
        hLower.includes('frekuensi') ||
        hLower.includes('saldo')
      ) {
        columnStyles[idx] = { halign: 'right' };
      } else if (
        hLower === 'no' ||
        hLower.includes('tanggal') ||
        hLower.includes('tgl') ||
        hLower.includes('jam') ||
        hLower.includes('shift') ||
        hLower.includes('satuan') ||
        hLower.includes('kolom') ||
        hLower.includes('peletakan') ||
        hLower.includes('status') ||
        hLower.includes('region') ||
        hLower.includes('pasar') ||
        hLower.includes('runner') ||
        hLower.includes('type')
      ) {
        columnStyles[idx] = { halign: 'center' };
      } else {
        columnStyles[idx] = { halign: 'left' };
      }
    }
  });

  // 4. Render Table with AutoTable
  autoTable(doc, {
    head: [headers],
    body: formattedRows,
    startY: tableStartY,
    margin: { left: marginX, right: marginX, bottom: signatures ? 32 : 14 },
    styles: {
      fontSize: isLandscape ? 7.2 : 7.8,
      cellPadding: isLandscape ? 1.8 : 2.2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: isLandscape ? 7.5 : 8.2,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    columnStyles
  });

  // 5. Totals Summary Box
  let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : tableStartY + 20;

  if (totalsSummary) {
    if (finalY + 12 > pageHeight - 35) {
      doc.addPage();
      finalY = 14;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, finalY + 2, pageWidth - marginX * 2, 6.8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(marginX, finalY + 2, pageWidth - marginX * 2, 6.8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`RINGKASAN TOTAL: ${totalsSummary}`, marginX + 3, finalY + 6.4);
    finalY += 10;
  }

  // 6. Signatures Block
  if (signatures) {
    drawOfficialSignatures(doc, finalY, isLandscape);
  }

  // 7. Two-Pass Running Footers
  applyTwoPassPageNumbers(doc, isLandscape);

  // 8. Download PDF
  const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(cleanFilename);
}

/**
 * Dedicated Pixel-Perfect PDF Exporter for Single Day Stock Take
 */
export async function exportSingleDayStockToPDF(
  result: SingleDayStockResult,
  options: { operatorName?: string; docNumber?: string } = {}
): Promise<void> {
  const headers = [
    'No',
    'Ukuran Pallet',
    'Region',
    'Wrap Type',
    'Pallet Runners',
    'Satuan',
    'Stok Awal',
    'Produksi / Masuk (+)',
    'Pengeluaran (-)',
    'Stok Akhir',
    'Status'
  ];

  const rows = result.rows.map((r, idx) => [
    idx + 1,
    formatPalletDimension(r.palletSize),
    r.marketType,
    r.palletType,
    r.typePallet || 'LS',
    r.unit,
    r.startOfDayQty.toLocaleString('id-ID'),
    r.inToday > 0 ? `+${r.inToday.toLocaleString('id-ID')}` : '0',
    r.outToday > 0 ? `-${r.outToday.toLocaleString('id-ID')}` : '0',
    r.endOfDayQty.toLocaleString('id-ID'),
    r.status
  ]);

  const summary = `Stok Awal: ${result.totalStart.toLocaleString('id-ID')} | Total Masuk/Produksi: +${result.totalIn.toLocaleString('id-ID')} | Total Keluar: -${result.totalOut.toLocaleString('id-ID')} | Stok Akhir: ${result.totalEnd.toLocaleString('id-ID')}`;

  await exportToPDF({
    filename: `Stok_Take_Harian_${result.targetDate}`,
    reportTitle: `LAPORAN STOK TAKE HARIAN - ${result.formattedDate.toUpperCase()}`,
    periodLabel: result.formattedDate,
    operatorName: options.operatorName || 'Semua Operator Finish Pallet',
    docNumber: options.docNumber || generateStockTakeDocNumber(undefined, undefined, result.targetDate),
    headers,
    rows,
    totalsSummary: summary,
    orientation: 'landscape',
    signatures: true
  });
}

/**
 * DEDICATED MONTHLY STOCK TAKE MATRIX PDF EXPORTER (TGL 01 S/D 31 IN 1 LANDSCAPE PAGE)
 *
 * Guarantees that all dates 1 through 31 fit in the SAME single landscape page horizontally,
 * with NO splitting of day columns onto subsequent pages.
 * Includes complete item identity: Ukuran Pallet, Region, Wrap Type, and Pallet Runners.
 */
export async function exportMonthlyStockMatrixToPDF(
  matrix: MonthlyStockMatrixResult,
  options: { operatorName?: string; docNumber?: string } = {}
): Promise<void> {
  const isLandscape = true;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const marginX = 6; // 6 mm left & right margin
  const printableWidth = pageWidth - marginX * 2; // 285 mm

  const daysCount = matrix.daysInMonth; // 28..31
  const daysList = matrix.daysList;

  // Fixed descriptor column widths (in mm)
  const colW_No = 4.5;
  const colW_Size = 20;
  const colW_Market = 10;
  const colW_PalletType = 12.5;
  const colW_Type = 7;
  const colW_Start = 8.5;

  const colW_In = 9;
  const colW_Out = 9;
  const colW_End = 9.5;

  // Total width of metadata + summary columns (no Kolom Yard)
  const totalFixedW =
    colW_No +
    colW_Size +
    colW_Market +
    colW_PalletType +
    colW_Type +
    colW_Start +
    colW_In +
    colW_Out +
    colW_End; // 70.5 mm

  const totalDaysW = printableWidth - totalFixedW; // 285 - 70.5 = 214.5 mm
  const colW_Day = Number((totalDaysW / daysCount).toFixed(2)); // ~6.9 mm per date column for 31 days

  // 1. Build Table Headers with full pallet specifications: Ukuran, Region, Wrap Type, Pallet Runners
  const tableHeaders = [
    'No',
    'Ukuran Pallet',
    'Region',
    'Wrap Type',
    'Pallet Runners',
    'Awal',
    ...daysList.map((d) => String(d).padStart(2, '0')),
    'Prod/In (+)',
    'Out (-)',
    'Stok Akhir'
  ];

  // 2. Build Table Data Rows (dengan per tanggal: stok akhir di tanggal itu, dibawahnya Produksi/Penerimaan & Pengeluaran)
  const tableRows = matrix.rows.map((r, idx) => {
    return [
      idx + 1,
      formatPalletDimension(r.palletSize),
      r.marketType,
      r.palletType,
      r.typePallet || 'LS',
      r.startOfMonthQty.toLocaleString('id-ID'),
      ...daysList.map((d) => {
        const pt = r.dailyPoints.find((p) => p.day === d);
        if (!pt || (pt.stock === 0 && pt.inQty === 0 && pt.outQty === 0)) return '-';
        if (pt.inQty > 0 || pt.outQty > 0) {
          const lines = [`Stk: ${pt.stock}`];
          if (pt.inQty > 0) lines.push(`Prod: +${pt.inQty}`);
          if (pt.outQty > 0) lines.push(`Out: -${pt.outQty}`);
          return lines.join('\n');
        }
        return `Stk: ${pt.stock.toLocaleString('id-ID')}`;
      }),
      r.totalInMonth > 0 ? `+${r.totalInMonth.toLocaleString('id-ID')}` : '0',
      r.totalOutMonth > 0 ? `-${r.totalOutMonth.toLocaleString('id-ID')}` : '0',
      r.endOfMonthQty.toLocaleString('id-ID')
    ];
  });

  // 3. Grand Total Row (Row Penutup Matriks)
  const grandTotalRow = [
    'TOTAL',
    'TOTAL KESELURUHAN',
    '-',
    '-',
    '-',
    matrix.totalStartMonth.toLocaleString('id-ID'),
    ...daysList.map((d) => {
      const dayTot = matrix.dailyTotals[d];
      if (!dayTot || (dayTot.stock === 0 && dayTot.inQty === 0 && dayTot.outQty === 0)) return '-';
      if (dayTot.inQty > 0 || dayTot.outQty > 0) {
        const lines = [`Stk: ${dayTot.stock}`];
        if (dayTot.inQty > 0) lines.push(`Prod: +${dayTot.inQty}`);
        if (dayTot.outQty > 0) lines.push(`Out: -${dayTot.outQty}`);
        return lines.join('\n');
      }
      return dayTot.stock > 0 ? `Stk: ${dayTot.stock.toLocaleString('id-ID')}` : '-';
    }),
    `+${matrix.totalInMonth.toLocaleString('id-ID')}`,
    `-${matrix.totalOutMonth.toLocaleString('id-ID')}`,
    matrix.totalEndMonth.toLocaleString('id-ID')
  ];
  tableRows.push(grandTotalRow);

  // 4. Draw Header Banner
  const effectiveDocNumber =
    options.docNumber || generateStockTakeDocNumber(matrix.year, matrix.month);
  const effectiveOperator = options.operatorName || 'Semua Operator Finish Pallet';
  const periodLabel = `${matrix.monthName.toUpperCase()} ${matrix.year} (${daysCount} HARI) · TGL 01 S/D ${String(daysCount).padStart(2, '0')}`;

  const logo = await getLogoBase64DataUrl();
  const companyLogo = await getCompanyLogoBase64DataUrl();
  const tableStartY = drawCorporateHeader(
    doc,
    `LAPORAN STOK TAKE BULANAN (TGL 01 S/D ${String(daysCount).padStart(2, '0')})`,
    effectiveDocNumber,
    periodLabel,
    effectiveOperator,
    isLandscape,
    logo,
    companyLogo
  );

  // 5. Build Column Styles mapping so every column fits strictly on 1 landscape page
  const columnStyles: Record<number, any> = {
    0: { cellWidth: colW_No, halign: 'center' },
    1: { cellWidth: colW_Size, halign: 'left', fontStyle: 'bold' },
    2: { cellWidth: colW_Market, halign: 'center' },
    3: { cellWidth: colW_PalletType, halign: 'left' },
    4: { cellWidth: colW_Type, halign: 'center', fontStyle: 'bold' },
    5: { cellWidth: colW_Start, halign: 'right' }
  };

  // Day columns (indexes 6 to 6 + daysCount - 1)
  daysList.forEach((_, idx) => {
    columnStyles[6 + idx] = {
      cellWidth: colW_Day,
      halign: 'center'
    };
  });

  // Summary trailing columns
  const inColIdx = 6 + daysCount;
  const outColIdx = inColIdx + 1;
  const endColIdx = outColIdx + 1;

  columnStyles[inColIdx] = { cellWidth: colW_In, halign: 'right' };
  columnStyles[outColIdx] = { cellWidth: colW_Out, halign: 'right' };
  columnStyles[endColIdx] = { cellWidth: colW_End, halign: 'right', fontStyle: 'bold' };

  // 6. Execute AutoTable with strict fitting and crisp font
  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: tableStartY,
    margin: { left: marginX, right: marginX, bottom: 32 },
    styles: {
      fontSize: 4.8,
      cellPadding: { top: 0.9, bottom: 0.9, left: 0.2, right: 0.2 },
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      overflow: 'ellipsize'
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 4.9,
      halign: 'center',
      cellPadding: { top: 1.4, bottom: 1.4, left: 0.2, right: 0.2 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    columnStyles,
    didParseCell: (data) => {
      // Highlight Grand Total row (last row)
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fillColor = [226, 232, 240]; // Slate 200
        data.cell.styles.textColor = [15, 23, 42];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // 7. Totals Summary Box
  let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : tableStartY + 20;

  const totalsSummary = `SALDO AWAL: ${matrix.totalStartMonth.toLocaleString('id-ID')} SET   |   TOTAL PENERIMAAN: +${matrix.totalInMonth.toLocaleString('id-ID')} SET   |   TOTAL PENGELUARAN: -${matrix.totalOutMonth.toLocaleString('id-ID')} SET   |   SALDO AKHIR BULAN: ${matrix.totalEndMonth.toLocaleString('id-ID')} SET   |   TOTAL VARIAN: ${matrix.rows.length} UKURAN/JENIS`;

  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY + 11 > pageHeight - 34) {
    doc.addPage();
    finalY = 12;
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, finalY + 1.8, printableWidth, 6.2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(marginX, finalY + 1.8, printableWidth, 6.2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`RINGKASAN REKAPITULASI: ${totalsSummary}`, marginX + 3, finalY + 5.8);

  finalY += 9;

  // 8. Signatures Block
  drawOfficialSignatures(doc, finalY, isLandscape);

  // 9. Two-Pass Running Footers
  applyTwoPassPageNumbers(doc, isLandscape);

  // 10. Save PDF
  const filename = `Laporan_Stok_Bulanan_${matrix.monthName}_${matrix.year}.pdf`;
  doc.save(filename);
}

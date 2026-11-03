import ExcelJS from 'exceljs';
import { normalizePalletDimension, formatProfessionalCell } from './dimensionUtils';
import { getLogoCleanBase64, getCompanyLogoCleanBase64 } from './logoUtils';

export interface ExcelExportOptions {
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
  totals?: { label: string; values: Record<number, any> };
  signatures?: boolean;
}

/**
 * Normalizes dimension string to canonical compact format (e.g. "81x111", "86x122")
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
 * Generates official document registration number:
 * Format: Shift/tanggalbulantahun/WSPCP
 * Contoh: Shift 2, tanggal 12 Oktober 2026 -> 002/12102026/WSPCP
 */
export function generateDocNumber(shiftInput?: string | number, dateInput?: string | Date): string {
  // If shiftInput contains '123' or indicates stock take/all shifts
  const shiftStr = String(shiftInput ?? '').toUpperCase();
  if (shiftStr.includes('123') || shiftStr.includes('STOK') || shiftStr.includes('STOCK')) {
    return generateStockTakeDocNumber(undefined, undefined, dateInput);
  }

  // Extract shift number as 3 digits: Shift 1 -> 001, Shift 2 -> 002, Shift 3 -> 003
  let shiftNum = '001';
  if (typeof shiftInput === 'number') {
    shiftNum = String(shiftInput).padStart(3, '0');
  } else if (shiftInput) {
    const s = String(shiftInput);
    const m = s.match(/\d+/);
    if (m) {
      shiftNum = m[0].padStart(3, '0');
    } else if (s.toUpperCase().includes('ALL') || s.toUpperCase().includes('SEMUA')) {
      shiftNum = '123';
    }
  }

  // Parse date into DDMMYYYY (8 digits without separator)
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const [y, m, day] = cleanStr.split('-');
      return `${shiftNum}/${day.padStart(2, '0')}${m.padStart(2, '0')}${y}/WSPCP`;
    }
    const parsed = new Date(cleanStr);
    d = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    d = dateInput;
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());

  return `${shiftNum}/${dd}${mm}${yyyy}/WSPCP`;
}

/**
 * Generates official registration document number for Stock Take / Laporan Stok Bulanan:
 * Format: 123/tanggalbulantahun akhir bulan/WSPCP
 * Contoh: Stok take bulan Oktober 2026 (meski dicetak tanggal 1 November) -> 123/31102026/WSPCP
 * Angka '123' melambangkan stok take mencakup gabungan seluruh shift (Shift 1, 2, dan 3)
 */
export function generateStockTakeDocNumber(
  yearInput?: number,
  monthInput?: number,
  fallbackDate?: string | Date
): string {
  let y = yearInput;
  let m = monthInput;

  // Try extracting month name and year from fallback date string (e.g. 'Oktober 2026', '2026-10', etc.)
  if ((!y || !m) && typeof fallbackDate === 'string') {
    const strLower = fallbackDate.toLowerCase();
    const monthsMap: Record<string, number> = {
      januari: 1, jan: 1, january: 1,
      februari: 2, feb: 2, february: 2,
      maret: 3, mar: 3, march: 3,
      april: 4, apr: 4,
      mei: 5, may: 5,
      juni: 6, jun: 6, june: 6,
      juli: 7, jul: 7, july: 7,
      agustus: 8, agu: 8, ags: 8, aug: 8, august: 8,
      september: 9, sep: 9, sept: 9,
      oktober: 10, okt: 10, oct: 10, october: 10,
      november: 11, nov: 11,
      desember: 12, des: 12, dec: 12, december: 12
    };

    for (const [key, val] of Object.entries(monthsMap)) {
      if (strLower.includes(key)) {
        m = val;
        break;
      }
    }

    const yearMatch = strLower.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      y = parseInt(yearMatch[1], 10);
    }

    if (!y || !m) {
      const match = fallbackDate.match(/(\d{4})[-/.](\d{1,2})/);
      if (match) {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
      }
    }
  }

  // If still not resolved, use date object or today
  if (!y || !m) {
    const d = fallbackDate instanceof Date ? fallbackDate : new Date();
    y = d.getFullYear();
    m = d.getMonth() + 1;
  }

  // Calculate the exact last day of that month (e.g. Oct -> 31, Sep -> 30, Feb -> 28/29)
  const lastDay = new Date(y, m, 0).getDate();
  const ddStr = String(lastDay).padStart(2, '0');
  const mmStr = String(m).padStart(2, '0');
  const yyyyStr = String(y);

  return `123/${ddStr}${mmStr}${yyyyStr}/WSPCP`;
}

/**
 * Exports data to a beautifully formatted Microsoft Excel workbook (.xlsx)
 * Using ExcelJS for authentic OpenXML formatting:
 * Includes corporate letterhead, metadata, colored table headers, borders,
 * formatted numbers (#,##0), grand total row with double accounting border,
 * auto-fit column widths, and official 3-signature block for superiors.
 */
export async function exportToExcel(options: ExcelExportOptions): Promise<void> {
  const {
    filename,
    reportTitle,
    periodLabel = new Date().toISOString().split('T')[0],
    operatorName = 'Indika (Operator)',
    headers,
    rows,
    alignments = [],
    totals,
    signatures = true
  } = options;

  try {
    const currentDateStr = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const colCount = Math.max(headers.length, 6);

    // Heuristics for column alignments
    const getAlign = (colIdx: number): 'left' | 'center' | 'right' => {
      if (alignments[colIdx]) return alignments[colIdx];
      const header = (headers[colIdx] || '').toLowerCase();
      if (
        header.includes('qty') ||
        header.includes('jumlah') ||
        header.includes('total') ||
        header.includes('stok') ||
        header.includes('masuk') ||
        header.includes('keluar') ||
        header.includes('frekuensi')
      ) {
        return 'right';
      }
      if (
        header === 'no' ||
        header.includes('tanggal') ||
        header.includes('jam') ||
        header.includes('shift') ||
        header.includes('satuan') ||
        header.includes('kolom') ||
        header.includes('peletakan') ||
        header.includes('status') ||
        header.includes('pasar')
      ) {
        return 'center';
      }
      return 'left';
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `Finish Pallet Management System (${operatorName})`;
    workbook.created = new Date();
    workbook.properties.date1904 = true;

    const logoClean = await getLogoCleanBase64();
    const companyLogoClean = await getCompanyLogoCleanBase64();

    // Determine frozen pane split: Bekukan sampai Pallet Runners saja, jangan sampai ke kolom Satuan
    const runnerIdx = headers.findIndex(h => h.toLowerCase().includes('runner'));
    const satuanIdx = headers.findIndex(h => h.toLowerCase().includes('satuan'));
    let splitCol = 0;
    if (runnerIdx !== -1) {
      splitCol = runnerIdx + 1; // Bekukan kolom sampai Pallet Runners
    } else if (satuanIdx !== -1) {
      splitCol = satuanIdx; // Jangan sampai ke kolom satuan (bekukan kolom sebelum satuan)
    }
    const headerRowNum = 10;

    const sheetName = reportTitle.length > 30 ? reportTitle.substring(0, 28) + '...' : reportTitle;
    const worksheet = workbook.addWorksheet(sheetName.replace(/[:\\/?*[\]]/g, ' '), {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    });

    const targetCellAddress = worksheet.getCell(headerRowNum + 1, splitCol + 1).address;
    worksheet.views = [
      {
        state: 'frozen',
        xSplit: splitCol,
        ySplit: headerRowNum,
        topLeftCell: targetCellAddress,
        activeCell: targetCellAddress,
        showGridLines: true
      }
    ];

    // Logo Finish Pallet (Kolom 1 / A)
    if (logoClean) {
      try {
        const imgId = workbook.addImage({
          base64: logoClean,
          extension: 'png'
        });
        worksheet.addImage(imgId, {
          tl: { col: 0.08, row: 0.15 },
          ext: { width: 48, height: 48 }
        });
      } catch (e) {
        console.warn('Could not add logo to worksheet', e);
      }
    }

    // Logo PT Indah Kiat (Berdampingan tepat di sebelah logo Finish Pallet, Kolom 2 / B)
    if (companyLogoClean) {
      try {
        const compImgId = workbook.addImage({
          base64: companyLogoClean,
          extension: 'png'
        });
        worksheet.addImage(compImgId, {
          tl: { col: 0.95, row: 0.18 },
          ext: { width: 110, height: 46 }
        });
      } catch (e) {
        console.warn('Could not add company logo to worksheet', e);
      }
    }

    // 1. Corporate Letterhead (dimulai dari kolom 3 agar kedua logo berdampingan rapih di kolom 1 & 2)
    // Row 1: Company Title
    worksheet.mergeCells(1, 3, 1, colCount);
    const row1Cell = worksheet.getCell(1, 3);
    row1Cell.value = 'PT INDAH KIAT PULP & PAPER TBK';
    row1Cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    row1Cell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 24;

    // Row 2: Sub-Brand & Unit
    worksheet.mergeCells(2, 3, 2, colCount);
    const row2Cell = worksheet.getCell(2, 3);
    row2Cell.value = 'WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM';
    row2Cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } }; // Emerald
    row2Cell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 18;

    // Row 3: Official Document Title
    worksheet.mergeCells(3, 3, 3, colCount);
    const row3Cell = worksheet.getCell(3, 3);
    row3Cell.value = reportTitle.toUpperCase();
    row3Cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    row3Cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // Slate 100 banner
    };
    row3Cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    row3Cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };
    worksheet.getRow(3).height = 24;

    // Row 4: Spacer
    worksheet.getRow(4).height = 8;

    // 2. Metadata Section (Rows 5-9)
    const isStockReport =
      reportTitle.toUpperCase().includes('STOK') ||
      reportTitle.toUpperCase().includes('STOCK') ||
      filename.toLowerCase().includes('stok');

    const effectiveDocNumber =
      options.docNumber ||
      (isStockReport
        ? generateStockTakeDocNumber(undefined, undefined, options.docDate || periodLabel)
        : generateDocNumber(options.shift || 'Shift 1', options.docDate || periodLabel));

    const effectiveOperator =
      isStockReport
        ? 'Semua Operator Finish Pallet'
        : (operatorName || 'Indika (Operator)');

    const metaData = [
      { label: 'No. Registrasi Dokumen:', val: effectiveDocNumber, isBold: true },
      { label: 'Periode Laporan:', val: periodLabel, isBold: true },
      { label: 'Waktu Generate Dokumen:', val: `${currentDateStr} WIB`, isBold: false },
      { label: 'Petugas / Operator Yard:', val: effectiveOperator, isBold: true },
      { label: 'Total Volume Data:', val: `${rows.length} Baris Data Transaksi Terdaftar`, isBold: false }
    ];

    metaData.forEach((item, idx) => {
      const rNum = 5 + idx;
      const lblCell = worksheet.getCell(rNum, 1);
      lblCell.value = item.label;
      lblCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF475569' } };
      lblCell.alignment = { vertical: 'middle', horizontal: 'left' };

      const valCell = worksheet.getCell(rNum, 2);
      valCell.value = item.val;
      valCell.font = { name: 'Calibri', size: 9.5, bold: item.isBold, color: { argb: 'FF0F172A' } };
      valCell.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(rNum).height = 16;
    });

    // Row 9: Spacer
    worksheet.getRow(9).height = 10;

    // 3. Table Headers (Row 10)
    const headerRow = worksheet.getRow(headerRowNum);
    headerRow.height = 26;

    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Dark Slate Navy
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: getAlign(idx),
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // 4. Data Rows (Starting at Row 11)
    let curRowNum = 11;
    rows.forEach((row, rIdx) => {
      const dataRow = worksheet.getRow(curRowNum);
      dataRow.height = 20;
      const isEven = rIdx % 2 === 0;

      row.forEach((val, cIdx) => {
        const cell = dataRow.getCell(cIdx + 1);
        const align = getAlign(cIdx);
        const isNumeric = typeof val === 'number';

        if (isNumeric) {
          cell.value = val;
          cell.numFmt = '#,##0';
        } else {
          // If string is pure integer or numeric with sign like "+60" or "-40"
          const rawStr = String(val ?? '');
          const strVal = formatProfessionalCell(rawStr, headers[cIdx]);
          const cleanNum = Number(rawStr.replace(/[^\d.-]/g, ''));
          if (!isNaN(cleanNum) && rawStr !== '' && (align === 'right' || headers[cIdx].toLowerCase().includes('qty'))) {
            cell.value = cleanNum;
            cell.numFmt = rawStr.startsWith('-') ? '-#,##0' : rawStr.startsWith('+') ? '+#,##0' : '#,##0';
          } else {
            cell.value = strVal;
          }
        }

        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: align === 'right' || cIdx === 1,
          color: { argb: 'FF0F172A' }
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: align
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      curRowNum++;
    });

    // 5. Total Row
    if (totals) {
      const totRow = worksheet.getRow(curRowNum);
      totRow.height = 24;

      headers.forEach((_, cIdx) => {
        const cell = totRow.getCell(cIdx + 1);
        const align = getAlign(cIdx);

        if (cIdx === 0) {
          cell.value = totals.label || 'TOTAL AKUMULASI';
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF78350F' } }; // Amber 900
        } else if (totals.values[cIdx] !== undefined) {
          const totVal = totals.values[cIdx];
          cell.value = typeof totVal === 'number' ? totVal : Number(String(totVal).replace(/[^\d.-]/g, '')) || totVal;
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
          }
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF78350F' } };
        } else {
          cell.value = '';
        }

        cell.alignment = { vertical: 'middle', horizontal: align };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' } // Amber 100 soft gold
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F172A' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Professional double underline
          left: { style: 'thin', color: { argb: 'FFFDE68A' } },
          right: { style: 'thin', color: { argb: 'FFFDE68A' } }
        };
      });

      curRowNum++;
    }

    // 6. Official Signatures Block
    if (signatures) {
      curRowNum += 2; // Spacing

      const sigTitleRow = worksheet.getRow(curRowNum);
      worksheet.mergeCells(curRowNum, 1, curRowNum, colCount);
      const sigTitleCell = sigTitleRow.getCell(1);
      sigTitleCell.value = 'LEMBAR VERIFIKASI & PENGESAHAN DOKUMEN OPERASIONAL YARD';
      sigTitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      sigTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sigTitleRow.height = 18;

      curRowNum += 1;

      // 3 Signers: Col A (Operator), Middle (SPV), End (Manager)
      const part1 = 1;
      const part2 = Math.max(2, Math.floor(colCount / 2));
      const part3 = colCount;

      // Titles
      const roleRow = worksheet.getRow(curRowNum);
      roleRow.getCell(part1).value = 'Dibuat / Dilaporkan Oleh:';
      roleRow.getCell(part1).font = { name: 'Calibri', size: 9.5, bold: true };
      roleRow.getCell(part1).alignment = { horizontal: 'center' };

      roleRow.getCell(part2).value = 'Diperiksa Oleh:';
      roleRow.getCell(part2).font = { name: 'Calibri', size: 9.5, bold: true };
      roleRow.getCell(part2).alignment = { horizontal: 'center' };

      roleRow.getCell(part3).value = 'Disetujui Oleh:';
      roleRow.getCell(part3).font = { name: 'Calibri', size: 9.5, bold: true };
      roleRow.getCell(part3).alignment = { horizontal: 'center' };
      roleRow.height = 16;

      // Subtitles
      curRowNum++;
      const subRow = worksheet.getRow(curRowNum);
      subRow.getCell(part1).value = 'Operator Finish Pallet';
      subRow.getCell(part1).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
      subRow.getCell(part1).alignment = { horizontal: 'center' };

      subRow.getCell(part2).value = 'Supervisor Workshop Pallet & Coreplug';
      subRow.getCell(part2).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
      subRow.getCell(part2).alignment = { horizontal: 'center' };

      subRow.getCell(part3).value = 'Manager Workshop Pallet & Coreplug';
      subRow.getCell(part3).font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
      subRow.getCell(part3).alignment = { horizontal: 'center' };
      subRow.height = 14;

      // Signature gap
      curRowNum += 3;

      // Names with underline / manual write space
      const nameRow = worksheet.getRow(curRowNum);
      nameRow.getCell(part1).value = '( .................................................. )';
      nameRow.getCell(part1).font = { name: 'Calibri', size: 9.5, bold: true };
      nameRow.getCell(part1).alignment = { horizontal: 'center' };

      nameRow.getCell(part2).value = '( .................................................. )';
      nameRow.getCell(part2).font = { name: 'Calibri', size: 9.5, bold: true };
      nameRow.getCell(part2).alignment = { horizontal: 'center' };

      nameRow.getCell(part3).value = '( .................................................. )';
      nameRow.getCell(part3).font = { name: 'Calibri', size: 9.5, bold: true };
      nameRow.getCell(part3).alignment = { horizontal: 'center' };
      nameRow.height = 18;

      curRowNum++;
      const hintRow = worksheet.getRow(curRowNum);
      hintRow.getCell(part1).value = 'Tulis Nama Terang & TTD';
      hintRow.getCell(part1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
      hintRow.getCell(part1).alignment = { horizontal: 'center' };

      hintRow.getCell(part2).value = 'Tulis Nama Terang & TTD';
      hintRow.getCell(part2).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
      hintRow.getCell(part2).alignment = { horizontal: 'center' };

      hintRow.getCell(part3).value = 'Tulis Nama Terang & TTD';
      hintRow.getCell(part3).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
      hintRow.getCell(part3).alignment = { horizontal: 'center' };
      hintRow.height = 14;
    }

    // 7. Auto-fit column widths
    worksheet.columns.forEach((column, colIdx) => {
      let maxLen = 12;
      const headerText = headers[colIdx] || '';
      maxLen = Math.max(maxLen, headerText.length + 4);

      rows.forEach(r => {
        const val = r[colIdx];
        if (val !== undefined && val !== null) {
          const str = String(val);
          maxLen = Math.max(maxLen, str.length + 3);
        }
      });

      column.width = Math.min(Math.max(maxLen, 12), 36);
    });

    // First column (No) and second column widths balanced for side-by-side header logos
    const firstCol = worksheet.getColumn(1);
    firstCol.width = headers[0]?.toLowerCase() === 'no' ? 8 : Math.max(firstCol.width || 8, 8);
    const secondCol = worksheet.getColumn(2);
    secondCol.width = Math.max(secondCol.width || 16, 16);

    // 8. Generate and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const cleanFilename = (filename || 'Laporan_Pallet')
      .replace(/\.xlsx?$/i, '')
      .replace(/[^\w.-]/g, '_');

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${cleanFilename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error generating Excel file via ExcelJS, using fallback:', error);
    // Graceful fallback to CSV
    exportToCSV(filename, headers, rows);
  }
}

/**
 * Standard CSV fallback
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const BOM = '\uFEFF';
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    )
  ].join('\r\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\.csv$/i, '')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates official clean printable A4 HTML content
 */
export function getPrintableHTML(
  title: string,
  periodLabel: string,
  operatorName: string,
  headers: string[],
  rows: (string | number)[][],
  totalsSummary?: string,
  customDocNumber?: string
): string {
  const currentDateStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getAlign = (colIdx: number) => {
    const h = (headers[colIdx] || '').toLowerCase();
    if (
      h.includes('qty') ||
      h.includes('jumlah') ||
      h.includes('total') ||
      h.includes('stok') ||
      h.includes('masuk') ||
      h.includes('keluar') ||
      h.includes('frekuensi')
    ) {
      return 'right';
    }
    if (
      h === 'no' ||
      h.includes('tanggal') ||
      h.includes('jam') ||
      h.includes('shift') ||
      h.includes('satuan') ||
      h.includes('kolom') ||
      h.includes('peletakan') ||
      h.includes('status') ||
      h.includes('pasar')
    ) {
      return 'center';
    }
    return 'left';
  };

  const headersHtml = headers
    .map(
      (h, idx) =>
        `<th style="padding: 8px 6px; border: 1px solid #1E293B; background: #0F172A; color: #FFFFFF; font-size: 10px; text-transform: uppercase; text-align: ${getAlign(idx)};">${h}</th>`
    )
    .join('');

  const rowsHtml = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const cells = r
        .map((c, ci) => {
          const isNum = typeof c === 'number';
          const align = getAlign(ci);
          const boldStyle = align === 'right' || ci === 1 ? 'font-weight: bold;' : '';
          return `<td style="padding: 6px 7px; border: 1px solid #CBD5E1; font-size: 10px; text-align: ${align}; ${boldStyle}">${isNum ? c.toLocaleString('id-ID') : (c ?? '-')}</td>`;
        })
        .join('');
      return `<tr style="background: ${bg};">${cells}</tr>`;
    })
    .join('');

  const isStockDoc =
    title.toUpperCase().includes('STOK') ||
    title.toUpperCase().includes('STOCK');

  const effectiveDocNumber =
    customDocNumber ||
    (isStockDoc
      ? generateStockTakeDocNumber(undefined, undefined, periodLabel)
      : generateDocNumber('Shift 1', periodLabel));

  const effectiveOperator =
    isStockDoc ? 'Semua Operator Finish Pallet' : (operatorName || 'Indika (Operator)');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${title} - PT Indah Kiat Pulp & Paper Tbk</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 15px;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .company { font-size: 16px; font-weight: 800; letter-spacing: -0.2px; color: #0F172A; }
    .unit { font-size: 10px; font-weight: 700; color: #047857; margin-top: 1px; }
    .title { font-size: 13px; font-weight: 800; margin-top: 4px; text-transform: uppercase; color: #1E293B; }
    .meta {
      font-size: 10px;
      color: #334155;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      background: #F8FAFC;
      padding: 6px 10px;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .summary {
      font-size: 11px;
      font-weight: bold;
      text-align: right;
      padding: 6px 10px;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: 4px;
      margin-bottom: 16px;
      color: #78350F;
    }
    .sig-section {
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .sig-heading {
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 15px;
    }
    .sig-grid {
      display: flex;
      justify-content: space-between;
      text-align: center;
      font-size: 10px;
    }
    .sig-box { width: 30%; }
    .sig-name {
      margin-top: 48px;
      font-weight: bold;
      text-decoration: underline;
    }
    .sig-desc { font-size: 9px; color: #64748B; margin-top: 2px; }
    .no-print-toolbar {
      margin-bottom: 14px;
      background: #1E293B;
      color: white;
      padding: 10px 14px;
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
      Pratonton Dokumen Resmi PT Indah Kiat Pulp & Paper Tbk · Format A4 Siap Cetak
    </span>
    <button class="btn-print" onclick="window.print()">Cetak Dokumen Sekarang (Print / PDF)</button>
  </div>

  <div class="header" style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 10px;">
    <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; height: 44px; flex-shrink: 0;">
      <img src="/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png" alt="PT Indah Kiat Pulp & Paper" style="height: 32px; width: auto; object-fit: contain;" />
    </div>
    <div style="background: white; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0;">
      <img src="/splash-pallet-logo.jpg" alt="Logo Finish Pallet" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px;" />
    </div>
    <div style="flex: 1;">
      <div class="company">PT INDAH KIAT PULP & PAPER TBK</div>
      <div class="unit">WORKSHOP PALLET DAN COREPLUG · FINISH PALLET MANAGEMENT SYSTEM</div>
      <div class="title">${title}</div>
    </div>
  </div>

  <div class="meta">
    <span><b>No. Registrasi Dokumen:</b> ${effectiveDocNumber}</span>
    <span><b>Periode:</b> ${periodLabel}</span>
    <span><b>Waktu Generate:</b> ${currentDateStr} WIB</span>
    <span><b>Operator:</b> ${effectiveOperator}</span>
    <span><b>Total Data:</b> ${rows.length} Baris</span>
  </div>

  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  ${totalsSummary ? `<div class="summary">${totalsSummary}</div>` : ''}

  <div class="sig-section">
    <div class="sig-heading">Lembar Verifikasi & Pengesahan Dokumen Operasional Workshop</div>
    <div class="sig-grid">
      <div class="sig-box">
        <div><b>Dibuat / Dilaporkan Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Operator Finish Pallet</div>
        <div class="sig-name" style="margin-top: 48px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc" style="font-size: 8.5px; color: #64748B; margin-top: 3px;">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Diperiksa Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Supervisor Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 48px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc" style="font-size: 8.5px; color: #64748B; margin-top: 3px;">Tulis Nama Terang & Tanda Tangan</div>
      </div>
      <div class="sig-box">
        <div><b>Disetujui Oleh:</b></div>
        <div style="color: #64748B; font-weight: 600;">Manager Workshop Pallet & Coreplug</div>
        <div class="sig-name" style="margin-top: 48px; font-weight: normal; font-family: monospace;">( .................................................. )</div>
        <div class="sig-desc" style="font-size: 8.5px; color: #64748B; margin-top: 3px;">Tulis Nama Terang & Tanda Tangan</div>
      </div>
    </div>
  </div>
  <div style="margin-top: 24px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 8.5px; color: #94A3B8; display: flex; justify-content: space-between;">
    <span>PT Indah Kiat Pulp & Paper Tbk · Workshop Pallet dan Coreplug</span>
    <span>Dokumen Resmi Sistem FPMS · Dicetak pada ${currentDateStr} WIB</span>
  </div>
</body>
</html>`;
}

/**
 * Downloads a clean self-contained A4 HTML file
 */
export function downloadPrintableHTML(
  filename: string,
  title: string,
  periodLabel: string,
  operatorName: string,
  headers: string[],
  rows: (string | number)[][],
  totalsSummary?: string,
  customDocNumber?: string
): void {
  const html = getPrintableHTML(title, periodLabel, operatorName, headers, rows, totalsSummary, customDocNumber);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\.html$/i, '')}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers printing using a hidden iframe to ensure clean isolation
 * and prevent UI styles/modals from contaminating the print sheet.
 */
export function printDocument(html: string): boolean {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return true;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print error, falling back to window.print():', err);
        window.print();
      }
      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch (_) {}
      }, 3000);
    }, 400);

    return true;
  } catch (err) {
    console.warn('Error during printDocument:', err);
    try {
      window.print();
      return true;
    } catch (_) {
      return false;
    }
  }
}

/**
 * Safe print trigger with graceful fallback
 */
export function safePrint(): boolean {
  try {
    window.print();
    return true;
  } catch (err) {
    console.warn('Direct print blocked by iframe or browser sandbox:', err);
    return false;
  }
}

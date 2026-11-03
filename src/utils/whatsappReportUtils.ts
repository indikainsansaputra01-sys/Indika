/**
 * WhatsApp Report Formatter Utilities
 * Formats Pallet Inbound (Hasil Produksi) and Outbound (Pengeluaran)
 * into standard chat template for company communication.
 *
 * Format specified:
 * Hasil Produksi Pallet Non Shift/Shift 2, TanggalBulanTahun
 * 1. 81x111 - Lokal - Reamwrap - LS = 300 SET
 * 2. 74x111 - Lokal - Bulkpack - LS = 300 SET
 * Urutan: Ukuran - Lokal/Ekspor - Jenis Pallet - Type Pallet = Total Set/Pcs
 */

import { Transaction } from '../types';
import { normalizePalletDimension } from './dimensionUtils';

export function formatIndoDateLong(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${d} ${months[m - 1] || ''} ${y}`;
    }
  } catch (_) {
    // fallback
  }
  return dateStr;
}

/**
 * Formats pallet dimensions to canonical compact format
 * Example: "81 x 111" -> "81x111", "74X111" -> "74x111"
 */
export function formatPalletDimension(size?: string): string {
  if (!size) return '';
  return normalizePalletDimension(size);
}

/**
 * Cleans pallet type name: "Pallet Reamwrap" -> "Reamwrap"
 */
export function cleanPalletTypeName(type: string): string {
  if (!type) return 'Reamwrap';
  return type.replace(/^Pallet\s+/i, '').trim();
}

/**
 * Formats user title: "Finishing Sheet" -> "User Finishing Sheet"
 * "User Finishing Sheet" -> "User Finishing Sheet"
 */
export function formatUserName(userName?: string): string {
  if (!userName || !userName.trim() || userName.toUpperCase() === 'ALL') {
    return 'User Finishing Sheet';
  }
  const clean = userName.trim();
  if (clean.toLowerCase().startsWith('user ')) {
    return clean;
  }
  return `User ${clean}`;
}

export interface WhatsAppReportGroupItem {
  palletSize: string;
  marketType: string;
  palletType: string;
  typePallet: string;
  unit: string;
  noRun?: string;
  totalQty: number;
  count: number;
}

/**
 * Aggregates transactions by: Ukuran - Market - Jenis - Type - Unit - No.Run
 */
export function aggregateTransactionsForWA(transactions: Transaction[]): WhatsAppReportGroupItem[] {
  const map: Record<string, WhatsAppReportGroupItem> = {};

  transactions.forEach((t) => {
    const cleanSize = formatPalletDimension(t.palletSize);
    const cleanRun = (t.noRun || '').trim();
    const key = `${cleanSize}__${t.marketType || 'Lokal'}__${t.palletType.trim()}__${t.typePallet || 'LS'}__${t.unit || 'Set'}__${cleanRun}`;
    if (!map[key]) {
      map[key] = {
        palletSize: cleanSize,
        marketType: t.marketType || 'Lokal',
        palletType: cleanPalletTypeName(t.palletType),
        typePallet: t.typePallet || 'LS',
        unit: t.unit || 'Set',
        noRun: cleanRun || undefined,
        totalQty: 0,
        count: 0
      };
    }
    map[key].totalQty += t.quantity;
    map[key].count += 1;
  });

  return Object.values(map);
}

/**
 * Generates WhatsApp text for PENERIMAAN (Hasil Produksi)
 * Format specified:
 * Hasil Produksi Pallet Shift 2, Tanggal Bulan Tahun
 * 1. Lebar x Panjang - Lokal/Ekspor - Jenis Pallet - Type Pallet = Total SET/PCS
 *
 * Total: 600 SET
 */
export function generateWhatsAppPenerimaanText(options: {
  transactions: Transaction[];
  date: string;
  shift: string;
  includeTotal?: boolean;
}): string {
  const { transactions, date, shift, includeTotal = true } = options;
  const filtered = transactions.filter(
    (t) =>
      t.transactionType === 'PENERIMAAN' &&
      t.date === date &&
      (!shift || shift === 'ALL' || t.shift === shift)
  );

  const formattedDate = formatIndoDateLong(date);
  const shiftTitle =
    shift === 'ALL'
      ? 'Semua Shift'
      : shift.toLowerCase().includes('shift')
      ? shift
      : `Shift ${shift}`;

  const header = `Hasil Produksi Pallet ${shiftTitle}, ${formattedDate}`;

  if (filtered.length === 0) {
    return `${header}\n(Belum ada data penerimaan/produksi untuk shift ini)`;
  }

  const items = aggregateTransactionsForWA(filtered);
  const lines = items.map((item, idx) => {
    // Format: 1. 81 x 111 - Lokal - Reamwrap - LS = 300 SET
    return `${idx + 1}. ${formatPalletDimension(item.palletSize)} - ${item.marketType} - ${item.palletType} - ${item.typePallet} = ${item.totalQty.toLocaleString('id-ID')} ${item.unit.toUpperCase()}`;
  });

  let result = `${header}\n${lines.join('\n')}`;

  if (includeTotal) {
    const totalSet = items.filter(i => i.unit.toLowerCase() === 'set').reduce((acc, i) => acc + i.totalQty, 0);
    const totalPcs = items.filter(i => i.unit.toLowerCase() === 'pcs').reduce((acc, i) => acc + i.totalQty, 0);

    const totalsStr: string[] = [];
    if (totalSet > 0) totalsStr.push(`${totalSet.toLocaleString('id-ID')} SET`);
    if (totalPcs > 0) totalsStr.push(`${totalPcs.toLocaleString('id-ID')} PCS`);

    if (totalsStr.length > 0) {
      result += `\n\nTotal: ${totalsStr.join(' + ')}`;
    }
  }

  return result;
}

export interface WhatsAppPengeluaranOptions {
  transactions: Transaction[];
  date: string;
  shift?: string;
  userFilter?: string;
  includeShiftInTitle?: boolean;
  includeTotal?: boolean;
}

/**
 * Generates WhatsApp text for PENGELUARAN
 * Format specified:
 * Pengiriman Pallet Ke User Shift, Tanggal Bulan Tahun
 * 1. Lebar x Panjang - Lokal/Ekspor - Jenis Pallet - Type Pallet = Jumlah SET/PCS
 *
 * Total: 350 SET
 */
export function generateWhatsAppPengeluaranText(options: WhatsAppPengeluaranOptions): string {
  const {
    transactions,
    date,
    shift = 'Shift 2',
    userFilter,
    includeShiftInTitle = true,
    includeTotal = true
  } = options;

  const filtered = transactions.filter(
    (t) =>
      t.transactionType === 'PENGELUARAN' &&
      t.date === date &&
      (!shift || shift === 'ALL' || t.shift === shift)
  );

  const formattedDate = formatIndoDateLong(date);
  const shiftTitle =
    shift && shift !== 'ALL'
      ? shift.toLowerCase().includes('shift')
        ? shift
        : `Shift ${shift}`
      : '';
  // Formats as " Shift 2" (clean without parentheses, matching "Pengiriman Pallet Ke User Shift, Tanggal Bulan Tahun")
  const shiftPart = includeShiftInTitle && shiftTitle ? ` ${shiftTitle}` : '';

  // Helper to render block for a specific user
  const renderUserBlock = (targetUser: string, txs: Transaction[]) => {
    const userLabel = formatUserName(targetUser);
    const header = `Pengiriman Pallet Ke ${userLabel}${shiftPart}, ${formattedDate}`;

    if (txs.length === 0) {
      return `${header}\n(Belum ada data pengeluaran untuk user ini)`;
    }

    const items = aggregateTransactionsForWA(txs);
    const lines = items.map((item, idx) => {
      // Format: 1. 66 x 84 - Ekspor - Bulkpack - LS = 101 SET ( No.Run 12001281 )
      const runPart = item.noRun && item.noRun.trim() ? ` ( No.Run ${item.noRun.trim()} )` : '';
      return `${idx + 1}. ${formatPalletDimension(item.palletSize)} - ${item.marketType} - ${item.palletType} - ${item.typePallet} = ${item.totalQty.toLocaleString('id-ID')} ${item.unit.toUpperCase()}${runPart}`;
    });

    let block = `${header}\n\n${lines.join('\n')}`;

    if (includeTotal) {
      const totalSet = items
        .filter((i) => i.unit.toLowerCase() === 'set')
        .reduce((acc, i) => acc + i.totalQty, 0);
      const totalPcs = items
        .filter((i) => i.unit.toLowerCase() === 'pcs')
        .reduce((acc, i) => acc + i.totalQty, 0);

      const totalsStr: string[] = [];
      if (totalSet > 0) totalsStr.push(`${totalSet.toLocaleString('id-ID')} SET`);
      if (totalPcs > 0) totalsStr.push(`${totalPcs.toLocaleString('id-ID')} PCS`);

      if (totalsStr.length > 0) {
        block += `\n\nTotal: ${totalsStr.join(' + ')}`;
      }
    }

    return block;
  };

  // Case 1: Specific user filter provided
  if (userFilter && userFilter !== 'ALL' && userFilter.trim() !== '') {
    const userTxs = filtered.filter(
      (t) => t.customer.trim().toLowerCase() === userFilter.trim().toLowerCase()
    );
    return renderUserBlock(userFilter, userTxs);
  }

  // Case 2: No specific filter -> inspect available transactions
  if (filtered.length === 0) {
    const fallbackHeader = `Pengiriman Pallet Ke User Finishing Sheet${shiftPart}, ${formattedDate}`;
    return `${fallbackHeader}\n(Belum ada data pengeluaran pada shift ini)`;
  }

  const uniqueUsers = Array.from(new Set(filtered.map((t) => t.customer.trim()).filter(Boolean)));

  if (uniqueUsers.length <= 1) {
    const singleUser = uniqueUsers[0] || 'User Finishing Sheet';
    return renderUserBlock(singleUser, filtered);
  }

  // Multiple users -> generate separated blocks for each user
  return uniqueUsers
    .map((u) => {
      const uTxs = filtered.filter((t) => t.customer.trim() === u);
      return renderUserBlock(u, uTxs);
    })
    .join('\n\n---\n\n');
}

/**
 * Copy text to user clipboard with safe fallbacks
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}

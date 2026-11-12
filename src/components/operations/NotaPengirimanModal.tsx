import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  FileText,
  Copy,
  Check,
  Building2,
  Calendar,
  Truck,
  User,
  Plus,
  Trash2,
  Users
} from 'lucide-react';
import { Transaction, Employee } from '../../types';
import { normalizePalletDimension } from '../../utils/dimensionUtils';

export interface NotaItem {
  id: string;
  txId?: string;
  noRun: string;
  jenisType: string;
  tinggi: string;
  lebar: string;
  panjang: string;
  qtySet: string;
  qtyPcs: string;
  kerapianPaku: 'OK' | 'NOT';
  kondisiFisik: 'OK' | 'NOT';
  keterangan: string;
}

interface UserDispatchGroup {
  customer: string;
  sequence: number;
  noNota: string;
  shift: string;
  transactions: Transaction[];
  items: NotaItem[];
}

interface NotaPengirimanModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  allTransactions?: Transaction[];
  employees: Employee[];
  currentUser?: Employee | null;
}

/**
 * Mapping nama pallet sesuai instruksi resmi:
 * - reamwrap / bulkpack => "Pallet MDF"
 * - racuk => "Pallet Racuk"
 * - sirkulasi => "Pallet Sirkulasi"
 */
export function formatPalletTypeForNota(palletType?: string): string {
  if (!palletType) return 'Pallet MDF';
  const val = palletType.toLowerCase().trim();
  if (val.includes('reamwrap') || val.includes('bulkpack') || val.includes('mdf')) {
    return 'Pallet MDF';
  }
  if (val.includes('racuk')) {
    return 'Pallet Racuk';
  }
  if (val.includes('sirkulasi')) {
    return 'Pallet Sirkulasi';
  }
  if (val.includes('coreplug') || val.includes('core plug')) {
    return 'Core Plug';
  }
  return palletType;
}

/**
 * Format keterangan resmi untuk NPP:
 * Format: [Lokal/Ekspor] [Wrap Type] [LS/SS]
 * Contoh: "LOKAL BULKPACK LS", "LOKAL REAMWRAP SS", "EKSPOR BULKPACK LS", "LOKAL RACUK SS"
 */
export function formatKeteranganForNota(
  marketType?: string,
  palletType?: string,
  typePallet?: string
): string {
  // 1. Pasar: LOKAL / EKSPOR
  const mkt = (marketType || 'Lokal').trim().toLowerCase();
  const pasarText = mkt.startsWith('e') ? 'EKSPOR' : 'LOKAL';

  // 2. Wrap type asli (tanpa kata "PALLET")
  let wrapText = (palletType || 'BULKPACK')
    .toUpperCase()
    .replace(/^PALLET\s+/i, '')
    .trim();

  // 3. Orientasi samping: LS / SS
  const sideText = (typePallet || 'LS').toUpperCase().trim();

  return `${pasarText} ${wrapText} ${sideText}`;
}

/**
 * Parsing dimensi ukuran pallet menjadi komponen Tebal/Tinggi, Lebar, dan Panjang
 * Tebal default pallet adalah 14 (bukan 10)
 * Contoh: "115x140" -> { tebal: "14", lebar: "115", panjang: "140" }
 * Contoh: "2x10x125" -> { tebal: "2", lebar: "10", panjang: "125" }
 */
export function parseDimensionParts(dimStr?: string): { tebal: string; lebar: string; panjang: string } {
  if (!dimStr) return { tebal: '14', lebar: '', panjang: '' };
  const clean = normalizePalletDimension(dimStr);
  const parts = clean.split('x').map(p => p.trim());
  if (parts.length === 3) {
    return { tebal: parts[0] || '14', lebar: parts[1] || '', panjang: parts[2] || '' };
  } else if (parts.length === 2) {
    return { tebal: '14', lebar: parts[0] || '', panjang: parts[1] || '' };
  }
  return { tebal: '14', lebar: clean, panjang: '' };
}

/**
 * Format tanggal Indonesia DD/MM/YYYY
 */
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Konversi tanggal YYYY-MM-DD menjadi DDMMYYYY (contoh: 2026-08-20 -> 20082026)
 */
export function getDateStringDDMMYYYY(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear());
    return `${d}${m}${y}`;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`;
  }
  return dateStr.replace(/[^0-9]/g, '');
}

/**
 * Menghasilkan judul dan nama file resmi untuk Nota Pengiriman Pallet (NPP)
 * Konsep: "Nota Pengiriman Pallet Ke (User) (Shift) TanggalBulanTahun"
 * Contoh: "Nota Pengiriman Pallet Ke Finishing Sheet Shift 1 06/11/2026"
 */
export function getNppDocumentTitle(params: {
  customer: string;
  shift: string;
  tanggal?: string;
  rawDate?: string;
  isAllUsers?: boolean;
  totalUsers?: number;
}): string {
  const { customer, shift, tanggal, rawDate, isAllUsers, totalUsers } = params;

  // Nama User Tujuan
  let targetUser = (customer || 'User').trim();
  if (isAllUsers && totalUsers && totalUsers > 1) {
    targetUser = `Semua User (${totalUsers} User)`;
  }

  // Format Shift (contoh: "Shift 1", "Shift 2", "Shift 3")
  let cleanShift = (shift || '1').trim();
  const shiftDigits = cleanShift.replace(/[^0-9]/g, '');
  if (shiftDigits) {
    cleanShift = `Shift ${shiftDigits}`;
  } else if (!cleanShift.toLowerCase().startsWith('shift')) {
    cleanShift = `Shift ${cleanShift}`;
  }

  // Format Tanggal: DD/MM/YYYY (contoh: 06/11/2026)
  let dateFormatted = '';
  if (tanggal && tanggal.includes('/')) {
    dateFormatted = tanggal.trim();
  } else if (rawDate && rawDate.includes('-')) {
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } else if (tanggal) {
    dateFormatted = tanggal.trim();
  } else {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    dateFormatted = `${d}/${m}/${y}`;
  }

  return `Nota Pengiriman Pallet Ke ${targetUser} ${cleanShift} ${dateFormatted}`;
}

export const NotaPengirimanModal: React.FC<NotaPengirimanModalProps> = ({
  isOpen,
  onClose,
  transaction,
  allTransactions = [],
  employees,
  currentUser
}) => {
  // Tanggal aktif yang dipilih
  const [rawDate, setRawDate] = useState<string>('');
  const [tujuanUser, setTujuanUser] = useState<string>('');
  const [noNota, setNoNota] = useState<string>('');
  const [sequenceNumber, setSequenceNumber] = useState<number>(1);
  const [costCentre, setCostCentre] = useState<string>('8720108700');
  const [tanggal, setTanggal] = useState<string>('');
  const [shift, setShift] = useState<string>('2');
  const [noKendaraan, setNoKendaraan] = useState<string>('');
  const [petugasGudang, setPetugasGudang] = useState<string>('');
  const [nikPetugas, setNikPetugas] = useState<string>('');
  const [namaSopir, setNamaSopir] = useState<string>('');
  const [nikSopir, setNikSopir] = useState<string>('');
  const [namaPenerima, setNamaPenerima] = useState<string>('');
  const [nikPenerima, setNikPenerima] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // List barang dalam nota saat ini
  const [items, setItems] = useState<NotaItem[]>([]);

  // Mode cetak: 'SELECTED_USER' (1 lembar A4 berisi 2 nota atas-bawah untuk 1 user)
  // atau 'ALL_USERS' (mencetak seluruh nota untuk semua user pengiriman hari itu)
  const [printMode, setPrintMode] = useState<'SELECTED_USER' | 'ALL_USERS'>('SELECTED_USER');

  // Kumpulkan seluruh data pengiriman per User pada tanggal rawDate dan SHIFT aktif
  const usersForDate = useMemo<UserDispatchGroup[]>(() => {
    if (!rawDate) return [];

    const ddmmyyyy = getDateStringDDMMYYYY(rawDate);
    const activeShiftNum = shift.replace(/[^0-9]/g, '') || '2';

    // Filter KETAT hanya pengeluaran pada tanggal dan SHIFT yang aktif
    const shiftOutTxs = (allTransactions || [])
      .filter(
        t =>
          t.transactionType === 'PENGELUARAN' &&
          t.date === rawDate &&
          (t.shift || '').replace(/[^0-9]/g, '') === activeShiftNum
      )
      .sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        if (timeA !== timeB) return timeA - timeB;
        return (a.transactionNumber || '').localeCompare(b.transactionNumber || '');
      });

    // Cari urutan unik user/customer pada shift tersebut
    const userGroupsMap = new Map<string, Transaction[]>();
    for (const tx of shiftOutTxs) {
      const cust = (tx.customer || '').trim();
      if (!cust) continue;
      if (!userGroupsMap.has(cust)) {
        userGroupsMap.set(cust, []);
      }
      userGroupsMap.get(cust)!.push(tx);
    }

    const groups: UserDispatchGroup[] = [];
    let seq = 1;
    userGroupsMap.forEach((txList, custName) => {
      const seqStr = String(seq).padStart(3, '0');

      const mappedItems: NotaItem[] = txList.slice(0, 10).map((tx, idx) => {
        const dim = parseDimensionParts(tx.palletSize);
        const isPcs = (tx.unit || '').toLowerCase() === 'pcs';
        const cleanType = formatPalletTypeForNota(tx.palletType);
        // Format resmi: [Lokal/Ekspor] [Wrap Type] [LS/SS] (contoh: LOKAL BULKPACK LS)
        const ket = formatKeteranganForNota(tx.marketType, tx.palletType, tx.typePallet);

        return {
          id: `item-tx-${tx.id || idx}`,
          txId: tx.id,
          noRun: tx.noRun || '',
          jenisType: cleanType,
          tinggi: dim.tebal || '14',
          lebar: dim.lebar || '',
          panjang: dim.panjang || '',
          qtySet: !isPcs ? String(tx.quantity) : '',
          qtyPcs: isPcs ? String(tx.quantity) : '',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: ket
        };
      });

      groups.push({
        customer: custName,
        sequence: seq,
        noNota: `${seqStr}/${ddmmyyyy}/WSPCP`,
        shift: activeShiftNum,
        transactions: txList,
        items: mappedItems
      });
      seq++;
    });

    return groups;
  }, [allTransactions, rawDate, shift]);

  // Menghitung nama berkas resmi NPP sesuai konsep yang diminta:
  // "Nota Pengiriman Pallet Ke (User) (Shift) TanggalBulanTahun"
  // Contoh: "Nota Pengiriman Pallet Ke Finishing Sheet Shift 1 06/11/2026"
  const currentFileName = useMemo(() => {
    return getNppDocumentTitle({
      customer: tujuanUser,
      shift,
      tanggal,
      rawDate,
      isAllUsers: printMode === 'ALL_USERS',
      totalUsers: usersForDate.length
    });
  }, [tujuanUser, shift, tanggal, rawDate, printMode, usersForDate.length]);

  // Sinkronisasi document.title otomatis agar saat user memilih Download / Simpan sebagai PDF di browser,
  // nama berkas yang disarankan secara otomatis menjadi nama NPP resmi tersebut (bukan "Finish Pallet Management System")
  useEffect(() => {
    if (!isOpen) return;

    const originalTitle = document.title;
    document.title = currentFileName;

    return () => {
      document.title = originalTitle || 'Finished Goods Pallet Management System';
    };
  }, [isOpen, currentFileName]);

  // Inisialisasi awal saat modal dibuka atau transaksi dipilih
  useEffect(() => {
    if (!isOpen) return;

    const opName = transaction?.operator || currentUser?.name || 'Indika';
    const foundEmp = employees.find(e => e.name.toLowerCase() === opName.toLowerCase()) || currentUser;
    const opNik = foundEmp?.nik || (opName.toLowerCase().includes('indika') ? '2002934' : '2002935');

    const txDate = transaction?.date || new Date().toISOString().split('T')[0];
    const initialCust = transaction?.customer?.trim() || 'Finishing Sheet';
    const txShiftNum = transaction?.shift ? transaction.shift.replace(/[^0-9]/g, '') || '2' : '2';

    setRawDate(txDate);
    setTanggal(formatDateDDMMYYYY(txDate));
    setCostCentre('8720108700');
    setShift(txShiftNum);
    setNoKendaraan('');
    setPetugasGudang(opName);
    setNikPetugas(opNik);
    setNamaSopir('');
    setNikSopir('');
    setNamaPenerima('');
    setNikPenerima('');

    // Cari grup user yang cocok di hari dan SHIFT tersebut
    const ddmmyyyy = getDateStringDDMMYYYY(txDate);
    const shiftOutTxs = (allTransactions || []).filter(
      t =>
        t.transactionType === 'PENGELUARAN' &&
        t.date === txDate &&
        (t.shift || '').replace(/[^0-9]/g, '') === txShiftNum
    );

    // Kumpulkan user unik untuk menentukan urutan 001, 002, dst. pada shift tersebut
    const uniqueCusts: string[] = [];
    shiftOutTxs.forEach(t => {
      const c = (t.customer || '').trim();
      if (c && !uniqueCusts.some(u => u.toLowerCase() === c.toLowerCase())) {
        uniqueCusts.push(c);
      }
    });

    let targetCust = initialCust;
    if (!transaction && uniqueCusts.length > 0) {
      targetCust = uniqueCusts[0];
    }

    setTujuanUser(targetCust);

    let custSeq = uniqueCusts.findIndex(c => c.toLowerCase() === targetCust.toLowerCase()) + 1;
    if (custSeq <= 0) custSeq = Math.max(1, uniqueCusts.length + 1);

    setSequenceNumber(custSeq);
    setNoNota(`${String(custSeq).padStart(3, '0')}/${ddmmyyyy}/WSPCP`);

    // Load item untuk user terpilih HANYA pada SHIFT yang sama
    const matchingTxs = shiftOutTxs.filter(
      t => (t.customer || '').trim().toLowerCase() === targetCust.toLowerCase()
    );

    const txListToUse = matchingTxs.length > 0 ? matchingTxs : transaction ? [transaction] : [];

    if (txListToUse.length > 0) {
      const mapped: NotaItem[] = txListToUse.slice(0, 10).map((tx, idx) => {
        const dim = parseDimensionParts(tx.palletSize);
        const isPcs = (tx.unit || '').toLowerCase() === 'pcs';
        const cleanType = formatPalletTypeForNota(tx.palletType);
        // Format resmi: [Lokal/Ekspor] [Wrap Type] [LS/SS] (contoh: LOKAL BULKPACK LS)
        const ket = formatKeteranganForNota(tx.marketType, tx.palletType, tx.typePallet);

        return {
          id: `item-tx-${tx.id || idx}`,
          txId: tx.id,
          noRun: tx.noRun || '',
          jenisType: cleanType,
          tinggi: dim.tebal || '14',
          lebar: dim.lebar || '',
          panjang: dim.panjang || '',
          qtySet: !isPcs ? String(tx.quantity) : '',
          qtyPcs: isPcs ? String(tx.quantity) : '',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: ket
        };
      });
      setItems(mapped);
    } else {
      setItems([
        {
          id: 'item-1',
          noRun: '',
          jenisType: 'Pallet MDF',
          tinggi: '14',
          lebar: '115',
          panjang: '140',
          qtySet: '80',
          qtyPcs: '',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: 'LOKAL BULKPACK LS'
        }
      ]);
    }
  }, [isOpen, transaction, allTransactions, employees, currentUser]);

  // Handler saat user berpindah customer dari daftar tab user
  const handleSelectUser = (custName: string) => {
    setTujuanUser(custName);
    const group = usersForDate.find(g => g.customer.toLowerCase() === custName.toLowerCase());
    if (group) {
      setNoNota(group.noNota);
      setSequenceNumber(group.sequence);
      setShift(group.shift);
      setItems([...group.items]);
    } else {
      const ddmmyyyy = getDateStringDDMMYYYY(rawDate);
      const nextSeq = Math.max(1, usersForDate.length + 1);
      setSequenceNumber(nextSeq);
      setNoNota(`${String(nextSeq).padStart(3, '0')}/${ddmmyyyy}/WSPCP`);
    }
  };

  const handleUpdateSequence = (newSeq: number) => {
    setSequenceNumber(newSeq);
    const ddmmyyyy = getDateStringDDMMYYYY(rawDate);
    setNoNota(`${String(newSeq).padStart(3, '0')}/${ddmmyyyy}/WSPCP`);
  };

  // Handler saat shift diubah di dropdown modal
  const handleShiftChange = (newShift: string) => {
    setShift(newShift);
    const newShiftNum = newShift.replace(/[^0-9]/g, '') || '2';

    // Cari transaksi untuk customer aktif HANYA pada shift yang baru dipilih
    const shiftTxs = (allTransactions || []).filter(
      t =>
        t.transactionType === 'PENGELUARAN' &&
        t.date === rawDate &&
        (t.shift || '').replace(/[^0-9]/g, '') === newShiftNum &&
        (t.customer || '').trim().toLowerCase() === tujuanUser.trim().toLowerCase()
    );

    if (shiftTxs.length > 0) {
      const mapped: NotaItem[] = shiftTxs.slice(0, 10).map((tx, idx) => {
        const dim = parseDimensionParts(tx.palletSize);
        const isPcs = (tx.unit || '').toLowerCase() === 'pcs';
        const cleanType = formatPalletTypeForNota(tx.palletType);
        const ket = formatKeteranganForNota(tx.marketType, tx.palletType, tx.typePallet);

        return {
          id: `item-tx-${tx.id || idx}`,
          txId: tx.id,
          noRun: tx.noRun || '',
          jenisType: cleanType,
          tinggi: dim.tebal || '14',
          lebar: dim.lebar || '',
          panjang: dim.panjang || '',
          qtySet: !isPcs ? String(tx.quantity) : '',
          qtyPcs: isPcs ? String(tx.quantity) : '',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: ket
        };
      });
      setItems(mapped);
    } else {
      // Jika shift baru tidak memiliki transaksi untuk user ini, kosongkan baris
      setItems([
        {
          id: 'item-1',
          noRun: '',
          jenisType: 'Pallet MDF',
          tinggi: '14',
          lebar: '',
          panjang: '',
          qtySet: '',
          qtyPcs: '',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: 'LOKAL BULKPACK LS'
        }
      ]);
    }
  };

  const handleAddItem = () => {
    if (items.length >= 10) return;
    setItems(prev => [
      ...prev,
      {
        id: 'item-' + Date.now(),
        noRun: '',
        jenisType: 'Pallet MDF',
        tinggi: '14',
        lebar: '',
        panjang: '',
        qtySet: '',
        qtyPcs: '',
        kerapianPaku: 'OK',
        kondisiFisik: 'OK',
        keterangan: ''
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof NotaItem, value: string) => {
    setItems(prev =>
      prev.map(it => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleCopyText = () => {
    const lines = [
      `NOTA PENGIRIMAN PALLET & CORE PLUG`,
      `Nama Berkas: ${currentFileName}`,
      `NO: ${noNota}`,
      `Dari: Dept. Workshop Pallet & Core Plug / Cost Centre: ${costCentre}`,
      `Ke: User ${tujuanUser}`,
      `Tanggal: ${tanggal} | Shift: ${shift} | No. Kendaraan: ${noKendaraan || '-'}`,
      `Petugas: ${petugasGudang} (NIK: ${nikPetugas})`,
      `Penerima: ${namaPenerima || '-'} (NIK: ${nikPenerima || '-'})`,
      `--- DAFTAR BARANG ---`
    ];
    items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}. No.Run: ${it.noRun || '-'} | ${it.jenisType} | Ukuran: ${it.tinggi}x${it.lebar}x${it.panjang} cm | Jml: ${it.qtySet ? `${it.qtySet} Set` : `${it.qtyPcs} Pcs`} | Paku: ${it.kerapianPaku} | Fisik: ${it.kondisiFisik} | Ket: ${it.keterangan}`
      );
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    // Set document.title tepat sebelum dialog cetak browser terbuka
    document.title = currentFileName;
    window.print();

    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      if (!isOpen) {
        document.title = originalTitle || 'Finished Goods Pallet Management System';
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
  };

  if (!isOpen) return null;

  // Render 1 Lembar Form Nota Pengiriman
  // Tinggi dibatasi ketat max 138mm sehingga 2 form pas 1 lembar kertas A4
  const renderSingleNotaSheet = (
    sheetCust: string,
    sheetNoNota: string,
    sheetItems: NotaItem[],
    sheetShift: string,
    isArchiveSheet: boolean = false
  ) => {
    const totalRows = 10;
    const tableRows = [];

    for (let i = 0; i < totalRows; i++) {
      const item = sheetItems[i];
      tableRows.push(
        <tr key={i} className="h-[14px] sm:h-[15px] border-b border-black text-[7.5px] sm:text-[8px] leading-tight">
          <td className="border-r border-black text-center font-bold px-0.5">{i + 1}</td>
          <td className="border-r border-black text-center font-mono font-bold px-0.5 whitespace-nowrap">
            {item ? item.noRun : ''}
          </td>
          <td className="border-r border-black px-1 font-bold uppercase whitespace-nowrap truncate max-w-[130px]">
            {item ? item.jenisType : ''}
          </td>
          {/* Ukuran (Tinggi / Lebar / Panjang) */}
          <td className="border-r border-black text-center px-0.5 font-mono">{item ? item.tinggi : ''}</td>
          <td className="border-r border-black text-center px-0.5 font-mono">{item ? item.lebar : ''}</td>
          <td className="border-r border-black text-center px-0.5 font-mono">{item ? item.panjang : ''}</td>
          {/* Jumlah Pengiriman */}
          <td className="border-r border-black text-center font-bold font-mono px-0.5">
            {item ? item.qtySet : ''}
          </td>
          <td className="border-r border-black text-center font-bold font-mono px-0.5">
            {item ? item.qtyPcs : ''}
          </td>
          {/* Kerapian Paku & Kondisi Fisik */}
          <td className="border-r border-black text-center font-bold px-0.5">{item ? item.kerapianPaku : ''}</td>
          <td className="border-r border-black text-center font-bold px-0.5">{item ? item.kondisiFisik : ''}</td>
          {/* Keterangan (Bersih tanpa kolom yard) */}
          <td className="px-1 font-medium uppercase truncate max-w-[100px]">{item ? item.keterangan : ''}</td>
        </tr>
      );
    }

    return (
      <div className="nota-sheet w-full bg-white text-black font-sans leading-tight p-2 sm:p-2.5 print:p-2 relative box-border border border-black/40 print:border-black flex flex-col justify-between">
        {/* 1. HEADER ATAS (LOGO RESMI INDAH KIAT & KODE DOKUMEN) */}
        <div className="flex items-start justify-between border-b border-black pb-0.5 mb-0.5">
          {/* Kiri: Logo Resmi PT Indah Kiat Pulp & Paper Tbk */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <img
                src="/assets/aistudio/pt_indah_kiat_logo_trimmed.png"
                alt="PT Indah Kiat Pulp & Paper Tbk"
                className="h-5 sm:h-6 w-auto object-contain print:h-5"
              />
            </div>
            {/* Box PALLET WORKSHOP & CORE PLUG */}
            <div className="mt-0.5 border border-black px-1 py-0 inline-block text-[6px] sm:text-[6.5px] font-bold tracking-wider uppercase bg-white">
              PALLET WORKSHOP & CORE PLUG
            </div>
          </div>

          {/* Kanan: Kode Dokumen Resmi */}
          <div className="text-right text-[7px] sm:text-[7.5px] font-mono leading-tight">
            <div className="font-bold">FO-IK/3/179/2</div>
            <div>Rev. 0</div>
            <div className="font-semibold">Form B-2</div>
          </div>
        </div>

        {/* 2. JUDUL DOKUMEN & NOMOR NOTA */}
        <div className="text-center my-0.2">
          <h2 className="text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-wider font-sans underline leading-none">
            NOTA PENGIRIMAN PALLET & CORE PLUG
          </h2>
          <div className="text-[8px] sm:text-[9px] font-mono font-bold mt-0.5">
            NO. : <span className="tracking-wider">{sheetNoNota || '... / ... / WSPCP'}</span>
          </div>
        </div>

        {/* 3. META INFO PENGIRIMAN */}
        <div className="grid grid-cols-12 gap-1 text-[7px] sm:text-[8px] my-0.5 border border-black/50 p-1 bg-slate-50/50 print:bg-transparent">
          {/* Kolom Kiri */}
          <div className="col-span-7 space-y-0.2">
            <div className="flex items-baseline">
              <span className="w-8 font-bold shrink-0">Dari</span>
              <span className="mx-0.5">:</span>
              <span className="font-medium truncate">
                Dept. Workshop Pallet & Core Plug / Cost centre : <b>{costCentre}</b>
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="w-8 font-bold shrink-0">Ke</span>
              <span className="mx-0.5">:</span>
              <span className="font-bold text-[8px] sm:text-[9px] uppercase underline truncate">
                User {sheetCust || '................................'}
              </span>
            </div>
          </div>

          {/* Kolom Kanan */}
          <div className="col-span-5 space-y-0.2">
            <div className="flex items-baseline justify-end">
              <span className="w-20 font-bold shrink-0">Tanggal</span>
              <span className="mx-0.5">:</span>
              <span className="w-24 font-bold font-mono text-right">{tanggal}</span>
            </div>
            <div className="flex items-baseline justify-end">
              <span className="w-20 font-bold shrink-0">Shift</span>
              <span className="mx-0.5">:</span>
              <span className="w-24 font-bold font-mono text-right">{sheetShift}</span>
            </div>
            <div className="flex items-baseline justify-end">
              <span className="w-20 font-bold shrink-0">No. Kendaraan</span>
              <span className="mx-0.5">:</span>
              <span className="w-24 font-mono text-right truncate">
                {noKendaraan || '.....................'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. TABEL BARANG (10 BARIS SAMA PERSIS KERTAS FISIK TANPA OK/NOT DI KETERANGAN) */}
        <div className="w-full overflow-hidden border border-black my-0.5">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Header Tingkat 1 */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[7px] sm:text-[7.5px] font-bold">
                <th rowSpan={2} className="border-r border-black text-center py-0.2 px-0.5 w-5">
                  No.
                </th>
                <th rowSpan={2} className="border-r border-black text-center py-0.2 px-0.5 w-14">
                  No. Run
                </th>
                <th rowSpan={2} className="border-r border-black text-center py-0.2 px-1 w-32">
                  Jenis / Type<br />Pallet & Core Plug
                </th>
                <th colSpan={3} className="border-r border-black text-center py-0.2 px-0.5 bg-slate-200/60 print:bg-transparent">
                  Ukuran
                </th>
                <th colSpan={2} className="border-r border-black text-center py-0.2 px-0.5 bg-slate-200/60 print:bg-transparent">
                  Jumlah Pengiriman
                </th>
                <th rowSpan={1} className="border-r border-black text-center py-0.2 px-0.5 w-11 leading-tight">
                  Kerapian<br />Paku
                </th>
                <th rowSpan={1} className="border-r border-black text-center py-0.2 px-0.5 w-14 leading-tight">
                  Kondisi fisik<br />Pallet
                </th>
                <th rowSpan={2} className="text-center py-0.2 px-1 w-20">
                  Keterangan
                </th>
              </tr>
              {/* Header Tingkat 2 (Sub-Kolom) */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[6.5px] sm:text-[7px] font-bold text-center">
                <th className="border-r border-black py-0.2 px-0.5 w-11">
                  Tinggi<br /><span className="text-[5.5px] font-normal">Tebal(cm)</span>
                </th>
                <th className="border-r border-black py-0.2 px-0.5 w-12">
                  Lebar<br /><span className="text-[5.5px] font-normal">Dia.(inch)</span>
                </th>
                <th className="border-r border-black py-0.2 px-0.5 w-11">
                  Panjang<br />(cm)
                </th>
                <th className="border-r border-black py-0.2 px-0.5 w-10">(SET)</th>
                <th className="border-r border-black py-0.2 px-0.5 w-10">(PCS)</th>
                <th className="border-r border-black py-0.2 px-0.5 text-[6px] font-bold">OK/NOT</th>
                <th className="border-r border-black py-0.2 px-0.5 text-[6px] font-bold">OK/NOT</th>
              </tr>
            </thead>
            <tbody>{tableRows}</tbody>
          </table>
        </div>

        {/* 5. FOOTER: DISTRIBUSI & 3 TANDA TANGAN DIPERLUAS LEBIH TINGGI & LAPANG */}
        <div className="grid grid-cols-12 gap-1 border border-black text-[6.5px] sm:text-[7px] mt-1 p-0.5">
          {/* Distribusi Box */}
          <div className="col-span-3 border-r border-black pr-1 leading-tight flex flex-col justify-between h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
            <div className="font-bold uppercase underline">Distribusi :</div>
            <div className="space-y-0.5">
              <div>- Accounting <span className="font-bold">(Putih)</span></div>
              <div>- Pengirim/Sopir <span className="font-bold">(Kuning)</span></div>
              <div className={!isArchiveSheet ? 'font-black bg-slate-200/50 print:bg-transparent' : ''}>
                - Penerima/User <span className="font-bold">(Hijau)</span> {!isArchiveSheet && '★'}
              </div>
              <div>- Gudang Pallet <span className="font-bold">(Biru)</span></div>
              <div className={isArchiveSheet ? 'font-black bg-slate-200/50 print:bg-transparent' : ''}>
                - Arsip Finish Pallet <span className="font-bold">(Merah)</span> {isArchiveSheet && '★'}
              </div>
            </div>
          </div>

          {/* 3 Kolom Tanda Tangan - DIPERLEBAR DAN DIPERTINGGI AGAR TANDA TANGAN LEBIH LEGA */}
          <div className="col-span-9 grid grid-cols-3 text-center divide-x divide-black">
            {/* Tanda Tangan 1: Petugas Gudang */}
            <div className="flex flex-col justify-between px-1.5 h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
              <div className="font-bold leading-tight text-[7.5px] sm:text-[8px]">
                Petugas Gudang Pallet
              </div>
              <div className="flex-1 min-h-[42px] print:min-h-[46px]" />
              <div className="border-t border-black/80 pt-0.5 text-left text-[6.5px] sm:text-[7px] font-mono truncate">
                NIK : <b>{nikPetugas} ({petugasGudang})</b>
              </div>
            </div>

            {/* Tanda Tangan 2: Pengirim/Sopir */}
            <div className="flex flex-col justify-between px-1.5 h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
              <div className="font-bold leading-tight text-[7.5px] sm:text-[8px]">
                Pengirim / Sopir
              </div>
              <div className="flex-1 min-h-[42px] print:min-h-[46px]" />
              <div className="border-t border-black/80 pt-0.5 text-left text-[6.5px] sm:text-[7px] font-mono truncate">
                NIK : {nikSopir || '.......................'} {namaSopir ? `(${namaSopir})` : ''}
              </div>
            </div>

            {/* Tanda Tangan 3: Penerima / User */}
            <div className="flex flex-col justify-between px-1.5 h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
              <div className="font-bold leading-tight text-[7.5px] sm:text-[8px]">
                Penerima / User
              </div>
              <div className="flex-1 min-h-[42px] print:min-h-[46px]" />
              <div className="border-t border-black/80 pt-0.5 text-left text-[6.5px] sm:text-[7px] font-mono truncate">
                NIK : {nikPenerima || '.......................'} {namaPenerima ? `(${namaPenerima})` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render 1 Lembar Fisik A4 yang Memuat Tepat 2 NPP Atas-Bawah
  // Atas: Untuk User · Bawah: Untuk Arsip Finish Pallet
  const renderA4Page = (
    custName: string,
    notaNum: string,
    notaItems: NotaItem[],
    notaShift: string
  ) => {
    return (
      <div className="a4-page-content w-full flex flex-col justify-between h-full box-border">
        {/* 1. LEMBAR ATAS: UNTUK USER */}
        {renderSingleNotaSheet(custName, notaNum, notaItems, notaShift, false)}

        {/* GARIS PUTUS-PUTUS PEMBATAS / POTONG DI TENGAH KERTAS A4 */}
        <div className="cut-divider my-0.5 border-b-2 border-dashed border-slate-500 print:border-black text-center relative shrink-0">
          <span className="bg-white px-2 py-0 text-[7px] font-mono text-slate-700 print:text-black font-bold uppercase tracking-wider relative -top-1.5 border border-slate-400 print:border-black rounded-full">
            ✂️ POTONG DI SINI (LEMBAR ATAS: PENERIMA/USER · LEMBAR BAWAH: ARSIP FINISH PALLET) ✂️
          </span>
        </div>

        {/* 2. LEMBAR BAWAH: UNTUK ARSIP FINISH PALLET */}
        {renderSingleNotaSheet(custName, notaNum, notaItems, notaShift, true)}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto no-print">
        {/* Modal Container */}
        <div className="bg-white rounded-xl border border-slate-300 w-full max-w-4xl shadow-2xl my-4 overflow-hidden flex flex-col max-h-[94vh]">
          {/* Modal Header */}
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight">
                    Nota Pengiriman Pallet & Coreplug (Form B-2)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Pasti 1 Lembar A4 (2 NPP Atas-Bawah)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Format resmi PT Indah Kiat Pulp & Paper Tbk · FO-IK/3/179/2
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                type="button"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Salin teks data nota"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
              </button>
              <button
                onClick={handlePrint}
                type="button"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title={`Cetak / Simpan PDF (${currentFileName}.pdf)`}
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Unduh PDF</span>
              </button>
              <button
                onClick={onClose}
                type="button"
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Controls & On-Screen Preview */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-slate-100">
            {/* USER SELECTOR TABS */}
            <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs shadow-2xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-xs">
                    Daftar User Pengiriman Tanggal {tanggal || rawDate} ({usersForDate.length} User):
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPrintMode('SELECTED_USER')}
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      printMode === 'SELECTED_USER'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    1 User Terpilih
                  </button>
                  {usersForDate.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPrintMode('ALL_USERS')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        printMode === 'ALL_USERS'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({usersForDate.length} User)
                    </button>
                  )}
                </div>
              </div>

              {/* Clickable User Destination Tabs */}
              {usersForDate.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {usersForDate.map(g => {
                    const isSelected = g.customer.toLowerCase() === tujuanUser.toLowerCase();
                    return (
                      <button
                        key={g.customer}
                        type="button"
                        onClick={() => {
                          setPrintMode('SELECTED_USER');
                          handleSelectUser(g.customer);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected && printMode === 'SELECTED_USER'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400/40'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-black/15">
                          {String(g.sequence).padStart(3, '0')}
                        </span>
                        <span>{g.customer}</span>
                        <span className="text-[10px] opacity-80">({g.items.length} Pallet)</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  Belum ada transaksi pengeluaran tercatat pada tanggal {tanggal}.
                </div>
              )}
            </div>

            {/* Quick Edit Controls Bar */}
            <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Pengaturan Rincian Nota ({tujuanUser}):</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  No. Nota: <b>{noNota}</b>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Urutan Pengiriman</label>
                  <div className="flex gap-1">
                    <select
                      value={sequenceNumber}
                      onChange={e => handleUpdateSequence(parseInt(e.target.value, 10))}
                      className="w-16 px-1 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs"
                      title="Nomor urutan pengiriman ke user (001, 002, dst)"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>
                          {String(n).padStart(3, '0')}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={noNota}
                      onChange={e => setNoNota(e.target.value)}
                      className="flex-1 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">User Tujuan (Ke)</label>
                  <input
                    type="text"
                    value={tujuanUser}
                    onChange={e => setTujuanUser(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Tanggal</label>
                  <input
                    type="text"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Shift</label>
                  <select
                    value={shift}
                    onChange={e => handleShiftChange(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                  >
                    <option value="1">Shift 1</option>
                    <option value="2">Shift 2</option>
                    <option value="3">Shift 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">No. Kendaraan</label>
                  <input
                    type="text"
                    value={noKendaraan}
                    onChange={e => setNoKendaraan(e.target.value)}
                    placeholder="Forklift / Truk"
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Petugas / NIK</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={petugasGudang}
                      onChange={e => setPetugasGudang(e.target.value)}
                      className="w-1/2 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={nikPetugas}
                      onChange={e => setNikPetugas(e.target.value)}
                      className="w-1/2 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                      placeholder="NIK"
                    />
                  </div>
                </div>
              </div>

              {/* Editable items list in modal controls */}
              <div className="pt-1.5 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Daftar Pengiriman Barang ({items.length} Baris / Maks 10):</span>
                    {items.length > 1 && (
                      <span className="px-2 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[10px]">
                        {items.length} Pallet Tergabung Dalam 1 Nota
                      </span>
                    )}
                  </span>
                  {items.length < 10 && (
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Tambah Baris Manual
                    </button>
                  )}
                </div>

                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {items.map((it, idx) => (
                    <div key={it.id} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-200 text-xs">
                      <span className="font-bold text-slate-400 w-4 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={it.noRun}
                        onChange={e => handleUpdateItem(it.id, 'noRun', e.target.value)}
                        placeholder="No.Run"
                        className="w-20 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                        title="No.Run (Pengganti No.Material)"
                      />
                      <select
                        value={it.jenisType}
                        onChange={e => handleUpdateItem(it.id, 'jenisType', e.target.value)}
                        className="w-36 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-bold"
                      >
                        <option value="Pallet MDF">Pallet MDF</option>
                        <option value="Pallet Racuk">Pallet Racuk</option>
                        <option value="Pallet Sirkulasi">Pallet Sirkulasi</option>
                        <option value="Core Plug">Core Plug</option>
                      </select>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="text"
                          value={it.tinggi}
                          onChange={e => handleUpdateItem(it.id, 'tinggi', e.target.value)}
                          placeholder="T"
                          className="w-9 px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-center text-xs font-bold"
                          title="Tinggi/Tebal (cm)"
                        />
                        <span>x</span>
                        <input
                          type="text"
                          value={it.lebar}
                          onChange={e => handleUpdateItem(it.id, 'lebar', e.target.value)}
                          placeholder="L"
                          className="w-12 px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-center text-xs"
                          title="Lebar (cm)"
                        />
                        <span>x</span>
                        <input
                          type="text"
                          value={it.panjang}
                          onChange={e => handleUpdateItem(it.id, 'panjang', e.target.value)}
                          placeholder="P"
                          className="w-12 px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-center text-xs"
                          title="Panjang (cm)"
                        />
                      </div>
                      <input
                        type="number"
                        value={it.qtySet}
                        onChange={e => handleUpdateItem(it.id, 'qtySet', e.target.value)}
                        placeholder="Set"
                        className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-center text-xs"
                        title="Qty (Set)"
                      />
                      <input
                        type="number"
                        value={it.qtyPcs}
                        onChange={e => handleUpdateItem(it.id, 'qtyPcs', e.target.value)}
                        placeholder="Pcs"
                        className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-center text-xs"
                        title="Qty (Pcs)"
                      />
                      <input
                        type="text"
                        value={it.keterangan}
                        onChange={e => handleUpdateItem(it.id, 'keterangan', e.target.value)}
                        placeholder="Keterangan (contoh: LOKAL BULKPACK LS)"
                        className="flex-1 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs uppercase"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ON-SCREEN PREVIEW ONLY */}
            <div className="w-full max-w-[210mm] mx-auto bg-white border border-slate-300 p-2 sm:p-2.5 shadow-md">
              <div className="text-[10px] font-bold text-slate-500 mb-1 flex items-center justify-between border-b pb-1 font-mono">
                <span>PRATINJAU KERTAS A4 (2 NPP ATAS-BAWAH):</span>
                <span>User: {tujuanUser}</span>
              </div>
              {renderA4Page(tujuanUser, noNota, items, shift)}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="text-slate-600 text-[11px] space-y-0.5">
              <div>
                * Kertas diatur <b>Portrait A4</b> (2 rangkap: 1 User & 1 Arsip).
              </div>
              <div className="text-emerald-700 font-semibold truncate max-w-lg">
                * Berkas tersimpan sebagai: <b>"{currentFileName}.pdf"</b>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={onClose}
                type="button"
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={handlePrint}
                type="button"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                title={`Cetak / Simpan PDF sebagai "${currentFileName}.pdf"`}
              >
                <Printer className="w-4 h-4" />
                <span>
                  {printMode === 'ALL_USERS' && usersForDate.length > 1
                    ? `Cetak Semua Nota (${usersForDate.length} User)`
                    : 'Cetak 1 Lembar A4 (Simpan PDF)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINT PORTAL ATTACHED DIRECTLY TO BODY */}
      {/* Saat print ditekan, seluruh #root di-hide (display: none) dan HANYA portal ini yang dicetak */}
      {createPortal(
        <div id="print-nota-portal">
          {printMode === 'ALL_USERS' && usersForDate.length > 1 ? (
            usersForDate.map((g, idx) => (
              <div
                key={`print-page-${g.customer}`}
                className={`a4-page-wrapper ${idx < usersForDate.length - 1 ? 'page-break-after' : ''}`}
              >
                {renderA4Page(g.customer, g.noNota, g.items, g.shift)}
              </div>
            ))
          ) : (
            <div className="a4-page-wrapper">
              {renderA4Page(tujuanUser, noNota, items, shift)}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* GLOBAL EMBEDDED PRINT STYLE */}
      {/* MENGUNCI 100% PASTI HANYA 1 LEMBAR KERTAS A4 */}
      <style>{`
        /* Sembunyikan elemen portal cetak saat tampilan layar normal */
        #print-nota-portal {
          display: none !important;
        }

        @media print {
          @page {
            size: 210mm 297mm;
            margin: 0 !important;
          }

          /* Hilangkan SELURUH antarmuka web, modal, dan background */
          #root {
            display: none !important;
          }

          html, body {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Tampilkan HANYA portal cetak */
          #print-nota-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
          }

          .a4-page-wrapper {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 4mm 6mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }

          .a4-page-wrapper.page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }

          .a4-page-content {
            height: 100% !important;
            max-height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }

          .nota-sheet {
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            border: 1px solid black !important;
            height: 140mm !important;
            max-height: 140mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }

          .cut-divider {
            height: 5mm !important;
            max-height: 5mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            margin: 1mm 0 !important;
          }
        }
      `}</style>
    </>
  );
};

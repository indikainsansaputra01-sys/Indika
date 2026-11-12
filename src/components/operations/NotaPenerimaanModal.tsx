import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  Copy,
  Check,
  Building2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  FileCheck2
} from 'lucide-react';
import { Transaction, Employee } from '../../types';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import { getOperatorShiftForDate } from '../../utils/rosterUtils';
import {
  formatPalletTypeForNota,
  formatKeteranganForNota,
  parseDimensionParts,
  formatDateDDMMYYYY,
  getDateStringDDMMYYYY
} from './NotaPengirimanModal';

export interface NotaPenerimaanItem {
  id: string;
  txId?: string;
  user: string;
  jenisType: string;
  tinggi: string;
  lebar: string;
  panjang: string;
  okSet: string;
  okPcs: string;
  notGoodSet: string;
  notGoodPcs: string;
  keterangan: string;
}

interface NotaPenerimaanModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  allTransactions?: Transaction[];
  employees: Employee[];
  currentUser?: Employee | null;
}

/**
 * Menghasilkan judul dan nama file resmi untuk Nota Good Received / Nota Penerimaan Produksi (NGR)
 * Contoh: "Nota Good Received Pallet Shift 3 Group C 08/11/2026"
 */
export function getNgrDocumentTitle(params: {
  shift?: string;
  tanggal?: string;
  rawDate?: string;
  group?: string;
}): string {
  const { shift, tanggal, rawDate, group } = params;

  let cleanShift = (shift || '1').trim();
  const shiftDigits = cleanShift.replace(/[^0-9]/g, '');
  if (shiftDigits) {
    cleanShift = `Shift ${shiftDigits}`;
  } else if (!cleanShift.toLowerCase().startsWith('shift')) {
    cleanShift = `Shift ${cleanShift}`;
  }

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

  return `Nota Good Received Penerimaan Produksi ${cleanShift} ${dateFormatted}`;
}

export const NotaPenerimaanModal: React.FC<NotaPenerimaanModalProps> = ({
  isOpen,
  onClose,
  transaction,
  allTransactions = [],
  employees,
  currentUser
}) => {
  const [rawDate, setRawDate] = useState<string>('');
  const [noNota, setNoNota] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>('');
  
  // Shift Finish Pallet & Shift Produksi
  const [shiftFinishPallet, setShiftFinishPallet] = useState<string>('3');
  const [shiftProduksi, setShiftProduksi] = useState<string>('Shift 2');
  const [shiftCustomText, setShiftCustomText] = useState<string>('');
  const [group, setGroup] = useState<string>('C');

  const [petugasGudang, setPetugasGudang] = useState<string>('');
  const [nikPetugas, setNikPetugas] = useState<string>('');
  const [kaGroupOutsourcing, setKaGroupOutsourcing] = useState<string>('');
  const [nikOutsourcing, setNikOutsourcing] = useState<string>('');
  const [spvProduksi, setSpvProduksi] = useState<string>('');
  const [nikSpvProduksi, setNikSpvProduksi] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const [items, setItems] = useState<NotaPenerimaanItem[]>([]);

  // Format Teks Shift: Shift Finish Pallet ( Shift Produksi )
  // Contoh: 3( Produksi Shift 2 ) atau 3( Produksi Non Shift )
  const shiftDisplayText = useMemo(() => {
    if (shiftCustomText.trim()) return shiftCustomText.trim();
    const fpNum = shiftFinishPallet.replace(/[^0-9]/g, '') || shiftFinishPallet || '3';
    return `${fpNum}( Produksi ${shiftProduksi} )`;
  }, [shiftFinishPallet, shiftProduksi, shiftCustomText]);

  // Inisialisasi awal saat modal dibuka atau transaksi dipilih
  useEffect(() => {
    if (!isOpen) return;

    const opName = transaction?.operator || currentUser?.name || 'Indika';
    const foundEmp = employees.find(e => e.name.toLowerCase() === opName.toLowerCase()) || currentUser;
    const opNik = foundEmp?.nik || (opName.toLowerCase().includes('indika') ? '2002934' : '2002935');

    const txDate = transaction?.date || new Date().toISOString().split('T')[0];
    const sched = getOperatorShiftForDate(opName, txDate);

    // Group dari roster pabrik (default C seperti contoh user)
    const detectedGroup = sched?.group || (foundEmp as any)?.group || 'C';
    setGroup(detectedGroup);

    // Shift Finish Pallet dari transaksi atau jadwal roster
    const txShiftNum = transaction?.shift
      ? transaction.shift.replace(/[^0-9]/g, '') || '1'
      : (sched?.shiftLabel ? sched.shiftLabel.replace(/[^0-9]/g, '') || '3' : '3');
    setShiftFinishPallet(txShiftNum || '3');

    // Shift Produksi default "Shift 2" (dapat diubah ke Non Shift, dsb)
    setShiftProduksi('Shift 2');
    setShiftCustomText('');

    setRawDate(txDate);
    setTanggal(formatDateDDMMYYYY(txDate));
    setPetugasGudang(opName);
    setNikPetugas(opNik);
    setKaGroupOutsourcing('');
    setNikOutsourcing('');
    setSpvProduksi('');
    setNikSpvProduksi('');

    const ddmmyyyy = getDateStringDDMMYYYY(txDate);
    setNoNota(`001/${ddmmyyyy}/NGR-WSPCP`);

    // Kumpulkan seluruh data penerimaan pada tanggal txDate dan SHIFT aktif
    const shiftInTxs = (allTransactions || []).filter(
      t =>
        t.transactionType === 'PENERIMAAN' &&
        t.date === txDate &&
        (t.shift || '').replace(/[^0-9]/g, '') === (txShiftNum || '3')
    );

    const txListToUse = shiftInTxs.length > 0 ? shiftInTxs : transaction ? [transaction] : [];

    const mapped: NotaPenerimaanItem[] = txListToUse.slice(0, 10).map((tx, idx) => {
      const dim = parseDimensionParts(tx.palletSize);
      const isPcs = (tx.unit || '').toLowerCase() === 'pcs';
      const cleanType = formatPalletTypeForNota(tx.palletType);
      const ket = formatKeteranganForNota(tx.marketType, tx.palletType, tx.typePallet);

      return {
        id: `item-in-${tx.id || idx}`,
        txId: tx.id,
        user: tx.customer || 'Finishing Sheet',
        jenisType: cleanType,
        tinggi: dim.tebal || '14',
        lebar: dim.lebar || '',
        panjang: dim.panjang || '',
        okSet: !isPcs ? String(tx.quantity) : '',
        okPcs: isPcs ? String(tx.quantity) : '',
        notGoodSet: '',
        notGoodPcs: '',
        keterangan: ket
      };
    });

    setItems(mapped.length > 0 ? mapped : [
      {
        id: 'item-default-1',
        user: 'Finishing Sheet',
        jenisType: 'Pallet MDF',
        tinggi: '14',
        lebar: '115',
        panjang: '140',
        okSet: '50',
        okPcs: '',
        notGoodSet: '',
        notGoodPcs: '',
        keterangan: 'LOKAL BULKPACK LS'
      }
    ]);
  }, [isOpen, transaction, allTransactions, employees, currentUser]);

  const currentFileName = useMemo(() => {
    return getNgrDocumentTitle({
      shift: shiftFinishPallet,
      tanggal,
      rawDate,
      group
    });
  }, [shiftFinishPallet, tanggal, rawDate, group]);

  // Sinkronisasi document.title otomatis saat print / save as PDF
  useEffect(() => {
    if (!isOpen) return;

    const originalTitle = document.title;
    document.title = currentFileName;

    return () => {
      document.title = originalTitle || 'Finished Goods Pallet Management System';
    };
  }, [isOpen, currentFileName]);

  const handleAddItem = () => {
    if (items.length >= 10) return;
    setItems(prev => [
      ...prev,
      {
        id: `item-new-${Date.now()}`,
        user: 'Finishing Sheet',
        jenisType: 'Pallet MDF',
        tinggi: '14',
        lebar: '',
        panjang: '',
        okSet: '',
        okPcs: '',
        notGoodSet: '',
        notGoodPcs: '',
        keterangan: 'LOKAL BULKPACK LS'
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof NotaPenerimaanItem, value: string) => {
    setItems(prev =>
      prev.map(it => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleCopyText = () => {
    const lines = [
      `NOTA GOOD RECEIVED / NOTA PENERIMAAN PRODUKSI PALLET & CORE PLUG`,
      `Nama Berkas: ${currentFileName}`,
      `NO: ${noNota}`,
      `Tanggal: ${tanggal} | Shift: ${shiftDisplayText} | Group: ${group}`,
      `Petugas Gudang FG: ${petugasGudang} (NIK: ${nikPetugas})`,
      `Ka.Group Outsourcing: ${kaGroupOutsourcing || '-'} (NIK: ${nikOutsourcing || '-'})`,
      `Supervisor Produksi: ${spvProduksi || '-'} (NIK: ${nikSpvProduksi || '-'})`,
      `--- DAFTAR BARANG DITERIMA ---`
    ];
    items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}. User: ${it.user || '-'} | ${it.jenisType} | Ukuran: ${it.tinggi}x${it.lebar}x${it.panjang} cm | OK: ${it.okSet ? `${it.okSet} Set` : it.okPcs ? `${it.okPcs} Pcs` : '-'} | NG: ${it.notGoodSet ? `${it.notGoodSet} Set` : it.notGoodPcs ? `${it.notGoodPcs} Pcs` : '-'} | Ket: ${it.keterangan}`
      );
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
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

  // Render 1 Lembar Form Nota Penerimaan (Good Received)
  const renderSingleNotaSheet = (
    sheetNoNota: string,
    sheetItems: NotaPenerimaanItem[],
    sheetShift: string,
    isArchiveSheet: boolean = false
  ) => {
    const totalRows = 10;
    const tableRows = [];

    for (let i = 0; i < totalRows; i++) {
      const item = sheetItems[i];
      tableRows.push(
        <tr key={i} className="h-[15.5px] sm:h-[16.5px] print:h-[16px] border-b border-black text-[7.5px] sm:text-[8px] leading-tight">
          <td className="border-r border-black text-center font-bold px-0.5">{i + 1}</td>
          <td className="border-r border-black text-center font-bold px-0.5 whitespace-nowrap truncate max-w-[85px]" title={item ? item.user : ''}>
            {item ? item.user : ''}
          </td>
          <td className="border-r border-black px-1 font-bold uppercase whitespace-nowrap truncate max-w-[130px]">
            {item ? item.jenisType : ''}
          </td>
          {/* Ukuran (Tinggi / Lebar / Panjang) */}
          <td className="border-r border-black text-center px-0.5 font-mono">{item ? item.tinggi : ''}</td>
          <td className="border-r border-black text-center px-0.5 font-mono">{item ? item.lebar : ''}</td>
          <td className="border-r border-black text-center px-0.5 font-mono">{item ? item.panjang : ''}</td>
          {/* Jumlah Pallet / Core Plug: OK (SET & PCS) */}
          <td className="border-r border-black text-center font-bold font-mono px-0.5 text-emerald-800 print:text-black">
            {item ? item.okSet : ''}
          </td>
          <td className="border-r border-black text-center font-bold font-mono px-0.5 text-emerald-800 print:text-black">
            {item ? item.okPcs : ''}
          </td>
          {/* Jumlah Pallet / Core Plug: NOT GOOD (SET & PCS) */}
          <td className="border-r border-black text-center font-bold font-mono px-0.5 text-rose-800 print:text-black">
            {item ? item.notGoodSet : ''}
          </td>
          <td className="border-r border-black text-center font-bold font-mono px-0.5 text-rose-800 print:text-black">
            {item ? item.notGoodPcs : ''}
          </td>
          {/* Keterangan */}
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
            <div className="mt-0.5 border border-black px-1 py-0 inline-block text-[6px] sm:text-[6.5px] font-bold tracking-wider uppercase bg-white">
              PALLET WORKSHOP & CORE PLUG
            </div>
          </div>

          {/* Tengah: Judul Resmi Dokumen Penerimaan */}
          <div className="text-center flex-1 px-2">
            <h2 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-none text-black">
              NOTA GOOD RECEIVED / NOTA PENERIMAAN PRODUKSI
            </h2>
            <div className="text-[7.5px] sm:text-[8px] font-extrabold uppercase tracking-wide text-slate-800 mt-0.5">
              PALLET & CORE PLUG (FORM GR-1)
            </div>
          </div>

          {/* Kanan: Kode Dokumen & No. Nota */}
          <div className="text-right text-[7px] sm:text-[7.5px] font-mono leading-tight">
            <div className="font-bold">FO-IK/3/178/1</div>
            <div className="text-[6.5px] text-slate-700">Ed./Rev. : 01/00</div>
            <div className="mt-0.5 font-bold text-black border-t border-black/40 pt-0.5">
              NO. : <span className="tracking-wider">{sheetNoNota || '... / ... / NGR-WSPCP'}</span>
            </div>
          </div>
        </div>

        {/* 2. META INFO PENERIMAAN PRODUKSI (CUKUP: TANGGAL, SHIFT, GROUP) */}
        <div className="flex items-center justify-between text-[7.5px] sm:text-[8.5px] my-1 border border-black px-2.5 py-1 bg-slate-50/50 print:bg-transparent font-sans">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold">Tanggal :</span>
            <span className="font-mono font-bold text-black">{tanggal}</span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-bold">Shift :</span>
            <span className="font-mono font-bold text-black">{shiftDisplayText}</span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-bold">Group :</span>
            <span className="font-mono font-black text-black">{group || 'C'}</span>
          </div>
        </div>

        {/* 3. TABEL BARANG (DENGAN KOLOM JUMLAH: OK & NOT GOOD: SET | PCS) */}
        <div className="w-full overflow-hidden border border-black my-0.5">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Header Tingkat 1 */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[7px] sm:text-[7.5px] font-bold">
                <th rowSpan={3} className="border-r border-black text-center py-0.2 px-0.5 w-5">
                  No.
                </th>
                <th rowSpan={3} className="border-r border-black text-center py-0.2 px-0.5 w-16">
                  User
                </th>
                <th rowSpan={3} className="border-r border-black text-center py-0.2 px-1 w-32">
                  Jenis / Type<br />Pallet & Core Plug
                </th>
                <th colSpan={3} className="border-r border-black text-center py-0.2 px-0.5 bg-slate-200/60 print:bg-transparent">
                  Ukuran
                </th>
                <th colSpan={4} className="border-r border-black text-center py-0.2 px-0.5 bg-slate-200/60 print:bg-transparent">
                  Jumlah Pallet / Core Plug
                </th>
                <th rowSpan={3} className="text-center py-0.2 px-1 w-20">
                  Keterangan
                </th>
              </tr>
              {/* Header Tingkat 2 (OK & NOT GOOD) */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[6.5px] sm:text-[7px] font-bold text-center">
                <th rowSpan={2} className="border-r border-black py-0.2 px-0.5 w-11">
                  Tinggi<br /><span className="text-[5.5px] font-normal">Tebal(cm)</span>
                </th>
                <th rowSpan={2} className="border-r border-black py-0.2 px-0.5 w-12">
                  Lebar<br /><span className="text-[5.5px] font-normal">Dia.(inch)</span>
                </th>
                <th rowSpan={2} className="border-r border-black py-0.2 px-0.5 w-11">
                  Panjang<br />(cm)
                </th>
                <th colSpan={2} className="border-r border-black py-0.2 px-0.5 bg-emerald-100/60 print:bg-transparent font-black text-emerald-950 print:text-black">
                  OK
                </th>
                <th colSpan={2} className="border-r border-black py-0.2 px-0.5 bg-rose-100/60 print:bg-transparent font-black text-rose-950 print:text-black">
                  NOT GOOD
                </th>
              </tr>
              {/* Header Tingkat 3 (Sub-Satuan SET & PCS) */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[6px] sm:text-[6.5px] font-bold text-center">
                <th className="border-r border-black py-0.2 px-0.5 w-10">SET</th>
                <th className="border-r border-black py-0.2 px-0.5 w-10">PCS</th>
                <th className="border-r border-black py-0.2 px-0.5 w-10">SET</th>
                <th className="border-r border-black py-0.2 px-0.5 w-10">PCS</th>
              </tr>
            </thead>
            <tbody>{tableRows}</tbody>
          </table>
        </div>

        {/* 4. FOOTER: DISTRIBUSI & 3 TANDA TANGAN RESMI */}
        <div className="grid grid-cols-12 gap-1 border border-black text-[6.5px] sm:text-[7px] mt-1 p-0.5">
          {/* Distribusi Box */}
          <div className="col-span-3 border-r border-black pr-1 leading-tight flex flex-col justify-between h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
            <div className="font-bold uppercase underline">Distribusi :</div>
            <div className="space-y-0.5">
              <div>- Accounting <span className="font-bold">(Putih)</span></div>
              <div>- Supervisor Produksi <span className="font-bold">(Kuning)</span></div>
              <div className={!isArchiveSheet ? 'font-black bg-slate-200/50 print:bg-transparent' : ''}>
                - Ka.Group Outsourcing <span className="font-bold">(Hijau)</span> {!isArchiveSheet && '★'}
              </div>
              <div>- Gudang Pallet <span className="font-bold">(Biru)</span></div>
              <div className={isArchiveSheet ? 'font-black bg-slate-200/50 print:bg-transparent' : ''}>
                - Arsip Finish Pallet <span className="font-bold">(Merah)</span> {isArchiveSheet && '★'}
              </div>
            </div>
          </div>

          {/* 3 Kolom Tanda Tangan: Ka.Group Outsourcing, Supervisor Produksi, Finished Good Pallet */}
          <div className="col-span-9 grid grid-cols-3 text-center divide-x divide-black">
            {/* Tanda Tangan 1: Ka.Group Outsourcing */}
            <div className="flex flex-col justify-between px-1.5 h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
              <div className="font-bold leading-tight text-[7.5px] sm:text-[8px]">
                Ka.Group Outsourcing
              </div>
              <div className="flex-1 min-h-[42px] print:min-h-[46px]" />
              <div className="border-t border-black/80 pt-0.5 text-left text-[6.5px] sm:text-[7px] font-mono truncate">
                NIK : {nikOutsourcing || '.......................'} {kaGroupOutsourcing ? `(${kaGroupOutsourcing})` : ''}
              </div>
            </div>

            {/* Tanda Tangan 2: Supervisor Produksi */}
            <div className="flex flex-col justify-between px-1.5 h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
              <div className="font-bold leading-tight text-[7.5px] sm:text-[8px]">
                Supervisor Produksi
              </div>
              <div className="flex-1 min-h-[42px] print:min-h-[46px]" />
              <div className="border-t border-black/80 pt-0.5 text-left text-[6.5px] sm:text-[7px] font-mono truncate">
                NIK : {nikSpvProduksi || '.......................'} {spvProduksi ? `(${spvProduksi})` : ''}
              </div>
            </div>

            {/* Tanda Tangan 3: Finished Good Pallet */}
            <div className="flex flex-col justify-between px-1.5 h-[72px] sm:h-[82px] print:h-[76px] py-0.5">
              <div className="font-bold leading-tight text-[7.5px] sm:text-[8px]">
                Finished Goods Pallet
              </div>
              <div className="flex-1 min-h-[42px] print:min-h-[46px]" />
              <div className="border-t border-black/80 pt-0.5 text-left text-[6.5px] sm:text-[7px] font-mono truncate">
                NIK : <b>{nikPetugas} ({petugasGudang})</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderA4Page = (
    sheetNo: string,
    sheetItems: NotaPenerimaanItem[],
    sheetShift: string
  ) => {
    return (
      <div className="a4-page-content w-full h-full flex flex-col justify-between">
        {/* Lembar Atas: Untuk Produksi / Ka.Group Outsourcing */}
        {renderSingleNotaSheet(sheetNo, sheetItems, sheetShift, false)}

        {/* Garis Potong / Cut Divider Tengah Kertas */}
        <div className="cut-divider my-0.5 border-b-2 border-dashed border-slate-500 print:border-black text-center relative shrink-0">
          <span className="bg-white px-2 py-0 text-[7px] font-mono text-slate-700 print:text-black font-bold uppercase tracking-wider relative -top-1.5 border border-slate-400 print:border-black rounded-full">
            ✂ POTONG DISINI (Gunting Sesuai Garis Putus-Putus) ✂
          </span>
        </div>

        {/* Lembar Bawah: Untuk Arsip Finish Pallet */}
        {renderSingleNotaSheet(sheetNo, sheetItems, sheetShift, true)}
      </div>
    );
  };

  return (
    <>
      {/* MODAL DIALOG ON SCREEN */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto no-print">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[95vh] overflow-hidden">
          {/* Modal Header */}
          <div className="p-3 sm:p-4 bg-[#163653] text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base leading-tight">
                  NOTA GOOD RECEIVED / NOTA PENERIMAAN PRODUKSI PALLET & CORE PLUG
                </h3>
                <p className="text-[11px] text-emerald-300">
                  Form Bukti Resmi Serah Terima Hasil Produksi ke Gudang Finish Pallet (A4 2 Rangkap)
                </p>
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
            {/* Input Form Metadata */}
            <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs shadow-2xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    No. Dokumen NGR:
                  </label>
                  <input
                    type="text"
                    value={noNota}
                    onChange={e => setNoNota(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal:
                  </label>
                  <input
                    type="text"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Shift Finish Pallet:
                  </label>
                  <select
                    value={shiftFinishPallet}
                    onChange={e => {
                      setShiftFinishPallet(e.target.value);
                      setShiftCustomText('');
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold"
                  >
                    <option value="1">Shift 1 (1)</option>
                    <option value="2">Shift 2 (2)</option>
                    <option value="3">Shift 3 (3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Shift Produksi:
                  </label>
                  <select
                    value={shiftProduksi}
                    onChange={e => {
                      setShiftProduksi(e.target.value);
                      setShiftCustomText('');
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold"
                  >
                    <option value="Shift 2">Shift 2</option>
                    <option value="Non Shift">Non Shift</option>
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 3">Shift 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Group:
                  </label>
                  <select
                    value={group}
                    onChange={e => setGroup(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-black bg-emerald-50 text-emerald-900 border-emerald-300"
                  >
                    <option value="A">Group A</option>
                    <option value="B">Group B</option>
                    <option value="C">Group C</option>
                    <option value="D">Group D</option>
                  </select>
                </div>
              </div>

              {/* Baris Edit Khusus Format Tampilan Shift */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600">Hasil Format Shift di Nota:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-black text-xs border border-emerald-300">
                    {shiftDisplayText}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">Edit Kustom:</span>
                  <input
                    type="text"
                    value={shiftCustomText}
                    onChange={e => setShiftCustomText(e.target.value)}
                    placeholder={shiftDisplayText}
                    className="px-2 py-1 border border-slate-300 rounded font-mono text-xs w-48 bg-white"
                    title="Ketik format kustom jika ingin mengubah teks shift secara manual"
                  />
                  {shiftCustomText && (
                    <button
                      type="button"
                      onClick={() => setShiftCustomText('')}
                      className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Tanda Tangan Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Ka.Group Outsourcing:
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Ka.Group"
                    value={kaGroupOutsourcing}
                    onChange={e => setKaGroupOutsourcing(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs mb-1"
                  />
                  <input
                    type="text"
                    placeholder="NIK Ka.Group"
                    value={nikOutsourcing}
                    onChange={e => setNikOutsourcing(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Supervisor Produksi:
                  </label>
                  <input
                    type="text"
                    placeholder="Nama SPV Produksi"
                    value={spvProduksi}
                    onChange={e => setSpvProduksi(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs mb-1"
                  />
                  <input
                    type="text"
                    placeholder="NIK SPV Produksi"
                    value={nikSpvProduksi}
                    onChange={e => setNikSpvProduksi(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Petugas Finished Goods Pallet:
                  </label>
                  <input
                    type="text"
                    value={petugasGudang}
                    onChange={e => setPetugasGudang(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs mb-1 font-bold"
                  />
                  <input
                    type="text"
                    value={nikPetugas}
                    onChange={e => setNikPetugas(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Rincian Baris Barang (Maksimal 10 Baris) */}
            <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Daftar Barang Diterima ({items.length}/10 Baris):
                </span>
                {items.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 gap-1.5 items-center p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="col-span-1 text-center font-bold text-slate-500">
                      #{idx + 1}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="User (Finishing Sheet, dll)"
                        value={it.user}
                        onChange={e => handleUpdateItem(it.id, 'user', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-slate-300 rounded font-semibold text-[11px]"
                        title="User / Bagian Tujuan Penerimaan Pallet"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Jenis/Type"
                        value={it.jenisType}
                        onChange={e => handleUpdateItem(it.id, 'jenisType', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-slate-300 rounded text-[11px]"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="T"
                        value={it.tinggi}
                        onChange={e => handleUpdateItem(it.id, 'tinggi', e.target.value)}
                        className="w-full px-1 py-0.5 border border-slate-300 rounded font-mono text-center text-[11px]"
                        title="Tinggi/Tebal (cm)"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="L"
                        value={it.lebar}
                        onChange={e => handleUpdateItem(it.id, 'lebar', e.target.value)}
                        className="w-full px-1 py-0.5 border border-slate-300 rounded font-mono text-center text-[11px]"
                        title="Lebar (inch)"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="P"
                        value={it.panjang}
                        onChange={e => handleUpdateItem(it.id, 'panjang', e.target.value)}
                        className="w-full px-1 py-0.5 border border-slate-300 rounded font-mono text-center text-[11px]"
                        title="Panjang (cm)"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="OK Set"
                        value={it.okSet}
                        onChange={e => handleUpdateItem(it.id, 'okSet', e.target.value)}
                        className="w-full px-1 py-0.5 border border-emerald-300 bg-emerald-50 rounded font-mono text-center text-[11px] font-bold text-emerald-800"
                        title="Jumlah OK (SET)"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="OK Pcs"
                        value={it.okPcs}
                        onChange={e => handleUpdateItem(it.id, 'okPcs', e.target.value)}
                        className="w-full px-1 py-0.5 border border-emerald-300 bg-emerald-50 rounded font-mono text-center text-[11px] font-bold text-emerald-800"
                        title="Jumlah OK (PCS)"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="NG"
                        value={it.notGoodSet || it.notGoodPcs}
                        onChange={e => handleUpdateItem(it.id, 'notGoodSet', e.target.value)}
                        className="w-full px-1 py-0.5 border border-rose-300 bg-rose-50 rounded font-mono text-center text-[11px] text-rose-800"
                        title="Jumlah Not Good"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRATINJAU KERTAS A4 ON-SCREEN */}
            <div className="w-full max-w-[210mm] mx-auto bg-white border border-slate-300 p-2 sm:p-2.5 shadow-md">
              <div className="text-[10px] font-bold text-slate-500 mb-1 flex items-center justify-between border-b pb-1 font-mono">
                <span>PRATINJAU KERTAS A4 (2 NGR ATAS-BAWAH):</span>
                <span>Shift: {shiftDisplayText} | Group: {group} | No: {noNota}</span>
              </div>
              {renderA4Page(noNota, items, shiftDisplayText)}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="text-slate-600 text-[11px] space-y-0.5">
              <div>
                * Kertas diatur <b>Portrait A4</b> (2 rangkap: 1 Produksi/Outsourcing & 1 Arsip Finish Pallet).
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
                <span>Cetak 1 Lembar A4 (Simpan PDF)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINT PORTAL ATTACHED DIRECTLY TO BODY */}
      {createPortal(
        <div id="print-ngr-portal">
          <div className="a4-page-wrapper">
            {renderA4Page(noNota, items, shiftDisplayText)}
          </div>
        </div>,
        document.body
      )}

      {/* GLOBAL EMBEDDED PRINT STYLE */}
      <style>{`
        #print-ngr-portal {
          display: none !important;
        }

        @media print {
          @page {
            size: 210mm 297mm;
            margin: 0 !important;
          }

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

          #print-ngr-portal {
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

import React, { useState, useEffect } from 'react';
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
  ShieldCheck,
  Plus,
  Trash2
} from 'lucide-react';
import { Transaction, Employee } from '../../types';
import { normalizePalletDimension } from '../../utils/dimensionUtils';

export interface NotaItem {
  id: string;
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

interface NotaPengirimanModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  employees: Employee[];
  currentUser?: Employee | null;
}

/**
 * Parsing dimensi ukuran pallet menjadi komponen Tebal/Tinggi, Lebar, dan Panjang
 * Contoh: "115x140" -> { tebal: "10", lebar: "115", panjang: "140" }
 * Contoh: "2x10x125" -> { tebal: "2", lebar: "10", panjang: "125" }
 */
function parseDimensionParts(dimStr?: string): { tebal: string; lebar: string; panjang: string } {
  if (!dimStr) return { tebal: '10', lebar: '', panjang: '' };
  const clean = normalizePalletDimension(dimStr);
  const parts = clean.split('x').map(p => p.trim());
  if (parts.length === 3) {
    return { tebal: parts[0] || '10', lebar: parts[1] || '', panjang: parts[2] || '' };
  } else if (parts.length === 2) {
    return { tebal: '10', lebar: parts[0] || '', panjang: parts[1] || '' };
  }
  return { tebal: '10', lebar: clean, panjang: '' };
}

/**
 * Format nomor nota otomatis: XXX/DDMMYYYY/WSPCP
 * Contoh di kertas: 002/02112026/WSPCP
 */
function generateDefaultNotaNumber(dateStr?: string, txNumber?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  const dateFormatted = `${day}${month}${year}`;

  let seq = '001';
  if (txNumber) {
    const match = txNumber.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10) % 1000;
      seq = String(num).padStart(3, '0');
    }
  }
  return `${seq}/${dateFormatted}/WSPCP`;
}

/**
 * Format tanggal Indonesia DD/MM/YYYY
 */
function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export const NotaPengirimanModal: React.FC<NotaPengirimanModalProps> = ({
  isOpen,
  onClose,
  transaction,
  employees,
  currentUser
}) => {
  // Form State
  const [noNota, setNoNota] = useState<string>('');
  const [costCentre, setCostCentre] = useState<string>('8720108700');
  const [tujuanUser, setTujuanUser] = useState<string>('');
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

  // List barang dalam nota (maksimal 10 baris, default 1 baris terisi dari transaksi)
  const [items, setItems] = useState<NotaItem[]>([]);

  // Inisialisasi data ketika transaksi dipilih atau modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    const opName = transaction?.operator || currentUser?.name || 'Indika';
    const foundEmp = employees.find(e => e.name.toLowerCase() === opName.toLowerCase()) || currentUser;
    const opNik = foundEmp?.nik || (opName.toLowerCase().includes('indika') ? '2002934' : '2002935');

    const txDate = transaction?.date || new Date().toISOString().split('T')[0];
    const txShiftNum = transaction?.shift ? transaction.shift.replace(/[^0-9]/g, '') || '2' : '2';

    setNoNota(generateDefaultNotaNumber(txDate, transaction?.transactionNumber));
    setCostCentre('8720108700');
    setTujuanUser(transaction?.customer || 'BU 17');
    setTanggal(formatDateDDMMYYYY(txDate));
    setShift(txShiftNum);
    setNoKendaraan('');
    setPetugasGudang(opName);
    setNikPetugas(opNik);
    setNamaSopir('');
    setNikSopir('');
    setNamaPenerima('');
    setNikPenerima('');

    if (transaction) {
      const dim = parseDimensionParts(transaction.palletSize);
      const isPcs = (transaction.unit || '').toLowerCase() === 'pcs';
      const mktShort = (transaction.marketType || 'Lokal').startsWith('E') ? 'E' : 'L';
      const pTypeClean = (transaction.palletType || 'Pallet Racuk').toUpperCase().replace('PALLET ', '');
      const typePal = transaction.typePallet || 'SS';
      const ket = `${mktShort} ${pTypeClean.substring(0, 3)} ${typePal}${transaction.pelatakanPallet ? ` (${transaction.pelatakanPallet})` : ''}`;

      setItems([
        {
          id: 'item-1',
          noRun: transaction.noRun || '',
          jenisType: (transaction.palletType || 'PALLET RACUK').toUpperCase(),
          tinggi: dim.tebal || '10',
          lebar: dim.lebar || '',
          panjang: dim.panjang || '',
          qtySet: !isPcs ? String(transaction.quantity) : '',
          qtyPcs: isPcs ? String(transaction.quantity) : '',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: ket
        }
      ]);
    } else {
      setItems([
        {
          id: 'item-1',
          noRun: '',
          jenisType: 'PALLET RACUK',
          tinggi: '10',
          lebar: '115',
          panjang: '140',
          qtySet: '',
          qtyPcs: '80',
          kerapianPaku: 'OK',
          kondisiFisik: 'OK',
          keterangan: 'L RCK SS'
        }
      ]);
    }
  }, [isOpen, transaction, employees, currentUser]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleAddItem = () => {
    if (items.length >= 10) return;
    setItems(prev => [
      ...prev,
      {
        id: 'item-' + Date.now(),
        noRun: '',
        jenisType: 'PALLET REAMWRAP',
        tinggi: '10',
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

  // Render Template 1 Salinan Lembar Nota
  const renderNotaSheet = (sheetType: 'USER' | 'ARSIP') => {
    const isUserSheet = sheetType === 'USER';
    const sheetLabel = isUserSheet
      ? 'LEMBAR 1 : UNTUK PENERIMA / USER'
      : 'LEMBAR 2 : UNTUK ARSIP WORKSHOP PALLET & CORE PLUG';

    // Buat total 10 baris tabel persis seperti di form kertas fisik
    const totalRows = 10;
    const tableRows = [];

    for (let i = 0; i < totalRows; i++) {
      const item = items[i];
      tableRows.push(
        <tr key={i} className="h-[21px] border-b border-black text-[9.5px]">
          <td className="border-r border-black text-center font-bold px-1">{i + 1}</td>
          <td className="border-r border-black text-center font-mono font-bold px-1 whitespace-nowrap">
            {item ? item.noRun : ''}
          </td>
          <td className="border-r border-black px-1.5 font-bold uppercase whitespace-nowrap">
            {item ? item.jenisType : ''}
          </td>
          {/* Ukuran */}
          <td className="border-r border-black text-center px-1 font-mono">{item ? item.tinggi : ''}</td>
          <td className="border-r border-black text-center px-1 font-mono">{item ? item.lebar : ''}</td>
          <td className="border-r border-black text-center px-1 font-mono">{item ? item.panjang : ''}</td>
          {/* Jumlah Pengiriman */}
          <td className="border-r border-black text-center font-bold font-mono px-1">
            {item ? item.qtySet : ''}
          </td>
          <td className="border-r border-black text-center font-bold font-mono px-1">
            {item ? item.qtyPcs : ''}
          </td>
          {/* Kerapian & Kondisi */}
          <td className="border-r border-black text-center font-bold px-1">{item ? item.kerapianPaku : ''}</td>
          <td className="border-r border-black text-center font-bold px-1">{item ? item.kondisiFisik : ''}</td>
          <td className="px-1.5 font-medium uppercase truncate">{item ? item.keterangan : ''}</td>
        </tr>
      );
    }

    return (
      <div className="nota-sheet w-full bg-white text-black font-sans leading-tight p-2 sm:p-3 relative box-border border border-black/30 print:border-0">
        {/* Watermark Label Lembar di Kanan Atas */}
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 mb-0.5 print:text-black">
          <span className="font-bold tracking-wider">{sheetLabel}</span>
          <span className="text-right">Workshop Pallet & Coreplug PT IKPP</span>
        </div>

        {/* 1. HEADER ATAS */}
        <div className="flex items-start justify-between border-b-2 border-black pb-1 mb-1">
          {/* Kiri: Logo Indah Kiat & Box Pallet Workshop */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {/* Logo Indah Kiat Icon */}
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full border border-black flex items-center justify-center font-serif font-black text-[10px] leading-none">
                  ik
                </div>
                <div className="leading-none">
                  <div className="text-[12px] font-black tracking-tight uppercase font-sans">
                    indah kiat
                  </div>
                  <div className="text-[7px] tracking-tight uppercase text-black font-sans">
                    pulp and paper products
                  </div>
                </div>
              </div>
            </div>
            {/* Box PALLET WORKSHOP & CORE PLUG */}
            <div className="mt-1 border border-black px-1.5 py-0.5 inline-block text-[8px] font-bold tracking-wider uppercase bg-slate-50 print:bg-transparent">
              PALLET WORKSHOP & CORE PLUG
            </div>
          </div>

          {/* Kanan: Kode Dokumen Resmi */}
          <div className="text-right text-[8.5px] font-mono leading-tight">
            <div className="font-bold">FO-IK/3/179/2</div>
            <div>Rev. 0</div>
            <div className="font-semibold">Form B-2</div>
          </div>
        </div>

        {/* 2. JUDUL DOKUMEN & NOMOR NOTA */}
        <div className="text-center my-1">
          <h2 className="text-[12px] font-black uppercase tracking-wider font-sans underline">
            NOTA PENGIRIMAN PALLET & CORE PLUG
          </h2>
          <div className="text-[10px] font-mono font-bold mt-0.5">
            NO. : <span className="tracking-wider">{noNota || '... / ... / WSPCP'}</span>
          </div>
        </div>

        {/* 3. META INFO PENGIRIMAN (Dua Kolom Kiri & Kanan) */}
        <div className="grid grid-cols-12 gap-2 text-[9px] my-1 border border-black/40 p-1.5 bg-slate-50/50 print:bg-transparent">
          {/* Kolom Kiri */}
          <div className="col-span-7 space-y-0.5">
            <div className="flex items-baseline">
              <span className="w-10 font-bold shrink-0">Dari</span>
              <span className="mx-1">:</span>
              <span className="font-medium">
                Dept. Workshop Pallet & Core Plug / Cost centre : <b>{costCentre}</b>
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="w-10 font-bold shrink-0">Ke</span>
              <span className="mx-1">:</span>
              <span className="font-bold text-[10px] uppercase underline">
                User {tujuanUser || '................................'}
              </span>
            </div>
          </div>

          {/* Kolom Kanan */}
          <div className="col-span-5 space-y-0.5">
            <div className="flex items-baseline justify-end">
              <span className="w-24 font-bold shrink-0">Tanggal</span>
              <span className="mx-1">:</span>
              <span className="w-28 font-bold font-mono text-right">{tanggal}</span>
            </div>
            <div className="flex items-baseline justify-end">
              <span className="w-24 font-bold shrink-0">Shift</span>
              <span className="mx-1">:</span>
              <span className="w-28 font-bold font-mono text-right">{shift}</span>
            </div>
            <div className="flex items-baseline justify-end">
              <span className="w-24 font-bold shrink-0">No. Kendaraan</span>
              <span className="mx-1">:</span>
              <span className="w-28 font-mono text-right truncate">
                {noKendaraan || '.....................'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. TABEL BARANG (10 BARIS SAMA PERSIS KERTAS) */}
        <div className="w-full overflow-hidden border-2 border-black my-1">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Header Tingkat 1 */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[9px] font-bold">
                <th rowSpan={2} className="border-r border-black text-center py-1 px-1 w-6">
                  No.
                </th>
                <th rowSpan={2} className="border-r border-black text-center py-1 px-1 w-16">
                  No. Run
                </th>
                <th rowSpan={2} className="border-r border-black text-center py-1 px-1.5 w-36">
                  Jenis / Type<br />Pallet & Core Plug
                </th>
                <th colSpan={3} className="border-r border-black text-center py-0.5 px-1 bg-slate-200/60 print:bg-transparent">
                  Ukuran
                </th>
                <th colSpan={2} className="border-r border-black text-center py-0.5 px-1 bg-slate-200/60 print:bg-transparent">
                  Jumlah Pengiriman
                </th>
                <th rowSpan={2} className="border-r border-black text-center py-1 px-1 w-12 leading-tight">
                  Kerapian<br />Paku
                </th>
                <th rowSpan={2} className="border-r border-black text-center py-1 px-1 w-16 leading-tight">
                  Kondisi fisik<br />Pallet
                </th>
                <th rowSpan={2} className="text-center py-1 px-1 w-24">
                  Keterangan
                </th>
              </tr>
              {/* Header Tingkat 2 (Sub-Kolom) */}
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-[8px] font-bold text-center">
                <th className="border-r border-black py-0.5 px-1 w-14">
                  Tinggi (cm)<br /><span className="text-[7px] font-normal">Tebal (cm)</span>
                </th>
                <th className="border-r border-black py-0.5 px-1 w-16">
                  Lebar (cm)<br /><span className="text-[7px] font-normal">Diameter (inch)</span>
                </th>
                <th className="border-r border-black py-0.5 px-1 w-14">
                  Panjang<br />(cm)
                </th>
                <th className="border-r border-black py-0.5 px-1 w-12">(SET)</th>
                <th className="border-r border-black py-0.5 px-1 w-12">(PCS)</th>
                <th className="border-r border-black py-0.5 px-1 text-[7px] font-semibold">OK/NOT</th>
                <th className="border-r border-black py-0.5 px-1 text-[7px] font-semibold">OK/NOT</th>
              </tr>
            </thead>
            <tbody>{tableRows}</tbody>
          </table>
        </div>

        {/* 5. FOOTER: DISTRIBUSI & TANDA TANGAN 3 KOLOM */}
        <div className="grid grid-cols-12 gap-1.5 border border-black text-[8px] mt-1 p-1">
          {/* Distribusi Box */}
          <div className="col-span-3 border-r border-black pr-1 leading-tight space-y-0.5">
            <div className="font-bold uppercase underline">Distribusi :</div>
            <div>- Accounting <span className="font-bold">(Putih)</span></div>
            <div>- Pengirim/Sopir <span className="font-bold">(Kuning)</span></div>
            <div>- Penerima/User <span className="font-bold">(Hijau)</span></div>
            <div>- Gudang Pallet <span className="font-bold">(Biru)</span></div>
            <div>- Arsip <span className="font-bold">(Merah)</span></div>
          </div>

          {/* 3 Kolom Tanda Tangan */}
          <div className="col-span-9 grid grid-cols-3 text-center divide-x divide-black">
            {/* Tanda Tangan 1: Petugas Gudang */}
            <div className="flex flex-col justify-between px-1 h-[68px]">
              <div className="font-bold leading-tight">
                Petugas Gudang Pallet & Core Plug
              </div>
              <div className="text-[11px] font-serif font-black italic tracking-widest text-slate-800">
                {petugasGudang ? `[ ${petugasGudang} ]` : ''}
              </div>
              <div className="border-t border-black/80 pt-0.5 text-left text-[8px] font-mono truncate">
                NIK : <b>{nikPetugas} ({petugasGudang})</b>
              </div>
            </div>

            {/* Tanda Tangan 2: Pengirim/Sopir */}
            <div className="flex flex-col justify-between px-1 h-[68px]">
              <div className="font-bold leading-tight">
                Pengirim / Sopir
              </div>
              <div className="text-[10px] text-slate-400 italic">
                {namaSopir ? `[ ${namaSopir} ]` : '( Paraf )'}
              </div>
              <div className="border-t border-black/80 pt-0.5 text-left text-[8px] font-mono truncate">
                NIK : {nikSopir || '.......................'}
              </div>
            </div>

            {/* Tanda Tangan 3: Penerima / User */}
            <div className="flex flex-col justify-between px-1 h-[68px]">
              <div className="font-bold leading-tight">
                Penerima / User
              </div>
              <div className="text-[10px] text-slate-400 italic">
                {namaPenerima ? `[ ${namaPenerima} ]` : '( Tanda Tangan )'}
              </div>
              <div className="border-t border-black/80 pt-0.5 text-left text-[8px] font-mono truncate">
                NIK : {nikPenerima || '.......................'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-xl border border-slate-300 w-full max-w-4xl shadow-2xl my-4 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header (Non-Printable) */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight">
                  Nota Pengiriman Pallet & Core Plug
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  A4 · 2 Rangkap Atas-Bawah
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Form resmi PT Indah Kiat Pulp & Paper Tbk · Lembar 1 untuk User & Lembar 2 untuk Arsip
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
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Nota (Print)</span>
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

        {/* Printable & Interactive Body Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-slate-100">
          {/* Quick Edit Controls Bar (Non-Printable) */}
          <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs space-y-2.5 shadow-2xs no-print">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Pengaturan Data Nota Pengiriman:</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Anda dapat menyesuaikan Nomor Nota, No. Run, User, Shift, atau NIK sebelum dicetak.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">No. Nota</label>
                <input
                  type="text"
                  value={noNota}
                  onChange={e => setNoNota(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs"
                />
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
                  onChange={e => setShift(e.target.value)}
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
                  placeholder="Forklift 01 / Truk"
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
                <span className="text-[11px] font-bold text-slate-700">
                  Daftar Baris Barang (Maks 10 Baris di Nota):
                </span>
                {items.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Baris Pallet
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
                    <input
                      type="text"
                      value={it.jenisType}
                      onChange={e => handleUpdateItem(it.id, 'jenisType', e.target.value.toUpperCase())}
                      placeholder="Jenis Pallet"
                      className="w-36 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-bold uppercase"
                    />
                    <div className="flex items-center gap-0.5">
                      <input
                        type="text"
                        value={it.tinggi}
                        onChange={e => handleUpdateItem(it.id, 'tinggi', e.target.value)}
                        placeholder="T"
                        className="w-9 px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-center text-xs"
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
                      placeholder="Keterangan (L RCK SS / Kolom)"
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

          {/* PRINTABLE A4 PREVIEW CONTAINER */}
          {/* Sesuai instruksi: 1 Lembar A4 berisi 2 Form atas-bawah (Lembar 1 untuk User, Lembar 2 untuk Arsip) */}
          <div
            id="print-nota-area"
            className="w-full max-w-[210mm] mx-auto bg-white border border-slate-400 p-2 sm:p-4 shadow-lg print:border-0 print:p-0 print:m-0 print:shadow-none"
          >
            {/* 1. LEMBAR ATAS: UNTUK USER */}
            {renderNotaSheet('USER')}

            {/* GARIS PUTUS-PUTUS PEMBATAS / POTONG DI TENGAH KERTAS A4 */}
            <div className="my-2.5 sm:my-3.5 border-b-2 border-dashed border-slate-400 text-center relative">
              <span className="bg-white px-3 py-0.5 text-[8.5px] font-mono text-slate-500 font-bold uppercase tracking-widest relative -top-2.5 border border-slate-300 rounded-full print:border-black print:text-black">
                ✂️ POTONG / GUNTING DI SINI (LEMBAR ATAS: USER · LEMBAR BAWAH: ARSIP) ✂️
              </span>
            </div>

            {/* 2. LEMBAR BAWAH: UNTUK ARSIP */}
            {renderNotaSheet('ARSIP')}
          </div>
        </div>

        {/* Modal Footer (Non-Printable) */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs no-print">
          <div className="text-slate-500 text-[11px]">
            * Pastikan printer menggunakan orientasi <b>Portrait</b> pada kertas <b>A4</b>. Kedua lembar otomatis muat dalam 1 halaman.
          </div>
          <div className="flex items-center gap-2">
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
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Nota Sekarang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Embedded Print Style */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 6mm;
          }
          body * {
            visibility: hidden !important;
          }
          #print-nota-area,
          #print-nota-area * {
            visibility: visible !important;
          }
          #print-nota-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .nota-sheet {
            page-break-inside: avoid !important;
            border: 1px solid black !important;
            margin-bottom: 3mm !important;
          }
        }
      `}</style>
    </div>
  );
};

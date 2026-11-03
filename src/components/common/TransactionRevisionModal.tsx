import React, { useState, useMemo } from 'react';
import {
  Transaction,
  QuantityUnit,
  TransactionType,
  ShiftType,
  MarketType,
  PalletSideType
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Check,
  Calendar,
  Clock,
  User,
  Layers,
  MapPin,
  Building2,
  FileEdit,
  Sparkles,
  Info,
  Plus,
  Trash2,
  Split,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { normalizePalletDimension } from '../../utils/dimensionUtils';
import {
  parseColumnAllocations,
  getAvailableColumnsForPallet
} from '../../utils/stockLocationUtils';

interface TransactionRevisionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedTx: Transaction) => void;
}

interface TransactionRevisionDialogProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess?: (updatedTx: Transaction) => void;
}

const TransactionRevisionDialog: React.FC<TransactionRevisionDialogProps> = ({
  transaction,
  onClose,
  onSuccess
}) => {
  const {
    transactions,
    editTransaction,
    canEdit,
    masterSizes,
    masterTypes,
    masterCustomers,
    employees,
    showNotification
  } = useApp();

  // Sibling split transactions from multi-order (jika sebelumnya pernah terpecah di beberapa baris transaksi)
  const siblingSplitTransactions = useMemo(() => {
    if (transaction.transactionType !== 'PENGELUARAN') return [];
    const tNote = transaction.notes || '';
    const totalOrderMatch = tNote.match(/Total\s+Order\s+(\d+)\s*(?:set|pcs)?[:\s]+([^\]]+)/i);

    return transactions.filter(t => {
      if (t.id === transaction.id) return false;
      if (t.transactionType !== 'PENGELUARAN') return false;
      const isSameDate = t.date === transaction.date;
      const isSameSize = normalizePalletDimension(t.palletSize) === normalizePalletDimension(transaction.palletSize);
      const isSameCust = (t.customer || '').trim().toLowerCase() === (transaction.customer || '').trim().toLowerCase();

      if (!isSameDate || !isSameSize || !isSameCust) return false;
      if (totalOrderMatch && t.notes && t.notes.includes(totalOrderMatch[0])) {
        return true;
      }
      return false;
    });
  }, [transaction, transactions]);

  const totalSplitOrderQty = useMemo(() => {
    if (siblingSplitTransactions.length === 0) return transaction.quantity;
    return transaction.quantity + siblingSplitTransactions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  }, [transaction, siblingSplitTransactions]);

  // Parse initial allocations from transaction.pelatakanPallet AND siblings if present
  const initialAllocs = useMemo(() => {
    const mainAllocs = parseColumnAllocations(transaction.pelatakanPallet, transaction.quantity);
    if (siblingSplitTransactions.length === 0) return mainAllocs;
    const sibAllocs = siblingSplitTransactions.flatMap(s => parseColumnAllocations(s.pelatakanPallet, s.quantity));
    const colMap = new Map<string, number>();
    for (const a of [...mainAllocs, ...sibAllocs]) {
      const c = a.column.trim().toUpperCase();
      colMap.set(c, (colMap.get(c) || 0) + a.qty);
    }
    return Array.from(colMap.entries()).map(([column, qty]) => ({ column, qty }));
  }, [transaction, siblingSplitTransactions]);

  // Form State initialized from current transaction (and siblings if order was split)
  const [txType, setTxType] = useState<TransactionType>(transaction.transactionType);
  const [date, setDate] = useState<string>(transaction.date);
  const [time, setTime] = useState<string>(transaction.time);
  const [shift, setShift] = useState<ShiftType>(transaction.shift);
  const [palletSize, setPalletSize] = useState<string>(normalizePalletDimension(transaction.palletSize));
  const [typePallet, setTypePallet] = useState<PalletSideType>(transaction.typePallet || 'LS');
  const [palletType, setPalletType] = useState<string>(transaction.palletType);
  const [marketType, setMarketType] = useState<MarketType>(transaction.marketType);
  const [customer, setCustomer] = useState<string>(transaction.customer);
  const [qty, setQty] = useState<string>(() => String(totalSplitOrderQty));
  const [unit, setUnit] = useState<QuantityUnit>(transaction.unit);
  const [pelatakan, setPelatakan] = useState<string>(transaction.pelatakanPallet || '');
  const [noRun, setNoRun] = useState<string>(transaction.noRun || '');
  const [operator, setOperator] = useState<string>(transaction.operator);
  const [notes, setNotes] = useState<string>(transaction.notes || '');
  const [revisionReason, setRevisionReason] = useState<string>(
    transaction.revisionReason || ''
  );

  const [pickingMode, setPickingMode] = useState<'single' | 'multi'>(() => {
    return initialAllocs.length > 1 ? 'multi' : 'single';
  });

  const [allocations, setAllocations] = useState<Array<{ id: string; column: string; qty: string }>>(() => {
    if (initialAllocs.length > 0) {
      return initialAllocs.map((a, idx) => ({
        id: 'alloc-' + idx + '-' + Math.random().toString(36).substring(2, 6),
        column: a.column,
        qty: String(a.qty)
      }));
    }
    return [
      {
        id: 'alloc-0',
        column: '',
        qty: String(totalSplitOrderQty || '')
      }
    ];
  });

  const [consolidateSiblings, setConsolidateSiblings] = useState<boolean>(() => {
    return siblingSplitTransactions.length > 0;
  });

  const detectedColumnsForSize = useMemo(() => {
    if (txType !== 'PENGELUARAN' && transaction.transactionType !== 'PENGELUARAN') return [];
    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) return [];
    return getAvailableColumnsForPallet({
      transactions,
      palletSize: cleanSize,
      palletType,
      typePallet,
      unit,
      marketType
    });
  }, [txType, transaction, transactions, palletSize, palletType, typePallet, unit, marketType]);

  const totalAllocatedQty = useMemo(() => {
    return allocations.reduce((sum, a) => sum + (parseInt(a.qty, 10) || 0), 0);
  }, [allocations]);

  // Live simulation of column refunds and debits
  const columnRefundPreview = useMemo(() => {
    if (txType !== 'PENGELUARAN' && transaction.transactionType !== 'PENGELUARAN') return [];

    const oldTakenMap = new Map<string, number>();
    initialAllocs.forEach(a => {
      const col = a.column.toUpperCase();
      oldTakenMap.set(col, (oldTakenMap.get(col) || 0) + a.qty);
    });

    if (consolidateSiblings && siblingSplitTransactions.length > 0) {
      siblingSplitTransactions.forEach(sib => {
        const sibAllocs = parseColumnAllocations(sib.pelatakanPallet, sib.quantity);
        sibAllocs.forEach(a => {
          const col = a.column.toUpperCase();
          oldTakenMap.set(col, (oldTakenMap.get(col) || 0) + a.qty);
        });
      });
    }

    const newTakenMap = new Map<string, number>();
    const curQty = parseInt(qty, 10) || 0;

    if (pickingMode === 'single') {
      const targetCol = (pelatakan.trim() || 'AREA TRANSIT').toUpperCase();
      newTakenMap.set(targetCol, curQty);
    } else {
      allocations.forEach(a => {
        const c = (a.column.trim() || 'AREA TRANSIT').toUpperCase();
        const q = parseInt(a.qty, 10) || 0;
        newTakenMap.set(c, (newTakenMap.get(c) || 0) + q);
      });
    }

    const allCols = Array.from(new Set([...oldTakenMap.keys(), ...newTakenMap.keys()]));
    const diffs: Array<{ column: string; refund: number; isNetChange: boolean }> = [];

    allCols.forEach(col => {
      const oldVal = oldTakenMap.get(col) || 0;
      const newVal = newTakenMap.get(col) || 0;
      const diff = oldVal - newVal; // positive: refunded/restored, negative: deducted
      if (diff !== 0) {
        diffs.push({
          column: col,
          refund: diff,
          isNetChange: true
        });
      }
    });

    return diffs;
  }, [txType, transaction, initialAllocs, consolidateSiblings, siblingSplitTransactions, pickingMode, pelatakan, qty, allocations]);

  const handleAddAllocationRow = (colName?: string) => {
    const usedCols = new Set(allocations.map(a => a.column.toUpperCase().trim()));
    const nextCol = colName || detectedColumnsForSize.find(c => !usedCols.has(c.col.toUpperCase()))?.col || '';
    const colStock = detectedColumnsForSize.find(c => c.col.toUpperCase() === nextCol.toUpperCase())?.qty || 0;
    const reqQ = parseInt(qty, 10) || 0;
    const remaining = Math.max(0, reqQ - totalAllocatedQty);
    const defaultQty = colStock > 0 ? Math.min(remaining, colStock) : remaining;

    setAllocations(prev => [
      ...prev,
      {
        id: 'alloc-' + Math.random().toString(36).substring(2, 7),
        column: nextCol,
        qty: defaultQty > 0 ? String(defaultQty) : ''
      }
    ]);
  };

  const handleRemoveAllocationRow = (id: string) => {
    setAllocations(prev => (prev.length > 1 ? prev.filter(a => a.id !== id) : prev));
  };

  const handleUpdateAllocationRow = (id: string, field: 'column' | 'qty', val: string) => {
    setAllocations(prev =>
      prev.map(a => (a.id === id ? { ...a, [field]: val } : a))
    );
  };

  const handleAutoAllocate = () => {
    const reqQ = parseInt(qty, 10) || 0;
    if (reqQ <= 0) {
      showNotification('error', 'Kuantitas Belum Diisi', 'Isi jumlah kuantitas pallet terlebih dahulu.');
      return;
    }

    let needed = reqQ;
    const newAllocs: Array<{ id: string; column: string; qty: string }> = [];

    for (const item of detectedColumnsForSize) {
      if (needed <= 0) break;
      const take = Math.min(needed, item.qty);
      if (take > 0) {
        newAllocs.push({
          id: 'alloc-' + Math.random().toString(36).substring(2, 7),
          column: item.col,
          qty: String(take)
        });
        needed -= take;
      }
    }

    if (newAllocs.length === 0) {
      newAllocs.push({
        id: 'alloc-' + Math.random().toString(36).substring(2, 7),
        column: pelatakan.trim() || '',
        qty: String(reqQ)
      });
    }

    setAllocations(newAllocs);
    setPickingMode('multi');
    showNotification(
      'info',
      'Alokasi Otomatis Siap',
      `Otomatis membagi pengeluaran ke ${newAllocs.length} kolom sesuai ketersediaan stok.`
    );
  };

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal Konfirmasi Satuan Pallet Khusus (Mencegah salah input PCS vs SET)
  const [unitConfirmModal, setUnitConfirmModal] = useState<{
    isOpen: boolean;
    question: string;
    targetUnit: QuantityUnit;
    recommendedUnit: QuantityUnit;
    palletType: string;
    explanation: string;
    actionAfterConfirm?: 'switch-unit' | 'save';
  } | null>(null);
  const [confirmedUnitCombo, setConfirmedUnitCombo] = useState<string | null>(null);

  // Helper wrap type & unit check
  const isReamwrapOrBulkpack = (type: string) => {
    const l = (type || '').toLowerCase();
    return l.includes('reamwrap') || l.includes('bulkpack') || l === 'rw' || l === 'bp';
  };

  const isRacukOrSirkulasi = (type: string) => {
    const l = (type || '').toLowerCase();
    return l.includes('racuk') || l.includes('sirkulasi') || l === 'rck' || l === 'srkls';
  };

  const getUnitMismatchedInfo = (type: string, u: QuantityUnit) => {
    if (isReamwrapOrBulkpack(type) && u === 'Pcs') {
      return {
        isMismatched: true,
        question: 'Apakah anda yakin satuan nya PCS?',
        targetUnit: 'Pcs' as QuantityUnit,
        recommendedUnit: 'Set' as QuantityUnit,
        explanation: 'Wrap type Reamwrap dan Bulkpack umumnya menggunakan satuan SET. Mohon pastikan kembali data dari produksi apakah benar bersatuan PCS.'
      };
    }
    if (isRacukOrSirkulasi(type) && u === 'Set') {
      return {
        isMismatched: true,
        question: 'Apakah anda yakin satuannya SET?',
        targetUnit: 'Set' as QuantityUnit,
        recommendedUnit: 'Pcs' as QuantityUnit,
        explanation: 'Wrap type Racuk dan Sirkulasi umumnya menggunakan satuan PCS. Mohon pastikan kembali data dari produksi apakah benar bersatuan SET.'
      };
    }
    return {
      isMismatched: false,
      question: '',
      targetUnit: u,
      recommendedUnit: u,
      explanation: ''
    };
  };

  const handleSelectUnit = (targetUnit: QuantityUnit) => {
    if (targetUnit === unit) return;
    const mismatch = getUnitMismatchedInfo(palletType, targetUnit);
    if (mismatch.isMismatched) {
      setUnitConfirmModal({
        isOpen: true,
        question: mismatch.question,
        targetUnit: mismatch.targetUnit,
        recommendedUnit: mismatch.recommendedUnit,
        palletType,
        explanation: mismatch.explanation,
        actionAfterConfirm: 'switch-unit'
      });
    } else {
      setUnit(targetUnit);
      setConfirmedUnitCombo(null);
    }
  };

  const handleSelectPalletType = (newType: string) => {
    setPalletType(newType);
    if (isReamwrapOrBulkpack(newType) && unit === 'Pcs' && confirmedUnitCombo !== `${newType}_Pcs`) {
      setUnit('Set');
      setConfirmedUnitCombo(null);
    } else if (isRacukOrSirkulasi(newType) && unit === 'Set' && confirmedUnitCombo !== `${newType}_Set`) {
      setUnit('Pcs');
      setConfirmedUnitCombo(null);
    }
  };

  const handleConfirmUnitModal = async () => {
    if (!unitConfirmModal) return;
    const targetUnit = unitConfirmModal.targetUnit;
    const action = unitConfirmModal.actionAfterConfirm;
    const comboKey = `${unitConfirmModal.palletType}_${targetUnit}`;

    setUnit(targetUnit);
    setConfirmedUnitCombo(comboKey);
    setUnitConfirmModal(null);

    if (action === 'save') {
      await executeSave(targetUnit);
    }
  };

  const handleCancelUnitModal = () => {
    if (!unitConfirmModal) return;
    const recUnit = unitConfirmModal.recommendedUnit;
    setUnit(recUnit);
    setConfirmedUnitCombo(null);
    setUnitConfirmModal(null);
  };

  // Preset size options combined with active masters
  const sizePresets = Array.from(
    new Set([
      '81x111',
      '108x128',
      '67x102',
      '82x82',
      '2x10x125',
      ...masterSizes.filter(s => s.active).map(s => s.name)
    ])
  );

  // Preset type options
  const typePresets = Array.from(
    new Set([
      'Pallet Reamwrap',
      'Pallet Bulkpack',
      'Pallet Racuk',
      'Pallet Sirkulasi',
      ...masterTypes.filter(t => t.active).map(t => t.name)
    ])
  );

  // Operator names
  const operatorOptions = employees.filter(e => e.active).map(e => e.name);

  // Deteksi jika transaksi ini adalah PENERIMAAN dan operator mengubah spesifikasinya
  const isPenerimaanSpecChanged = useMemo(() => {
    if (transaction.transactionType !== 'PENERIMAAN') return false;
    const oldSz = normalizePalletDimension(transaction.palletSize);
    const newSz = normalizePalletDimension(palletSize);
    const oldTp = transaction.typePallet || 'LS';
    const oldPt = (transaction.palletType || '').trim().toLowerCase();
    const newPt = (palletType || '').trim().toLowerCase();
    return (
      oldSz !== newSz ||
      oldTp !== typePallet ||
      oldPt !== newPt ||
      transaction.marketType !== marketType ||
      transaction.unit !== unit
    );
  }, [transaction, palletSize, typePallet, palletType, marketType, unit]);

  // Transaksi pengeluaran terkait yang menggunakan spesifikasi lama setelah tanggal penerimaan ini
  const relatedShipments = useMemo(() => {
    if (!isPenerimaanSpecChanged) return [];
    const oldSz = normalizePalletDimension(transaction.palletSize);
    const oldTp = transaction.typePallet || 'LS';
    const oldPt = (transaction.palletType || '').trim().toLowerCase();
    const oldMkt = transaction.marketType;
    const oldUn = transaction.unit;

    return transactions.filter(t => 
      t.id !== transaction.id &&
      t.transactionType === 'PENGELUARAN' &&
      normalizePalletDimension(t.palletSize) === oldSz &&
      (t.typePallet || 'LS') === oldTp &&
      (t.palletType || '').trim().toLowerCase() === oldPt &&
      t.marketType === oldMkt &&
      t.unit === oldUn &&
      t.date >= transaction.date
    );
  }, [isPenerimaanSpecChanged, transaction, transactions]);

  const totalRelatedShipmentQty = useMemo(() => {
    return relatedShipments.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
  }, [relatedShipments]);

  const handleResetToOriginal = () => {
    setTxType(transaction.transactionType);
    setDate(transaction.date);
    setTime(transaction.time);
    setShift(transaction.shift);
    setPalletSize(normalizePalletDimension(transaction.palletSize));
    setTypePallet(transaction.typePallet || 'LS');
    setPalletType(transaction.palletType);
    setMarketType(transaction.marketType);
    setCustomer(transaction.customer);
    setQty(String(totalSplitOrderQty));
    setUnit(transaction.unit);
    setPelatakan(transaction.pelatakanPallet || '');
    setNoRun(transaction.noRun || '');
    setOperator(transaction.operator);
    setNotes(transaction.notes || '');
    setRevisionReason(transaction.revisionReason || '');
    setPickingMode(initialAllocs.length > 1 ? 'multi' : 'single');
    setAllocations(
      initialAllocs.length > 0
        ? initialAllocs.map((a, idx) => ({
            id: 'alloc-' + idx + '-' + Math.random().toString(36).substring(2, 6),
            column: a.column,
            qty: String(a.qty)
          }))
        : [{ id: 'alloc-0', column: '', qty: String(totalSplitOrderQty) }]
    );
    setConsolidateSiblings(siblingSplitTransactions.length > 0);
    setErrorMessage('');
  };

  const executeSave = async (overrideUnit?: QuantityUnit) => {
    const finalUnit = overrideUnit || unit;
    const cleanSize = normalizePalletDimension(palletSize);
    const numericQty = parseInt(qty, 10);

    let finalPelatakan = pelatakan.trim();
    if (txType === 'PENGELUARAN' && pickingMode === 'multi') {
      const valid = allocations.filter(a => a.column.trim());
      if (valid.length > 0) {
        finalPelatakan = valid
          .map(a => `${a.column.trim().toUpperCase()} (${parseInt(a.qty, 10) || 0} ${finalUnit})`)
          .join(', ');
      }
    }

    const siblingIdsToDelete = (consolidateSiblings && siblingSplitTransactions.length > 0)
      ? siblingSplitTransactions.map(s => s.id)
      : undefined;

    try {
      setIsSaving(true);
      const res = await editTransaction(
        transaction.id,
        {
          transactionType: txType,
          date,
          time,
          shift,
          palletSize: cleanSize,
          typePallet,
          palletType: palletType.trim(),
          marketType,
          customer: customer.trim(),
          quantity: numericQty,
          unit: finalUnit,
          pelatakanPallet: finalPelatakan,
          noRun: noRun.trim() || undefined,
          operator: operator.trim(),
          notes: notes.trim(),
          revisionReason: revisionReason.trim() || 'Koreksi data transaksi',
          siblingIdsToDelete
        },
        revisionReason.trim() || 'Koreksi data transaksi'
      );

      if (res.success) {
        if (onSuccess) {
          onSuccess({
            ...transaction,
            transactionType: txType,
            date,
            time,
            shift,
            palletSize: cleanSize,
            typePallet,
            palletType: palletType.trim(),
            marketType,
            customer: customer.trim(),
            quantity: numericQty,
            unit: finalUnit,
            pelatakanPallet: finalPelatakan,
            noRun: noRun.trim() || undefined,
            operator: operator.trim(),
            notes: notes.trim(),
            isRevised: true,
            revisionReason: revisionReason.trim() || 'Koreksi data transaksi'
          });
        }
        onClose();
        showNotification(
          'success',
          'Revisi Berhasil',
          `Transaksi ${cleanSize} (${finalUnit}) berhasil diperbarui.`
        );
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan revisi transaksi.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan revisi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!canEdit) {
      setErrorMessage('Akses ditolak: Hanya Operator yang diizinkan merevisi data transaksi.');
      return;
    }

    const cleanSize = normalizePalletDimension(palletSize);
    if (!cleanSize) {
      setErrorMessage('Ukuran pallet tidak boleh kosong.');
      return;
    }

    const numericQty = parseInt(qty, 10);
    if (isNaN(numericQty) || numericQty <= 0) {
      setErrorMessage('Jumlah kuantitas pallet harus berupa angka positif lebih dari 0.');
      return;
    }

    if (txType === 'PENGELUARAN' && pickingMode === 'multi') {
      if (allocations.length === 0) {
        setErrorMessage('Tentukan minimal 1 baris kolom untuk alokasi multi-kolom.');
        return;
      }
      for (let i = 0; i < allocations.length; i++) {
        const a = allocations[i];
        if (!a.column.trim()) {
          setErrorMessage(`Nama kolom pada baris ke-${i + 1} belum diisi.`);
          return;
        }
        const aQty = parseInt(a.qty, 10);
        if (isNaN(aQty) || aQty <= 0) {
          setErrorMessage(`Jumlah quantity di kolom ${a.column} baris ke-${i + 1} harus lebih dari 0.`);
          return;
        }
      }
      if (totalAllocatedQty !== numericQty) {
        setErrorMessage(
          totalAllocatedQty < numericQty
            ? `Total alokasi kolom (${totalAllocatedQty} ${unit}) masih KURANG ${numericQty - totalAllocatedQty} ${unit} dari total kuantitas (${numericQty} ${unit}).`
            : `Total alokasi kolom (${totalAllocatedQty} ${unit}) MELEBIHI total kuantitas (${numericQty} ${unit}) sebanyak ${totalAllocatedQty - numericQty} ${unit}.`
        );
        return;
      }
    }

    if (!date) {
      setErrorMessage('Tanggal transaksi wajib ditentukan.');
      return;
    }

    if (!customer.trim()) {
      setErrorMessage('User / Tujuan pengiriman wajib diisi.');
      return;
    }

    // Pengecekan unit khusus untuk Penerimaan
    const mismatch = getUnitMismatchedInfo(palletType, unit);
    const comboKey = `${palletType}_${unit}`;
    if (mismatch.isMismatched && confirmedUnitCombo !== comboKey) {
      setUnitConfirmModal({
        isOpen: true,
        question: mismatch.question,
        targetUnit: mismatch.targetUnit,
        recommendedUnit: mismatch.recommendedUnit,
        palletType,
        explanation: mismatch.explanation,
        actionAfterConfirm: 'save'
      });
      return;
    }

    await executeSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-300 w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono tracking-wider">
                  {transaction.transactionNumber}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  MODE REVISI
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Koreksi transaksi salah input · Penyesuaian stok dan laporan historis otomatis sinkron
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Info */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <b>Penting:</b> Perubahan pada jenis, ukuran, tipe, pasar, satuan, atau jumlah akan <b>otomatis mengoreksi saldo stok fisik</b> dan seluruh laporan historis (Stok Bulanan, Rekap Shift, dan Matriks Harian), meskipun transaksi ini dibuat di masa lampau.
          </div>
        </div>

        {/* Live Cascaded Shipment Alert */}
        {relatedShipments.length > 0 && (
          <div className="bg-[#163653] border-b border-[#1E4366] px-4 py-3 text-white">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-[#3886B8] text-white shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="text-xs space-y-1.5 flex-1 leading-relaxed">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Penyelarasan Otomatis Riwayat Pengiriman Terkait:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-extrabold bg-[#8CCCF0]/25 text-[#BAE6FD] border border-[#8CCCF0]/50 uppercase">
                    Stok Tetap Akurat
                  </span>
                </div>
                <div className="text-slate-200">
                  Terdeteksi <b>{relatedShipments.length} transaksi pengeluaran/kirim</b> (total <b>{totalRelatedShipmentQty} {unit}</b>) pada/setelah tanggal <b>{transaction.date}</b> yang keluar dari stok ini.
                </div>
                <div className="bg-[#112B43] p-2.5 rounded-lg border border-[#1E4366] text-[11px] text-slate-200 space-y-1">
                  <div>
                    • Spek Penerimaan diubah ke: <b className="text-[#8CCCF0]">{palletSize || transaction.palletSize} {typePallet} {palletType} [{marketType}]</b>
                  </div>
                  <div>
                    • Seluruh {relatedShipments.length} pengiriman terkait akan <b>otomatis ikut disesuaikan</b> ke spek aktual ini.
                  </div>
                  <div>
                    • Sisa stok di Data Stok: <b className="text-[#34D399] font-mono text-xs">{Math.max(0, (parseInt(qty, 10) || 0) - totalRelatedShipmentQty)} {unit}</b> (bukan {qty} {unit}).
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Jenis Transaksi & Waktu */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              1. Tipe Transaksi & Waktu Terjadi
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Jenis Transaksi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Jenis Transaksi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1 bg-white p-1 border border-slate-300 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTxType('PENERIMAAN')}
                    className={`py-1 text-center font-bold rounded cursor-pointer transition-colors ${
                      txType === 'PENERIMAAN'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Masuk (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('PENGELUARAN')}
                    className={`py-1 text-center font-bold rounded cursor-pointer transition-colors ${
                      txType === 'PENGELUARAN'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Keluar (-)
                  </button>
                </div>
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tanggal Transaksi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Jam */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Waktu / Jam
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Shift */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Shift Kerja
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as ShiftType)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Shift 1">Shift 1 (07:00 - 15:00)</option>
                  <option value="Shift 2">Shift 2 (15:00 - 23:00)</option>
                  <option value="Shift 3">Shift 3 (23:00 - 07:00)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Spesifikasi Pallet */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              2. Spesifikasi Fisik Pallet & Pasar
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Ukuran Pallet */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Ukuran Pallet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="revision-size-presets"
                  value={palletSize}
                  onChange={(e) => setPalletSize(e.target.value)}
                  onBlur={() => {
                    if (palletSize.trim()) {
                      setPalletSize(normalizePalletDimension(palletSize));
                    }
                  }}
                  placeholder="cth: 81x111, 108x128..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="revision-size-presets">
                  {sizePresets.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Pilih opsi atau ketik ukuran manual
                </span>
              </div>

              {/* 1. Klasifikasi Pasar (Lokal / Ekspor) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pasar (Lokal / Ekspor) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value as MarketType)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Lokal">Lokal</option>
                  <option value="Ekspor">Ekspor</option>
                </select>
              </div>

              {/* 2. Jenis Pallet: 1-Click Button Selection (RW, BP, RCK, SRKLS) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Jenis Pallet <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-blue-700 font-bold">Tinggal Klik</span>
                </label>
                <div className="grid grid-cols-2 gap-1 bg-white p-1 border border-slate-300 rounded-lg">
                  {[
                    { code: 'RW', label: 'REAMWRAP', fullName: 'Pallet Reamwrap' },
                    { code: 'BP', label: 'BULKPACK', fullName: 'Pallet Bulkpack' },
                    { code: 'RCK', label: 'RACUK', fullName: 'Pallet Racuk' },
                    { code: 'SRKLS', label: 'SIRKULASI', fullName: 'Pallet Sirkulasi' }
                  ].map((item) => {
                    const isSelected =
                      palletType === item.fullName ||
                      palletType.toLowerCase().includes(item.label.toLowerCase()) ||
                      palletType.toUpperCase() === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelectPalletType(item.fullName)}
                        className={`py-1 px-1 rounded text-center transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100 font-semibold'
                        }`}
                        title={item.fullName}
                      >
                        <span className="text-xs font-black">{item.code}</span>
                        <span className="text-[9px] font-medium opacity-90">( {item.label} )</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* 3. Type Pallet (LS / SS) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Type Pallet <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1 bg-white p-1 border border-slate-300 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTypePallet('LS')}
                    className={`py-1 text-center font-bold font-mono rounded cursor-pointer transition-colors ${
                      typePallet === 'LS'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Long Side"
                  >
                    LS (Long Side)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypePallet('SS')}
                    className={`py-1 text-center font-bold font-mono rounded cursor-pointer transition-colors ${
                      typePallet === 'SS'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Short Side"
                  >
                    SS (Short Side)
                  </button>
                </div>
              </div>

              {/* Kuantitas & Satuan (Menyamping & Tinggal Klik) */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Jumlah & Satuan <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-blue-700 font-bold">Tinggal Klik</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="Qty..."
                    className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-extrabold font-mono text-base text-slate-900 focus:ring-1 focus:ring-blue-500 text-center"
                  />
                  <div className="grid grid-cols-2 gap-1 flex-1 bg-white p-1 border border-slate-300 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleSelectUnit('Set')}
                      className={`py-1 text-center font-bold text-xs rounded cursor-pointer transition-colors ${
                        unit === 'Set'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectUnit('Pcs')}
                      className={`py-1 text-center font-bold text-xs rounded cursor-pointer transition-colors ${
                        unit === 'Pcs'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Pcs
                    </button>
                  </div>
                </div>

                {/* Status Satuan Indicator */}
                {(() => {
                  const mismatch = getUnitMismatchedInfo(palletType, unit);
                  const comboKey = `${palletType}_${unit}`;
                  const isConfirmed = confirmedUnitCombo === comboKey;
                  if (mismatch.isMismatched) {
                    return (
                      <div className={`mt-1.5 px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 ${
                        isConfirmed
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-50 text-amber-900 border border-amber-300'
                      }`}>
                        {isConfirmed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Dikonfirmasi Yakin: <b>{unit}</b> ({palletType})</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Perlu konfirmasi: Satuan <b>{unit}</b></span>
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>

          {/* Section 3: User, No.Run, Kolom, & Operator */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              3. User Tujuan, No.Run, Kolom Peletakan, & Operator
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* User / Customer */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  User / Customer Tujuan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="revision-cust-presets"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="cth: Pindo 1, Pindo 2, Ekspor..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="revision-cust-presets">
                  {masterCustomers.filter(c => c.active).map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              {/* No.Run (Opsional) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>No.Run</span>
                  <span className="text-[9px] text-slate-400 font-normal">Opsional</span>
                </label>
                <input
                  type="text"
                  value={noRun}
                  onChange={(e) => setNoRun(e.target.value)}
                  placeholder="cth: 12001281..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Kolom Peletakan Yard (Single or Multi-Column Picking) */}
              {txType === 'PENGELUARAN' ? (
                <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-white p-3 rounded-lg border border-slate-300 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>Kolom Pengambilan Pallet (Yard)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500">
                        Pilih 1 kolom atau bagi ke beberapa kolom (split). Kolom yang diganti otomatis direfund.
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setPickingMode('single');
                          if (allocations[0]?.column) {
                            setPelatakan(allocations[0].column);
                          }
                        }}
                        className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                          pickingMode === 'single'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        1 Kolom
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPickingMode('multi');
                          if (allocations.length <= 1 && pelatakan.trim()) {
                            setAllocations([
                              {
                                id: 'alloc-0',
                                column: pelatakan.trim().toUpperCase(),
                                qty: qty || '0'
                              }
                            ]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          pickingMode === 'multi'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Split className="w-3 h-3" />
                        Multi-Kolom (Split)
                      </button>
                    </div>
                  </div>

                  {/* Sibling Split Consolidation Banner */}
                  {siblingSplitTransactions.length > 0 && !consolidateSiblings && (
                    <div className="bg-sky-50 border border-sky-300 rounded-lg p-2.5 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-sky-700 shrink-0" />
                        <div>
                          <span className="font-bold">Terdeteksi Order Split Terkait:</span> Transaksi ini sebelumnya terpecah di {siblingSplitTransactions.length + 1} kolom (Total order: <b>{totalSplitOrderQty} {unit}</b>).
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setConsolidateSiblings(true);
                          setQty(String(totalSplitOrderQty));
                          setPickingMode(initialAllocs.length > 1 ? 'multi' : 'single');
                        }}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-[11px] shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        Satukan Semua ({totalSplitOrderQty} {unit})
                      </button>
                    </div>
                  )}

                  {consolidateSiblings && (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2 text-xs text-emerald-950 flex items-center justify-between">
                      <span className="font-semibold">
                        Mode Konsolidasi Aktif: Seluruh {siblingSplitTransactions.length + 1} bagian ({totalSplitOrderQty} {unit}) disatukan ke transaksi ini. Transaksi split lainnya otomatis dibatalkan/direfund.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setConsolidateSiblings(false);
                          setQty(transaction.quantity.toString());
                        }}
                        className="text-emerald-700 hover:text-emerald-900 font-bold underline text-[11px] ml-2 cursor-pointer"
                      >
                        Batalkan
                      </button>
                    </div>
                  )}

                  {/* Mode Single Column */}
                  {pickingMode === 'single' ? (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={pelatakan}
                          onChange={(e) => setPelatakan(e.target.value.toUpperCase())}
                          placeholder="Ketik kolom (cth: F8, F9, Transit)..."
                          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold font-mono text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500 uppercase"
                        />
                        {detectedColumnsForSize.length > 0 && (
                          <div className="text-[11px] text-slate-500 shrink-0">
                            Pilih cepat dari stok yang ada:
                          </div>
                        )}
                      </div>

                      {/* Stock chips in Yard */}
                      {detectedColumnsForSize.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                            Stok Tersedia:
                          </span>
                          {detectedColumnsForSize.map((c) => {
                            const isSelected = pelatakan.trim().toUpperCase() === c.col.toUpperCase();
                            return (
                              <button
                                key={c.col}
                                type="button"
                                onClick={() => setPelatakan(c.col)}
                                className={`px-2 py-0.5 rounded text-xs font-bold font-mono cursor-pointer transition-all border ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                }`}
                              >
                                {c.col}: {c.qty} {unit}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Mode Multi-Column Split */
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Daftar Pembagian Kolom Pengambilan:
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoAllocate}
                          className="px-2 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-sky-700" />
                          Alokasi Otomatis dari Stok
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {allocations.map((alloc, idx) => (
                          <div key={alloc.id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 font-mono w-5 text-center">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={alloc.column}
                              onChange={(e) => handleUpdateAllocationRow(alloc.id, 'column', e.target.value.toUpperCase())}
                              placeholder="Kolom (cth: F9)..."
                              className="w-36 px-2.5 py-1 bg-white border border-slate-300 rounded font-bold font-mono text-xs uppercase focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold text-slate-500">Ambil:</span>
                              <input
                                type="number"
                                min="1"
                                value={alloc.qty}
                                onChange={(e) => handleUpdateAllocationRow(alloc.id, 'qty', e.target.value)}
                                placeholder="Qty"
                                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-bold font-mono text-xs text-center focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-xs font-bold text-slate-600">{unit}</span>
                            </div>

                            {/* Column available stock hint */}
                            {(() => {
                              const matchCol = detectedColumnsForSize.find(
                                c => c.col.toUpperCase() === alloc.column.trim().toUpperCase()
                              );
                              if (matchCol) {
                                return (
                                  <span className="text-[10px] text-slate-500 font-medium ml-1">
                                    (Stok kolom: {matchCol.qty})
                                  </span>
                                );
                              }
                              return null;
                            })()}

                            <div className="ml-auto">
                              <button
                                type="button"
                                onClick={() => handleRemoveAllocationRow(alloc.id)}
                                disabled={allocations.length <= 1}
                                className={`p-1 rounded cursor-pointer ${
                                  allocations.length <= 1
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-rose-500 hover:bg-rose-50'
                                }`}
                                title="Hapus kolom ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddAllocationRow()}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tambah Kolom Lain
                        </button>

                        <div className={`text-xs font-bold font-mono px-2.5 py-1 rounded border ${
                          totalAllocatedQty === parseInt(qty, 10)
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          Teralokasi: {totalAllocatedQty} / {qty || '0'} {unit}
                          {totalAllocatedQty !== parseInt(qty, 10) && (
                            <span className="ml-1 text-[11px] font-normal">
                              ({totalAllocatedQty < parseInt(qty, 10) ? `Kurang ${parseInt(qty, 10) - totalAllocatedQty}` : `Lebih ${totalAllocatedQty - parseInt(qty, 10)}`})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Column Refund & Re-allocation Simulation Card */}
                  {columnRefundPreview.length > 0 && (
                    <div className="bg-slate-900 text-white p-2.5 rounded-lg border border-slate-800 space-y-1.5 mt-2 shadow-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold flex items-center gap-1 text-[#8CCCF0]">
                          <RotateCcw className="w-3.5 h-3.5" />
                          Simulasi Sinkronisasi Kolom Real-Time:
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Otomatis update saldo per kolom
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {columnRefundPreview.map((diff) => {
                          const isRefund = diff.refund > 0;
                          return (
                            <div
                              key={diff.column}
                              className={`px-2 py-1 rounded text-[11px] font-bold font-mono flex items-center gap-1 border ${
                                isRefund
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-600'
                              }`}
                            >
                              <span>{diff.column}:</span>
                              <span>
                                {isRefund ? `+${diff.refund} ${unit}` : `${diff.refund} ${unit}`}
                              </span>
                              <span className="text-[9px] font-sans font-medium opacity-90 ml-0.5">
                                ({isRefund ? 'Kerefund / Kembali' : 'Diambil'})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode PENERIMAAN / PINDAH_KOLOM: Single field */
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kolom Peletakan (Yard)
                  </label>
                  <input
                    type="text"
                    value={pelatakan}
                    onChange={(e) => setPelatakan(e.target.value.toUpperCase())}
                    placeholder="cth: F14, F10, Transit..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold font-mono text-slate-900 focus:ring-1 focus:ring-blue-500 uppercase"
                  />
                </div>
              )}

              {/* Operator */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Operator Bertugas
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500"
                >
                  {operatorOptions.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              {/* Catatan Transaksi Tambahan (Opsional) */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Catatan Transaksi</span>
                  <span className="text-[9px] text-slate-400 font-normal">Opsional</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keterangan tambahan transaksi..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Buttons Footer */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetToOriginal}
              disabled={isSaving}
              className="w-full sm:w-auto px-3 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kembalikan Nilai Semula</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Revisi Transaksi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal Notifikasi Konfirmasi Satuan Pallet Khusus */}
      {unitConfirmModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Dialog */}
            <div className="bg-amber-500/10 border-b border-amber-200 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                  Konfirmasi Satuan Pallet
                </h3>
                <p className="text-[11px] text-amber-800 font-medium">
                  Verifikasi Anti Salah Input Operasional Pabrik
                </p>
              </div>
            </div>

            {/* Body Dialog */}
            <div className="p-5 space-y-4">
              <div className="text-center py-2">
                <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  "{unitConfirmModal.question}"
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                  <span>Wrap Type: <b className="text-blue-700">{unitConfirmModal.palletType}</b></span>
                  <span>•</span>
                  <span>Satuan Dipilih: <b className="text-rose-700">{unitConfirmModal.targetUnit}</b></span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Aturan Standar Satuan di Finish Pallet:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1 text-slate-600">
                  <li><b>Reamwrap & Bulkpack</b> standar umumnya bersatuan: <b className="text-blue-700">SET</b></li>
                  <li><b>Racuk & Sirkulasi</b> standar umumnya bersatuan: <b className="text-blue-700">PCS</b></li>
                </ul>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  {unitConfirmModal.explanation}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmUnitModal}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg text-xs font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Ya, Saya Yakin ({unitConfirmModal.targetUnit})</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelUnitModal}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Bukan, Ganti ke {unitConfirmModal.recommendedUnit}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TransactionRevisionModal: React.FC<TransactionRevisionModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSuccess
}) => {
  if (!isOpen || !transaction) return null;

  return (
    <TransactionRevisionDialog
      transaction={transaction}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
};

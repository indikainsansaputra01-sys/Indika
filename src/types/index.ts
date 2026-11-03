export type UserRole = 'operator' | 'officer' | 'leadershift' | 'spv' | 'admin';

export type ShiftType = 'Shift 1' | 'Shift 2' | 'Shift 3';

export type MarketType = 'Lokal' | 'Ekspor';

export type TransactionType = 'PENERIMAAN' | 'PENGELUARAN' | 'PINDAH_KOLOM' | 'UBAH_SPEK';

export type QuantityUnit = 'Set' | 'Pcs';

export type PalletSideType = 'LS' | 'SS';

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  isAdmin?: boolean; // Khusus Admin (Indika memiliki akses Admin)
  title: string; // e.g. "Operator & Admin", "Operator Finish Pallet", "Supervisor (SPV)"
  active: boolean;
  nik?: string; // NIK karyawan (cth: 2002934 untuk Indika)
  password?: string;
  lastPasswordChangedAt?: string;
  avatarVariant?: 'indika_glasses' | 'operator_yellow' | 'officer_white_1' | 'officer_white_2' | string;
}

export interface StockItem {
  id: string;
  palletSize: string; // Ketik sendiri (cth: 81x111, 67x102, 82x82, 2x10x125)
  palletType: string; // Pallet Reamwrap, Pallet Bulkpack, Pallet Racuk, Pallet Sirkulasi
  typePallet: PalletSideType; // LS (Long Side) atau SS (Short Side)
  marketType: MarketType; // Lokal / Ekspor
  unit: QuantityUnit; // Set / Pcs
  quantity: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string; // IN-YYYYMMDD-XXXX, OUT-YYYYMMDD-XXXX, MOV-YYYYMMDD-XXXX, or CHG-YYYYMMDD-XXXX
  transactionType: TransactionType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  palletSize: string; // Ketik sendiri
  palletType: string; // Pallet Reamwrap, Pallet Bulkpack, Pallet Racuk, Pallet Sirkulasi (atau Wrap Type Asal saat UBAH_SPEK)
  targetPalletType?: string; // Khusus UBAH_SPEK: Wrap Type tujuan hasil perubahan
  typePallet?: PalletSideType; // LS (Long Side) atau SS (Short Side)
  customer: string; // Ketik sendiri atau nama relokasi/perubahan spek
  shift: ShiftType;
  marketType: MarketType;
  quantity: number;
  unit: QuantityUnit; // Set / Pcs
  pelatakanPallet?: string; // Input manual peletakan/lokasi pallet di yard (atau Kolom Asal saat PINDAH_KOLOM / UBAH_SPEK)
  kolomAsal?: string; // Khusus PINDAH_KOLOM: Kolom yard asal
  kolomTujuan?: string; // Khusus PINDAH_KOLOM & UBAH_SPEK: Kolom yard tujuan penempatan
  noRun?: string; // No.Run (Nomor Run) - diketik manual saat pengeluaran, opsional
  operator: string; // Indika, Agus, Harun, Riffky
  operatorId: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  isRevised?: boolean;
  revisionReason?: string;
  revisedAt?: string;
  revisedBy?: string;
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  userName: string;
  employeeId: string;
  activity: string;
  dataBefore?: string;
  dataAfter?: string;
}

export interface StockThresholdConfig {
  safeMin: number;
  warningMin: number;
  criticalMax: number;
}

export interface MasterPalletSize {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface MasterPalletType {
  id: string;
  name: string;
  active: boolean;
}

export interface MasterCustomer {
  id: string;
  name: string;
  active: boolean;
}

export type ThemeMode = 'light' | 'dark';

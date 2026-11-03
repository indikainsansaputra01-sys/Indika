import { Employee, MasterCustomer, MasterPalletSize, MasterPalletType, StockItem, Transaction, AuditLog } from '../types';

export const INITIAL_EMPLOYEES: Employee[] = [
  // Operator: Indika (Kacamata, Helm Kuning, Kulit Sawo Matang, Usia ~25), Agus, Harun, Riffky (Helm Kuning, Sawo Matang)
  { id: 'OP-01', name: 'Indika', role: 'operator', isAdmin: true, title: 'Operator & Admin Finish Pallet', active: true, shiftPreference: 'Shift 1', nik: '2002934', password: 'Indika581196', avatarVariant: 'indika_glasses' },
  { id: 'OP-02', name: 'Agus', role: 'operator', isAdmin: false, title: 'Operator Finish Pallet', active: true, shiftPreference: 'Shift 2', nik: '2002935', password: 'Agus777', avatarVariant: 'operator_yellow' },
  { id: 'OP-03', name: 'Harun', role: 'operator', isAdmin: false, title: 'Operator Finish Pallet', active: true, shiftPreference: 'Shift 2', nik: '2002936', password: 'Harun777', avatarVariant: 'operator_yellow' },
  { id: 'OP-04', name: 'Riffky', role: 'operator', isAdmin: false, title: 'Operator Finish Pallet', active: true, shiftPreference: 'Shift 3', nik: '2002937', password: 'Riffky777', avatarVariant: 'operator_yellow' },
  
  // Officer, Leadershift & Supervisor: Syafa, Fauzan, Ahmad Muhlas (Helm Putih, Laki-laki Sawo Matang Usia ~25)
  { id: 'OFF-01', name: 'Syafa', role: 'officer', isAdmin: false, title: 'Officer Finish Pallet', active: true, shiftPreference: 'Shift 1', nik: '2002938', password: 'Monitoring123', avatarVariant: 'officer_white_1' },
  { id: 'LS-01', name: 'Fauzan', role: 'leadershift', isAdmin: false, title: 'Leadershift Finish Pallet', active: true, shiftPreference: 'Shift 1', nik: '2002939', password: 'Monitoring123', avatarVariant: 'officer_white_1' },
  { id: 'SPV-01', name: 'Ahmad Muhlas', role: 'spv', isAdmin: false, title: 'Supervisor (SPV)', active: true, shiftPreference: 'Shift 1', nik: '2002940', password: 'Monitoring123', avatarVariant: 'officer_white_2' },
];

// Cukup 5 ukuran ini: 81x111, 82x82, 67x102, 72x102, dan 92x122
export const INITIAL_MASTER_SIZES: MasterPalletSize[] = [
  { id: 's-1', name: '81x111', description: 'Ukuran Standard', active: true },
  { id: 's-2', name: '82x82', description: 'Ukuran Standard', active: true },
  { id: 's-3', name: '67x102', description: 'Ukuran Standard', active: true },
  { id: 's-4', name: '72x102', description: 'Ukuran Standard', active: true },
  { id: 's-5', name: '92x122', description: 'Ukuran Standard', active: true },
];

// 4 Jenis Pallet Resmi
export const INITIAL_MASTER_TYPES: MasterPalletType[] = [
  { id: 't-1', name: 'Pallet Reamwrap', active: true },
  { id: 't-2', name: 'Pallet Bulkpack', active: true },
  { id: 't-3', name: 'Pallet Racuk', active: true },
  { id: 't-4', name: 'Pallet Sirkulasi', active: true },
];

// User pilihan cepat: Finishing Sheet, Finishing Sheet(PD1), BU19(Order Finishing), BU 19, FG ROLL PM 1, BU 17
export const INITIAL_MASTER_CUSTOMERS: MasterCustomer[] = [
  { id: 'c-1', name: 'Finishing Sheet', active: true },
  { id: 'c-2', name: 'Finishing Sheet(PD1)', active: true },
  { id: 'c-3', name: 'BU19(Order Finishing)', active: true },
  { id: 'c-4', name: 'BU 19', active: true },
  { id: 'c-5', name: 'FG ROLL PM 1', active: true },
  { id: 'c-6', name: 'BU 17', active: true },
];

// Data stok dikosongkan terlebih dahulu sesuai instruksi
export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_STOCKS: StockItem[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

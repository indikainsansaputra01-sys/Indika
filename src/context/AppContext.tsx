import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, runTransaction, getDoc, writeBatch, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Employee,
  Transaction,
  StockItem,
  AuditLog,
  StockThresholdConfig,
  MasterPalletSize,
  MasterPalletType,
  MasterCustomer,
  ShiftType,
  MarketType,
  TransactionType,
  QuantityUnit,
  PalletSideType,
  ThemeMode
} from '../types';
import {
  INITIAL_EMPLOYEES,
  INITIAL_TRANSACTIONS,
  INITIAL_STOCKS,
  INITIAL_AUDIT_LOGS,
  INITIAL_MASTER_SIZES,
  INITIAL_MASTER_TYPES,
  INITIAL_MASTER_CUSTOMERS
} from '../utils/seedData';
import { normalizePalletDimension, isAllowed115x140Spec } from '../utils/dimensionUtils';

interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface AppContextType {
  currentUser: Employee | null;
  isOperator: boolean; // True for Indika, Agus, Harun, Riffky
  isAdmin: boolean; // True for Indika or accounts with isAdmin: true
  canEdit: boolean; // True for operators
  login: (nameOrId: string, password?: string) => { success: boolean; message?: string };
  logout: () => void;
  activeShift: ShiftType;
  setActiveShift: (shift: ShiftType) => void;
  
  // Theme Management (Mode Gelap / Terang)
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  
  // Data
  transactions: Transaction[];
  stocks: StockItem[];
  employees: Employee[];
  masterSizes: MasterPalletSize[];
  masterTypes: MasterPalletType[];
  masterCustomers: MasterCustomer[];
  auditLogs: AuditLog[];
  thresholds: StockThresholdConfig;
  notifications: ToastNotification[];
  removeNotification: (id: string) => void;
  showNotification: (type: ToastNotification['type'], title: string, message: string) => void;

  // Transaction Operations
  addTransaction: (data: {
    transactionType: TransactionType;
    date: string;
    time: string;
    palletSize: string;
    palletType: string;
    typePallet?: PalletSideType;
    customer: string;
    shift: ShiftType;
    marketType: MarketType;
    quantity: number;
    unit: QuantityUnit;
    pelatakanPallet?: string;
    kolomTujuan?: string;
    noRun?: string;
    operator: string;
  }) => Promise<{ success: boolean; message: string; currentStock?: number; createdTx?: Transaction }>;

  convertPalletSpec: (params: {
    date: string;
    time?: string;
    shift: ShiftType;
    palletSize: string;
    sourcePalletType: string;
    targetPalletType: string;
    typePallet?: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    quantity: number;
    kolomAsal: string;
    kolomTujuan?: string;
    operator: string;
    notes?: string;
  }) => Promise<{ success: boolean; message: string; remainingSourceStock?: number; targetStock?: number }>;

  deleteTransaction: (id: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  editTransaction: (
    id: string,
    updated: Partial<Transaction> & { siblingIdsToDelete?: string[] },
    revisionReason?: string
  ) => Promise<{ success: boolean; message: string }>;

  // Stock Queries
  getStock: (
    palletSize: string,
    palletType: string,
    marketType: MarketType,
    unit?: QuantityUnit,
    typePallet?: PalletSideType
  ) => number;
  getStockStatus: (quantity: number) => 'AMAN' | 'PERHATIAN' | 'KRITIS';
  updateThresholds: (cfg: StockThresholdConfig) => void;

  // Stock Operations & Revisions
  reviseStock: (params: {
    palletSize: string;
    palletType: string;
    typePallet?: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    newQuantity: number;
    reason?: string;
  }) => Promise<{ success: boolean; message: string }>;

  // Master Data Operations
  addMasterSize: (name: string, description?: string) => void;
  toggleMasterSize: (id: string) => void;
  deleteMasterSize: (id: string) => void;

  addMasterType: (name: string) => void;
  toggleMasterType: (id: string) => void;
  deleteMasterType: (id: string) => void;

  addMasterCustomer: (name: string) => void;
  toggleMasterCustomer: (id: string) => void;
  deleteMasterCustomer: (id: string) => void;

  // Employee & Security Management
  addEmployee: (
    nameOrData: string | {
      name: string;
      role: Employee['role'];
      title: string;
      password?: string;
      isAdmin?: boolean;
      shiftPreference?: ShiftType;
      avatarVariant?: Employee['avatarVariant'];
    },
    legacyRole?: Employee['role'],
    legacyTitle?: string,
    legacyPassword?: string
  ) => Promise<{ success: boolean; message: string }>;
  updateEmployee: (id: string, updated: Partial<Employee>) => Promise<{ success: boolean; message: string }>;
  deleteEmployee: (id: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (
    employeeId: string,
    newPassword: string,
    oldPassword?: string
  ) => Promise<{ success: boolean; message: string }>;
  toggleEmployee: (id: string) => void;

  // System
  resetDemoData: (operatorPassword?: string) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

import { getOperationalShift } from '../utils/shiftReportUtils';

export const detectCurrentShift = (): ShiftType => {
  return getOperationalShift();
};

const STORAGE_KEYS = {
  USER: 'fpms_current_user_v3',
  USER_SESSION: 'fpms_session_user_v4',
  TRANSACTIONS: 'fpms_transactions_v3',
  STOCKS: 'fpms_stocks_v3',
  EMPLOYEES: 'fpms_employees_v3',
  SIZES: 'fpms_sizes_v3',
  TYPES: 'fpms_types_v3',
  CUSTOMERS: 'fpms_customers_v3',
  AUDIT: 'fpms_audit_v3',
  THRESHOLDS: 'fpms_thresholds_v3',
  THEME: 'fpms_theme_mode'
};

/**
 * Merges stock items by canonical specification:
 * normalized size, typePallet (LS/SS), palletType, marketType, and unit.
 * Sums duplicate quantities and prunes zero-quantity or duplicate documents.
 */
export function consolidateStocks(rawStocks: StockItem[]): {
  consolidated: StockItem[];
  duplicatesToPrune: string[];
  canonicalUpdates: StockItem[];
} {
  const map = new Map<string, StockItem>();
  const duplicatesToPrune: string[] = [];
  const canonicalUpdates: StockItem[] = [];

  if (!Array.isArray(rawStocks)) {
    return {
      consolidated: [],
      duplicatesToPrune: [],
      canonicalUpdates: []
    };
  }

  for (const item of rawStocks) {
    if (!item) continue;
    const normSize = normalizePalletDimension(item.palletSize);
    if (!normSize) continue;

    const typePallet = (item.typePallet ? String(item.typePallet).trim() : 'LS') as PalletSideType;
    const cleanType = item.palletType ? String(item.palletType).trim() : 'Pallet Reamwrap';
    const market = (item.marketType ? String(item.marketType).trim() : 'Lokal') as MarketType;
    const unit = (item.unit ? String(item.unit).trim() : 'Set') as QuantityUnit;
    const rawQty = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 0;
    const canonicalKey = `${normSize}__${typePallet}__${cleanType.toLowerCase()}__${market.toLowerCase()}__${unit.toLowerCase()}`;
    const canonicalDocId = `stk_${normSize}_${typePallet}_${cleanType}_${market}_${unit}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    const effectiveQty = Math.max(0, rawQty);

    if (map.has(canonicalKey)) {
      const existing = map.get(canonicalKey)!;
      existing.quantity += effectiveQty;
      if (item.lastUpdated && (!existing.lastUpdated || item.lastUpdated > existing.lastUpdated)) {
        existing.lastUpdated = item.lastUpdated;
      }
      canonicalUpdates.push(existing);
      if (item.id && item.id !== canonicalDocId) {
        duplicatesToPrune.push(item.id);
      }
    } else {
      const cleanItem: StockItem = {
        ...item,
        id: canonicalDocId,
        palletSize: normSize,
        palletType: cleanType,
        typePallet,
        marketType: market,
        unit,
        quantity: effectiveQty
      };
      map.set(canonicalKey, cleanItem);
      if (item.id && item.id !== canonicalDocId) {
        duplicatesToPrune.push(item.id);
        canonicalUpdates.push(cleanItem);
      }
    }
  }

  // Sesuai permintaan user: stok 0 tetap dipertahankan agar tetap muncul saat dicari
  const finalActiveList = Array.from(map.values());

  return {
    consolidated: finalActiveList,
    duplicatesToPrune,
    canonicalUpdates
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Current logged in user (Persistent login stored in localStorage; preserved unless employee logs out)
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      // 1. If URL explicitly contains ?logout=1, clear session
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('logout') === '1') {
          sessionStorage.removeItem(STORAGE_KEYS.USER_SESSION);
          localStorage.removeItem(STORAGE_KEYS.USER);
          return null;
        }
      }

      // 2. Check localStorage for persistent saved login
      const savedLocal = localStorage.getItem(STORAGE_KEYS.USER);
      if (savedLocal && savedLocal !== 'null' && savedLocal !== 'undefined') {
        const parsed = JSON.parse(savedLocal);
        if (parsed && parsed.id && parsed.name) {
          if (parsed.name.toLowerCase() === 'indika') {
            parsed.isAdmin = true;
          }
          return parsed;
        }
      }

      // 3. Fallback to sessionStorage if available
      const savedSession = sessionStorage.getItem(STORAGE_KEYS.USER_SESSION);
      if (savedSession && savedSession !== 'null' && savedSession !== 'undefined') {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.id && parsed.name) {
          if (parsed.name.toLowerCase() === 'indika') {
            parsed.isAdmin = true;
          }
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeShift, setActiveShift] = useState<ShiftType>(detectCurrentShift());

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const list: Transaction[] = saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
      return list.map(t => ({ ...t, typePallet: t.typePallet || 'LS' }));
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [stocks, setStocks] = useState<StockItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCKS);
      const list: StockItem[] = saved ? JSON.parse(saved) : INITIAL_STOCKS;
      return list.map(s => ({ ...s, typePallet: s.typePallet || 'LS' }));
    } catch {
      return INITIAL_STOCKS;
    }
  });

  const [masterSizes, setMasterSizes] = useState<MasterPalletSize[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SIZES);
      return saved !== null ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [masterTypes, setMasterTypes] = useState<MasterPalletType[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TYPES);
      if (saved) {
        const parsed = JSON.parse(saved) as MasterPalletType[];
        if (Array.isArray(parsed)) {
          const hasSirkulasi = parsed.some(
            t => t.name.toLowerCase() === 'pallet sirkulasi'
          );
          if (!hasSirkulasi) {
            parsed.push({ id: 't-4', name: 'Pallet Sirkulasi', active: true });
          }
          return parsed;
        }
      }
      return INITIAL_MASTER_TYPES;
    } catch {
      return INITIAL_MASTER_TYPES;
    }
  });

  const [masterCustomers, setMasterCustomers] = useState<MasterCustomer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      const list: MasterCustomer[] = saved ? JSON.parse(saved) : INITIAL_MASTER_CUSTOMERS;
      if (Array.isArray(list)) {
        if (!list.some(c => c.name.toLowerCase() === 'bu19(order finishing)')) {
          list.push({ id: 'c-bu19-ord', name: 'BU19(Order Finishing)', active: true });
        }
        if (!list.some(c => c.name.toLowerCase() === 'finishing sheet(pd1)')) {
          list.push({ id: 'c-fs-pd1', name: 'Finishing Sheet(PD1)', active: true });
        }
        return list;
      }
      return INITIAL_MASTER_CUSTOMERS;
    } catch {
      return INITIAL_MASTER_CUSTOMERS;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  const [thresholds, setThresholds] = useState<StockThresholdConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THRESHOLDS);
      return saved ? JSON.parse(saved) : { safeMin: 20, warningMin: 10, criticalMax: 9 };
    } catch {
      return { safeMin: 20, warningMin: 10, criticalMax: 9 };
    }
  });

  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  // Theme Mode (Dark / Light mode - selectable anytime independent of shift)
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  // Persistent storage for currentUser (stored in both localStorage and sessionStorage)
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
        sessionStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
        sessionStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
  }, [stocks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIZES, JSON.stringify(masterSizes));
  }, [masterSizes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TYPES, JSON.stringify(masterTypes));
  }, [masterTypes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(masterCustomers));
  }, [masterCustomers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(thresholds));
  }, [thresholds]);

  // Real-time synchronization with Firestore across all factory devices
  useEffect(() => {
    // 1. Transactions Listener
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const remoteTxs: Transaction[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as Transaction;
        remoteTxs.push({
          ...item,
          id: d.id,
          palletSize: normalizePalletDimension(item.palletSize),
          typePallet: item.typePallet || 'LS'
        });
      });
      remoteTxs.sort((a, b) => (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time));
      setTransactions(remoteTxs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    // 2. Stocks Listener: Consolidates canonical dimensions and eliminates split/duplicate/zero stock items
    const unsubStocks = onSnapshot(collection(db, 'stocks'), (snapshot) => {
      const remoteStocks: StockItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as StockItem;
        remoteStocks.push({
          ...item,
          id: d.id,
          palletSize: normalizePalletDimension(item.palletSize),
          typePallet: item.typePallet || 'LS'
        });
      });

      const { consolidated, duplicatesToPrune, canonicalUpdates } = consolidateStocks(remoteStocks);
      setStocks(consolidated);

      // Self-heal Firestore asynchronously: update canonical doc and remove obsolete duplicates / zeroed docs
      if (canonicalUpdates.length > 0) {
        canonicalUpdates.forEach((canon) => {
          setDoc(doc(db, 'stocks', canon.id), cleanFirestoreData(canon), { merge: true }).catch(() => {});
        });
      }
      if (duplicatesToPrune.length > 0) {
        duplicatesToPrune.forEach((dupId) => {
          deleteDoc(doc(db, 'stocks', dupId)).catch(() => {});
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stocks');
    });

    // 3. Audit Logs Listener
    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
      const remoteLogs: AuditLog[] = [];
      snapshot.forEach((d) => {
        remoteLogs.push({ ...d.data(), id: d.id } as AuditLog);
      });
      remoteLogs.sort((a, b) => (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time));
      setAuditLogs(remoteLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auditLogs');
    });

    // 4. Master Sizes Listener
    const unsubSizes = onSnapshot(collection(db, 'masterSizes'), (snapshot) => {
      const remoteSizes: MasterPalletSize[] = [];
      snapshot.forEach((d) => {
        remoteSizes.push({ ...d.data(), id: d.id } as MasterPalletSize);
      });
      setMasterSizes(remoteSizes);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'masterSizes');
    });

    // 5. Master Types Listener
    const unsubTypes = onSnapshot(collection(db, 'masterTypes'), (snapshot) => {
      if (!snapshot.empty) {
        const remoteTypes: MasterPalletType[] = [];
        snapshot.forEach((d) => {
          remoteTypes.push({ ...d.data(), id: d.id } as MasterPalletType);
        });
        const hasSirkulasi = remoteTypes.some(
          t => t.name.toLowerCase() === 'pallet sirkulasi'
        );
        if (!hasSirkulasi) {
          const sirkulasiObj: MasterPalletType = { id: 't-4', name: 'Pallet Sirkulasi', active: true };
          remoteTypes.push(sirkulasiObj);
          setDoc(doc(db, 'masterTypes', 't-4'), sirkulasiObj).catch(() => {});
        }
        setMasterTypes(remoteTypes);
      } else {
        // Seed initial types online
        INITIAL_MASTER_TYPES.forEach((t) => {
          setDoc(doc(db, 'masterTypes', t.id), t).catch(() => {});
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'masterTypes');
    });

    // 6. Master Customers Listener
    const unsubCustomers = onSnapshot(collection(db, 'masterCustomers'), (snapshot) => {
      if (!snapshot.empty) {
        const remoteCustomers: MasterCustomer[] = [];
        snapshot.forEach((d) => {
          remoteCustomers.push({ ...d.data(), id: d.id } as MasterCustomer);
        });
        setMasterCustomers(remoteCustomers);
      } else {
        // Seed initial customers online
        INITIAL_MASTER_CUSTOMERS.forEach((c) => {
          setDoc(doc(db, 'masterCustomers', c.id), c).catch(() => {});
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'masterCustomers');
    });

    // 7. System Config Listener
    const unsubConfig = onSnapshot(collection(db, 'systemConfig'), (snapshot) => {
      if (!snapshot.empty) {
        snapshot.forEach((d) => {
          if (d.id === 'main') {
            const data = d.data() as StockThresholdConfig;
            setThresholds(data);
          }
        });
      } else {
        setDoc(doc(db, 'systemConfig', 'main'), {
          safeMin: 20,
          warningMin: 10,
          criticalMax: 9,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'systemConfig');
    });

    // 8. Employees Listener (Realtime sync for passwords, staff additions/removals across devices)
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      if (!snapshot.empty) {
        const remoteEmployees: Employee[] = [];
        snapshot.forEach((d) => {
          const emp = d.data() as Employee;
          if (emp.name.toLowerCase() === 'indika') {
            emp.isAdmin = true;
          }

          const lowerName = emp.name.toLowerCase();
          // Pastikan varian avatar terpasang sesuai ketentuan terbaru:
          // - Kulit sawo matang Indonesia usia ~25 tahun
          // - Indika: Berkacamata + Helm Kuning
          // - Syafa (laki-laki), Fauzan, Ahmad Muhlas: Helm Putih
          // - Agus, Riffky, Harun: Helm Kuning
          const validVariants = ['indika_glasses', 'operator_yellow', 'officer_white_1', 'officer_white_2'];
          if (!emp.avatarVariant || !validVariants.includes(emp.avatarVariant) || (lowerName.includes('indika') && emp.avatarVariant !== 'indika_glasses')) {
            if (lowerName.includes('indika')) {
              emp.avatarVariant = 'indika_glasses';
            } else if (lowerName.includes('syafa') || lowerName.includes('fauzan') || emp.role === 'officer' || emp.role === 'leadershift') {
              emp.avatarVariant = 'officer_white_1';
            } else if (lowerName.includes('muhlas') || lowerName.includes('ahmad') || emp.role === 'spv') {
              emp.avatarVariant = 'officer_white_2';
            } else {
              emp.avatarVariant = 'operator_yellow';
            }
            setDoc(doc(db, 'employees', d.id), { avatarVariant: emp.avatarVariant }, { merge: true }).catch(() => {});
          }

          remoteEmployees.push({ ...emp, id: d.id });
        });
        setEmployees(remoteEmployees);
        setCurrentUser((prevUser) => {
          if (!prevUser) return null;
          const matched = remoteEmployees.find(
            (e) => e.id === prevUser.id || e.name.toLowerCase() === prevUser.name.toLowerCase()
          );
          if (matched) {
            return {
              ...matched,
              isAdmin: matched.isAdmin || matched.name.toLowerCase() === 'indika'
            };
          }
          return prevUser;
        });
      } else {
        // Seed initial employees to Firestore
        INITIAL_EMPLOYEES.forEach((emp) => {
          setDoc(doc(db, 'employees', emp.id), emp).catch(() => {});
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'employees');
    });

    return () => {
      unsubTx();
      unsubStocks();
      unsubAudit();
      unsubSizes();
      unsubTypes();
      unsubCustomers();
      unsubConfig();
      unsubEmployees();
    };
  }, []);



  // Helper to recursively remove undefined fields so Firestore never rejects data
  const cleanFirestoreData = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(cleanFirestoreData);
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
          result[key] = cleanFirestoreData(value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  };

  // Helper for Firestore mutations
  const syncToFirestore = async (col: string, docId: string, data: any) => {
    try {
      await setDoc(doc(db, col, docId), cleanFirestoreData(data));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${col}/${docId}`);
    }
  };

  const deleteFromFirestore = async (col: string, docId: string) => {
    try {
      await deleteDoc(doc(db, col, docId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${col}/${docId}`);
    }
  };

  // Operator and Admin roles check: Indika has both Operator + Admin
  const isOperator = Boolean(
    currentUser?.role === 'operator' ||
    currentUser?.name?.toLowerCase() === 'indika' ||
    currentUser?.isAdmin ||
    currentUser?.role === 'admin'
  );
  const isAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.name?.toLowerCase() === 'indika' ||
    currentUser?.role === 'admin'
  );
  const canEdit = Boolean(isOperator || isAdmin);

  const showNotification = (type: ToastNotification['type'], title: string, message: string) => {
    const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setNotifications(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /**
   * Login method supporting individual passwords:
   * Defaults:
   * - Indika: Indika581196 (Operator & Admin)
   * - Agus: Agus777
   * - Riffky: Riffky777
   * - Harun: Harun777
   * - Monitoring (Syafa, Fauzan, Ahmad Muhlas): Monitoring123
   * Custom passwords updated via Master Karyawan are honored!
   */
  const login = (nameOrId: string, password = ''): { success: boolean; message?: string } => {
    const cleanInput = nameOrId.trim().toLowerCase();
    const emp = employees.find(
      e =>
        e.name.toLowerCase() === cleanInput ||
        e.id.toLowerCase() === cleanInput ||
        ((cleanInput === 'ahmad muhlas' || cleanInput === 'pak muhlas' || cleanInput === 'muhlas') &&
          e.name.toLowerCase().includes('muhlas'))
    );

    if (!emp || !emp.active) {
      showNotification('error', 'Login Gagal', 'Nama karyawan tidak terdaftar atau non-aktif di sistem.');
      return { success: false, message: 'Nama tidak ditemukan dalam daftar personil aktif.' };
    }

    const isOperatorUser = emp.role === 'operator';
    const OPERATOR_PASSWORDS: Record<string, string> = {
      'indika': 'Indika581196',
      'agus': 'Agus777',
      'riffky': 'Riffky777',
      'harun': 'Harun777'
    };

    const defaultPass = isOperatorUser 
      ? (OPERATOR_PASSWORDS[emp.name.toLowerCase().trim()] || `${emp.name}777`)
      : 'Monitoring123';

    // Prioritize stored employee password if set, otherwise fallback to default
    const expectedPassword = emp.password || defaultPass;

    const trimmedInputPass = (password || '').trim();
    const isValid = trimmedInputPass === expectedPassword || 
      trimmedInputPass.toLowerCase() === expectedPassword.toLowerCase();

    if (!isValid) {
      showNotification('error', 'Sandi Salah', 'Kata sandi tidak sesuai. Silakan periksa kembali kata sandi Anda.');
      return { success: false, message: 'Kata sandi tidak sesuai.' };
    }

    // Indika is automatically guaranteed Admin privileges
    const userToSet: Employee = {
      ...emp,
      isAdmin: emp.isAdmin || emp.name.toLowerCase() === 'indika',
      password: expectedPassword
    };

    setCurrentUser(userToSet);
    const now = new Date();
    const newLog: AuditLog = {
      id: 'aud-' + Date.now(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().substring(0, 5),
      userName: userToSet.name,
      employeeId: userToSet.id,
      activity: 'Login Sistem',
      dataBefore: '-',
      dataAfter: `User ${userToSet.name} (${userToSet.title}) login ke sistem [${userToSet.isAdmin ? 'Admin Full Access' : isOperatorUser ? 'Operator' : 'Monitoring'}]`
    };
    setAuditLogs(prev => [newLog, ...prev]);
    syncToFirestore('auditLogs', newLog.id, newLog);

    showNotification(
      'success',
      'Login Berhasil',
      `Selamat datang, ${userToSet.name} · ${userToSet.title} [${userToSet.isAdmin ? 'Hak Akses Admin & Operator' : isOperatorUser ? 'Akses Operator (Edit)' : 'Mode Monitoring'}]`
    );
    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      const now = new Date();
      const newLog: AuditLog = {
        id: 'aud-' + Date.now(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().substring(0, 5),
        userName: currentUser.name,
        employeeId: currentUser.id,
        activity: 'Logout',
        dataBefore: '-',
        dataAfter: `User ${currentUser.name} logout dari sistem`
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
    try {
      sessionStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem('fpms_current_user_v3');
    } catch {
      // ignore
    }
    setCurrentUser(null);
    showNotification('info', 'Sesi Berakhir', 'Anda telah keluar dari sistem.');
  };

  const isMatchingStock = (
    item: StockItem,
    size: string,
    type: string,
    market: MarketType,
    unit?: QuantityUnit,
    typePallet?: PalletSideType
  ) => {
    if (!item) return false;
    const itemTypePallet = item.typePallet || 'LS';
    const matchTypePallet = !typePallet || itemTypePallet === typePallet;
    const itemPalletType = item.palletType ? String(item.palletType).trim().toLowerCase() : '';
    const targetType = type ? String(type).trim().toLowerCase() : '';
    const itemMarket = item.marketType ? String(item.marketType).trim().toLowerCase() : '';
    const targetMarket = market ? String(market).trim().toLowerCase() : '';

    const matchBase =
      normalizePalletDimension(item.palletSize) === normalizePalletDimension(size) &&
      itemPalletType === targetType &&
      itemMarket === targetMarket &&
      matchTypePallet;
    
    if (unit) {
      return matchBase && item.unit === unit;
    }
    return matchBase;
  };

  const getStock = (
    palletSize: string,
    palletType: string,
    marketType: MarketType,
    unit?: QuantityUnit,
    typePallet?: PalletSideType
  ): number => {
    const normSize = normalizePalletDimension(palletSize);
    if (!normSize) return 0;

    const cleanPalletType = palletType ? String(palletType).trim().toLowerCase().replace(/^pallet\s+/i, '') : '';
    const cleanTypePallet = typePallet || 'LS';

    // 1. Akumulasi dari seluruh matching record di state stocks (bukan cuma find pertama!)
    const matchingStocks = stocks.filter(s => s && isMatchingStock(s, normSize, palletType, marketType, unit, cleanTypePallet));
    const stockSum = matchingStocks.reduce((sum, s) => sum + (typeof s.quantity === 'number' && !isNaN(s.quantity) ? s.quantity : 0), 0);

    // 2. Akumulasi dari ground-truth riwayat transaksi (Penerimaan - Pengeluaran - Ubah Spek)
    const normMkt = (marketType ? String(marketType).trim().toLowerCase() : 'lokal').replace(/^export$/, 'ekspor');
    const txs = transactions.filter(t => {
      if (!t) return false;
      const tNormSize = normalizePalletDimension(t.palletSize);
      const tTypePallet = t.typePallet || 'LS';
      const tPalletType = t.palletType ? String(t.palletType).trim().toLowerCase().replace(/^pallet\s+/i, '') : '';
      const tMarket = (t.marketType ? String(t.marketType).trim().toLowerCase() : 'lokal').replace(/^export$/, 'ekspor');

      if (tNormSize !== normSize) return false;
      if (tTypePallet !== cleanTypePallet) return false;
      if (tPalletType !== cleanPalletType) return false;
      if (tMarket !== normMkt) return false;
      if (unit && t.unit && t.unit.toLowerCase() !== unit.toLowerCase()) return false;
      return true;
    });

    let txNet = 0;
    if (txs.length > 0) {
      const inQty = txs.filter(t => t.transactionType === 'PENERIMAAN').reduce((acc, t) => acc + (typeof t.quantity === 'number' ? t.quantity : 0), 0);
      const outQty = txs.filter(t => t.transactionType === 'PENGELUARAN').reduce((acc, t) => acc + (typeof t.quantity === 'number' ? t.quantity : 0), 0);
      const changeOutQty = txs.filter(t => t.transactionType === 'UBAH_SPEK').reduce((acc, t) => acc + (typeof t.quantity === 'number' ? t.quantity : 0), 0);
      txNet = Math.max(0, inQty - outQty - changeOutQty);
    }

    return Math.max(stockSum, txNet);
  };

  const getStockStatus = (quantity: number): 'AMAN' | 'PERHATIAN' | 'KRITIS' => {
    if (quantity >= thresholds.safeMin) return 'AMAN';
    if (quantity >= thresholds.warningMin) return 'PERHATIAN';
    return 'KRITIS';
  };

  // Add Transaction with Atomic Firestore Transaction (prevents negative stock & race conditions)
  const addTransaction = async (data: {
    transactionType: TransactionType;
    date: string;
    time: string;
    palletSize: string;
    palletType: string;
    typePallet?: PalletSideType;
    customer: string;
    shift: ShiftType;
    marketType: MarketType;
    quantity: number;
    unit: QuantityUnit;
    pelatakanPallet?: string;
    kolomTujuan?: string;
    noRun?: string;
    operator: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; currentStock?: number }> => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator (Indika, Agus, Harun, Riffky) yang dapat menambah transaksi. Akun Anda berada dalam mode Monitoring.');
      return { success: false, message: 'Hanya Operator yang dapat menginput transaksi.' };
    }

    const cleanSize = normalizePalletDimension(data.palletSize);
    const cleanType = data.palletType.trim();
    const cleanTypePallet: PalletSideType = data.typePallet || 'LS';
    const cleanCustomer = data.customer.trim();
    const cleanOperator = data.operator.trim();
    const qty = Number(data.quantity);
    const unit = data.unit;

    if (!cleanSize || !cleanType || !cleanCustomer || !cleanOperator) {
      showNotification('error', 'Validasi Gagal', 'Semua field wajib diisi kecuali catatan.');
      return { success: false, message: 'Semua field wajib diisi kecuali catatan.' };
    }

    if (isNaN(qty) || qty <= 0) {
      showNotification('error', 'Validasi Gagal', 'Quantity harus lebih dari 0.');
      return { success: false, message: 'Quantity harus lebih dari 0.' };
    }

    const dateCompact = data.date.replace(/-/g, '');
    const prefix = data.transactionType === 'PENERIMAAN'
      ? 'IN'
      : data.transactionType === 'PINDAH_KOLOM'
      ? 'MOV'
      : 'OUT';
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const txNumber = `${prefix}-${dateCompact}-${randomSeq}`;
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${uniqueSuffix}`,
      transactionNumber: txNumber,
      transactionType: data.transactionType,
      date: data.date,
      time: data.time || new Date().toTimeString().substring(0, 5),
      palletSize: cleanSize,
      palletType: cleanType,
      typePallet: cleanTypePallet,
      customer: cleanCustomer,
      shift: data.shift,
      marketType: data.marketType,
      quantity: qty,
      unit: unit,
      pelatakanPallet: data.pelatakanPallet?.trim() || '',
      ...(data.kolomTujuan && data.kolomTujuan.trim() ? { kolomTujuan: data.kolomTujuan.trim() } : {}),
      ...(data.noRun && data.noRun.trim() ? { noRun: data.noRun.trim() } : {}),
      operator: cleanOperator,
      operatorId: currentUser ? currentUser.id : 'OP-01',
      notes: data.notes?.trim() || '',
      createdBy: currentUser ? currentUser.name : cleanOperator,
      createdAt: new Date().toISOString()
    };

    const stockDocId = `stk_${cleanSize}_${cleanTypePallet}_${cleanType}_${data.marketType}_${unit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const stockRef = doc(db, 'stocks', stockDocId);
    const txRef = doc(db, 'transactions', newTx.id);
    const auditId = `aud-${Date.now()}-${uniqueSuffix}`;
    const auditRef = doc(db, 'auditLogs', auditId);

    let finalStockCount = 0;

    try {
      // Atomic Cloud Firestore Transaction
      await runTransaction(db, async (t) => {
        const stockDoc = await t.get(stockRef);
        let currentQty = 0;
        if (stockDoc.exists()) {
          const s = stockDoc.data() as StockItem;
          currentQty = typeof s.quantity === 'number' ? s.quantity : 0;
        }

        // Akumulasi ground truth dari transaksi agar pengeluaran dari 2 kolom atau lebih (contoh F12: 50, F9: 45 = 95) tidak terblokir
        const normTargetMarket = (data.marketType ? String(data.marketType).trim().toLowerCase() : 'lokal').replace(/^export$/, 'ekspor');
        const matchTxs = transactions.filter(tr => {
          if (!tr) return false;
          const trSize = normalizePalletDimension(tr.palletSize);
          const trTypePallet = tr.typePallet || 'LS';
          const trType = tr.palletType ? String(tr.palletType).trim().toLowerCase().replace(/^pallet\s+/i, '') : '';
          const trMarket = (tr.marketType ? String(tr.marketType).trim().toLowerCase() : 'lokal').replace(/^export$/, 'ekspor');

          return (
            trSize === cleanSize &&
            trTypePallet === cleanTypePallet &&
            trType === cleanType.toLowerCase().replace(/^pallet\s+/i, '') &&
            trMarket === normTargetMarket &&
            tr.unit === unit
          );
        });
        const inSum = matchTxs.filter(tr => tr.transactionType === 'PENERIMAAN').reduce((acc, tr) => acc + (typeof tr.quantity === 'number' ? tr.quantity : 0), 0);
        const outSum = matchTxs.filter(tr => tr.transactionType === 'PENGELUARAN').reduce((acc, tr) => acc + (typeof tr.quantity === 'number' ? tr.quantity : 0), 0);
        const specSum = matchTxs.filter(tr => tr.transactionType === 'UBAH_SPEK').reduce((acc, tr) => acc + (typeof tr.quantity === 'number' ? tr.quantity : 0), 0);
        const netTx = Math.max(0, inSum - outSum - specSum);

        if (netTx > currentQty) {
          currentQty = netTx;
        }

        if (data.transactionType === 'PENGELUARAN') {
          if (qty > currentQty) {
            throw new Error(`STOK_KURANG:${currentQty}`);
          }
          finalStockCount = currentQty - qty;
        } else if (data.transactionType === 'PINDAH_KOLOM') {
          // Relokasi tidak mengubah total stok fisik pallet
          finalStockCount = currentQty;
        } else {
          finalStockCount = currentQty + qty;
        }

        // 1. Simpan Transaksi ke Cloud (dibersihkan dari undefined)
        t.set(txRef, cleanFirestoreData(newTx));

        // 2. Perbarui Saldo Stok Terpusat di Cloud (jika bukan relokasi)
        t.set(stockRef, {
          id: stockDocId,
          palletSize: cleanSize,
          palletType: cleanType,
          typePallet: cleanTypePallet,
          marketType: data.marketType,
          unit: unit,
          quantity: finalStockCount,
          lastUpdated: data.date
        });

        // 3. Catat Audit Log di Cloud
        const auditLog: AuditLog = {
          id: auditId,
          date: data.date,
          time: data.time || new Date().toTimeString().substring(0, 5),
          userName: currentUser ? currentUser.name : cleanOperator,
          employeeId: currentUser ? currentUser.id : 'OP-SYS',
          activity: data.transactionType === 'PENERIMAAN'
            ? 'Input Penerimaan'
            : data.transactionType === 'PINDAH_KOLOM'
            ? 'Pindah Kolom / Relokasi'
            : 'Input Pengeluaran',
          dataBefore: data.transactionType === 'PINDAH_KOLOM'
            ? `Kolom Asal: ${data.pelatakanPallet || '-'} (${qty} ${unit})`
            : `Stok Awal: ${currentQty} ${unit}`,
          dataAfter: data.transactionType === 'PINDAH_KOLOM'
            ? `${txNumber}: Pindah ke ${data.kolomTujuan || '-'} (${qty} ${unit}) [Total Stok: ${currentQty} ${unit}]`
            : `${txNumber}: ${cleanSize} [${cleanTypePallet}] ${cleanType} ${data.marketType} (${qty} ${unit}) -> Saldo: ${finalStockCount} ${unit}`
        };
        t.set(auditRef, cleanFirestoreData(auditLog));
      });

      // Optimistic fallback update, listener onSnapshot will immediately reconcile
      setTransactions(prev => [newTx, ...prev.filter(x => x.id !== newTx.id)]);
      setStocks(prev => {
        const idx = prev.findIndex(s => isMatchingStock(s, cleanSize, cleanType, data.marketType, unit, cleanTypePallet));
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = { ...cp[idx], quantity: finalStockCount, typePallet: cleanTypePallet, lastUpdated: data.date };
          return cp;
        }
        return [...prev, {
          id: stockDocId,
          palletSize: cleanSize,
          palletType: cleanType,
          typePallet: cleanTypePallet,
          marketType: data.marketType,
          unit: unit,
          quantity: finalStockCount,
          lastUpdated: data.date
        }];
      });

      if (data.transactionType === 'PINDAH_KOLOM') {
        showNotification(
          'success',
          'RELOKASI KOLOM BERHASIL',
          `Pallet ${cleanSize} (${qty} ${unit}) berhasil dipindahkan dari ${data.pelatakanPallet} ke ${data.kolomTujuan}. Total stok aman: ${finalStockCount} ${unit}.`
        );
      } else if (finalStockCount <= thresholds.criticalMax) {
        showNotification(
          'warning',
          'PERINGATAN STOK KRITIS',
          `Stok pallet ${cleanSize} (${cleanTypePallet} - ${cleanType} - ${data.marketType} - ${unit}) saat ini hanya tersisa ${finalStockCount} ${unit}!`
        );
      } else {
        const successMsg = data.transactionType === 'PENERIMAAN'
          ? `Penerimaan pallet berhasil disimpan ke cloud. Sisa stok: ${finalStockCount} ${unit}.`
          : `Pengeluaran pallet berhasil disimpan ke cloud. Sisa stok: ${finalStockCount} ${unit}.`;
        showNotification('success', 'TRANSAKSI BERHASIL', successMsg);
      }

      return {
        success: true,
        message: data.transactionType === 'PINDAH_KOLOM'
          ? `Pallet berhasil dipindahkan dari ${data.pelatakanPallet} ke ${data.kolomTujuan}.`
          : data.transactionType === 'PENERIMAAN'
          ? 'Penerimaan pallet berhasil disimpan.'
          : 'Pengeluaran pallet berhasil disimpan.',
        currentStock: finalStockCount,
        createdTx: newTx
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.startsWith('STOK_KURANG:')) {
        const actual = Number(errMsg.split(':')[1]) || 0;
        showNotification(
          'error',
          'STOK TIDAK MENCUKUPI',
          `Stok di server untuk ${cleanSize} (${cleanType} - ${data.marketType} - ${unit}) saat ini hanya ${actual} ${unit}. Permintaan pengeluaran ${qty} ${unit} ditolak.`
        );
        return {
          success: false,
          message: `STOK TIDAK MENCUKUPI. Stok di server saat ini hanya tersisa ${actual} ${unit}.`,
          currentStock: actual
        };
      }

      console.error('Firestore Atomic Transaction Error: ', err);
      showNotification('error', 'GAGAL MENYIMPAN KE CLOUD', 'Database menolak transaksi: ' + errMsg);
      return {
        success: false,
        message: 'Gagal menyimpan transaksi ke database cloud: ' + errMsg
      };
    }
  };

  const convertPalletSpec = async (params: {
    date: string;
    time?: string;
    shift: ShiftType;
    palletSize: string;
    sourcePalletType: string;
    targetPalletType: string;
    typePallet?: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    quantity: number;
    kolomAsal: string;
    kolomTujuan?: string;
    operator: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; remainingSourceStock?: number; targetStock?: number }> => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat melakukan perubahan spesifikasi pallet.');
      return { success: false, message: 'Hanya Operator yang dapat melakukan perubahan spek.' };
    }

    const cleanSize = normalizePalletDimension(params.palletSize);
    const sourcePalletType = params.sourcePalletType.trim();
    const targetPalletType = params.targetPalletType.trim();
    const cleanTypePallet: PalletSideType = params.typePallet || 'LS';
    const cleanOperator = params.operator.trim();
    const qty = Number(params.quantity);
    const unit = params.unit;
    const kolomAsal = params.kolomAsal.trim();
    const kolomTujuan = (params.kolomTujuan && params.kolomTujuan.trim()) ? params.kolomTujuan.trim() : kolomAsal;

    if (!cleanSize || !sourcePalletType || !targetPalletType || !cleanOperator || !kolomAsal) {
      showNotification('error', 'Validasi Gagal', 'Ukuran, wrap type asal, wrap type tujuan, kolom asal, dan operator wajib diisi.');
      return { success: false, message: 'Field wajib belum lengkap diisi.' };
    }

    if (sourcePalletType.toLowerCase() === targetPalletType.toLowerCase()) {
      showNotification('error', 'Validasi Gagal', 'Wrap type tujuan harus berbeda dengan wrap type asal.');
      return { success: false, message: 'Wrap type tujuan tidak boleh sama dengan wrap type asal.' };
    }

    if (isNaN(qty) || qty <= 0) {
      showNotification('error', 'Validasi Gagal', 'Jumlah yang diubah harus lebih dari 0.');
      return { success: false, message: 'Jumlah yang diubah harus lebih dari 0.' };
    }

    const dateCompact = params.date.replace(/-/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const txNumber = `CHG-${dateCompact}-${randomSeq}`;
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${uniqueSuffix}`,
      transactionNumber: txNumber,
      transactionType: 'UBAH_SPEK',
      date: params.date,
      time: params.time || new Date().toTimeString().substring(0, 5),
      palletSize: cleanSize,
      palletType: sourcePalletType,
      targetPalletType: targetPalletType,
      typePallet: cleanTypePallet,
      customer: `Ubah Spek: ${sourcePalletType.replace('Pallet ', '')} ➔ ${targetPalletType.replace('Pallet ', '')}`,
      shift: params.shift,
      marketType: params.marketType,
      quantity: qty,
      unit: unit,
      pelatakanPallet: kolomAsal,
      kolomTujuan: kolomTujuan,
      operator: cleanOperator,
      operatorId: currentUser ? currentUser.id : 'OP-01',
      notes: params.notes?.trim() || '',
      createdBy: currentUser ? currentUser.name : cleanOperator,
      createdAt: new Date().toISOString()
    };

    const sourceStockDocId = `stk_${cleanSize}_${cleanTypePallet}_${sourcePalletType}_${params.marketType}_${unit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetStockDocId = `stk_${cleanSize}_${cleanTypePallet}_${targetPalletType}_${params.marketType}_${unit}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    const sourceStockRef = doc(db, 'stocks', sourceStockDocId);
    const targetStockRef = doc(db, 'stocks', targetStockDocId);
    const txRef = doc(db, 'transactions', newTx.id);
    const auditId = `aud-${Date.now()}-${uniqueSuffix}`;
    const auditRef = doc(db, 'auditLogs', auditId);

    let finalSourceQty = 0;
    let finalTargetQty = 0;

    try {
      await runTransaction(db, async (t) => {
        const sourceDoc = await t.get(sourceStockRef);
        let curSourceQty = 0;
        if (sourceDoc.exists()) {
          const s = sourceDoc.data() as StockItem;
          curSourceQty = typeof s.quantity === 'number' ? s.quantity : 0;
        } else {
          const match = stocks.find(s => isMatchingStock(s, cleanSize, sourcePalletType, params.marketType, unit, cleanTypePallet));
          if (match) curSourceQty = match.quantity;
        }

        if (qty > curSourceQty) {
          throw new Error(`STOK_KURANG:${curSourceQty}`);
        }

        finalSourceQty = curSourceQty - qty;

        const targetDoc = await t.get(targetStockRef);
        let curTargetQty = 0;
        if (targetDoc.exists()) {
          const s = targetDoc.data() as StockItem;
          curTargetQty = typeof s.quantity === 'number' ? s.quantity : 0;
        } else {
          const match = stocks.find(s => isMatchingStock(s, cleanSize, targetPalletType, params.marketType, unit, cleanTypePallet));
          if (match) curTargetQty = match.quantity;
        }
        finalTargetQty = curTargetQty + qty;

        t.set(txRef, cleanFirestoreData(newTx));

        t.set(sourceStockRef, {
          id: sourceStockDocId,
          palletSize: cleanSize,
          palletType: sourcePalletType,
          typePallet: cleanTypePallet,
          marketType: params.marketType,
          unit: unit,
          quantity: finalSourceQty,
          lastUpdated: params.date
        });

        t.set(targetStockRef, {
          id: targetStockDocId,
          palletSize: cleanSize,
          palletType: targetPalletType,
          typePallet: cleanTypePallet,
          marketType: params.marketType,
          unit: unit,
          quantity: finalTargetQty,
          lastUpdated: params.date
        });

        const auditLog: AuditLog = {
          id: auditId,
          date: params.date,
          time: params.time || new Date().toTimeString().substring(0, 5),
          userName: currentUser ? currentUser.name : cleanOperator,
          employeeId: currentUser ? currentUser.id : 'OP-SYS',
          activity: 'Perubahan Spesifikasi Pallet',
          dataBefore: `${sourcePalletType} di Kolom ${kolomAsal} (Saldo Awal: ${curSourceQty} ${unit})`,
          dataAfter: `${txNumber}: ${cleanSize} [${cleanTypePallet}] ${sourcePalletType} diubah jadi ${targetPalletType} (${qty} ${unit}) di Kolom ${kolomTujuan} -> Sisa ${sourcePalletType}: ${finalSourceQty} ${unit}, Total ${targetPalletType}: ${finalTargetQty} ${unit}`
        };
        t.set(auditRef, cleanFirestoreData(auditLog));
      });

      setTransactions(prev => [newTx, ...prev.filter(x => x.id !== newTx.id)]);
      setStocks(prev => {
        let updated = [...prev];
        const srcIdx = updated.findIndex(s => isMatchingStock(s, cleanSize, sourcePalletType, params.marketType, unit, cleanTypePallet));
        if (srcIdx >= 0) {
          updated[srcIdx] = { ...updated[srcIdx], quantity: finalSourceQty, lastUpdated: params.date };
        } else {
          updated.push({
            id: sourceStockDocId,
            palletSize: cleanSize,
            palletType: sourcePalletType,
            typePallet: cleanTypePallet,
            marketType: params.marketType,
            unit: unit,
            quantity: finalSourceQty,
            lastUpdated: params.date
          });
        }
        const tgtIdx = updated.findIndex(s => isMatchingStock(s, cleanSize, targetPalletType, params.marketType, unit, cleanTypePallet));
        if (tgtIdx >= 0) {
          updated[tgtIdx] = { ...updated[tgtIdx], quantity: finalTargetQty, lastUpdated: params.date };
        } else {
          updated.push({
            id: targetStockDocId,
            palletSize: cleanSize,
            palletType: targetPalletType,
            typePallet: cleanTypePallet,
            marketType: params.marketType,
            unit: unit,
            quantity: finalTargetQty,
            lastUpdated: params.date
          });
        }
        return updated;
      });

      showNotification(
        'success',
        'PERUBAHAN SPEK BERHASIL',
        `${qty} ${unit} ${cleanSize} (${sourcePalletType} ➔ ${targetPalletType}) berhasil diubah dari Kolom ${kolomAsal}. Sisa ${sourcePalletType}: ${finalSourceQty} ${unit}.`
      );

      return {
        success: true,
        message: `Perubahan spek ${qty} ${unit} berhasil disimpan.`,
        remainingSourceStock: finalSourceQty,
        targetStock: finalTargetQty
      };
    } catch (err: any) {
      if (err.message && err.message.startsWith('STOK_KURANG:')) {
        const available = err.message.split(':')[1];
        showNotification(
          'error',
          'STOK ASAL TIDAK CUKUP',
          `Stok ${sourcePalletType} hanya tersisa ${available} ${unit}. Tidak dapat mengubah ${qty} ${unit}.`
        );
        return { success: false, message: `Stok asal tidak cukup (tersisa ${available} ${unit}).` };
      }
      showNotification('error', 'GAGAL MENYIMPAN', 'Terjadi kesalahan saat memproses perubahan spek: ' + err.message);
      return { success: false, message: err.message };
    }
  };

  const deleteTransaction = async (id: string, reason = 'Dibatalkan oleh operator'): Promise<{ success: boolean; message: string }> => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat membatalkan atau menghapus transaksi.');
      return { success: false, message: 'Akses ditolak.' };
    }

    const tx = transactions.find(t => t.id === id) || transactions.find(t => t.transactionNumber === id);
    if (!tx) {
      showNotification('warning', 'Transaksi Tidak Ditemukan', 'Data transaksi tidak ditemukan atau mungkin sudah dibatalkan sebelumnya.');
      return { success: false, message: 'Transaksi tidak ditemukan' };
    }

    const txTypePallet = tx.typePallet || 'LS';
    const cleanSize = normalizePalletDimension(tx.palletSize);
    const cleanType = tx.palletType ? String(tx.palletType).trim() : 'Pallet Reamwrap';
    const stockDocId = `stk_${cleanSize}_${txTypePallet}_${cleanType}_${tx.marketType}_${tx.unit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const stockRef = doc(db, 'stocks', stockDocId);
    const txRef = doc(db, 'transactions', tx.id);
    const auditId = 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const auditRef = doc(db, 'auditLogs', auditId);

    const oldMatched = stocks.find(s => isMatchingStock(s, cleanSize, cleanType, tx.marketType, tx.unit, txTypePallet));

    // Calculate reversed quantity
    let curQty = oldMatched ? oldMatched.quantity : 0;
    let reversedQty = curQty;
    if (tx.transactionType === 'PENERIMAAN') {
      reversedQty = Math.max(0, curQty - tx.quantity);
    } else if (tx.transactionType === 'PENGELUARAN') {
      reversedQty = curQty + tx.quantity;
    } else if (tx.transactionType === 'UBAH_SPEK') {
      reversedQty = curQty + tx.quantity;
    }

    // 1. Immediate Optimistic UI update so the interface doesn't feel stuck or frozen
    setTransactions(prev => prev.filter(t => t.id !== tx.id && t.transactionNumber !== tx.transactionNumber));
    setStocks(prev => {
      let found = false;
      const updated = prev.map(s => {
        if (isMatchingStock(s, cleanSize, cleanType, tx.marketType, tx.unit, txTypePallet)) {
          found = true;
          return { ...s, quantity: Math.max(0, reversedQty), lastUpdated: new Date().toISOString().split('T')[0] };
        }
        return s;
      });
      if (!found && reversedQty > 0) {
        updated.push({
          id: stockDocId,
          palletSize: cleanSize,
          palletType: cleanType,
          typePallet: txTypePallet,
          marketType: tx.marketType,
          unit: tx.unit,
          quantity: Math.max(0, reversedQty),
          lastUpdated: new Date().toISOString().split('T')[0]
        });
      }
      return updated;
    });

    // 2. Perform writeBatch or direct writes to Firestore
    try {
      const batch = writeBatch(db);

      // Delete transaction doc
      batch.delete(txRef);

      // Adjust stock in cloud
      batch.set(stockRef, {
        id: stockDocId,
        palletSize: cleanSize,
        palletType: cleanType,
        typePallet: txTypePallet,
        marketType: tx.marketType,
        unit: tx.unit,
        quantity: Math.max(0, reversedQty),
        lastUpdated: new Date().toISOString().split('T')[0]
      }, { merge: true });

      if (oldMatched?.id && oldMatched.id !== stockDocId) {
        batch.delete(doc(db, 'stocks', oldMatched.id));
      }

      // Revert target stock for UBAH_SPEK
      if (tx.transactionType === 'UBAH_SPEK') {
        const targetType = tx.targetPalletType ? String(tx.targetPalletType).trim() : 'Pallet Bulkpack';
        const targetStockDocId = `stk_${cleanSize}_${txTypePallet}_${targetType}_${tx.marketType}_${tx.unit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const targetStockRef = doc(db, 'stocks', targetStockDocId);
        const targetMatched = stocks.find(s => isMatchingStock(s, cleanSize, targetType, tx.marketType, tx.unit, txTypePallet));
        const targetCur = targetMatched ? targetMatched.quantity : 0;
        batch.set(targetStockRef, {
          id: targetStockDocId,
          palletSize: cleanSize,
          palletType: targetType,
          typePallet: txTypePallet,
          marketType: tx.marketType,
          unit: tx.unit,
          quantity: Math.max(0, targetCur - tx.quantity),
          lastUpdated: new Date().toISOString().split('T')[0]
        }, { merge: true });
      }

      // Write audit log
      const log: AuditLog = {
        id: auditId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().substring(0, 5),
        userName: currentUser ? currentUser.name : 'Operator',
        employeeId: currentUser ? currentUser.id : 'OP-01',
        activity: 'Hapus Transaksi',
        dataBefore: `No: ${tx.transactionNumber}, Qty: ${tx.quantity} ${tx.unit}, Jenis: ${tx.transactionType}, Type: ${txTypePallet}`,
        dataAfter: `Alasan: ${reason}. Efek stok dikembalikan ke cloud.`
      };
      batch.set(auditRef, log);

      await batch.commit();

      showNotification('info', 'Transaksi Dibatalkan', `Transaksi ${tx.transactionNumber} berhasil dihapus & saldo stok disesuaikan.`);
      return { success: true, message: 'Transaksi berhasil dihapus.' };
    } catch (err: any) {
      console.warn('Batch delete failed, attempting direct fallback delete:', err);
      // Fallback: direct doc deletions in case batch had an issue
      try {
        await deleteDoc(txRef).catch(async () => {
          const q = query(collection(db, 'transactions'), where('transactionNumber', '==', tx.transactionNumber));
          const snap = await getDocs(q);
          snap.forEach(d => deleteDoc(d.ref).catch(() => {}));
        });
        await setDoc(stockRef, {
          id: stockDocId,
          palletSize: cleanSize,
          palletType: cleanType,
          typePallet: txTypePallet,
          marketType: tx.marketType,
          unit: tx.unit,
          quantity: Math.max(0, reversedQty),
          lastUpdated: new Date().toISOString().split('T')[0]
        }, { merge: true });
        showNotification('info', 'Transaksi Dibatalkan', `Transaksi ${tx.transactionNumber} berhasil dihapus.`);
        return { success: true, message: 'Transaksi berhasil dihapus via fallback.' };
      } catch (fallbackErr: any) {
        console.error('Fallback delete failed:', fallbackErr);
        showNotification('error', 'Gagal Membatalkan', 'Database cloud menolak pembatalan: ' + (fallbackErr.message || String(fallbackErr)));
        return { success: false, message: 'Gagal membatalkan transaksi: ' + (fallbackErr.message || String(fallbackErr)) };
      }
    }
  };

  const editTransaction = async (
    id: string,
    updated: Partial<Transaction> & { siblingIdsToDelete?: string[] },
    revisionReason?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat merevisi transaksi.');
      return { success: false, message: 'Akses ditolak.' };
    }

    const existing = transactions.find(t => t.id === id);
    if (!existing) return { success: false, message: 'Transaksi tidak ditemukan' };

    const siblingIdsToDelete = updated.siblingIdsToDelete || [];
    const siblingTxs = siblingIdsToDelete.length > 0
      ? transactions.filter(t => siblingIdsToDelete.includes(t.id))
      : [];
    const totalSiblingQty = siblingTxs.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    const exTypePallet = (existing.typePallet || 'LS') as PalletSideType;
    const oldSize = normalizePalletDimension(existing.palletSize);
    const oldPalletType = existing.palletType ? String(existing.palletType).trim() : 'Pallet Reamwrap';
    const oldMarket = existing.marketType;
    const oldUnit = existing.unit;
    const oldTxType = existing.transactionType;
    const oldQty = existing.quantity;

    const newSize = normalizePalletDimension(updated.palletSize !== undefined ? updated.palletSize : existing.palletSize);
    const newTypePallet = (updated.typePallet !== undefined ? updated.typePallet : exTypePallet) as PalletSideType;
    const newPalletType = (updated.palletType !== undefined ? String(updated.palletType).trim() : oldPalletType);
    const newMarket = (updated.marketType !== undefined ? updated.marketType : existing.marketType) as MarketType;
    const newUnit = (updated.unit !== undefined ? updated.unit : existing.unit) as QuantityUnit;
    const newTxType = (updated.transactionType !== undefined ? updated.transactionType : existing.transactionType) as TransactionType;
    const newQty = updated.quantity !== undefined ? updated.quantity : existing.quantity;

    // Check if stock-affecting specifications changed
    const isSameSpec =
      oldSize === newSize &&
      oldPalletType.toLowerCase() === newPalletType.toLowerCase() &&
      exTypePallet === newTypePallet &&
      oldMarket === newMarket &&
      oldUnit === newUnit;

    const isStockAffected = !isSameSpec || oldTxType !== newTxType || oldQty !== newQty || totalSiblingQty > 0;

    // Deteksi transaksi pengeluaran / kirim yang terjadi setelah penerimaan ini menggunakan spek lama
    const cascadedShipments: Transaction[] = [];
    let cascadedShippedQty = 0;

    if (oldTxType === 'PENERIMAAN' && !isSameSpec) {
      // Cari transaksi PENGELUARAN / PINDAH_KOLOM yang memakai oldSpec pada atau setelah tanggal penerimaan ini
      const subsequentShipments = transactions
        .filter(t => {
          if (t.id === existing.id) return false;
          if (t.transactionType !== 'PENGELUARAN' && t.transactionType !== 'PINDAH_KOLOM') return false;
          const isMatch = isMatchingStock(
            {
              id: '',
              palletSize: t.palletSize,
              typePallet: t.typePallet || 'LS',
              palletType: t.palletType,
              marketType: t.marketType,
              unit: t.unit,
              quantity: t.quantity,
              lastUpdated: ''
            },
            oldSize,
            oldPalletType,
            oldMarket,
            oldUnit,
            exTypePallet
          );
          if (!isMatch) return false;
          return t.date >= existing.date;
        })
        .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));

      // Ambil transaksi pengiriman terkait hingga sejumlah kuantitas penerimaan lama (oldQty)
      let quota = oldQty;
      for (const ship of subsequentShipments) {
        if (quota <= 0) break;
        cascadedShipments.push(ship);
        if (ship.transactionType === 'PENGELUARAN') {
          cascadedShippedQty += ship.quantity;
          quota -= ship.quantity;
        }
      }
    }

    if (isStockAffected) {
      // Revert old effect (termasuk sibling split jika dikonsolidasikan):
      const effectiveOldQty = oldQty + (oldTxType === 'PENGELUARAN' ? totalSiblingQty : 0);
      const revertOldDelta = oldTxType === 'PENERIMAAN'
        ? (-oldQty + cascadedShippedQty)
        : oldTxType === 'PENGELUARAN'
        ? +effectiveOldQty
        : 0;

      // Apply new effect:
      const applyNewDelta = newTxType === 'PENERIMAAN'
        ? (+newQty - cascadedShippedQty)
        : newTxType === 'PENGELUARAN'
        ? -newQty
        : 0;

      if (isSameSpec) {
        // Net change for the exact same stock item
        const netDelta = (oldTxType === 'PENERIMAAN' ? -oldQty : +effectiveOldQty) + (newTxType === 'PENERIMAAN' ? +newQty : -newQty);
        const stockDocId = `stk_${newSize}_${newTypePallet}_${newPalletType}_${newMarket}_${newUnit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const matched = stocks.find(s => isMatchingStock(s, newSize, newPalletType, newMarket, newUnit, newTypePallet));
        const finalCount = matched ? Math.max(0, matched.quantity + netDelta) : Math.max(0, newQty);

        setStocks(prev => {
          const index = prev.findIndex(s => isMatchingStock(s, oldSize, oldPalletType, oldMarket, oldUnit, exTypePallet));
          if (index >= 0) {
            const item = prev[index];
            const newCount = Math.max(0, item.quantity + netDelta);
            const copy = [...prev];
            copy[index] = { ...item, quantity: newCount, lastUpdated: new Date().toISOString().split('T')[0] };
            return copy;
          } else {
            return [...prev, {
              id: stockDocId,
              palletSize: newSize,
              palletType: newPalletType,
              typePallet: newTypePallet,
              marketType: newMarket,
              unit: newUnit,
              quantity: finalCount,
              lastUpdated: new Date().toISOString().split('T')[0]
            }];
          }
        });

        // Tetap simpan ke Firestore meskipun 0 agar tetap muncul saat dicari
        if (matched?.id && matched.id !== stockDocId) {
          await deleteFromFirestore('stocks', matched.id);
        }
        await syncToFirestore('stocks', stockDocId, {
          id: stockDocId,
          palletSize: newSize,
          palletType: newPalletType,
          typePallet: newTypePallet,
          marketType: newMarket,
          unit: newUnit,
          quantity: Math.max(0, finalCount),
          lastUpdated: new Date().toISOString().split('T')[0]
        });
      } else {
        // Different spec: adjust old stock item and new stock item separately
        const oldDocId = `stk_${oldSize}_${exTypePallet}_${oldPalletType}_${oldMarket}_${oldUnit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const newDocId = `stk_${newSize}_${newTypePallet}_${newPalletType}_${newMarket}_${newUnit}`.replace(/[^a-zA-Z0-9_-]/g, '_');

        const oldMatched = stocks.find(s => isMatchingStock(s, oldSize, oldPalletType, oldMarket, oldUnit, exTypePallet));
        const oldRemain = oldMatched ? Math.max(0, oldMatched.quantity + revertOldDelta) : 0;

        // Cek apakah masih ada transaksi lain di sistem yang menggunakan spek lama
        const otherOldTxExists = transactions.some(t =>
          t.id !== existing.id &&
          isMatchingStock(
            {
              id: '',
              palletSize: t.palletSize,
              palletType: t.palletType,
              marketType: t.marketType,
              unit: t.unit,
              typePallet: t.typePallet || 'LS',
              quantity: t.quantity,
              lastUpdated: ''
            },
            oldSize,
            oldPalletType,
            oldMarket,
            oldUnit,
            exTypePallet
          )
        );

        // Jika sisa stok spek lama <= 0 atau sudah tidak ada transaksi lain untuk spek lama (karena direvisi ke spek baru),
        // spek lama harus dihapus total agar tidak timbul duplikat data (contoh kasus 82x82 Set direvisi jadi Pcs)
        const shouldDeleteOldSpec = oldRemain <= 0 || !otherOldTxExists;

        const newMatched = stocks.find(s => isMatchingStock(s, newSize, newPalletType, newMarket, newUnit, newTypePallet));
        const newFinalCount = newMatched ? Math.max(0, newMatched.quantity + applyNewDelta) : Math.max(0, applyNewDelta);

        setStocks(prev => {
          let updatedList = [...prev];
          // 1. Revert from old
          if (shouldDeleteOldSpec) {
            updatedList = updatedList.filter(s => !isMatchingStock(s, oldSize, oldPalletType, oldMarket, oldUnit, exTypePallet));
          } else {
            const oldIndex = updatedList.findIndex(s => isMatchingStock(s, oldSize, oldPalletType, oldMarket, oldUnit, exTypePallet));
            if (oldIndex >= 0) {
              const oldItem = updatedList[oldIndex];
              updatedList[oldIndex] = {
                ...oldItem,
                quantity: oldRemain,
                lastUpdated: new Date().toISOString().split('T')[0]
              };
            }
          }

          // 2. Apply to new
          const newIndex = updatedList.findIndex(s => isMatchingStock(s, newSize, newPalletType, newMarket, newUnit, newTypePallet));
          if (newIndex >= 0) {
            const newItem = updatedList[newIndex];
            updatedList[newIndex] = {
              ...newItem,
              quantity: newFinalCount,
              lastUpdated: new Date().toISOString().split('T')[0]
            };
          } else {
            updatedList.push({
              id: newDocId,
              palletSize: newSize,
              palletType: newPalletType,
              typePallet: newTypePallet,
              marketType: newMarket,
              unit: newUnit,
              quantity: newFinalCount,
              lastUpdated: new Date().toISOString().split('T')[0]
            });
          }
          return updatedList;
        });

        // Sync old to Firestore: jika sisa <= 0 atau tidak ada transaksi lain, hapus dokumen lama dari database cloud
        if (shouldDeleteOldSpec) {
          await deleteFromFirestore('stocks', oldDocId);
          if (oldMatched?.id) {
            await deleteFromFirestore('stocks', oldMatched.id);
          }
        } else {
          if (oldMatched?.id && oldMatched.id !== oldDocId) {
            await deleteFromFirestore('stocks', oldMatched.id);
          }
          await syncToFirestore('stocks', oldDocId, {
            id: oldDocId,
            palletSize: oldSize,
            palletType: oldPalletType,
            typePallet: exTypePallet,
            marketType: oldMarket,
            unit: oldUnit,
            quantity: Math.max(0, oldRemain),
            lastUpdated: new Date().toISOString().split('T')[0]
          });
        }

        // Sync new to Firestore: simpan spek baru
        if (newMatched?.id && newMatched.id !== newDocId) {
          await deleteFromFirestore('stocks', newMatched.id);
        }
        await syncToFirestore('stocks', newDocId, {
          id: newDocId,
          palletSize: newSize,
          palletType: newPalletType,
          typePallet: newTypePallet,
          marketType: newMarket,
          unit: newUnit,
          quantity: Math.max(0, newFinalCount),
          lastUpdated: new Date().toISOString().split('T')[0]
        });
      }
    }

    const now = new Date();
    const reasonText = (revisionReason || updated.revisionReason || 'Revisi kesalahan input data oleh operator').trim();
    const updatedTx: Transaction = {
      ...existing,
      ...updated,
      palletSize: newSize,
      typePallet: newTypePallet,
      palletType: newPalletType,
      marketType: newMarket,
      unit: newUnit,
      transactionType: newTxType,
      quantity: newQty,
      lastModifiedBy: currentUser ? currentUser.name : 'Operator',
      lastModifiedAt: now.toISOString(),
      isRevised: true,
      revisionReason: reasonText,
      revisedAt: now.toISOString(),
      revisedBy: currentUser ? currentUser.name : 'Operator'
    };

    // Siapkan update untuk transaksi pengiriman yang otomatis diselaraskan
    const cascadedUpdatedMap = new Map<string, Transaction>();
    if (cascadedShipments.length > 0) {
      for (const ship of cascadedShipments) {
        const updatedShip: Transaction = {
          ...ship,
          palletSize: newSize,
          typePallet: newTypePallet,
          palletType: newPalletType,
          marketType: newMarket,
          unit: newUnit,
          isRevised: true,
          revisionReason: `Otomatis diselaraskan mengikuti revisi aktual penerimaan #${existing.transactionNumber}`,
          revisedAt: now.toISOString(),
          revisedBy: currentUser ? currentUser.name : 'Operator'
        };
        cascadedUpdatedMap.set(ship.id, updatedShip);
        await syncToFirestore('transactions', updatedShip.id, updatedShip);
      }
    }

    // Hapus transaksi sibling yang dikonsolidasikan (jika pengeluaran split disatukan ke 1 kolom)
    if (siblingIdsToDelete.length > 0) {
      for (const sibId of siblingIdsToDelete) {
        await deleteFromFirestore('transactions', sibId);
      }
    } else if (updated.noRun !== undefined && existing.transactionType === 'PENGELUARAN') {
      // Jika tidak dikonsolidasikan tetapi noRun diperbarui, sinkronkan noRun ke sibling split agar tidak timpang
      const tNote = existing.notes || '';
      const totalOrderMatch = tNote.match(/Total\s+Order\s+(\d+)\s*(?:set|pcs)?[:\s]+([^\]]+)/i);
      const siblingsToSync = transactions.filter(t => {
        if (t.id === id) return false;
        if (t.transactionType !== 'PENGELUARAN') return false;
        if (t.date !== existing.date) return false;
        if (normalizePalletDimension(t.palletSize) !== oldSize) return false;
        if ((t.customer || '').trim().toLowerCase() !== (existing.customer || '').trim().toLowerCase()) return false;
        return totalOrderMatch ? (t.notes && t.notes.includes(totalOrderMatch[0])) : false;
      });

      for (const sib of siblingsToSync) {
        const updatedSib = {
          ...sib,
          noRun: updated.noRun ? updated.noRun.trim() : undefined,
          lastModifiedAt: now.toISOString(),
          lastModifiedBy: currentUser ? currentUser.name : 'Operator'
        };
        cascadedUpdatedMap.set(sib.id, updatedSib);
        await syncToFirestore('transactions', sib.id, updatedSib);
      }
    }

    setTransactions(prev => prev
      .filter(t => !siblingIdsToDelete.includes(t.id))
      .map(t => {
        if (t.id === id) return updatedTx;
        if (cascadedUpdatedMap.has(t.id)) return cascadedUpdatedMap.get(t.id)!;
        return t;
      })
    );
    await syncToFirestore('transactions', updatedTx.id, updatedTx);

    const siblingInfo = siblingIdsToDelete.length > 0
      ? ` | Serta mengkonsolidasi ${siblingIdsToDelete.length} transaksi split sebelumnya (${totalSiblingQty} ${newUnit}) menjadi 1 transaksi utuh di kolom ${updatedTx.pelatakanPallet}.`
      : '';
    const cascadeInfo = (cascadedShipments.length > 0
      ? ` | Serta ${cascadedShipments.length} transaksi pengeluaran/kirim terkait (${cascadedShippedQty} ${newUnit}) otomatis diselaraskan ke spek ${newSize} (${newTypePallet}) ${newPalletType} ${newMarket} sehingga sisa stok tetap akurat.`
      : '') + siblingInfo;

    const log: AuditLog = {
      id: 'aud-' + Date.now(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().substring(0, 5),
      userName: currentUser ? currentUser.name : 'Operator',
      employeeId: currentUser ? currentUser.id : 'OP-01',
      activity: `Revisi Transaksi [${existing.transactionNumber}]`,
      dataBefore: `${existing.transactionType} ${existing.palletSize} (${exTypePallet}) ${existing.palletType} [${existing.marketType}] Qty: ${existing.quantity} ${existing.unit} | Tgl: ${existing.date} ${existing.time} | Shift: ${existing.shift} | Kolom: ${existing.pelatakanPallet || '-'}`,
      dataAfter: `${updatedTx.transactionType} ${updatedTx.palletSize} (${newTypePallet}) ${updatedTx.palletType} [${updatedTx.marketType}] Qty: ${updatedTx.quantity} ${updatedTx.unit} | Tgl: ${updatedTx.date} ${updatedTx.time} | Shift: ${updatedTx.shift} | Kolom: ${updatedTx.pelatakanPallet || '-'} | Alasan: ${reasonText}${cascadeInfo}`
    };
    setAuditLogs(prev => [log, ...prev]);
    await syncToFirestore('auditLogs', log.id, log);

    const successMsg = cascadedShipments.length > 0
      ? `Revisi penerimaan #${existing.transactionNumber} berhasil. ${cascadedShipments.length} transaksi pengiriman terkait (${cascadedShippedQty} ${newUnit}) otomatis diselaraskan ke spek baru.`
      : `Perubahan transaksi ${existing.transactionNumber} dan penyesuaian stok berhasil disimpan.`;

    showNotification('success', 'Transaksi Berhasil Direvisi', successMsg);
    return { success: true, message: successMsg };
  };

  const updateThresholds = (cfg: StockThresholdConfig) => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat mengubah batas status stok.');
      return;
    }
    setThresholds(cfg);
    syncToFirestore('systemConfig', 'main', { ...cfg, updatedAt: new Date().toISOString() });

    const now = new Date();
    const log: AuditLog = {
      id: 'aud-' + Date.now(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().substring(0, 5),
      userName: currentUser ? currentUser.name : 'Operator',
      employeeId: currentUser ? currentUser.id : 'OP-01',
      activity: 'Perubahan Pengaturan',
      dataBefore: `Safe: ${thresholds.safeMin}, Warning: ${thresholds.warningMin}`,
      dataAfter: `Safe: ${cfg.safeMin}, Warning: ${cfg.warningMin}`
    };
    setAuditLogs(prev => [log, ...prev]);
    syncToFirestore('auditLogs', log.id, log);
    showNotification('success', 'Pengaturan Tersimpan', 'Batas status stok berhasil diperbarui.');
  };

  // Langsung revisi stok aktual (Stok Opname / Penyesuaian Saldo Fisik)
  const reviseStock = async (params: {
    palletSize: string;
    palletType: string;
    typePallet?: PalletSideType;
    marketType: MarketType;
    unit: QuantityUnit;
    newQuantity: number;
    reason?: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat merevisi stok aktual.');
      return { success: false, message: 'Akses ditolak.' };
    }

    const cleanSize = normalizePalletDimension(params.palletSize);
    const cleanType = params.palletType ? String(params.palletType).trim() : 'Pallet Reamwrap';
    const cleanTypePallet: PalletSideType = params.typePallet || 'LS';
    const cleanMarket = params.marketType;
    const cleanUnit = params.unit;
    const targetQty = Math.max(0, Number(params.newQuantity) || 0);

    const stockDocId = `stk_${cleanSize}_${cleanTypePallet}_${cleanType}_${cleanMarket}_${cleanUnit}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const stockRef = doc(db, 'stocks', stockDocId);
    const auditId = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const auditRef = doc(db, 'auditLogs', auditId);

    const oldMatched = stocks.find(s => isMatchingStock(s, cleanSize, cleanType, cleanMarket, cleanUnit, cleanTypePallet));
    const oldQty = oldMatched ? oldMatched.quantity : 0;

    try {
      const stockData: StockItem = {
        id: stockDocId,
        palletSize: cleanSize,
        palletType: cleanType,
        typePallet: cleanTypePallet,
        marketType: cleanMarket,
        unit: cleanUnit,
        quantity: targetQty,
        lastUpdated: new Date().toISOString().split('T')[0]
      };

      await setDoc(stockRef, cleanFirestoreData(stockData));

      // Audit log
      const auditLog: AuditLog = {
        id: auditId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().substring(0, 5),
        userName: currentUser ? currentUser.name : 'Operator',
        employeeId: currentUser ? currentUser.id : 'OP-SYS',
        activity: 'Revisi Stok Aktual',
        dataBefore: `Stok Awal: ${oldQty} ${cleanUnit} (${cleanSize} ${cleanTypePallet} ${cleanType} ${cleanMarket})`,
        dataAfter: `Stok Baru: ${targetQty} ${cleanUnit}. Alasan: ${params.reason || 'Koreksi stok aktual oleh operator'}`
      };
      await setDoc(auditRef, cleanFirestoreData(auditLog));

      // Local optimistic update
      setStocks(prev => {
        const idx = prev.findIndex(s => isMatchingStock(s, cleanSize, cleanType, cleanMarket, cleanUnit, cleanTypePallet));
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = stockData;
          return cp;
        }
        return [...prev, stockData];
      });

      showNotification(
        'success',
        'Stok Berhasil Direvisi',
        `Stok ${cleanSize} (${cleanTypePallet} - ${cleanType} - ${cleanMarket}) berhasil disesuaikan menjadi ${targetQty} ${cleanUnit}.`
      );
      return { success: true, message: 'Stok berhasil direvisi.' };
    } catch (err: any) {
      console.error('Revise stock error:', err);
      showNotification('error', 'Gagal Merevisi Stok', 'Database menolak pembaruan: ' + (err.message || String(err)));
      return { success: false, message: 'Gagal merevisi stok: ' + (err.message || String(err)) };
    }
  };

  // Master Data Ukuran
  const addMasterSize = (name: string, description?: string) => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat menambah master ukuran.');
      return;
    }
    const clean = name.trim();
    if (!clean) return;
    const exists = masterSizes.find(s => s.name.toLowerCase() === clean.toLowerCase());
    if (exists) {
      showNotification('warning', 'Duplikat', `Ukuran ${clean} sudah ada di daftar.`);
      return;
    }
    const newSize: MasterPalletSize = {
      id: 's-' + Date.now(),
      name: clean,
      description: description?.trim() || '',
      active: true
    };
    setMasterSizes(prev => [newSize, ...prev]);
    syncToFirestore('masterSizes', newSize.id, newSize);
    showNotification('success', 'Master Ukuran Ditambah', `Ukuran ${clean} berhasil ditambahkan.`);
  };

  const toggleMasterSize = (id: string) => {
    if (!canEdit) return;
    const item = masterSizes.find(s => s.id === id);
    if (item) {
      const updated = { ...item, active: !item.active };
      setMasterSizes(prev => prev.map(s => (s.id === id ? updated : s)));
      syncToFirestore('masterSizes', id, updated);
    }
  };

  const deleteMasterSize = (id: string) => {
    if (!canEdit) return;
    setMasterSizes(prev => prev.filter(s => s.id !== id));
    deleteFromFirestore('masterSizes', id);
  };

  // Master Jenis Pallet
  const addMasterType = (name: string) => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat menambah jenis pallet.');
      return;
    }
    const clean = name.trim();
    if (!clean) return;
    const exists = masterTypes.find(t => t.name.toLowerCase() === clean.toLowerCase());
    if (exists) {
      showNotification('warning', 'Duplikat', `Jenis ${clean} sudah ada.`);
      return;
    }
    const newType: MasterPalletType = {
      id: 't-' + Date.now(),
      name: clean,
      active: true
    };
    setMasterTypes(prev => [newType, ...prev]);
    syncToFirestore('masterTypes', newType.id, newType);
    showNotification('success', 'Master Jenis Ditambah', `Jenis ${clean} berhasil ditambahkan.`);
  };

  const toggleMasterType = (id: string) => {
    if (!canEdit) return;
    const item = masterTypes.find(t => t.id === id);
    if (item) {
      const updated = { ...item, active: !item.active };
      setMasterTypes(prev => prev.map(t => (t.id === id ? updated : t)));
      syncToFirestore('masterTypes', id, updated);
    }
  };

  const deleteMasterType = (id: string) => {
    if (!canEdit) return;
    setMasterTypes(prev => prev.filter(t => t.id !== id));
    deleteFromFirestore('masterTypes', id);
  };

  // Master Customer / User
  const addMasterCustomer = (name: string) => {
    if (!canEdit) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator yang dapat menambah master user.');
      return;
    }
    const clean = name.trim();
    if (!clean) return;
    const exists = masterCustomers.find(c => c.name.toLowerCase() === clean.toLowerCase());
    if (exists) {
      showNotification('warning', 'Duplikat', `User ${clean} sudah ada.`);
      return;
    }
    const newCust: MasterCustomer = {
      id: 'c-' + Date.now(),
      name: clean,
      active: true
    };
    setMasterCustomers(prev => [newCust, ...prev]);
    syncToFirestore('masterCustomers', newCust.id, newCust);
    showNotification('success', 'Master User Ditambah', `User ${clean} berhasil ditambahkan.`);
  };

  const toggleMasterCustomer = (id: string) => {
    if (!canEdit) return;
    const item = masterCustomers.find(c => c.id === id);
    if (item) {
      const updated = { ...item, active: !item.active };
      setMasterCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
      syncToFirestore('masterCustomers', id, updated);
    }
  };

  const deleteMasterCustomer = (id: string) => {
    if (!canEdit) return;
    setMasterCustomers(prev => prev.filter(c => c.id !== id));
    deleteFromFirestore('masterCustomers', id);
  };

  // Master Employees & Security Management
  const addEmployee = async (
    nameOrData: string | {
      name: string;
      role: Employee['role'];
      title: string;
      password?: string;
      isAdmin?: boolean;
      shiftPreference?: ShiftType;
      avatarVariant?: Employee['avatarVariant'];
    },
    legacyRole?: Employee['role'],
    legacyTitle?: string,
    legacyPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!canEdit && !isAdmin) {
      showNotification('error', 'Akses Ditolak', 'Hanya Admin atau Operator yang dapat menambah personil.');
      return { success: false, message: 'Akses ditolak: Hanya Admin atau Operator yang dapat menambah karyawan.' };
    }

    let name = '';
    let role: Employee['role'] = 'operator';
    let title = 'Operator Finish Pallet';
    let password = '';
    let isUserAdmin = false;
    let shiftPreference: ShiftType | undefined = 'Shift 1';
    let avatarVariant: Employee['avatarVariant'] = undefined;

    if (typeof nameOrData === 'object') {
      name = nameOrData.name.trim();
      role = nameOrData.role;
      title = nameOrData.title?.trim() || (role === 'operator' ? 'Operator Finish Pallet' : 'Officer Finish Pallet');
      password = (nameOrData.password || '').trim();
      isUserAdmin = Boolean(nameOrData.isAdmin);
      shiftPreference = nameOrData.shiftPreference || 'Shift 1';
      avatarVariant = nameOrData.avatarVariant;
    } else {
      name = (nameOrData || '').trim();
      role = legacyRole || 'operator';
      title = (legacyTitle || '').trim() || (role === 'operator' ? 'Operator Finish Pallet' : 'Officer Finish Pallet');
      password = (legacyPassword || '').trim();
    }

    if (!name) {
      showNotification('warning', 'Nama Diperlukan', 'Nama personil tidak boleh kosong.');
      return { success: false, message: 'Nama karyawan tidak boleh kosong.' };
    }

    const exists = employees.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      showNotification('warning', 'Duplikat', `Karyawan dengan nama "${name}" sudah terdaftar.`);
      return { success: false, message: `Karyawan "${name}" sudah terdaftar.` };
    }

    // Default password if not provided
    if (!password) {
      password = role === 'operator' ? `${name}777` : 'Monitoring123';
    }

    // Prefix for ID
    const prefix = isUserAdmin ? 'ADM' : role === 'operator' ? 'OP' : role === 'officer' ? 'OFF' : role === 'leadershift' ? 'LS' : 'SPV';
    const count = employees.filter(e => e.role === role).length + 1;
    const id = `${prefix}-${String(count).padStart(2, '0')}`;

    const newEmp: Employee = {
      id,
      name,
      role,
      isAdmin: isUserAdmin,
      title,
      active: true,
      shiftPreference,
      password,
      lastPasswordChangedAt: new Date().toISOString(),
      avatarVariant:
        avatarVariant ||
        (name.toLowerCase().includes('indika')
          ? 'indika_glasses'
          : role === 'spv'
          ? 'officer_white_2'
          : role === 'officer' || role === 'leadershift'
          ? 'officer_white_1'
          : 'operator_yellow')
    };

    try {
      setEmployees(prev => [...prev, newEmp]);
      await syncToFirestore('employees', newEmp.id, newEmp);

      const now = new Date();
      const log: AuditLog = {
        id: 'aud-' + Date.now(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().substring(0, 5),
        userName: currentUser ? currentUser.name : 'Operator',
        employeeId: currentUser ? currentUser.id : 'OP-01',
        activity: `Tambah Personil Baru [${name}]`,
        dataBefore: '-',
        dataAfter: `ID: ${id}, Nama: ${name}, Role: ${role}, Admin: ${isUserAdmin ? 'Ya' : 'Tidak'}, Jabatan: ${title}`
      };
      setAuditLogs(prev => [log, ...prev]);
      await syncToFirestore('auditLogs', log.id, log);

      showNotification('success', 'Personil Ditambah', `${name} (${title}) berhasil didaftarkan ke sistem.`);
      return { success: true, message: `${name} berhasil ditambahkan.` };
    } catch (err: any) {
      console.error('Add employee error:', err);
      showNotification('error', 'Gagal', 'Gagal menambahkan personil: ' + (err.message || String(err)));
      return { success: false, message: 'Gagal menambahkan personil.' };
    }
  };

  const updateEmployee = async (id: string, updated: Partial<Employee>): Promise<{ success: boolean; message: string }> => {
    const target = employees.find(e => e.id === id);
    if (!target) return { success: false, message: 'Karyawan tidak ditemukan.' };

    const isSelf = currentUser && (currentUser.id === id || currentUser.name.toLowerCase() === target.name.toLowerCase());
    if (!isAdmin && !isSelf) {
      showNotification('error', 'Akses Ditolak', 'Hanya Admin (Indika) yang dapat mengubah data karyawan lain.');
      return { success: false, message: 'Akses ditolak.' };
    }

    const merged: Employee = {
      ...target,
      ...updated,
      id: target.id
    };

    if (merged.name.toLowerCase() === 'indika') {
      merged.isAdmin = true;
    }

    try {
      setEmployees(prev => prev.map(e => e.id === id ? merged : e));
      await syncToFirestore('employees', id, merged);

      if (isSelf) {
        setCurrentUser(prev => prev ? { ...prev, ...merged } : null);
      }

      showNotification('success', 'Data Diperbarui', `Informasi karyawan ${merged.name} berhasil disimpan.`);
      return { success: true, message: 'Data berhasil diperbarui.' };
    } catch (err: any) {
      console.error('Update employee error:', err);
      showNotification('error', 'Gagal Update', 'Gagal memperbarui data: ' + (err.message || String(err)));
      return { success: false, message: 'Gagal memperbarui data.' };
    }
  };

  const deleteEmployee = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (!isAdmin) {
      showNotification('error', 'Akses Ditolak', 'Hanya Admin (Indika) yang memiliki hak untuk menghapus karyawan.');
      return { success: false, message: 'Akses ditolak: Hanya Admin yang dapat menghapus karyawan.' };
    }

    const targetEmp = employees.find(e => e.id === id);
    if (!targetEmp) {
      return { success: false, message: 'Karyawan tidak ditemukan.' };
    }

    if (currentUser?.id === id || targetEmp.name.toLowerCase() === 'indika') {
      showNotification('warning', 'Tidak Diizinkan', 'Akun Administrator Indika tidak dapat dihapus dari sistem.');
      return { success: false, message: 'Akun Administrator Indika tidak dapat dihapus.' };
    }

    try {
      setEmployees(prev => prev.filter(e => e.id !== id));
      await deleteFromFirestore('employees', id);

      const now = new Date();
      const log: AuditLog = {
        id: 'aud-' + Date.now(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().substring(0, 5),
        userName: currentUser ? currentUser.name : 'Admin Indika',
        employeeId: currentUser ? currentUser.id : 'OP-01',
        activity: `Hapus Karyawan [${targetEmp.name}]`,
        dataBefore: `${targetEmp.name} - ${targetEmp.title} (${targetEmp.role})`,
        dataAfter: 'Data personil dihapus dari sistem oleh Admin'
      };
      setAuditLogs(prev => [log, ...prev]);
      await syncToFirestore('auditLogs', log.id, log);

      showNotification('info', 'Karyawan Dihapus', `Data personil ${targetEmp.name} telah berhasil dihapus dari sistem.`);
      return { success: true, message: 'Karyawan berhasil dihapus.' };
    } catch (err: any) {
      console.error('Failed to delete employee:', err);
      showNotification('error', 'Gagal', 'Gagal menghapus personil: ' + (err.message || String(err)));
      return { success: false, message: 'Gagal menghapus personil.' };
    }
  };

  const changePassword = async (
    employeeId: string,
    newPassword: string,
    oldPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    const targetEmp = employees.find(e => e.id === employeeId);
    if (!targetEmp) {
      showNotification('error', 'Gagal', 'Karyawan tidak ditemukan.');
      return { success: false, message: 'Karyawan tidak ditemukan.' };
    }

    const isSelf = Boolean(currentUser && (
      currentUser.id === employeeId || 
      currentUser.name.toLowerCase() === targetEmp.name.toLowerCase()
    ));

    if (!isAdmin && !isSelf) {
      showNotification('error', 'Akses Ditolak', 'Anda hanya memiliki akses untuk mengganti kata sandi akun Anda sendiri.');
      return { success: false, message: 'Akses ditolak: Anda hanya dapat mengganti kata sandi akun Anda sendiri.' };
    }

    if (!isAdmin && oldPassword) {
      const currentExpectedPass = targetEmp.password || (
        targetEmp.role === 'operator' ? `${targetEmp.name}777` : 'Monitoring123'
      );
      if (oldPassword.trim().toLowerCase() !== currentExpectedPass.toLowerCase()) {
        showNotification('error', 'Sandi Lama Salah', 'Kata sandi lama yang Anda masukkan tidak sesuai.');
        return { success: false, message: 'Kata sandi lama salah.' };
      }
    }

    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 4) {
      showNotification('warning', 'Sandi Terlalu Pendek', 'Kata sandi minimal 4 karakter.');
      return { success: false, message: 'Kata sandi minimal 4 karakter.' };
    }

    const updatedEmp: Employee = {
      ...targetEmp,
      password: trimmedNew,
      lastPasswordChangedAt: new Date().toISOString()
    };

    try {
      setEmployees(prev => prev.map(e => e.id === employeeId ? updatedEmp : e));
      await syncToFirestore('employees', employeeId, updatedEmp);

      if (isSelf) {
        setCurrentUser(prev => prev ? { ...prev, password: trimmedNew } : null);
      }

      const now = new Date();
      const log: AuditLog = {
        id: 'aud-' + Date.now(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().substring(0, 5),
        userName: currentUser ? currentUser.name : 'System',
        employeeId: currentUser ? currentUser.id : 'OP-01',
        activity: `Ganti Sandi Karyawan [${targetEmp.name}]`,
        dataBefore: 'Kata sandi sebelumnya',
        dataAfter: `Kata sandi berhasil diperbarui oleh ${currentUser?.name || 'User'} (${isAdmin ? 'Akses Admin' : 'Mandiri'})`
      };
      setAuditLogs(prev => [log, ...prev]);
      await syncToFirestore('auditLogs', log.id, log);

      showNotification('success', 'Sandi Berhasil Diubah', `Kata sandi akun ${targetEmp.name} berhasil diperbarui.`);
      return { success: true, message: 'Kata sandi berhasil diperbarui.' };
    } catch (err: any) {
      console.error('Failed to change password:', err);
      showNotification('error', 'Gagal', 'Terjadi kesalahan saat menyimpan kata sandi baru: ' + (err.message || String(err)));
      return { success: false, message: 'Gagal menyimpan kata sandi: ' + (err.message || String(err)) };
    }
  };

  const toggleEmployee = (id: string) => {
    if (!canEdit && !isAdmin) {
      showNotification('error', 'Akses Ditolak', 'Hanya Admin atau Operator yang dapat mengubah status aktif personil.');
      return;
    }
    const item = employees.find(e => e.id === id);
    if (item) {
      if (item.name.toLowerCase() === 'indika') {
        showNotification('warning', 'Peringatan', 'Akun Administrator Indika tidak dapat dinonaktifkan.');
        return;
      }
      const updated = { ...item, active: !item.active };
      setEmployees(prev => prev.map(e => (e.id === id ? updated : e)));
      syncToFirestore('employees', id, updated);
      showNotification('info', 'Status Diubah', `Status ${item.name} diubah menjadi ${updated.active ? 'Aktif' : 'Non-Aktif'}.`);
    }
  };


  // Reset demo data / bersihkan pengujian & stok dari 0
  const resetDemoData = async (operatorPassword?: string): Promise<{ success: boolean; message: string }> => {
    const trimmedPass = (operatorPassword || '').trim().toLowerCase();
    const isOpPass = ['indika581196', 'agus777', 'riffky777', 'harun777', 'operator777'].includes(trimmedPass);
    const hasPermission = canEdit || isOpPass;
    if (!hasPermission) {
      showNotification('error', 'Akses Ditolak', 'Hanya Operator (atau dengan sandi Operator) yang dapat membersihkan data pengujian.');
      return { success: false, message: 'Akses Ditolak: Kata sandi Operator salah.' };
    }

    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, '[]');
      localStorage.setItem(STORAGE_KEYS.STOCKS, '[]');
      localStorage.setItem(STORAGE_KEYS.AUDIT, '[]');
      localStorage.setItem(STORAGE_KEYS.SIZES, '[]');

      setTransactions([]);
      setStocks([]);
      setAuditLogs([]);
      setMasterSizes([]);

      // Clear online documents in Firestore
      try {
        const txSnap = await getDocs(collection(db, 'transactions'));
        await Promise.all(txSnap.docs.map(d => deleteDoc(doc(db, 'transactions', d.id))));
      } catch (err) {
        console.warn('Error clearing firestore transactions:', err);
      }

      try {
        const stockSnap = await getDocs(collection(db, 'stocks'));
        await Promise.all(stockSnap.docs.map(d => deleteDoc(doc(db, 'stocks', d.id))));
      } catch (err) {
        console.warn('Error clearing firestore stocks:', err);
      }

      try {
        const auditSnap = await getDocs(collection(db, 'auditLogs'));
        await Promise.all(auditSnap.docs.map(d => deleteDoc(doc(db, 'auditLogs', d.id))));
      } catch (err) {
        console.warn('Error clearing firestore audit logs:', err);
      }

      try {
        const sizeSnap = await getDocs(collection(db, 'masterSizes'));
        await Promise.all(sizeSnap.docs.map(d => deleteDoc(doc(db, 'masterSizes', d.id))));
      } catch (err) {
        console.warn('Error clearing firestore master sizes:', err);
      }

      showNotification('success', 'Reset Berhasil', 'Seluruh data transaksi, saldo stok, dan ukuran berhasil dibersihkan. Sistem kembali pure kosong dari awal.');
      return { success: true, message: 'Data pengujian dan daftar ukuran berhasil dibersihkan, stok di-reset ke 0.' };
    } catch (err) {
      console.error('Reset error:', err);
      showNotification('error', 'Gagal Reset', 'Terjadi kendala saat membersihkan data.');
      return { success: false, message: 'Terjadi kesalahan saat membersihkan data.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isOperator,
        isAdmin,
        canEdit,
        login,
        logout,
        activeShift,
        setActiveShift,
        theme,
        setTheme,
        toggleTheme,
        transactions,
        stocks,
        employees,
        masterSizes,
        masterTypes,
        masterCustomers,
        auditLogs,
        thresholds,
        notifications,
        removeNotification,
        showNotification,
        addTransaction,
        convertPalletSpec,
        deleteTransaction,
        editTransaction,
        getStock,
        getStockStatus,
        updateThresholds,
        reviseStock,
        addMasterSize,
        toggleMasterSize,
        deleteMasterSize,
        addMasterType,
        toggleMasterType,
        deleteMasterType,
        addMasterCustomer,
        toggleMasterCustomer,
        deleteMasterCustomer,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        changePassword,
        toggleEmployee,
        resetDemoData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

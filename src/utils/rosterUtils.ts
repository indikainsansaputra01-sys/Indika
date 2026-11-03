import { ShiftType } from '../types';

export type RosterGroup = 'A' | 'B' | 'C' | 'D';
export type ShiftCode = '1' | '2' | '3' | 'OFF';

export interface CrewMember {
  no: number;
  idKaryawan: string;
  name: string;
  position: string;
}

export interface GroupRosterMeta {
  group: RosterGroup;
  groupName: string; // "Grup A"
  finPalletOperator: string; // "Rifky Maulana"
  finPalletShort: string; // "Riffky"
  operatorId: string;
  anchorOffset: number;
  crew: CrewMember[];
}

// 12-day cyclical pattern:
// 3 days Shift 3 -> 1 day OFF -> 3 days Shift 2 -> 1 day OFF -> 3 days Shift 1 -> 1 day OFF
export const CYCLE_PATTERN: ShiftCode[] = [
  '3', '3', '3', 'OFF',
  '2', '2', '2', 'OFF',
  '1', '1', '1', 'OFF'
];

export const GROUP_ROSTER_CONFIG: Record<RosterGroup, GroupRosterMeta> = {
  A: {
    group: 'A',
    groupName: 'Grup A',
    finPalletOperator: 'Rifky Maulana',
    finPalletShort: 'Riffky',
    operatorId: 'OP-04',
    anchorOffset: 2, // Sep 30: 3 -> Oct 1: 3 (idx 2)
    crew: [
      { no: 1, idKaryawan: '1151102', name: 'Andreas Maden', position: 'Ka. Shift' },
      { no: 2, idKaryawan: '2001934', name: 'Aji Permana', position: 'Core Plug' },
      { no: 3, idKaryawan: '2001916', name: 'Viki Firdaus', position: 'Vacuum' },
      { no: 4, idKaryawan: '2003001', name: 'Muhamad Lutfi Baihaqi', position: 'Vacuum' },
      { no: 5, idKaryawan: '2002961', name: 'Rafi Satria Ramadhan', position: 'KD' },
      { no: 6, idKaryawan: '2002927', name: 'Huzaifa Firstantyo Arya Wibowo', position: 'Gud. Kering' },
      { no: 7, idKaryawan: '2002967', name: 'Rifky Maulana', position: 'Fin. Pallet' },
      { no: 8, idKaryawan: '1150639', name: 'Dwi Septiana', position: 'Maintenance Produksi' },
    ]
  },
  B: {
    group: 'B',
    groupName: 'Grup B',
    finPalletOperator: 'Muhamad Agus Reza Santosa',
    finPalletShort: 'Agus',
    operatorId: 'OP-02',
    anchorOffset: 11, // Sep 30: 1 -> Oct 1: OFF (idx 11)
    crew: [
      { no: 9, idKaryawan: '1151129', name: 'M Thoriq Alfakhri S', position: 'Ka. Shift' },
      { no: 10, idKaryawan: '2001947', name: 'Bagas Irawan Widjanarko', position: 'Core Plug' },
      { no: 11, idKaryawan: '2001946', name: 'Arif Ardiansah', position: 'Vacuum' },
      { no: 12, idKaryawan: '2002968', name: 'Royan Maulana Ibrahim', position: 'Vacuum' },
      { no: 13, idKaryawan: '2001956', name: 'Miftah Farhan Hafidz', position: 'KD' },
      { no: 14, idKaryawan: '2002976', name: 'Zaidan Zahran Hibatullah', position: 'Gud. Kering' },
      { no: 15, idKaryawan: '2002945', name: 'Muhamad Agus Reza Santosa', position: 'Fin. Pallet' },
      { no: 16, idKaryawan: '1150624', name: 'Budi Hartono', position: 'Maintenance Produksi' },
    ]
  },
  C: {
    group: 'C',
    groupName: 'Grup C',
    finPalletOperator: 'Indika Insan Saputra',
    finPalletShort: 'Indika',
    operatorId: 'OP-01',
    anchorOffset: 8, // Sep 30: OFF -> Oct 1: 1 (idx 8)
    crew: [
      { no: 17, idKaryawan: '1151142', name: 'Muhammad Naufal Bimoriza Putra', position: 'Ka. Shift' },
      { no: 18, idKaryawan: '2001945', name: 'Ardi Yahya', position: 'Core Plug' },
      { no: 19, idKaryawan: '2002944', name: 'Mohamad Ari Darmawan', position: 'Vacuum' },
      { no: 20, idKaryawan: '2002969', name: 'Saddam Ramadhan Suwito', position: 'Vacuum' },
      { no: 21, idKaryawan: '2002951', name: 'Muhammad Febri Eka Haryono', position: 'KD' },
      { no: 22, idKaryawan: '2002912', name: 'Gugun Gumelar', position: 'Gud. Kering' },
      { no: 23, idKaryawan: '2002934', name: 'Indika Insan Saputra', position: 'Fin. Pallet' },
      { no: 24, idKaryawan: '1150643', name: 'Erick Ardiwiranata', position: 'Maintenance Produksi' },
    ]
  },
  D: {
    group: 'D',
    groupName: 'Grup D',
    finPalletOperator: 'Harun Syahpakih',
    finPalletShort: 'Harun',
    operatorId: 'OP-03',
    anchorOffset: 5, // Sep 30: 2 -> Oct 1: 2 (idx 5)
    crew: [
      { no: 25, idKaryawan: '2002566', name: 'Diki Irpanli', position: 'Ka. Shift' },
      { no: 26, idKaryawan: '2002960', name: 'Nurdiansyah Alifudin', position: 'Core Plug' },
      { no: 27, idKaryawan: '2003002', name: 'Indra Permana', position: 'Vacuum' },
      { no: 28, idKaryawan: '2002962', name: 'Rayhan Nurramdhani', position: 'Vacuum' },
      { no: 29, idKaryawan: '2001957', name: 'Kiki Sobandi', position: 'KD' },
      { no: 30, idKaryawan: '2002921', name: 'Harun Syahpakih', position: 'Fin. Pallet' },
      { no: 31, idKaryawan: '1150629', name: 'Danis Surbakti', position: 'Maintenance Produksi' },
    ]
  }
};

// Anchor Date: 2026-10-01 UTC
const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH = 9; // 0-indexed: 9 = October
const ANCHOR_DAY = 1;
const ANCHOR_UTC_MS = Date.UTC(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_DAY);

/**
 * Calculates days between anchor (2026-10-01) and target date string (YYYY-MM-DD).
 */
export function getDaysFromAnchor(dateStr: string): number {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 0;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const targetUtc = Date.UTC(y, m, d);
  return Math.round((targetUtc - ANCHOR_UTC_MS) / (1000 * 60 * 60 * 24));
}

/**
 * Maps an operator name or ID to their group ('A' | 'B' | 'C' | 'D').
 */
export function getGroupForOperator(nameOrId?: string | null): RosterGroup | null {
  if (!nameOrId) return null;
  const lower = nameOrId.toLowerCase().trim();

  // Group A - Riffky / Rifky Maulana
  if (lower.includes('riffky') || lower.includes('rifky') || lower === 'op-04') {
    return 'A';
  }
  // Group B - Agus / Muhamad Agus Reza Santosa
  if (lower.includes('agus') || lower === 'op-02') {
    return 'B';
  }
  // Group C - Indika / Indika Insan Saputra
  if (lower.includes('indika') || lower === 'op-01') {
    return 'C';
  }
  // Group D - Harun / Harun Syahpakih
  if (lower.includes('harun') || lower === 'op-03') {
    return 'D';
  }

  // Also match any crew member from the PDF
  for (const groupKey of ['A', 'B', 'C', 'D'] as RosterGroup[]) {
    const config = GROUP_ROSTER_CONFIG[groupKey];
    for (const member of config.crew) {
      if (
        member.name.toLowerCase().includes(lower) ||
        lower.includes(member.name.toLowerCase()) ||
        member.idKaryawan === lower
      ) {
        return groupKey;
      }
    }
  }

  return null;
}

export interface DayShiftResult {
  group: RosterGroup;
  date: string;
  shiftCode: ShiftCode;
  shiftLabel: ShiftType | 'OFF';
  isOff: boolean;
  dayInPhase: number; // 1, 2, 3 (work day of 3-day block) or 1 (for OFF)
  totalDaysInPhase: number; // 3 or 1
  phaseDescription: string; // e.g. "Hari ke-1 Shift 3", "Hari ke-3 Shift 2 (Terakhir)", "Hari Libur / OFF"
  operatorName: string;
  operatorShort: string;
}

/**
 * Calculates shift details for a group on a given date.
 */
export function getShiftForGroupAndDate(group: RosterGroup, dateStr: string): DayShiftResult {
  const meta = GROUP_ROSTER_CONFIG[group];
  const diffDays = getDaysFromAnchor(dateStr);
  const patternIndex = ((meta.anchorOffset + diffDays) % 12 + 12) % 12;
  const shiftCode = CYCLE_PATTERN[patternIndex];

  let shiftLabel: ShiftType | 'OFF' = 'OFF';
  let isOff = false;
  let dayInPhase = 1;
  const totalDaysInPhase = shiftCode === 'OFF' ? 1 : 3;
  let phaseDescription = '';

  if (shiftCode === '3') {
    shiftLabel = 'Shift 3';
    dayInPhase = patternIndex + 1; // 0->1, 1->2, 2->3
    phaseDescription = dayInPhase === 3 ? 'Shift 3 Hari ke-3 (Terakhir)' : `Shift 3 Hari ke-${dayInPhase}`;
  } else if (shiftCode === '2') {
    shiftLabel = 'Shift 2';
    dayInPhase = patternIndex - 4 + 1; // 4->1, 5->2, 6->3
    phaseDescription = dayInPhase === 3 ? 'Shift 2 Hari ke-3 (Terakhir)' : `Shift 2 Hari ke-${dayInPhase}`;
  } else if (shiftCode === '1') {
    shiftLabel = 'Shift 1';
    dayInPhase = patternIndex - 8 + 1; // 8->1, 9->2, 10->3
    phaseDescription = dayInPhase === 3 ? 'Shift 1 Hari ke-3 (Terakhir)' : `Shift 1 Hari ke-${dayInPhase}`;
  } else {
    isOff = true;
    shiftLabel = 'OFF';
    dayInPhase = 1;
    phaseDescription = 'Hari Libur / OFF';
  }

  return {
    group,
    date: dateStr,
    shiftCode,
    shiftLabel,
    isOff,
    dayInPhase,
    totalDaysInPhase,
    phaseDescription,
    operatorName: meta.finPalletOperator,
    operatorShort: meta.finPalletShort
  };
}

/**
 * Calculates shift details for an operator on a given date.
 * If the operator is not one of the 4 groups (e.g. Officer / SPV), defaults to null group or Shift 1.
 */
export function getOperatorShiftForDate(nameOrId: string, dateStr: string): DayShiftResult & { hasRoster: boolean } {
  const group = getGroupForOperator(nameOrId);
  if (!group) {
    return {
      group: 'C',
      date: dateStr,
      shiftCode: '1',
      shiftLabel: 'Shift 1',
      isOff: false,
      dayInPhase: 1,
      totalDaysInPhase: 3,
      phaseDescription: 'Jadwal Standar Operasional',
      operatorName: nameOrId,
      operatorShort: nameOrId,
      hasRoster: false
    };
  }

  const result = getShiftForGroupAndDate(group, dateStr);
  return {
    ...result,
    hasRoster: true
  };
}

export interface MonthRosterDay {
  date: string;
  dayNumber: number;
  dayName: string; // 'Sen' | 'Sel' | 'Rab' | 'Kam' | 'Jum' | 'Sab' | 'Min'
  fullDayName: string; // 'Senin' | 'Selasa' ...
  isSunday: boolean;
  isToday: boolean;
  shifts: Record<RosterGroup, DayShiftResult>;
}

const INDO_DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const INDO_FULL_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const MONTH_NAMES_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Generates roster schedule matrix for a full month (year, month 1..12).
 * Works perpetually for any month/year past or future.
 */
export function getMonthRoster(year: number, month: number): MonthRosterDay[] {
  // Number of days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const days: MonthRosterDay[] = [];
  const groups: RosterGroup[] = ['A', 'B', 'C', 'D'];

  for (let d = 1; d <= daysInMonth; d++) {
    const padM = String(month).padStart(2, '0');
    const padD = String(d).padStart(2, '0');
    const dateStr = `${year}-${padM}-${padD}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();

    const shifts: Record<RosterGroup, DayShiftResult> = {
      A: getShiftForGroupAndDate('A', dateStr),
      B: getShiftForGroupAndDate('B', dateStr),
      C: getShiftForGroupAndDate('C', dateStr),
      D: getShiftForGroupAndDate('D', dateStr)
    };

    days.push({
      date: dateStr,
      dayNumber: d,
      dayName: INDO_DAY_NAMES[dayOfWeek],
      fullDayName: INDO_FULL_DAY_NAMES[dayOfWeek],
      isSunday: dayOfWeek === 0,
      isToday: dateStr === todayStr,
      shifts
    });
  }

  return days;
}

/**
 * Returns summary stats for the group for the current month.
 */
export function getGroupMonthlySummary(year: number, month: number, group: RosterGroup) {
  const days = getMonthRoster(year, month);
  let shift1Count = 0;
  let shift2Count = 0;
  let shift3Count = 0;
  let offCount = 0;

  days.forEach((day) => {
    const s = day.shifts[group].shiftCode;
    if (s === '1') shift1Count++;
    else if (s === '2') shift2Count++;
    else if (s === '3') shift3Count++;
    else if (s === 'OFF') offCount++;
  });

  return {
    group,
    meta: GROUP_ROSTER_CONFIG[group],
    shift1Count,
    shift2Count,
    shift3Count,
    offCount,
    totalWorkDays: shift1Count + shift2Count + shift3Count,
    totalDays: days.length
  };
}

export interface DutyOperatorResult {
  group: RosterGroup;
  name: string; // "Harun", "Indika", "Agus", "Riffky"
  fullName: string; // "Harun Syahpakih", dll
  idKaryawan: string;
  position: string;
  groupName: string; // "Grup D", dll
  shiftLabel: ShiftType;
  date: string;
}

/**
 * Mendapatkan petugas operator Finish Pallet yang berdinas/jaga sesuai jadwal shift dan tanggal operasional.
 * Mengikuti matriks rotasi resmi 12 hari (Grup A, B, C, D).
 */
export function getDutyOperatorForShift(shift: ShiftType, dateStr?: string): DutyOperatorResult | null {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const groups: RosterGroup[] = ['A', 'B', 'C', 'D'];

  for (const g of groups) {
    const s = getShiftForGroupAndDate(g, targetDate);
    if (s.shiftLabel === shift) {
      const cfg = GROUP_ROSTER_CONFIG[g];
      return {
        group: g,
        name: cfg.finPalletShort,
        fullName: cfg.finPalletOperator,
        idKaryawan: cfg.operatorId,
        position: 'Operator Finish Pallet',
        groupName: cfg.groupName,
        shiftLabel: shift,
        date: targetDate
      };
    }
  }

  return null;
}


import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Shield,
  Sparkles
} from 'lucide-react';
import {
  RosterGroup,
  ShiftCode,
  GROUP_ROSTER_CONFIG,
  getMonthRoster,
  MONTH_NAMES_INDO,
  getOperatorShiftForDate,
  getGroupForOperator
} from '../../utils/rosterUtils';

export const ShiftRosterTable: React.FC = () => {
  const { currentUser } = useApp();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12
  const todayDateStr = today.toISOString().split('T')[0];

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [showCrewModal, setShowCrewModal] = useState<boolean>(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<RosterGroup | 'ALL'>('ALL');

  // Active user group
  const userGroup = useMemo(() => {
    return getGroupForOperator(currentUser?.name || currentUser?.id);
  }, [currentUser]);

  // Active user shift status today
  const userTodayShift = useMemo(() => {
    if (!currentUser?.name) return null;
    return getOperatorShiftForDate(currentUser.name, todayDateStr);
  }, [currentUser, todayDateStr]);

  // Generate month data
  const monthData = useMemo(() => {
    return getMonthRoster(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleResetToToday = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  };

  const getShiftBadgeStyle = (code: ShiftCode) => {
    switch (code) {
      case '1':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold hover:bg-emerald-200';
      case '2':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-bold hover:bg-blue-200';
      case '3':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold hover:bg-amber-200';
      case 'OFF':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold hover:bg-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const groups: RosterGroup[] = ['A', 'B', 'C', 'D'];

  return (
    <div className="bg-white dark:bg-[#0E1E2E] border border-[#E2E8F0] dark:border-[#1E3A52] rounded-xl overflow-hidden shadow-2xs">
      {/* Top Banner / User Shift Status */}
      <div className="bg-[#163653] border-b border-[#1E4366] p-4 sm:p-5 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#112B43] text-[#8CCCF0] border border-[#1E4366]">
                Roster Resmi 4 Grup (3 Hari Kerja - 1 Hari Libur)
              </span>
              <span className="text-xs text-[#8CCCF0]/70">Rotasi 3 ➔ 2 ➔ 1 ➔ OFF</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight mt-1 flex items-center gap-2 text-white">
              <span>JADWAL SHIFT PALLET WORKSHOP & CORE PLUG</span>
            </h2>
            <p className="text-xs text-[#CBD5E1] mt-0.5">
              Jadwal otomatis berkesinambungan. Mengunci pilihan shift pada form transaksi dan mencegah input saat libur.
            </p>
          </div>

          {/* User's Personalized Shift Pill */}
          {userTodayShift && userTodayShift.hasRoster && (
            <div className="p-3 rounded-lg bg-[#112B43] border border-[#1E4366] flex items-center gap-3 shrink-0 shadow-sm">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold font-mono text-sm shadow-inner ${
                  userTodayShift.shiftCode === '1'
                    ? 'bg-[#16805D] text-white'
                    : userTodayShift.shiftCode === '2'
                    ? 'bg-[#3886B8] text-white'
                    : userTodayShift.shiftCode === '3'
                    ? 'bg-[#D97706] text-white'
                    : 'bg-[#EF4444] text-white'
                }`}
              >
                {userTodayShift.shiftCode}
              </div>
              <div className="text-xs">
                <div className="text-[#8CCCF0]/80 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#8CCCF0]" />
                  <span>Jadwal Anda Hari Ini ({currentUser?.name}):</span>
                </div>
                <div className="font-bold text-white text-sm flex items-center gap-2 mt-0.5">
                  <span>{userTodayShift.isOff ? 'LIBUR / OFF' : userTodayShift.shiftLabel}</span>
                  <span className="text-[11px] font-normal text-[#8CCCF0]">
                    ({userTodayShift.phaseDescription})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar: Month Navigation & Actions */}
        <div className="mt-4 pt-3.5 border-t border-[#1E4366] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-[#112B43] hover:bg-[#1E4366] text-white border border-[#1E4366] cursor-pointer transition-colors"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 font-bold text-sm bg-[#112B43] px-3 py-1.5 rounded-lg border border-[#1E4366] text-white">
              <Calendar className="w-4 h-4 text-[#8CCCF0]" />
              <span>
                {MONTH_NAMES_INDO[selectedMonth - 1]} {selectedYear}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-[#112B43] hover:bg-[#1E4366] text-white border border-[#1E4366] cursor-pointer transition-colors"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {(selectedMonth !== currentMonth || selectedYear !== currentYear) && (
              <button
                onClick={handleResetToToday}
                className="px-2.5 py-1.5 rounded-lg bg-[#3886B8] hover:bg-[#2D739E] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Hari Ini
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCrewModal(true)}
              className="px-3 py-1.5 bg-[#112B43] hover:bg-[#1E4366] text-white border border-[#1E4366] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-white" />
              <span>Daftar Kru 4 Grup ({31} Anggota)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Roster Matrix Table (Scrollable on small screens) */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center select-none">
          <thead>
            {/* Row 1: Month Name Banner */}
            <tr className="bg-slate-200/80 dark:bg-[#112B43] border-b border-slate-300 dark:border-[#1E4366] text-slate-900 dark:text-white font-extrabold text-xs uppercase tracking-wider">
              <th className="py-2.5 px-3 text-left w-36 sm:w-44 sticky left-0 bg-slate-200 dark:bg-[#112B43] z-10 border-r border-slate-300 dark:border-[#1E4366] shadow-xs">
                GRUP & OPERATOR
              </th>
              <th colSpan={monthData.length} className="py-2.5 px-2 text-center text-slate-900 dark:text-white font-extrabold">
                {MONTH_NAMES_INDO[selectedMonth - 1].toUpperCase()} {selectedYear}
              </th>
            </tr>

            {/* Row 2: Day Numbers (1 .. 31) */}
            <tr className="bg-slate-100 dark:bg-[#163653] border-b border-slate-300 dark:border-[#1E4366] text-[11.5px] font-mono text-slate-900 dark:text-white font-extrabold">
              <th className="py-2 px-3 text-left sticky left-0 bg-slate-100 dark:bg-[#163653] z-10 border-r border-slate-300 dark:border-[#1E4366]">
                TANGGAL
              </th>
              {monthData.map((d) => (
                <th
                  key={`num-${d.date}`}
                  className={`py-2 px-1 min-w-[32px] sm:min-w-[36px] ${
                    d.isToday
                      ? 'bg-blue-600 text-white font-extrabold ring-2 ring-blue-400 ring-inset shadow-xs'
                      : d.isSunday
                      ? 'text-rose-700 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/40 font-black'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                  title={`${d.fullDayName}, ${d.dayNumber} ${MONTH_NAMES_INDO[selectedMonth - 1]} ${selectedYear}${
                    d.isToday ? ' (Hari Ini)' : ''
                  }`}
                >
                  {d.dayNumber}
                </th>
              ))}
            </tr>

            {/* Row 3: Day Names (Kam, Jum, Sab, Min...) */}
            <tr className="bg-slate-100/90 dark:bg-[#112B43]/90 border-b border-slate-300 dark:border-[#1E4366] text-[10.5px] text-slate-800 dark:text-slate-200 font-bold">
              <th className="py-1.5 px-3 text-left sticky left-0 bg-slate-100 dark:bg-[#112B43] z-10 border-r border-slate-300 dark:border-[#1E4366]">
                HARI
              </th>
              {monthData.map((d) => (
                <th
                  key={`name-${d.date}`}
                  className={`py-1.5 px-1 ${
                    d.isToday
                      ? 'bg-blue-600 text-white font-extrabold'
                      : d.isSunday
                      ? 'text-rose-700 dark:text-rose-400 font-black bg-rose-100/60 dark:bg-rose-950/40'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {d.dayName}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs">
            {groups.map((grpKey) => {
              const meta = GROUP_ROSTER_CONFIG[grpKey];
              const isUserRow = userGroup === grpKey;

              return (
                <tr
                  key={`grp-${grpKey}`}
                  className={`transition-colors ${
                    isUserRow ? 'bg-indigo-50/40 font-semibold' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Left Column: Group & Operator info */}
                  <td
                    className={`py-2 px-3 text-left sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap shadow-xs ${
                      isUserRow ? 'bg-indigo-50/90' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                          grpKey === 'A'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : grpKey === 'B'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : grpKey === 'C'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}
                      >
                        {grpKey}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                          <span>{meta.groupName}</span>
                          {isUserRow && (
                            <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-bold">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={meta.finPalletOperator}>
                          {meta.finPalletShort}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Shift cells for each day */}
                  {monthData.map((d) => {
                    const shiftInfo = d.shifts[grpKey];
                    const badgeClass = getShiftBadgeStyle(shiftInfo.shiftCode);

                    return (
                      <td
                        key={`cell-${grpKey}-${d.date}`}
                        className={`p-1 align-middle ${
                          d.isToday
                            ? 'bg-indigo-50/60 ring-1 ring-indigo-400 ring-inset'
                            : d.isSunday
                            ? 'bg-rose-50/20'
                            : ''
                        }`}
                        title={`${meta.groupName} (${meta.finPalletShort}): ${
                          shiftInfo.isOff ? 'LIBUR / OFF' : shiftInfo.shiftLabel
                        } (${shiftInfo.phaseDescription}) pada ${d.fullDayName}, ${d.dayNumber} ${
                          MONTH_NAMES_INDO[selectedMonth - 1]
                        }`}
                      >
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded flex items-center justify-center text-[11px] border transition-all ${badgeClass} ${
                            d.isToday ? 'scale-105 shadow-xs ring-1 ring-indigo-500' : ''
                          }`}
                        >
                          {shiftInfo.shiftCode}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend & SOP Notice Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-700">Keterangan Shift:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-[10px]">
              1
            </span>
            <span>Shift 1 (07:00 - 15:00)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 border border-blue-300 flex items-center justify-center font-bold text-[10px]">
              2
            </span>
            <span>Shift 2 (15:00 - 23:00)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold text-[10px]">
              3
            </span>
            <span>Shift 3 (23:00 - 07:00)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-5 rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center font-bold text-[10px]">
              OFF
            </span>
            <span>Libur Roster 1 Hari</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Sistem mengunci otomatis shift input transaksi sesuai jadwal di atas.</span>
        </div>
      </div>

      {/* Modal: Full Crew Roster List from PDF Page 2 */}
      {showCrewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Daftar Anggota Kru 4 Grup Pallet Workshop & Core Plug</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lampiran resmi susunan regu kerja Pallet Workshop (Sesuai Dokumen Roster 2026)
                </p>
              </div>
              <button
                onClick={() => setShowCrewModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Group Filter Tabs */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveGroupFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  activeGroupFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                Semua Grup (31 Karyawan)
              </button>
              {groups.map((grp) => (
                <button
                  key={`tab-${grp}`}
                  onClick={() => setActiveGroupFilter(grp)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeGroupFilter === grp
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  <span>Grup {grp}</span>
                  <span className="text-[11px] opacity-80">({GROUP_ROSTER_CONFIG[grp].finPalletShort})</span>
                </button>
              ))}
            </div>

            {/* Crew Table List */}
            <div className="overflow-y-auto p-4 space-y-4">
              {groups
                .filter((grp) => activeGroupFilter === 'ALL' || activeGroupFilter === grp)
                .map((grp) => {
                  const meta = GROUP_ROSTER_CONFIG[grp];
                  return (
                    <div key={`crew-grp-${grp}`} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            {meta.groupName}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            · Operator Finish Pallet: <b className="text-slate-800">{meta.finPalletOperator}</b>
                          </span>
                        </div>
                        <span className="text-xs bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                          {meta.crew.length} Karyawan
                        </span>
                      </div>

                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3 w-10 text-center">No</th>
                            <th className="py-2 px-3 w-24">ID Karyawan</th>
                            <th className="py-2 px-3">Nama Karyawan</th>
                            <th className="py-2 px-3">Posisi / Bagian</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {meta.crew.map((member) => {
                            const isFinPallet = member.position.toLowerCase().includes('fin. pallet');
                            const isKaShift = member.position.toLowerCase().includes('ka. shift');

                            return (
                              <tr
                                key={member.idKaryawan}
                                className={`hover:bg-slate-50/80 transition-colors ${
                                  isFinPallet ? 'bg-amber-50/50 font-semibold' : ''
                                }`}
                              >
                                <td className="py-2 px-3 text-center text-slate-400 font-mono">
                                  {member.no}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600">
                                  {member.idKaryawan}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span>{member.name}</span>
                                    {isFinPallet && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        Operator Finish Pallet
                                      </span>
                                    )}
                                    {isKaShift && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                        Ka. Shift
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {member.position}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowCrewModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

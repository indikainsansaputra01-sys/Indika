import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, Search, Download, Calendar, Filter } from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();
  const [search, setSearch] = useState('');
  const [filterActivity, setFilterActivity] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch =
        !search.trim() ||
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.employeeId.toLowerCase().includes(search.toLowerCase()) ||
        log.activity.toLowerCase().includes(search.toLowerCase()) ||
        (log.dataAfter && log.dataAfter.toLowerCase().includes(search.toLowerCase())) ||
        (log.dataBefore && log.dataBefore.toLowerCase().includes(search.toLowerCase()));

      const matchActivity = filterActivity === 'ALL' || log.activity === filterActivity;

      return matchSearch && matchActivity;
    });
  }, [auditLogs, search, filterActivity]);

  const uniqueActivities = useMemo(() => {
    const set = new Set(auditLogs.map(l => l.activity));
    return Array.from(set);
  }, [auditLogs]);

  const handleExport = () => {
    const headers = ['No', 'Tanggal', 'Jam', 'User / Operator', 'ID Karyawan', 'Aktivitas', 'Data Sebelum', 'Data Sesudah'];
    const rows = filteredLogs.map((l, idx) => [
      idx + 1,
      l.date,
      l.time,
      l.userName,
      l.employeeId,
      l.activity,
      l.dataBefore || '-',
      l.dataAfter || '-'
    ]);
    exportToExcel({
      filename: `Audit_Log_FPMS_${new Date().toISOString().split('T')[0]}`,
      reportTitle: 'BUKU AUDIT LOG & JEJAK SISTEM OPERASIONAL',
      periodLabel: `Semua Jejak Audit (${filteredLogs.length} Entri)`,
      headers,
      rows,
      signatures: true
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-600 text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">AUDIT LOG & JEJAK SISTEM</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Rekam jejak setiap aksi krusial operator dan supervisor untuk akuntabilitas operasional pabrik.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Log Excel</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari user, ID, aktivitas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-emerald-600 text-slate-800"
          />
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Filter Aktivitas:</span>
          <select
            value={filterActivity}
            onChange={(e) => setFilterActivity(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-600 bg-white"
          >
            <option value="ALL">Semua Aktivitas ({auditLogs.length})</option>
            {uniqueActivities.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Tanggal & Jam</th>
                <th className="py-3 px-3">User & ID</th>
                <th className="py-3 px-3">Aktivitas</th>
                <th className="py-3 px-3">Data Sebelum</th>
                <th className="py-3 px-3">Data Sesudah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    Tidak ada catatan audit yang cocok.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      <div>{log.date}</div>
                      <div className="text-[10px] text-slate-400">{log.time}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                      <div className="font-bold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{log.employeeId}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {log.activity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={log.dataBefore}>
                      {log.dataBefore || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 max-w-sm truncate" title={log.dataAfter}>
                      {log.dataAfter || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Plus, Check, X, Trash2, Power } from 'lucide-react';

export const MasterUser: React.FC = () => {
  const { masterCustomers, addMasterCustomer, toggleMasterCustomer, deleteMasterCustomer, isOperator } = useApp();
  const [newCustName, setNewCustName] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOperator) return;
    if (!newCustName.trim()) return;
    addMasterCustomer(newCustName.trim());
    setNewCustName('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 text-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-600 text-white">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">MASTER DATA USER / CUSTOMER</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Daftar departemen, line produksi, dan entitas tujuan pengiriman pallet (User A, User B, Pindo 1, dll).
          </p>
        </div>
      </div>

      {/* Add Form */}
      {isOperator && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-xs">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            + Tambah User / Departemen Tujuan
          </h2>
          <form onSubmit={handleAdd} className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Contoh: User D, Cutting Area, Gudang Bahan Baku..."
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
                required
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan User</span>
            </button>
          </form>
        </div>
      )}

      {/* List Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700 uppercase">
            Daftar User / Customer ({masterCustomers.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Nama User / Customer</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {masterCustomers.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900 text-sm">
                    {item.name}
                  </td>
                  <td className="py-2.5 px-3">
                    {item.active ? (
                      <span className="text-emerald-700 font-semibold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Aktif
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs flex items-center gap-1">
                        <X className="w-3.5 h-3.5" />
                        Non-Aktif
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleMasterCustomer(item.id)}
                        title={item.active ? 'Nonaktifkan' : 'Aktifkan'}
                        className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      {itemToDelete === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              deleteMasterCustomer(item.id);
                              setItemToDelete(null);
                            }}
                            className="px-1.5 py-0.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setItemToDelete(null)}
                            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setItemToDelete(item.id)}
                          title="Hapus"
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

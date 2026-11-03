import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  UserCheck,
  Plus,
  Check,
  X,
  Shield,
  User,
  Power,
  Eye,
  EyeOff,
  Key,
  Trash2,
  Edit3,
  Lock,
  Copy,
  CheckCheck,
  AlertTriangle,
  UserPlus,
  ShieldAlert,
  Search,
  RefreshCw
} from 'lucide-react';
import { Employee, ShiftType } from '../../types';
import { EmployeeAvatar, AVATAR_OPTIONS, AvatarVariant, resolveAvatarVariant } from '../common/EmployeeAvatar';

export const MasterKaryawan: React.FC = () => {
  const {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    changePassword,
    toggleEmployee,
    currentUser,
    isOperator,
    isAdmin,
    showNotification
  } = useApp();

  // Add Employee Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Employee['role']>('operator');
  const [newTitle, setNewTitle] = useState('Operator Finish Pallet');
  const [newShift, setNewShift] = useState<ShiftType>('Shift 1');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newAvatarVariant, setNewAvatarVariant] = useState<AvatarVariant>('operator_yellow');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'operator' | 'monitoring' | 'admin'>('all');

  // Password Visibility State (Admin can view others; users can view own)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Change Password Modal State
  const [passwordModalEmp, setPasswordModalEmp] = useState<Employee | null>(null);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showModalNewPass, setShowModalNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  // Edit Employee Modal State (Admin only)
  const [editModalEmp, setEditModalEmp] = useState<Employee | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Employee['role']>('operator');
  const [editTitle, setEditTitle] = useState('');
  const [editShift, setEditShift] = useState<ShiftType>('Shift 1');
  const [editPassword, setEditPassword] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [editAvatarVariant, setEditAvatarVariant] = useState<AvatarVariant>('operator_yellow');
  const [showEditPass, setShowEditPass] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<Employee | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Quick Role change in Add Form
  const handleRoleChange = (role: Employee['role']) => {
    setNewRole(role);
    if (role === 'operator') {
      setNewTitle('Operator Finish Pallet');
      setNewAvatarVariant(newName.toLowerCase().includes('indika') ? 'indika_glasses' : 'operator_yellow');
      if (!newPassword) setNewPassword(newName ? `${newName}777` : 'Operator777');
    } else if (role === 'officer') {
      setNewTitle('Officer Finish Pallet');
      setNewAvatarVariant('officer_white_1');
      if (!newPassword) setNewPassword('Monitoring123');
    } else if (role === 'leadershift') {
      setNewTitle('Leadershift Finish Pallet');
      setNewAvatarVariant('officer_white_1');
      if (!newPassword) setNewPassword('Monitoring123');
    } else if (role === 'spv') {
      setNewTitle('Supervisor (SPV)');
      setNewAvatarVariant('officer_white_2');
      if (!newPassword) setNewPassword('Monitoring123');
    }
  };

  // Quick Role change in Edit Form
  const handleEditRoleChange = (role: Employee['role']) => {
    setEditRole(role);
    if (role === 'operator') {
      if (!editTitle.includes('Operator')) setEditTitle('Operator Finish Pallet');
      setEditAvatarVariant(editName.toLowerCase().includes('indika') ? 'indika_glasses' : 'operator_yellow');
    } else if (role === 'officer') {
      if (!editTitle.includes('Officer')) setEditTitle('Officer Finish Pallet');
      setEditAvatarVariant('officer_white_1');
    } else if (role === 'leadershift') {
      if (!editTitle.includes('Leadershift')) setEditTitle('Leadershift Finish Pallet');
      setEditAvatarVariant('officer_white_1');
    } else if (role === 'spv') {
      if (!editTitle.includes('Supervisor')) setEditTitle('Supervisor (SPV)');
      setEditAvatarVariant('officer_white_2');
    }
  };

  // Submit Add Employee
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmittingAdd(true);
    try {
      const res = await addEmployee({
        name: newName.trim(),
        role: newRole,
        title: newTitle.trim(),
        shiftPreference: newShift,
        password: newPassword.trim(),
        isAdmin: isAdmin ? newIsAdmin : false,
        avatarVariant: newAvatarVariant
      });

      if (res.success) {
        setNewName('');
        setNewPassword('');
        setNewIsAdmin(false);
        setNewAvatarVariant('operator_yellow');
        setShowAddForm(false);
      }
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Change Password Modal
  const openPasswordModal = (emp: Employee) => {
    setPasswordModalEmp(emp);
    setOldPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setShowModalNewPass(false);
  };

  // Submit Change Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalEmp) return;

    setPasswordError('');

    if (newPasswordInput.length < 4) {
      setPasswordError('Kata sandi baru minimal 4 karakter');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('Konfirmasi kata sandi tidak cocok dengan kata sandi baru');
      return;
    }

    setIsSubmittingPass(true);
    try {
      const res = await changePassword(
        passwordModalEmp.id,
        newPasswordInput.trim(),
        oldPasswordInput.trim() || undefined
      );

      if (res.success) {
        setPasswordModalEmp(null);
      } else {
        setPasswordError(res.message);
      }
    } catch {
      setPasswordError('Terjadi kesalahan saat memproses ganti sandi');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  // Open Edit Modal (Admin only)
  const openEditModal = (emp: Employee) => {
    setEditModalEmp(emp);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditTitle(emp.title);
    setEditShift(emp.shiftPreference || 'Shift 1');
    setEditPassword(emp.password || '');
    setEditIsAdmin(Boolean(emp.isAdmin || emp.name.toLowerCase() === 'indika'));
    setEditActive(emp.active);
    setEditAvatarVariant(resolveAvatarVariant(emp));
    setShowEditPass(false);
  };

  // Submit Edit Employee
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalEmp) return;

    setIsSubmittingEdit(true);
    try {
      const res = await updateEmployee(editModalEmp.id, {
        name: editName.trim(),
        role: editRole,
        title: editTitle.trim(),
        shiftPreference: editShift,
        password: editPassword.trim(),
        isAdmin: editName.toLowerCase() === 'indika' ? true : editIsAdmin,
        active: editActive,
        avatarVariant: editAvatarVariant
      });

      if (res.success) {
        setEditModalEmp(null);
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit Delete Employee
  const handleDeleteSubmit = async () => {
    if (!deleteConfirmEmp) return;
    setIsSubmittingDelete(true);
    try {
      const res = await deleteEmployee(deleteConfirmEmp.id);
      if (res.success) {
        setDeleteConfirmEmp(null);
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Toggle Password Reveal in Table
  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy password to clipboard
  const handleCopyPassword = (emp: Employee) => {
    const defaultPass =
      emp.role === 'operator'
        ? emp.name.toLowerCase() === 'indika'
          ? 'Indika581196'
          : `${emp.name}777`
        : 'Monitoring123';
    const pwd = emp.password || defaultPass;
    navigator.clipboard.writeText(pwd);
    setCopiedId(emp.id);
    showNotification('info', 'Sandi Disalin', `Sandi untuk ${emp.name} telah disalin ke clipboard.`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Helper check if current row is current user
  const isSelf = (emp: Employee) => {
    if (!currentUser) return false;
    return (
      currentUser.id === emp.id ||
      currentUser.name.toLowerCase() === emp.name.toLowerCase()
    );
  };

  // Filtering
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      emp.name.toLowerCase().includes(q) ||
      emp.id.toLowerCase().includes(q) ||
      emp.title.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (roleFilter === 'admin') return emp.isAdmin || emp.name.toLowerCase() === 'indika';
    if (roleFilter === 'operator') return emp.role === 'operator';
    if (roleFilter === 'monitoring') return emp.role !== 'operator';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Banner Utama */}
      <div className="bg-[#163653] border border-[#1E4366] rounded-xl p-5 sm:p-6 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#3886B8] text-white shrink-0 shadow-xs mt-0.5">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  MASTER DATA KARYAWAN & KEAMANAN AKUN
                </h1>
                {isAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" />
                    HAK ADMIN AKTIF (INDIKA)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Manajemen personil, hak akses, dan pengaturan kata sandi akun. Setiap personil yang login
                memiliki akses untuk mengubah kata sandi akun pribadinya sendiri.
                {isAdmin && (
                  <span className="text-amber-300 font-semibold ml-1">
                    Sebagai Admin, Anda memiliki hak istimewa untuk melihat kata sandi, menambah, mengedit,
                    dan mengurangi karyawan.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action: Ganti Sandi Akun Sendiri & Tambah Karyawan */}
          <div className="flex flex-wrap items-center gap-2 sm:self-center shrink-0">
            {currentUser && (
              <button
                onClick={() => {
                  const currentEmp = employees.find((e) => isSelf(e)) || currentUser;
                  openPasswordModal(currentEmp);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Key className="w-4 h-4 text-amber-400" />
                <span>Ganti Sandi Saya</span>
              </button>
            )}

            {(isAdmin || isOperator) && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>{showAddForm ? 'Tutup Form' : '+ Tambah Karyawan'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Current User Status Banner */}
        {currentUser && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <EmployeeAvatar
                employee={currentUser}
                size="md"
                initialsPosition="beside"
                showAdminBadge={isAdmin}
              />
              <div>
                <div className="text-slate-300">
                  Akun yang Sedang Login:{' '}
                  <strong className="text-white font-bold">{currentUser.name}</strong>{' '}
                  <span className="text-slate-400">({currentUser.title})</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Seragam Kerja: Kemeja Biru Muda Indah Kiat Karawang
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Peran: <strong className="text-blue-300 uppercase">{currentUser.role}</strong>
              </span>
              {isAdmin ? (
                <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" /> Admin Access
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  Ganti Sandi: Hanya Akun Pribadi
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form Tambah Personil / Karyawan Baru */}
      {showAddForm && (isAdmin || isOperator) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Pendaftaran Karyawan / Personil Baru
              </h2>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Nama Karyawan */}
              <div>
                <label className="block text-xs text-slate-700 font-bold mb-1">
                  Nama Lengkap Karyawan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newPassword) {
                      const clean = e.target.value.trim().replace(/\s+/g, '');
                      if (newRole === 'operator') {
                        setNewPassword(clean ? `${clean}777` : '');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-medium"
                  required
                />
              </div>

              {/* Peran / Hak Akses */}
              <div>
                <label className="block text-xs text-slate-700 font-bold mb-1">
                  Peran / Wewenang Operasional *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => handleRoleChange(e.target.value as Employee['role'])}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 bg-white font-medium"
                >
                  <option value="operator">Operator (Bisa Input/Edit Transaksi & Master)</option>
                  <option value="officer">Officer (Hanya Monitoring)</option>
                  <option value="leadershift">Leadershift (Hanya Monitoring)</option>
                  <option value="spv">Supervisor / SPV (Hanya Monitoring)</option>
                </select>
              </div>

              {/* Jabatan / Title */}
              <div>
                <label className="block text-xs text-slate-700 font-bold mb-1">
                  Jabatan / Titel di Label
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Operator Finish Pallet"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                  required
                />
              </div>

              {/* Shift Preferensi */}
              <div>
                <label className="block text-xs text-slate-700 font-bold mb-1">
                  Shift Kerja Standar
                </label>
                <select
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value as ShiftType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 bg-white font-medium"
                >
                  <option value="Shift 1">Shift 1 (07:00 - 15:00)</option>
                  <option value="Shift 2">Shift 2 (15:00 - 23:00)</option>
                  <option value="Shift 3">Shift 3 (23:00 - 07:00)</option>
                </select>
              </div>

              {/* KATA SANDI (Requirement user) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-700 font-bold">
                    Kata Sandi Akun Baru *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = (newName || 'User').trim().replace(/\s+/g, '');
                      setNewPassword(newRole === 'operator' ? `${clean}777` : 'Monitoring123');
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    Set Standar
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Masukkan sandi..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Sandi ini dapat diubah kemudian oleh karyawan yang bersangkutan.
                </p>
              </div>

              {/* Admin Privileges (Admin only can grant) */}
              {isAdmin && (
                <div className="flex flex-col justify-center">
                  <label className="block text-xs text-slate-700 font-bold mb-1">
                    Wewenang Tambahan Administrator
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-amber-200 bg-amber-50/60 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={newIsAdmin}
                      onChange={(e) => setNewIsAdmin(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-amber-900 block text-xs">
                        Jadikan Administrator
                      </span>
                      <span className="text-[10px] text-amber-700 block">
                        Dapat melihat semua sandi & mengelola personil
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Pilihan Karakter Kartun Karyawan Seragam Indah Kiat */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs text-slate-700 font-bold mb-1.5">
                Karakter Kartun Karyawan (Seragam Kemeja Biru Muda Indah Kiat Karawang) *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {AVATAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewAvatarVariant(opt.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      newAvatarVariant === opt.id
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
                      <img src={opt.src} alt={opt.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{opt.label}</div>
                      <div className="text-[10px] text-slate-500 truncate leading-tight">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmittingAdd ? 'Menyimpan...' : 'Simpan Karyawan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama karyawan / ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 font-semibold shrink-0">Filter:</span>
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              roleFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({employees.length})
          </button>
          <button
            onClick={() => setRoleFilter('operator')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              roleFilter === 'operator'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Operator ({employees.filter((e) => e.role === 'operator').length})
          </button>
          <button
            onClick={() => setRoleFilter('monitoring')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              roleFilter === 'monitoring'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Monitoring ({employees.filter((e) => e.role !== 'operator').length})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              roleFilter === 'admin'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Admin ({employees.filter((e) => e.isAdmin || e.name.toLowerCase() === 'indika').length})
          </button>
        </div>
      </div>

      {/* Main Employee Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Personil Terdaftar ({filteredEmployees.length})
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Sistem Autentikasi Pabrik Finish Pallet · PT Indah Kiat Pulp & Paper Tbk
            </p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                Mode Admin: Sandi Terbuka & Kontrol Penuh
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3.5 w-16">ID</th>
                <th className="py-3 px-3.5">Nama Karyawan</th>
                <th className="py-3 px-3.5">Jabatan & Wewenang</th>
                <th className="py-3 px-3.5">Shift Standar</th>
                <th className="py-3 px-3.5">Kata Sandi</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-center">Aksi / Ganti Sandi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    Tidak ada karyawan yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((item) => {
                  const itemIsAdmin = Boolean(item.isAdmin || item.name.toLowerCase() === 'indika');
                  const itemIsSelf = isSelf(item);
                  const canSeePassword = isAdmin || itemIsSelf;
                  const isRevealed = Boolean(revealedPasswords[item.id]);

                  // Determine effective password display
                  const defaultPass =
                    item.role === 'operator'
                      ? item.name.toLowerCase() === 'indika'
                        ? 'Indika581196'
                        : `${item.name}777`
                      : 'Monitoring123';
                  const plainPassword = item.password || defaultPass;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        itemIsSelf ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* ID */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-800 text-[11px]">
                        {item.id}
                      </td>

                      {/* Nama Karyawan */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar
                            employee={item}
                            size="sm"
                            initialsPosition="corner"
                            showAdminBadge={itemIsAdmin}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200 lowercase font-bold">
                                {item.name.slice(0, 2).toLowerCase()}
                              </span>
                              {itemIsAdmin && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                                  <Shield className="w-3 h-3 text-amber-600" />
                                  ADMIN
                                </span>
                              )}
                              {itemIsSelf && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                  Anda
                                </span>
                              )}
                            </div>
                            {item.lastPasswordChangedAt && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Sandi diubah: {new Date(item.lastPasswordChangedAt).toLocaleDateString('id-ID')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Jabatan & Wewenang */}
                      <td className="py-3 px-3.5">
                        {item.role === 'operator' ? (
                          <div>
                            <span className="text-blue-900 font-bold flex items-center gap-1 text-xs">
                              <User className="w-3.5 h-3.5 text-blue-600" />
                              {item.title}
                            </span>
                            <span className="text-[10px] text-blue-600 font-medium block mt-0.5">
                              Bisa Input & Edit Transaksi
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-800 font-bold flex items-center gap-1 text-xs">
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              {item.title}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                              Hanya Monitoring
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-3.5 text-slate-600 font-medium text-xs">
                        <span className="px-2 py-1 bg-slate-100 rounded text-[11px] font-mono">
                          {item.shiftPreference || 'Shift 1'}
                        </span>
                      </td>

                      {/* KATA SANDI COLUMN (Admin can view others; non-admin can only see own or masked) */}
                      <td className="py-3 px-3.5">
                        {canSeePassword ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-1 rounded font-mono text-xs border ${
                                isRevealed
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 tracking-widest'
                              }`}
                            >
                              {isRevealed ? plainPassword : '••••••••'}
                            </span>

                            {/* Reveal Toggle Eye Button */}
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(item.id)}
                              title={isRevealed ? 'Sembunyikan Sandi' : 'Lihat Sandi'}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              {isRevealed ? (
                                <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(item)}
                              title="Salin Sandi"
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              {copiedId === item.id ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400 text-xs font-mono">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span className="tracking-widest">••••••••</span>
                            <span className="text-[10px] text-slate-400 ml-1">(Terproteksi)</span>
                          </div>
                        )}
                      </td>

                      {/* Status Aktif */}
                      <td className="py-3 px-3.5 text-center">
                        {item.active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <X className="w-3 h-3" />
                            Nonaktif
                          </span>
                        )}
                      </td>

                      {/* Aksi / Ganti Sandi */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Button Ganti Sandi:
                              - Non-admin: ONLY allowed for their own account
                              - Admin: allowed for ANY account */}
                          {(isAdmin || itemIsSelf) && (
                            <button
                              type="button"
                              onClick={() => openPasswordModal(item)}
                              title={itemIsSelf ? 'Ganti Sandi Akun Saya' : `Ubah Sandi ${item.name}`}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                itemIsSelf
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              <Key className="w-3 h-3" />
                              <span>{itemIsSelf ? 'Ganti Sandi' : 'Reset Sandi'}</span>
                            </button>
                          )}

                          {/* Admin Only Actions: Edit & Delete & Toggle Active */}
                          {isAdmin && (
                            <>
                              {/* Edit Employee Info */}
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title={`Edit data ${item.name}`}
                                className="p-1.5 rounded text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Active status */}
                              <button
                                type="button"
                                onClick={() => toggleEmployee(item.id)}
                                title={item.active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                className={`p-1.5 rounded transition-colors cursor-pointer ${
                                  item.active
                                    ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                                    : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Employee (Indika cannot delete himself) */}
                              {item.name.toLowerCase() !== 'indika' && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmEmp(item)}
                                  title={`Hapus karyawan ${item.name}`}
                                  className="p-1.5 rounded text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}

                          {/* If not self and not admin: Show lock indicator */}
                          {!isAdmin && !itemIsSelf && (
                            <span className="text-[11px] text-slate-400 italic">
                              Hanya Pemilik Akun
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL GANTI KATA SANDI */}
      {/* ============================================================ */}
      {passwordModalEmp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <EmployeeAvatar
                  employee={passwordModalEmp}
                  size="md"
                  initialsPosition="corner"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ganti Kata Sandi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Akun: <strong className="text-slate-800">{passwordModalEmp.name}</strong> ({passwordModalEmp.title})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalEmp(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="mt-3 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3.5">
              {/* If non-admin user changing their own password, ask for old password */}
              {!isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kata Sandi Lama Anda *
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan sandi lama..."
                    value={oldPasswordInput}
                    onChange={(e) => setOldPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Diperlukan untuk memverifikasi bahwa Anda adalah pemilik sah akun ini.
                  </p>
                </div>
              )}

              {isAdmin && passwordModalEmp.name.toLowerCase() !== currentUser?.name.toLowerCase() && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                  <span className="font-bold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-amber-600" /> Mode Administrator
                  </span>
                  Sebagai Admin, Anda dapat mengatur ulang (reset) sandi karyawan ini tanpa sandi lama.
                </div>
              )}

              {/* Sandi Baru */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Kata Sandi Baru *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = passwordModalEmp.name.trim().replace(/\s+/g, '');
                      setNewPasswordInput(passwordModalEmp.role === 'operator' ? `${clean}777` : 'Monitoring123');
                      setConfirmPasswordInput(passwordModalEmp.role === 'operator' ? `${clean}777` : 'Monitoring123');
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    Pakai Standar
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showModalNewPass ? 'text' : 'password'}
                    placeholder="Minimal 4 karakter..."
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalNewPass(!showModalNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showModalNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Sandi Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ulangi Kata Sandi Baru *
                </label>
                <input
                  type={showModalNewPass ? 'text' : 'password'}
                  placeholder="Ketik ulang kata sandi baru..."
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalEmp(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPass}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingPass ? 'Menyimpan...' : 'Simpan Kata Sandi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL EDIT KARYAWAN (Admin Only) */}
      {/* ============================================================ */}
      {editModalEmp && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <EmployeeAvatar
                  employee={{
                    name: editName,
                    role: editRole,
                    isAdmin: editIsAdmin,
                    avatarVariant: editAvatarVariant
                  }}
                  size="md"
                  initialsPosition="corner"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Edit Data Personil (Admin)
                  </h3>
                  <p className="text-xs text-slate-500">ID: {editModalEmp.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalEmp(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nama */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Karyawan *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                    required
                  />
                </div>

                {/* Peran */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Peran / Wewenang *
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => handleEditRoleChange(e.target.value as Employee['role'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="operator">Operator (Full Edit)</option>
                    <option value="officer">Officer (Monitoring)</option>
                    <option value="leadershift">Leadershift (Monitoring)</option>
                    <option value="spv">Supervisor (SPV)</option>
                  </select>
                </div>

                {/* Jabatan / Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jabatan *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shift
                  </label>
                  <select
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value as ShiftType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                    <option value="Shift 3">Shift 3</option>
                  </select>
                </div>
              </div>

              {/* Kata Sandi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Akun
                </label>
                <div className="relative">
                  <input
                    type={showEditPass ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showEditPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Hak Admin Checkbox */}
              <div>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editName.toLowerCase() === 'indika' ? true : editIsAdmin}
                    disabled={editName.toLowerCase() === 'indika'}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-amber-900">
                      Hak Akses Administrator (Admin)
                    </span>
                    <span className="text-[11px] text-amber-700 block">
                      Memiliki wewenang melihat seluruh sandi, mengubah karyawan, dan menghapus personil.
                    </span>
                  </div>
                </label>
              </div>

              {/* Status Aktif */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    disabled={editName.toLowerCase() === 'indika'}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Akun Aktif (Dapat Login ke Sistem)</span>
                </label>
              </div>

              {/* Pilihan Karakter Kartun Karyawan Seragam Indah Kiat */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs text-slate-700 font-bold mb-1.5">
                  Karakter Kartun Karyawan (Seragam Kemeja Biru Muda Indah Kiat Karawang)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditAvatarVariant(opt.id)}
                      className={`flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                        editAvatarVariant === opt.id
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                        <img src={opt.src} alt={opt.label} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 truncate">{opt.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalEmp(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL KONFIRMASI HAPUS KARYAWAN (Admin Only) */}
      {/* ============================================================ */}
      {deleteConfirmEmp && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2 rounded-xl bg-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Hapus Personil Karyawan
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus personil{' '}
              <strong className="text-slate-900 font-bold">{deleteConfirmEmp.name}</strong> (
              {deleteConfirmEmp.title})? Data akun, kredensial sandi, dan riwayat akses karyawan ini akan
              dihapus dari basis data sistem.
            </p>

            <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Tindakan ini tidak dapat dibatalkan.</span>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmEmp(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmittingDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSubmittingDelete ? 'Menghapus...' : 'Ya, Hapus Karyawan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

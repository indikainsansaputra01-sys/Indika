import React, { useState } from 'react';
import { Employee } from '../../types';
import { Shield } from 'lucide-react';

// Import Avatar Personil Muda Usia ~25 Tahun Kulit Sawo Matang Indonesia
import avatarIndika from '../../assets/images/ik_indika_glasses_yellow_1793194084914.jpg';
import avatarOperatorYellow from '../../assets/images/ik_operator_sawomatang_yellow_1793194112956.jpg';
import avatarOfficerWhite1 from '../../assets/images/ik_officer_sawomatang_white_1793194130873.jpg';
import avatarOfficerWhite2 from '../../assets/images/ik_spv_sawomatang_white_1793194151757.jpg';

export type AvatarVariant = 'indika_glasses' | 'operator_yellow' | 'officer_white_1' | 'officer_white_2';

export interface AvatarVariantOption {
  id: AvatarVariant;
  label: string;
  description: string;
  src: string;
}

export const AVATAR_OPTIONS: AvatarVariantOption[] = [
  {
    id: 'indika_glasses',
    label: 'Indika (Kacamata & Helm Kuning)',
    description: 'Pria muda ~25th, kulit sawo matang, berkacamata, helm kuning & kemeja biru muda',
    src: avatarIndika
  },
  {
    id: 'operator_yellow',
    label: 'Operator (Helm Kuning)',
    description: 'Pria muda ~25th, kulit sawo matang, helm kuning & seragam kemeja biru muda',
    src: avatarOperatorYellow
  },
  {
    id: 'officer_white_1',
    label: 'Officer / Leadershift (Helm Putih)',
    description: 'Pria muda ~25th, kulit sawo matang, helm putih & seragam kemeja biru muda',
    src: avatarOfficerWhite1
  },
  {
    id: 'officer_white_2',
    label: 'Supervisor / SPV (Helm Putih)',
    description: 'Pria muda ~25th, kulit sawo matang, helm putih & seragam kemeja biru muda',
    src: avatarOfficerWhite2
  }
];

export function getEmployeeInitials(name?: string): string {
  if (!name || !name.trim()) return 'ik';
  const clean = name.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toLowerCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toLowerCase();
  }
  return clean.charAt(0).toLowerCase();
}

/**
 * Pemetaan resmi karakter kartun karyawan PT Indah Kiat Karawang:
 * - Kulit Sawo Matang Indonesia, Usia Muda ~25 Tahun
 * - Indika: Berkacamata + Helm Kuning
 * - Operator (Agus, Harun, Riffky): Helm Kuning
 * - Officer / Leadershift (Syafa laki-laki, Fauzan): Helm Putih
 * - Supervisor (Ahmad Muhlas): Helm Putih
 */
export function resolveAvatarVariant(employee?: {
  name?: string;
  role?: string;
  avatarVariant?: string;
  title?: string;
  isAdmin?: boolean;
}): AvatarVariant {
  const name = (employee?.name || '').toLowerCase().trim();
  const role = (employee?.role || '').toLowerCase().trim();
  const title = (employee?.title || '').toLowerCase().trim();
  const rawVariant = employee?.avatarVariant;

  // Indika selalu menggunakan kacamata + helm kuning
  if (name.includes('indika')) {
    return 'indika_glasses';
  }

  if (rawVariant === 'indika_glasses') return 'indika_glasses';
  if (rawVariant === 'operator_yellow') return 'operator_yellow';
  if (rawVariant === 'officer_white_1') return 'officer_white_1';
  if (rawVariant === 'officer_white_2') return 'officer_white_2';

  // Helm Putih: Syafa (laki-laki officer), Fauzan (leadershift), Ahmad Muhlas (SPV)
  if (name.includes('syafa') || name.includes('fauzan') || role === 'officer' || role === 'leadershift') {
    return 'officer_white_1';
  }
  if (name.includes('muhlas') || name.includes('ahmad') || role === 'spv' || title.includes('supervisor') || title.includes('spv')) {
    return 'officer_white_2';
  }

  // Operator lainnya (Agus, Harun, Riffky): Helm Kuning
  return 'operator_yellow';
}

export function getAvatarSrc(variant: AvatarVariant): string {
  switch (variant) {
    case 'indika_glasses':
      return avatarIndika;
    case 'officer_white_1':
      return avatarOfficerWhite1;
    case 'officer_white_2':
      return avatarOfficerWhite2;
    case 'operator_yellow':
    default:
      return avatarOperatorYellow;
  }
}

interface EmployeeAvatarProps {
  employee?: Partial<Employee> | null;
  name?: string;
  role?: string;
  isAdmin?: boolean;
  avatarVariant?: AvatarVariant | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  initialsPosition?: 'beside' | 'corner' | 'none';
  showAdminBadge?: boolean;
  className?: string;
}

export const EmployeeAvatar: React.FC<EmployeeAvatarProps> = ({
  employee,
  name: explicitName,
  role: explicitRole,
  isAdmin: explicitIsAdmin,
  avatarVariant: explicitVariant,
  size = 'md',
  initialsPosition = 'corner',
  showAdminBadge = true,
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);

  const name = explicitName || employee?.name || 'Karyawan';
  const role = explicitRole || employee?.role || 'operator';
  const isAdmin = explicitIsAdmin ?? (employee?.isAdmin || name.toLowerCase() === 'indika');
  const variant = resolveAvatarVariant({
    name,
    role,
    avatarVariant: explicitVariant || employee?.avatarVariant,
    title: employee?.title,
    isAdmin
  });

  const initials = getEmployeeInitials(name);
  const avatarSrc = getAvatarSrc(variant);
  const isWhiteHelmet = variant.startsWith('officer_white');
  const hasGlasses = variant === 'indika_glasses';

  // Size mappings
  const sizeStyles: Record<string, {
    container: string;
    avatar: string;
    initialsText: string;
    initialsPadding: string;
    cornerOffset: string;
  }> = {
    xs: {
      container: 'w-6 h-6',
      avatar: 'w-6 h-6',
      initialsText: 'text-[8px] font-bold font-mono',
      initialsPadding: 'px-1 py-0.2',
      cornerOffset: '-bottom-1 -right-1'
    },
    sm: {
      container: 'w-8 h-8',
      avatar: 'w-8 h-8',
      initialsText: 'text-[9px] font-bold font-mono',
      initialsPadding: 'px-1 py-0.5',
      cornerOffset: '-bottom-1 -right-1.5'
    },
    md: {
      container: 'w-10 h-10',
      avatar: 'w-10 h-10',
      initialsText: 'text-[10px] font-bold font-mono',
      initialsPadding: 'px-1.5 py-0.5',
      cornerOffset: '-bottom-1 -right-1.5'
    },
    lg: {
      container: 'w-12 h-12',
      avatar: 'w-12 h-12',
      initialsText: 'text-[11px] font-bold font-mono',
      initialsPadding: 'px-1.5 py-0.5',
      cornerOffset: '-bottom-1 -right-2'
    },
    xl: {
      container: 'w-16 h-16',
      avatar: 'w-16 h-16',
      initialsText: 'text-xs font-bold font-mono',
      initialsPadding: 'px-2 py-0.5',
      cornerOffset: '-bottom-1.5 -right-2'
    },
    '2xl': {
      container: 'w-20 h-20',
      avatar: 'w-20 h-20',
      initialsText: 'text-xs font-bold font-mono',
      initialsPadding: 'px-2.5 py-1',
      cornerOffset: '-bottom-1.5 -right-2'
    }
  };

  const style = sizeStyles[size] || sizeStyles.md;

  // Render SVG fallback with matching sawo matang skin tone, glasses for Indika, & helmet
  const renderFallbackSvg = () => {
    const helmetColor = isWhiteHelmet ? '#ffffff' : '#facc15';
    const helmetStroke = isWhiteHelmet ? '#cbd5e1' : '#ca8a04';
    const skinTone = '#b8794a'; // Kulit sawo matang Indonesia
    const neckTone = '#a3663b';

    return (
      <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
        {/* Background Circle */}
        <circle cx="50" cy="50" r="50" fill="#93c5fd" />
        
        {/* Body: Kemeja Biru Muda Indah Kiat */}
        <path
          d="M18 100 L24 72 L38 65 L45 74 L55 74 L62 65 L76 72 L82 100 Z"
          fill="#60a5fa"
          stroke="#1d4ed8"
          strokeWidth="1.5"
        />
        {/* Dual Chest Pockets */}
        <rect x="27" y="76" width="16" height="13" rx="2" fill="#3b82f6" stroke="#1e40af" strokeWidth="1" />
        <rect x="57" y="76" width="16" height="13" rx="2" fill="#3b82f6" stroke="#1e40af" strokeWidth="1" />
        
        {/* Company Badge / ID Lanyard */}
        <line x1="43" y1="67" x2="35" y2="76" stroke="#1e40af" strokeWidth="1.5" />
        <line x1="57" y1="67" x2="65" y2="76" stroke="#1e40af" strokeWidth="1.5" />
        
        {/* Shirt Collar */}
        <path d="M39 65 L46 75 L50 67 L54 75 L61 65 Z" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.2" />
        {/* Neck (Sawo Matang) */}
        <rect x="44" y="55" width="12" height="12" fill={neckTone} rx="2" />
        {/* Face (Sawo Matang Indonesia) */}
        <ellipse cx="50" cy="45" rx="18" ry="19" fill={skinTone} />
        {/* Eyes & Smile */}
        <circle cx="43" cy="45" r="2.2" fill="#0f172a" />
        <circle cx="57" cy="45" r="2.2" fill="#0f172a" />
        <path d="M44 53 Q50 58 56 53" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
        
        {/* Kacamata Khusus Karakter Indika */}
        {hasGlasses && (
          <g stroke="#0f172a" strokeWidth="1.8" fill="none">
            {/* Left Rim */}
            <rect x="36" y="40" width="12" height="9" rx="2.5" />
            {/* Right Rim */}
            <rect x="52" y="40" width="12" height="9" rx="2.5" />
            {/* Bridge */}
            <line x1="48" y1="44" x2="52" y2="44" strokeWidth="2" />
            {/* Temples */}
            <line x1="36" y1="43" x2="31" y2="41" />
            <line x1="64" y1="43" x2="69" y2="41" />
          </g>
        )}

        {/* Safety Helmet (Helm Kuning atau Helm Putih) */}
        <path
          d="M26 36 C26 18 36 14 50 14 C64 14 74 18 74 36 Z"
          fill={helmetColor}
          stroke={helmetStroke}
          strokeWidth="2"
        />
        {/* Helmet Brim */}
        <path
          d="M22 36 Q50 33 78 36 L76 39 Q50 36 24 39 Z"
          fill={helmetColor}
          stroke={helmetStroke}
          strokeWidth="1.5"
        />
        {/* Helmet Ridge */}
        <path d="M47 14 L47 34 L53 34 L53 14 Z" fill={helmetStroke} opacity="0.3" />
      </svg>
    );
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Avatar Container with cartoon portrait */}
      <div
        className={`relative ${style.container} shrink-0 select-none`}
        title={`${name} (${role}) · Kulit Sawo Matang · ${hasGlasses ? 'Berkacamata · ' : ''}${isWhiteHelmet ? 'Helm Putih' : 'Helm Kuning'}`}
      >
        <div
          className={`w-full h-full rounded-full overflow-hidden border-2 shadow-xs transition-transform hover:scale-105 ${
            isAdmin
              ? 'border-amber-400 bg-amber-950/20 ring-1 ring-amber-400/40'
              : isWhiteHelmet
              ? 'border-slate-300 bg-slate-900 ring-1 ring-white/50'
              : 'border-yellow-400 bg-amber-950/20 ring-1 ring-yellow-400/40'
          }`}
        >
          {!imgError ? (
            <img
              src={avatarSrc}
              alt={`Avatar ${name} - Karyawan Indah Kiat (${hasGlasses ? 'Berkacamata, ' : ''}${isWhiteHelmet ? 'Helm Putih' : 'Helm Kuning'})`}
              className="w-full h-full object-cover object-top"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            renderFallbackSvg()
          )}
        </div>

        {/* Admin Shield Badge at Top-Right */}
        {showAdminBadge && isAdmin && (
          <span
            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-full flex items-center justify-center shadow-xs border border-white text-slate-950 z-10"
            title="Administrator Sistem"
          >
            <Shield className="w-2.2 h-2.2 text-slate-950 fill-current" />
          </span>
        )}

        {/* Small Initials Badge at Corner */}
        {initialsPosition === 'corner' && (
          <span
            className={`absolute ${style.cornerOffset} ${style.initialsPadding} ${style.initialsText} rounded-full tracking-wider border shadow-sm z-10 lowercase flex items-center justify-center font-bold ${
              isAdmin
                ? 'bg-amber-600 text-amber-50 border-amber-300 ring-1 ring-amber-700/50'
                : isWhiteHelmet
                ? 'bg-slate-900 text-white border-slate-300 ring-1 ring-slate-800'
                : 'bg-slate-900 text-yellow-300 border-yellow-400/80 ring-1 ring-slate-800'
            }`}
            title={`Inisial Karyawan: ${initials}`}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Small Initials Badge Beside Avatar (Beside mode) */}
      {initialsPosition === 'beside' && (
        <span
          className={`inline-flex items-center gap-0.5 ${style.initialsPadding} ${style.initialsText} rounded-md tracking-wider border lowercase font-bold ${
            isAdmin
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : isWhiteHelmet
              ? 'bg-slate-100 text-slate-800 border-slate-300'
              : 'bg-yellow-500/15 text-yellow-700 border-yellow-500/40'
          }`}
          title={`Inisial Karyawan: ${initials}`}
        >
          <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block animate-pulse mr-0.5" />
          {initials}
        </span>
      )}
    </div>
  );
};

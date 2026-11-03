import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print">
      {notifications.map((notif) => {
        const isSuccess = notif.type === 'success';
        const isWarning = notif.type === 'warning';
        const isError = notif.type === 'error';

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto p-3.5 rounded-lg border shadow-xl flex items-start gap-3 transition-all duration-200 ${
              isSuccess
                ? 'bg-slate-900 border-emerald-600 text-white'
                : isWarning
                ? 'bg-slate-900 border-amber-500 text-white'
                : isError
                ? 'bg-slate-900 border-rose-600 text-white'
                : 'bg-slate-900 border-slate-700 text-white'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {!isSuccess && !isWarning && !isError && <Info className="w-5 h-5 text-blue-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider">
                {notif.title}
              </div>
              <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {notif.message}
              </div>
            </div>

            <button
              onClick={() => removeNotification(notif.id)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};


import React, { useState, useRef, useEffect } from 'react';
import { Camera, ShieldCheck, AlertCircle, CheckCircle2, Search, Clock, Users, UserCheck, Loader2 } from 'lucide-react';
import { registerAttendance, justifyAttendance, AttendanceResult } from '../services/attendanceService';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/TenantContext';

const QRRegistration: React.FC<{ user?: any }> = ({ user }) => {
  const { tenant } = useTenant();
  const colegioId = tenant?.id ?? null;
  const [inputToken, setInputToken] = useState('');
  const [lastResult, setLastResult] = useState<AttendanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tutor justification state
  const [showJustify, setShowJustify] = useState(false);
  const [justifyLoading, setJustifyLoading] = useState(false);
  const [tutoredStudents, setTutoredStudents] = useState<any[]>([]);
  const [justifyResult, setJustifyResult] = useState<AttendanceResult | null>(null);

  const isTutor = user?.role === 'docente' || user?.role === 'admin' || user?.role === 'superadmin';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputToken.trim()) return;

    setLoading(true);
    const result = await registerAttendance(inputToken);
    setLastResult(result);
    setInputToken('');
    setLoading(false);

    inputRef.current?.focus();

    setTimeout(() => {
      setLastResult(null);
    }, 5000);
  };

  // Cargar alumnos del salón del tutor para justificar
  useEffect(() => {
    if (!showJustify || !user) return;
    const loadStudents = async () => {
      // Obtener el salón tutorado por este usuario
      const { data: salones } = await supabase
        .from('salones')
        .select('id, nombre, seccion')
        .eq('tutor_id', user.id);

      if (!salones || salones.length === 0) {
        // Si es admin/superadmin, mostrar todos los alumnos
        if (user.role === 'superadmin' || user.role === 'admin') {
          const allStudentsQ = supabase
            .from('alumnos')
            .select('id, nombres, apellidos, salon:salones(nombre, seccion)')
            .order('nombres');
          if (colegioId) allStudentsQ.eq('colegio_id', colegioId);
          const { data: allStudents } = await allStudentsQ;
          setTutoredStudents(allStudents || []);
        }
        return;
      }

      const salonIds = salones.map(s => s.id);
      const { data: students } = await supabase
        .from('alumnos')
        .select('id, nombres, apellidos, salon:salones(nombre, seccion)')
        .in('salon_id', salonIds)
        .order('nombres');

      setTutoredStudents(students || []);
    };
    loadStudents();
  }, [showJustify, user]);

  const handleJustify = async (studentId: string) => {
    setJustifyLoading(true);
    const result = await justifyAttendance(studentId);
    setJustifyResult(result);
    setJustifyLoading(false);

    setTimeout(() => setJustifyResult(null), 4000);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Control de Ingreso</h2>
        <p className="text-slate-500">Módulo de PC Master para registro de entrada/salida. <span className="text-indigo-600 font-bold">Hora límite: 8:00 AM</span></p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Input Card */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 rounded-full">
              <Camera className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold">Lector QR Escáner</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Esperando escaneo...</span>
              <div className="mt-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="Apunte el código al lector..."
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-4 pl-12 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  autoFocus
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Registrar Manualmente'}
            </button>
          </form>

          {/* Tutor justification button */}
          {isTutor && (
            <button
              onClick={() => setShowJustify(!showJustify)}
              className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border-2 ${showJustify ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'}`}
            >
              <UserCheck className="w-4 h-4" />
              {showJustify ? 'Cerrar Panel de Justificación' : 'Justificar Asistencia (Tutor)'}
            </button>
          )}

          <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Conexión Segura (x-device-secret activo)</span>
            </div>
            <span className="font-mono">IP: 192.168.1.15</span>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-slate-900 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[300px]">
          {!lastResult ? (
            <div className="text-slate-500 animate-pulse">
              <QrCode className="w-24 h-24 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Listo para recibir alumnos</p>
            </div>
          ) : lastResult.success ? (
            <div className="animate-in fade-in zoom-in duration-300">
              {lastResult.estado === 'tardanza' ? (
                <Clock className="w-20 h-20 text-amber-500 mx-auto mb-4" />
              ) : (
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
              )}
              <h4 className="text-white text-2xl font-bold mb-2">{lastResult.studentName}</h4>
              <p className={`font-medium mb-4 ${lastResult.estado === 'tardanza' ? 'text-amber-400' : 'text-green-400'}`}>
                {lastResult.message}
              </p>
              <p className="text-slate-400 text-sm">
                Hora de ingreso: <span className="text-white font-mono">{lastResult.timestamp}</span>
              </p>

              {/* Badge de estado */}
              <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${lastResult.estado === 'tardanza'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-green-500/10 text-green-400'
                }`}>
                <span className={`w-2 h-2 rounded-full animate-ping ${lastResult.estado === 'tardanza' ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                {lastResult.estado === 'tardanza' ? 'TARDANZA — Después de 8:00 AM' : 'PUNTUAL'}
              </div>

              <div className="mt-4 inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                Notificación WhatsApp Enviada
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
              <h4 className="text-white text-2xl font-bold mb-2">{lastResult.studentName || 'Error de Validación'}</h4>
              <p className="text-red-400 font-medium">{lastResult.message}</p>
            </div>
          )}

          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -ml-16 -mb-16"></div>
        </div>
      </div>

      {/* Tutor Justification Panel */}
      {showJustify && (
        <div className="bg-white rounded-[32px] border border-orange-100 shadow-sm p-8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-50 rounded-2xl">
              <UserCheck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Justificación de Asistencia</h3>
              <p className="text-xs text-slate-400 font-medium">Solo el tutor puede justificar. No se registra hora de ingreso.</p>
            </div>
          </div>

          {justifyResult && (
            <div className={`mb-4 p-4 rounded-2xl flex items-center gap-3 ${justifyResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {justifyResult.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-bold text-sm">{justifyResult.studentName && `${justifyResult.studentName}: `}{justifyResult.message}</span>
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {tutoredStudents.length > 0 ? tutoredStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700 font-black text-sm">
                    {s.nombres[0]}{s.apellidos[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{s.nombres} {s.apellidos}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{s.salon?.nombre} {s.salon?.seccion}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleJustify(s.id)}
                  disabled={justifyLoading}
                  className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {justifyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Justificar'}
                </button>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400 font-medium">
                <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p>No tienes alumnos asignados como tutor.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const QrCode = ({ className, ...props }: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props} className={className}>
    <rect width="10" height="10" x="3" y="3" rx="2" />
    <rect width="10" height="10" x="14" y="14" rx="2" />
    <rect width="5" height="5" x="14" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="14" rx="1" />
  </svg>
);

export default QRRegistration;

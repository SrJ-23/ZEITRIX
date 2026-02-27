
import React, { useState } from 'react';
import { GraduationCap, ShieldCheck, Lock, Mail, Loader2, KeyRound } from 'lucide-react';
import { Role, User as UserType } from '../types';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/TenantContext';

const Login: React.FC<{ onLogin: (user: UserType) => void }> = ({ onLogin }) => {
  const { tenant } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Cambio de contraseña obligatorio
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (userError) throw userError;
        if (!userData || !userData.activo) throw new Error('Usuario no encontrado o inactivo');

        // Verificar si debe cambiar contraseña
        if (userData.must_change_password) {
          setPendingUser(userData);
          setShowChangePassword(true);
          setLoading(false);
          return;
        }

        // Login normal
        await completeLogin(userData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : 'Error al ingresar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (userData: any) => {
    let salonAsignado;
    if (userData.role === 'docente') {
      const { data: salonData } = await supabase
        .from('salones')
        .select('nombre, seccion')
        .eq('tutor_id', userData.id)
        .single();
      if (salonData) salonAsignado = `${salonData.nombre} ${salonData.seccion}`;
    }

    onLogin({
      id: userData.id,
      name: userData.nombre_completo,
      email: userData.email,
      role: userData.role as Role,
      salonAsignado: salonAsignado
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');

    if (newPassword.length < 6) {
      setChangeError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Las contraseñas no coinciden.');
      return;
    }

    setChangingPassword(true);
    try {
      // Actualizar contraseña en Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;

      // Quitar flag de cambio obligatorio
      await supabase
        .from('usuarios')
        .update({ must_change_password: false })
        .eq('id', pendingUser.id);

      alert('✅ Contraseña actualizada exitosamente. Bienvenido/a.');

      // Completar login
      await completeLogin({ ...pendingUser, must_change_password: false });
    } catch (err: any) {
      console.error('Error cambiando contraseña:', err);
      setChangeError('Error al cambiar contraseña: ' + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-900 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600 blur-[120px] rounded-full"></div>
      </div>

      {/* MODAL: Cambio de contraseña obligatorio */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Cambio de Contraseña</h2>
              <p className="text-sm text-slate-500 mt-2">
                Por seguridad, debe cambiar su contraseña temporal antes de continuar.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Confirmar Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la contraseña"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              {changeError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center border border-red-100">
                  {changeError}
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-orange-200 uppercase text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {changingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-md w-full bg-white rounded-[40px] p-12 shadow-2xl relative z-10 border border-white/20">
        <div className="text-center mb-10">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.nombre} className="w-20 h-20 rounded-3xl mx-auto mb-6 shadow-xl object-cover" />
          ) : (
            <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
            {tenant ? tenant.nombre : <>ZEI<span className="text-indigo-600">TRIX</span></>}
          </h1>
          <p className="text-slate-400 font-medium text-sm mt-2">Ingrese sus credenciales para acceder</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="ejemplo@colegio.edu.pe"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-bold text-slate-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-bold text-slate-700"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-slate-200 uppercase text-xs tracking-widest mt-4"
          >
            Acceder al Sistema
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-50 text-center">
          <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            PROTECCIÓN DE DATOS CIFRADA
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

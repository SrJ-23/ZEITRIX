
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, GraduationCap, AlertTriangle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import QRRegistration from './components/QRRegistration';
import PlantelManagement from './components/AdminStudents';
import GradesManagement from './components/GradesManagement';
import AcademicReports from './components/AcademicReports';
import ScheduleManagement from './components/ScheduleManagement';
import TeacherReports from './components/TeacherReports';
import Login from './components/Login';
import PaymentsManagement from './components/PaymentsManagement';
import ParentDashboard from './components/ParentDashboard';
import { User, Role } from './types';
import { supabase } from './lib/supabase';
import { useTenant } from './lib/TenantContext';

const App: React.FC = () => {
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          const profile = await loadUserProfile(session.user.id);
          if (profile && isMounted) setUser(profile);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // Solo escuchar sign-out para limpiar el estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && isMounted) {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !userData) return null;

      let salonAsignado;
      if (userData.role === 'docente') {
        const { data: salonData } = await supabase
          .from('salones')
          .select('nombre, seccion')
          .eq('tutor_id', userData.id)
          .maybeSingle();
        if (salonData) salonAsignado = `${salonData.nombre} ${salonData.seccion}`;
      }

      return {
        id: userData.id,
        name: userData.nombre_completo,
        email: userData.email,
        role: userData.role as Role,
        salonAsignado: salonAsignado
      };
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading || tenantLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
    </div>
  );

  // Colegio no encontrado (subdominio inválido)
  if (tenantError) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6">
      <div className="text-center max-w-md">
        <div className="bg-red-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Institución No Encontrada</h1>
        <p className="text-slate-400 text-sm mb-6">{tenantError}</p>
        <p className="text-slate-500 text-xs">Verifique la URL o contacte al administrador.</p>
      </div>
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex">
        {user && (
          <Sidebar
            user={user}
            onLogout={handleLogout}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        {/* Botón hamburguesa — solo visible en móvil cuando hay usuario */}
        {user && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 lg:hidden bg-slate-900 text-white p-3 rounded-2xl shadow-xl shadow-slate-900/30 hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <main className={`flex-1 transition-all duration-300 ${user ? 'lg:ml-64 p-4 pt-16 lg:p-10 lg:pt-10' : ''}`}>
          <Routes>
            {!user ? (
              <Route path="*" element={<Login onLogin={(u) => setUser(u)} />} />
            ) : (
              <>
                {/* Redirección automática según rol */}
                {user.role === 'asistencia' && <Route path="/" element={<Navigate to="/attendance" />} />}
                {user.role === 'padre' && <Route path="/" element={<Navigate to="/parent" />} />}

                {user.role !== 'padre' && <Route path="/" element={<Dashboard user={user} />} />}
                <Route path="/parent" element={<ParentDashboard user={user} />} />
                <Route path="/attendance" element={<QRRegistration user={user} />} />
                <Route path="/plantel" element={<PlantelManagement />} />
                <Route path="/schedules" element={<ScheduleManagement />} />
                <Route path="/grades" element={<GradesManagement user={user} />} />
                <Route path="/incidencias" element={<TeacherReports user={user} />} />
                <Route path="/academic-reports" element={<AcademicReports user={user} />} />
                <Route path="/payments" element={<PaymentsManagement />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

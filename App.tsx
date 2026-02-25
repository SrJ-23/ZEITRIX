
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex">
        {user && <Sidebar user={user} onLogout={handleLogout} />}

        <main className={`flex-1 transition-all ${user ? 'ml-64 p-10' : ''}`}>
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

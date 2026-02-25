import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  TrendingUp,
  UserCheck,
  BookOpen,
  Star,
  Loader2,
  X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC<{ user: any }> = ({ user }) => {
  const isTeacher = user.role === 'profesor';
  const isParent = user.role === 'padre';
  const [parentTab, setParentTab] = useState<'notas' | 'asistencia'>('notas');

  // ESTADO PARA ADMIN/DOCENTE
  const [dbStats, setDbStats] = useState({
    totalAlumnos: 0,
    asistenciaHoy: '0%',
    totalDocentes: 0,
  });

  // ESTADO PARA EL GRÁFICO
  const [chartData, setChartData] = useState<any[]>([]);

  // ESTADO PARA MODAL DE DETALLES
  const [selectedDateDetails, setSelectedDateDetails] = useState<{ date: string; fullDate: string; list: any[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // FETCH DATA: STATS Y CHART (Solo si no es padre)
  useEffect(() => {
    if (!isParent) {
      const fetchData = async () => {
        // --- 1. STATS GLOBALES ---
        const { count: countAlumnos } = await supabase
          .from('alumnos')
          .select('*', { count: 'exact', head: true });

        const { count: countDocentes } = await supabase
          .from('profesores')
          .select('*', { count: 'exact', head: true });

        const today = new Date().toISOString().split('T')[0];
        const { count: countAsistencia } = await supabase
          .from('asistencia')
          .select('*', { count: 'exact', head: true })
          .eq('fecha', today);

        const total = countAlumnos || 1;
        const porcentaje = Math.round(((countAsistencia || 0) / total) * 100);

        setDbStats({
          totalAlumnos: countAlumnos || 0,
          totalDocentes: countDocentes || 0,
          asistenciaHoy: `${porcentaje}%`,
        });

        // --- 2. CHART DATA (Últimos 7 días) ---
        const now = new Date();
        const last7Days = new Date(now);
        last7Days.setDate(now.getDate() - 6);

        const { data: asistencias } = await supabase
          .from('asistencia')
          .select('fecha')
          .gte('fecha', last7Days.toISOString().split('T')[0])
          .order('fecha', { ascending: true });

        const daysMap = new Map<string, number>();
        const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

        // Inicializar últimos 7 días en 0
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          daysMap.set(dateStr, 0);
        }

        // Llenar con datos reales
        if (asistencias) {
          asistencias.forEach((a: any) => {
            const dateKey = a.fecha;
            if (daysMap.has(dateKey)) {
              daysMap.set(dateKey, (daysMap.get(dateKey) || 0) + 1);
            }
          });
        }

        // Convertir para Recharts
        const finalChartData = Array.from(daysMap.entries()).map(([dateStr, count]) => {
          const d = new Date(dateStr);
          const userTimezoneOffset = d.getTimezoneOffset() * 60000;
          const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
          return {
            name: daysOfWeek[adjustedDate.getDay()],
            fullDate: dateStr,
            asistencia: count,
          };
        });

        setChartData(finalChartData);
      };

      fetchData();
    }
  }, [isParent]);

  // HANDLER: Clic en barra del gráfico (recibe el payload directo desde <Bar>)
  const handleBarClick = async (barData: any) => {
    if (!barData || !barData.fullDate) return;
    const dateStr: string = barData.fullDate;
    const dayName: string = barData.name;

    setLoadingDetails(true);
    setSelectedDateDetails({ date: dayName, fullDate: dateStr, list: [] });

    try {
      const { data: attendanceList, error } = await supabase
        .from('asistencia')
        .select(`
          hora_ingreso,
          estado,
          alumno:alumnos (
            nombres,
            apellidos,
            salon:salones (nombre, seccion)
          )
        `)
        .eq('fecha', dateStr)
        .order('hora_ingreso', { ascending: true });

      if (error) throw error;
      setSelectedDateDetails({ date: dayName, fullDate: dateStr, list: attendanceList || [] });
    } catch (err) {
      console.error('Error fetching attendance details:', err);
      setSelectedDateDetails({ date: dayName, fullDate: dateStr, list: [] });
    } finally {
      setLoadingDetails(false);
    }
  };

  // --- VISTA PADRE (en desarrollo) ---
  if (isParent) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <header>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Portal Familiar</h2>
          <p className="text-slate-500 font-medium italic">
            Bienvenido/a, <span className="text-indigo-600 font-black">{user.name}</span>
          </p>
        </header>
        <div className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-16 text-center">
          <BookOpen className="w-16 h-16 text-indigo-200 mx-auto mb-6" />
          <h3 className="text-2xl font-black text-slate-800 mb-3">Portal en Desarrollo</h3>
          <p className="text-slate-400 font-medium max-w-md mx-auto">
            Pronto podrás consultar las notas y asistencia de tu hijo/a directamente desde aquí.
          </p>
        </div>
      </div>
    );
  }

  // --- VISTA ADMIN/DOCENTE ---
  const stats = [
    { name: 'Alumnos Matriculados', value: dbStats.totalAlumnos.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Asistencia Hoy', value: dbStats.asistenciaHoy, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Docentes Activos', value: dbStats.totalDocentes.toString(), icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
    { name: 'Año Académico', value: new Date().getFullYear().toString(), icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-800">Panel de Control: {user.role.toUpperCase()}</h2>
        <p className="text-slate-500 font-medium italic">¡Hola de nuevo, {user.name}! Aquí el resumen de hoy.</p>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className={`${stat.bg} p-4 rounded-2xl`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.name}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GRÁFICO + SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Asistencia Semanal (Últimos 7 días)
              </h3>
              <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full">
                Clic en la barra para ver detalles
              </span>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value} alumnos`, 'Asistencia']}
                  />
                  <Bar dataKey="asistencia" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={32} activeBar={{ fill: '#4338ca' }} onClick={(data) => handleBarClick(data)} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-900 text-white p-8 rounded-[40px] shadow-xl shadow-indigo-200">
            <Star className="w-10 h-10 mb-6 text-amber-400 fill-amber-400" />
            <h3 className="text-xl font-black mb-2 leading-tight">Módulo de Notificaciones</h3>
            <p className="text-indigo-200 text-sm font-medium mb-6">
              El sistema está configurado para enviar alertas automáticas a los padres cada vez que un alumno ingresa.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              WAHA Service: Online
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALLES DE ASISTENCIA */}
      {selectedDateDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
            {/* Header del modal */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  Asistencia: {selectedDateDetails.date}
                </h3>
                <p className="text-slate-500 font-medium text-sm">
                  {selectedDateDetails.fullDate} · Lista de alumnos registrados
                </p>
              </div>
              <button
                onClick={() => setSelectedDateDetails(null)}
                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            {loadingDetails ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : selectedDateDetails.list.length > 0 ? (
              <div className="overflow-y-auto pr-2 space-y-2">
                {selectedDateDetails.list.map((record: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 font-black text-xs">
                        {record.alumno?.nombres?.[0]}{record.alumno?.apellidos?.[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {record.alumno?.nombres} {record.alumno?.apellidos}
                        </p>
                        <p className="text-[10px] text-slate-400 font-black uppercase">
                          {record.alumno?.salon?.nombre} {record.alumno?.salon?.seccion}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-black text-slate-800">
                        {record.hora_ingreso?.substring(0, 5)}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${record.estado === 'tardanza'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                        }`}>
                        {record.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <UserCheck className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 font-medium">No se encontraron registros para este día.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    CalendarDays,
    BookOpen,
    Clock,
    AlertTriangle,
    GraduationCap,
    Bell,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    CreditCard,
    User as UserIcon,
    Loader2
} from 'lucide-react';
import { User } from '../types';

// Types and helper functions for ParentDashboard
interface ParentDashboardProps {
    user: User | null;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
};
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ParentDashboard: React.FC<ParentDashboardProps> = ({ user }) => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resumen' | 'asistencia' | 'notas' | 'pagos'>('resumen');

    // Data States
    const [padreInfo, setPadreInfo] = useState<any>(null);
    const [alumnos, setAlumnos] = useState<any[]>([]);
    const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(null);

    // Asistencia
    const [currentDate, setCurrentDate] = useState(new Date());
    const [asistencias, setAsistencias] = useState<any[]>([]);

    // Notas
    const [notas, setNotas] = useState<any[]>([]);
    const [asignaciones, setAsignaciones] = useState<any[]>([]);

    // Pagos
    const [pagos, setPagos] = useState<any[]>([]);

    // Tareas/Noticias
    const [tareas, setTareas] = useState<any[]>([]);

    useEffect(() => {
        if (user?.id) {
            loadInitialData();
        }
    }, [user]);

    // Load parent user and their linked students
    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Get Padre info based on user ID
            const { data: padreData } = await supabase
                .from('padres')
                .select('*')
                .eq('usuario_id', user!.id)
                .single();

            if (padreData) {
                setPadreInfo(padreData);

                // Get linked students
                const { data: rels } = await supabase
                    .from('padres_alumnos')
                    .select('alumno:alumnos(*, salon:salones(*, tutor:usuarios(nombre_completo)))')
                    .eq('padre_id', padreData.id);

                if (rels && rels.length > 0) {
                    const alumnosData = rels.map(r => r.alumno).filter(Boolean);
                    setAlumnos(alumnosData);
                    if (alumnosData.length > 0) {
                        setSelectedAlumnoId((alumnosData[0] as any).id);
                    }
                }
            }
        } catch (err) {
            console.error('Error loading parent data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load specific data for selected student
    useEffect(() => {
        if (selectedAlumnoId) {
            loadStudentData(selectedAlumnoId);
        }
    }, [selectedAlumnoId, currentDate]);

    const loadStudentData = async (alumnoId: string) => {
        try {
            // 1. Asistencias (current month)
            const year = currentDate.getFullYear();
            const monthStr = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            const startDate = `${year}-${monthStr}-01`;
            const endDate = new Date(year, currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

            const { data: asisData } = await supabase
                .from('asistencias')
                .select('*')
                .eq('alumno_id', alumnoId)
                .gte('fecha', startDate)
                .lte('fecha', endDate);
            setAsistencias(asisData || []);

            // 2. Pagos
            const { data: pagosData } = await supabase
                .from('pagos')
                .select('*')
                .eq('alumno_id', alumnoId)
                .eq('anio_academico', currentDate.getFullYear());
            setPagos(pagosData || []);

            // 3. Obtener el salón del alumno seleccionado actual para busquedas de notas/tareas
            const alumno = alumnos.find(a => a.id === alumnoId);
            if (alumno && alumno.salon_id) {
                // Notas (necesitamos las asignaciones del salón)
                const { data: asigData } = await supabase
                    .from('asignaciones_cursos')
                    .select('id, curso:cursos(nombre), profesor:usuarios!profesor_id(nombre_completo)')
                    .eq('salon_id', alumno.salon_id);

                setAsignaciones(asigData || []);

                if (asigData && asigData.length > 0) {
                    const asigIds = asigData.map(a => a.id);
                    const { data: notasData } = await supabase
                        .from('notas')
                        .select('*')
                        .eq('alumno_id', alumnoId)
                        .in('asignacion_id', asigIds);
                    setNotas(notasData || []);
                }

                // Tareas
                const { data: tareasData } = await supabase
                    .from('tareas')
                    .select('*, profesor:usuarios(nombre_completo)')
                    .eq('salon_id', alumno.salon_id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                setTareas(tareasData || []);
            }

        } catch (err) {
            console.error('Error loading student modules:', err);
        }
    };

    // Sub-components rendering

    const renderResumen = () => {
        const alumno = alumnos.find(a => a.id === selectedAlumnoId);
        if (!alumno) return null;

        // Calcular stats
        const diasAusente = asistencias.filter(a => a.estado === 'falta').length;
        const diasTarde = asistencias.filter(a => a.estado === 'tardanza').length;

        const pagosPendientes = pagos.filter(p => p.estado !== 'pagado').length;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <UserIcon className="w-7 h-7 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Tutor del Salón</p>
                            <p className="text-lg font-bold text-slate-800">{alumno.salon?.tutor?.nombre_completo || 'Sin asignar'}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                            <Clock className="w-7 h-7 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Tardanzas este mes</p>
                            <p className="text-3xl font-black text-slate-800">{diasTarde}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-red-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Faltas este mes</p>
                            <p className="text-3xl font-black text-slate-800">{diasAusente}</p>
                        </div>
                    </div>
                </div>

                {/* Tareas Recientes */}
                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">Tareas y Comunicados Recientes</h3>
                    </div>

                    <div className="space-y-4">
                        {tareas.length > 0 ? tareas.map(t => (
                            <div key={t.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-4">
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800">{t.titulo}</h4>
                                    <p className="text-sm text-slate-600 mt-1">{t.descripcion}</p>
                                    <div className="flex gap-4 mt-3">
                                        <span className="text-xs font-bold text-indigo-600">{t.profesor?.nombre_completo}</span>
                                        <span className="text-xs text-slate-400">Publicado: {new Date(t.created_at).toLocaleDateString()}</span>
                                        {t.fecha_entrega && (
                                            <span className="text-xs font-bold text-orange-600">Entrega: {new Date(t.fecha_entrega).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-slate-400 py-8 font-medium">No hay tareas o comunicados recientes.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderAsistencia = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date();

        const renderCalendarDay = (day: number) => {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const record = asistencias.find(a => a.fecha === dateStr);
            const dayOfWeek = new Date(year, month, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isFuture = new Date(year, month, day) > today;

            let statusClass = "bg-slate-50/50 text-slate-400 border-dashed";
            let label = "-";

            if (isWeekend) {
                statusClass = "bg-slate-100 text-slate-400 opacity-50";
            } else if (!isFuture && record) {
                switch (record.estado) {
                    case 'presente': statusClass = "bg-green-100 text-green-700 font-bold border-green-200 shadow-sm border-solid"; label = "✔"; break;
                    case 'falta': statusClass = "bg-red-100 text-red-700 font-bold border-red-200 shadow-sm border-solid"; label = "✘"; break;
                    case 'tardanza': statusClass = "bg-orange-100 text-orange-700 font-bold border-orange-200 shadow-sm border-solid"; label = "T"; break;
                    case 'justificado': statusClass = "bg-blue-100 text-blue-700 font-bold border-blue-200 shadow-sm border-solid"; label = "J"; break;
                }
            } else if (!isFuture && !isWeekend) {
                statusClass = "bg-slate-50 text-slate-400 border-solid"; label = "?"; // Falta registro
            }

            return (
                <div key={`day-${day}`} className={`aspect-square flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border-2 transition-all cursor-default ${statusClass}`}>
                    <span className="text-xs sm:text-sm font-black opacity-50 mb-1">{day}</span>
                    {!isWeekend && !isFuture && <span className="text-sm sm:text-lg">{label}</span>}
                </div>
            );
        };

        return (
            <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <CalendarDays className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Calendario de Asistencia</h3>
                            <p className="text-sm text-slate-500 font-bold">{MESES[month]} {year}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/50">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2.5 rounded-xl hover:bg-white text-slate-600 transition-all font-bold shadow-sm">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-6 font-black text-slate-700 min-w-[140px] text-center">{MESES[month]} {year}</span>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2.5 rounded-xl hover:bg-white text-slate-600 transition-all font-bold shadow-sm">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-8">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                        <div key={d} className="text-center text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">{d}</div>
                    ))}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square rounded-2xl bg-transparent" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => renderCalendarDay(i + 1))}
                </div>

                <div className="flex flex-wrap gap-4 sm:gap-8 justify-center border-t border-slate-100 pt-8">
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-green-100 border border-green-200 flex items-center justify-center text-[8px] font-black text-green-700">✔</span><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Presente</span></div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-[8px] font-black text-red-700">✘</span><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Falta</span></div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-[8px] font-black text-orange-700">T</span><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tardanza</span></div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[8px] font-black text-blue-700">J</span><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Justificado</span></div>
                </div>
            </div>
        );
    };

    const renderNotas = () => {
        return (
            <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-sm">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" /> Rendimiento Académico
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                                <th className="px-6 py-4 rounded-l-xl">Curso</th>
                                <th className="px-6 py-4">Bimestre 1</th>
                                <th className="px-6 py-4">Bimestre 2</th>
                                <th className="px-6 py-4">Bimestre 3</th>
                                <th className="px-6 py-4">Bimestre 4</th>
                                <th className="px-6 py-4 rounded-r-xl">Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {asignaciones.map(asig => {
                                const notasCurso = notas.filter(n => n.asignacion_id === asig.id);
                                const n1 = notasCurso.find(n => n.bimestre === 1)?.valor;
                                const n2 = notasCurso.find(n => n.bimestre === 2)?.valor;
                                const n3 = notasCurso.find(n => n.bimestre === 3)?.valor;
                                const n4 = notasCurso.find(n => n.bimestre === 4)?.valor;

                                const promedios = [n1, n2, n3, n4].filter(n => n !== undefined && n !== null);
                                const final = promedios.length > 0
                                    ? Math.round(promedios.reduce((a, b) => a + b, 0) / promedios.length)
                                    : null;

                                const getClass = (val: number | undefined) => {
                                    if (val === undefined || val === null) return "text-slate-300";
                                    if (val >= 18) return "text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg";
                                    if (val >= 11) return "text-slate-800 font-bold";
                                    return "text-red-500 font-bold bg-red-50 px-2 py-1 rounded-lg";
                                };

                                return (
                                    <tr key={asig.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800">{asig.curso.nombre}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">{asig.profesor.nombre_completo}</p>
                                        </td>
                                        <td className={`px-6 py-4 ${getClass(n1)}`}>{n1 || '-'}</td>
                                        <td className={`px-6 py-4 ${getClass(n2)}`}>{n2 || '-'}</td>
                                        <td className={`px-6 py-4 ${getClass(n3)}`}>{n3 || '-'}</td>
                                        <td className={`px-6 py-4 ${getClass(n4)}`}>{n4 || '-'}</td>
                                        <td className={`px-6 py-4 text-sm ${getClass(final)}`}>{final || '-'}</td>
                                    </tr>
                                );
                            })}
                            {asignaciones.length === 0 && (
                                <tr><td colSpan={6} className="text-center p-8 text-sm text-slate-400">No hay cursos asignados para el salón del alumno.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderPagos = () => {
        return (
            <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-sm">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" /> Estado de Cuenta
                </h3>

                <div className="space-y-4">
                    {pagos.length > 0 ? pagos.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                            <div>
                                <p className="font-bold text-slate-800 capitalize">{p.concepto.replace('_', ' ')}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{currentDate.getFullYear()}</p>
                            </div>

                            <div className="text-right">
                                {p.estado === 'pagado' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-black uppercase tracking-wider">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Pagado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-black uppercase tracking-wider">
                                        <Clock className="w-3.5 h-3.5" /> Pendiente
                                    </span>
                                )}
                                {p.fecha_pago && <p className="text-[10px] mt-2 font-mono text-slate-400">{p.fecha_pago}</p>}
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-500">No hay registros de pagos para el año académico actual. Acérquese a Secretaría.</div>
                    )}
                </div>
            </div>
        );
    };

    // Main UI
    if (loading) {
        return <div className="flex p-20 justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
    }

    if (alumnos.length === 0) {
        return (
            <div className="p-10 text-center space-y-4">
                <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto" />
                <h2 className="text-2xl font-black text-slate-800">Sin Alumnos Vinculados</h2>
                <p className="text-slate-500">Su cuenta de apoderado aún no tiene alumnos vinculados en el sistema vigente.</p>
            </div>
        );
    }

    const selectedAlumno = alumnos.find(a => a.id === selectedAlumnoId);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER / ALUMNO SELECTOR */}
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        {selectedAlumno?.foto_url ? (
                            <img src={selectedAlumno.foto_url} alt="" className="w-24 h-24 rounded-3xl object-cover shadow-md border-4 border-white" />
                        ) : (
                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md border-4 border-white flex justify-center items-center text-white text-3xl font-black">
                                {selectedAlumno?.nombres?.[0] || 'A'}
                            </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-white rounded-xl p-1 shadow-sm">
                            <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg block">Activo</span>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedAlumno?.nombres} {selectedAlumno?.apellidos}</h2>
                        <div className="flex mt-2 items-center gap-2">
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <GraduationCap className="w-3.5 h-3.5" />
                                {selectedAlumno?.salon ? `${selectedAlumno.salon.nombre} ${selectedAlumno.salon.seccion}` : 'Sin Salón Asignado'}
                            </span>
                        </div>
                    </div>
                </div>

                {alumnos.length > 1 && (
                    <div className="bg-slate-50 p-2 rounded-2xl w-full md:w-auto">
                        <select
                            className="w-full bg-transparent border-none outline-none font-bold text-slate-700 p-2 cursor-pointer"
                            value={selectedAlumnoId || ''}
                            onChange={(e) => setSelectedAlumnoId(e.target.value)}
                        >
                            {alumnos.map(a => (
                                <option key={a.id} value={a.id}>{a.nombres} (Cambiar de perfil)</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 lg:gap-4 border-b-2 border-slate-100 pb-px sticky top-0 bg-slate-50/80 backdrop-blur-xl z-10 pt-4">
                {[
                    { id: 'resumen', label: 'Resumen Mensual', icon: TrendingUp },
                    { id: 'asistencia', label: 'Asistencia', icon: CalendarDays },
                    { id: 'notas', label: 'Calificaciones', icon: BookOpen },
                    { id: 'pagos', label: 'Estado de Cuenta', icon: CreditCard },
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-3.5 font-bold transition-all relative border-b-2
                ${isActive ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 hover:text-slate-600 border-transparent hover:border-slate-300'}`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="pt-2">
                {activeTab === 'resumen' && renderResumen()}
                {activeTab === 'asistencia' && renderAsistencia()}
                {activeTab === 'notas' && renderNotas()}
                {activeTab === 'pagos' && renderPagos()}
            </div>

        </div>
    );
};

export default ParentDashboard;

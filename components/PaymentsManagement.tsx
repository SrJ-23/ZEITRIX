import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    Users,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    Search,
    ChevronRight,
    ArrowLeft,
    Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendWhatsAppMessage } from '../services/wahaService';

const CONCEPTOS = [
    { key: 'matricula', label: 'Matrícula' },
    ...Array.from({ length: 10 }, (_, i) => ({ key: `mensualidad_${i + 1}`, label: `Mensualidad ${i + 1}` }))
];

const PaymentsManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');

    // Dashboard data
    const [salons, setSalons] = useState<any[]>([]);
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [allPayments, setAllPayments] = useState<any[]>([]);

    // Detail view
    const [selectedSalonId, setSelectedSalonId] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [studentPayments, setStudentPayments] = useState<any[]>([]);
    const [salonStudents, setSalonStudents] = useState<any[]>([]);
    const [sendingReminder, setSendingReminder] = useState(false);

    const currentYear = new Date().getFullYear();

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [salonsRes, studentsRes, paymentsRes] = await Promise.all([
                supabase.from('salones').select('id, nombre, seccion').order('nombre'),
                supabase.from('alumnos').select('id, nombres, apellidos, salon_id, salon:salones(nombre, seccion)'),
                supabase.from('pagos').select('*').eq('anio_academico', currentYear)
            ]);
            setSalons(salonsRes.data || []);
            setAllStudents(studentsRes.data || []);
            setAllPayments(paymentsRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Estadísticas del dashboard
    const totalAlumnos = allStudents.length;
    const alumnosConPagos = new Set(allPayments.filter(p => p.estado === 'pagado').map(p => p.alumno_id));

    // Alumnos morosos: los que tienen al menos un pago pendiente
    const getMorosos = () => {
        const morosos: any[] = [];
        allStudents.forEach(student => {
            const pagosAlumno = allPayments.filter(p => p.alumno_id === student.id);
            const pendientes = CONCEPTOS.length - pagosAlumno.filter(p => p.estado === 'pagado').length;
            if (pendientes > 0) {
                morosos.push({
                    ...student,
                    pendientes,
                    pagados: pagosAlumno.filter(p => p.estado === 'pagado').length
                });
            }
        });
        return morosos.sort((a, b) => b.pendientes - a.pendientes);
    };

    const morosos = getMorosos();
    const totalPagosEsperados = totalAlumnos * CONCEPTOS.length;
    const totalPagosRealizados = allPayments.filter(p => p.estado === 'pagado').length;
    const progressPercent = totalPagosEsperados > 0 ? Math.round((totalPagosRealizados / totalPagosEsperados) * 100) : 0;
    const alDia = totalAlumnos - morosos.length;

    // Detail: cargar alumnos de salón
    useEffect(() => {
        if (!selectedSalonId) { setSalonStudents([]); return; }
        const load = async () => {
            const { data } = await supabase
                .from('alumnos')
                .select('id, nombres, apellidos')
                .eq('salon_id', selectedSalonId)
                .order('nombres');
            setSalonStudents(data || []);
        };
        load();
    }, [selectedSalonId]);

    // Detail: cargar pagos de alumno
    const loadStudentPayments = async (student: any) => {
        setSelectedStudent(student);
        const { data } = await supabase
            .from('pagos')
            .select('*')
            .eq('alumno_id', student.id)
            .eq('anio_academico', currentYear);
        setStudentPayments(data || []);
        setView('detail');
    };

    const markAsPaid = async (concepto: string) => {
        if (!selectedStudent) return;
        try {
            // Check if record exists
            const existing = studentPayments.find(p => p.concepto === concepto);
            if (existing) {
                await supabase.from('pagos').update({ estado: 'pagado', fecha_pago: new Date().toISOString().split('T')[0] }).eq('id', existing.id);
            } else {
                await supabase.from('pagos').insert([{
                    alumno_id: selectedStudent.id,
                    concepto,
                    monto: 0,
                    estado: 'pagado',
                    fecha_pago: new Date().toISOString().split('T')[0],
                    anio_academico: currentYear
                }]);
            }
            // Reload
            const { data } = await supabase
                .from('pagos')
                .select('*')
                .eq('alumno_id', selectedStudent.id)
                .eq('anio_academico', currentYear);
            setStudentPayments(data || []);
            // Reload dashboard data too
            loadDashboardData();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const markAsPending = async (concepto: string) => {
        if (!selectedStudent) return;
        const existing = studentPayments.find(p => p.concepto === concepto);
        if (existing) {
            await supabase.from('pagos').update({ estado: 'pendiente', fecha_pago: null }).eq('id', existing.id);
            const { data } = await supabase
                .from('pagos')
                .select('*')
                .eq('alumno_id', selectedStudent.id)
                .eq('anio_academico', currentYear);
            setStudentPayments(data || []);
            loadDashboardData();
        }
    };

    const handleSendReminder = async () => {
        if (!selectedStudent) return;

        // Determinar pendientes
        const pendientes = CONCEPTOS.filter(c => {
            const p = studentPayments.find(sp => sp.concepto === c.key);
            return !p || p.estado !== 'pagado';
        });

        if (pendientes.length === 0) {
            alert('El alumno está al día. No hay recordatorios que enviar.');
            return;
        }

        if (!confirm(`¿Enviar recordatorio de pago a apoderado de ${selectedStudent.nombres}?`)) return;

        setSendingReminder(true);
        try {
            // 1. Buscar apoderado y su teléfono
            const { data: padreRelData } = await supabase
                .from('padres_alumnos')
                .select(`
                    padre:padres(
                        usuario:usuarios(nombre_completo, telefono)
                    )
                `)
                .eq('alumno_id', selectedStudent.id)
                .limit(1)
                .single();

            const padreRel = padreRelData as any;
            const telefonoApoderado = padreRel?.padre?.usuario?.telefono;
            const nombreApoderado = padreRel?.padre?.usuario?.nombre_completo || 'Estimado Apoderado';

            if (!telefonoApoderado) {
                alert('No se encontró un número telefónico registrado para el apoderado del alumno.');
                setSendingReminder(false);
                return;
            }

            // 2. Construir mensaje
            const conceptList = pendientes.map(p => `- ${p.label}`).join('\n');
            const message = `*RECORDATORIO DE PAGOS - Sistema Escolar*\n\nHola ${nombreApoderado},\n\nLe recordamos gentilmente que el alumno(a) *${selectedStudent.nombres} ${selectedStudent.apellidos}* mantiene pendientes los siguientes conceptos:\n\n${conceptList}\n\nAgradecemos regularizar el pago a la brevedad posible. Si ya realizó el pago, por favor ignore este mensaje.\n\nAtentamente,\nLa Dirección.`;

            // 3. Enviar vía WAHA local
            await sendWhatsAppMessage(telefonoApoderado, message);
            alert('Recordatorio enviado exitosamente por WhatsApp.');

        } catch (err: any) {
            console.error(err);
            alert('No se pudo enviar el recordatorio. Verifique la consola para detalles.');
        } finally {
            setSendingReminder(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
    }

    if (view === 'detail' && selectedStudent) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <header className="flex items-center justify-between">
                    <button onClick={() => { setView('dashboard'); setSelectedStudent(null); }} className="flex items-center gap-2 text-indigo-600 font-black text-sm hover:underline">
                        <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
                    </button>
                </header>

                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg">
                            {selectedStudent.nombres[0]}{selectedStudent.apellidos[0]}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">{selectedStudent.nombres} {selectedStudent.apellidos}</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Estado de Pagos — {currentYear}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-indigo-600" /> Detalle de Conceptos
                        </h4>
                        <button
                            onClick={handleSendReminder}
                            disabled={sendingReminder}
                            className="flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-600 shadow-md transition-all disabled:opacity-50"
                        >
                            {sendingReminder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sendingReminder ? 'Enviando...' : 'Enviar Recordatorio WA'}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {CONCEPTOS.map(c => {
                            const pago = studentPayments.find(p => p.concepto === c.key);
                            const isPaid = pago?.estado === 'pagado';
                            return (
                                <div key={c.key} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${isPaid ? 'bg-green-50/50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center gap-3">
                                        {isPaid ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-orange-400" />
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{c.label}</p>
                                            {isPaid && pago?.fecha_pago && (
                                                <p className="text-[10px] text-green-600 font-bold">Pagado el {pago.fecha_pago}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {isPaid ? 'Pagado' : 'Pendiente'}
                                        </span>
                                        {isPaid ? (
                                            <button onClick={() => markAsPending(c.key)} className="text-[10px] font-bold text-red-400 hover:text-red-600 ml-2 uppercase">Revertir</button>
                                        ) : (
                                            <button onClick={() => markAsPaid(c.key)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm">
                                                Marcar Pagado
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    const filteredMorosos = morosos.filter(m =>
        `${m.nombres} ${m.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mensualidades</h2>
                <p className="text-slate-500 font-medium">Control de pagos de matrícula y mensualidades — {currentYear}.</p>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
                        <Users className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Alumnos</p>
                        <p className="text-3xl font-black text-slate-800">{totalAlumnos}</p>
                    </div>
                </div>

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Al Día</p>
                        <p className="text-3xl font-black text-green-600">{alDia}</p>
                    </div>
                </div>

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atrasados</p>
                        <p className="text-3xl font-black text-orange-600">{morosos.length}</p>
                    </div>
                </div>

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Progreso Global</p>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <span className="text-lg font-black text-indigo-600">{progressPercent}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">{totalPagosRealizados} de {totalPagosEsperados} pagos</p>
                </div>
            </div>

            {/* Quick access by salon */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Consultar por Salón</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-sm">
                        <select
                            value={selectedSalonId}
                            onChange={(e) => setSelectedSalonId(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                        >
                            <option value="">Seleccionar Salón...</option>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.seccion}</option>)}
                        </select>
                    </div>
                </div>

                {selectedSalonId && salonStudents.length > 0 && (
                    <div className="mt-6 space-y-2">
                        {salonStudents.map(s => {
                            const pagosAlumno = allPayments.filter(p => p.alumno_id === s.id && p.estado === 'pagado');
                            const progress = Math.round((pagosAlumno.length / CONCEPTOS.length) * 100);
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => loadStudentPayments(s)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm">
                                            {s.nombres[0]}{s.apellidos[0]}
                                        </div>
                                        <p className="font-bold text-slate-800 text-sm">{s.nombres} {s.apellidos}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : progress > 50 ? 'bg-indigo-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <span className="text-xs font-black text-slate-400">{pagosAlumno.length}/{CONCEPTOS.length}</span>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Morosos List */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h3 className="text-sm font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Alumnos con Pagos Pendientes
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar alumno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium w-64"
                        />
                    </div>
                </div>
                <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                    {filteredMorosos.length > 0 ? filteredMorosos.map(m => (
                        <button
                            key={m.id}
                            onClick={() => loadStudentPayments(m)}
                            className="w-full flex items-center justify-between px-8 py-5 hover:bg-slate-50/80 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700 font-black text-sm">
                                    {m.nombres[0]}{m.apellidos[0]}
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-slate-800">{m.nombres} {m.apellidos}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{(m as any).salon?.nombre} {(m as any).salon?.seccion}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                    {m.pendientes} pendiente{m.pendientes > 1 ? 's' : ''}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                            </div>
                        </button>
                    )) : (
                        <div className="p-12 text-center text-slate-400 font-medium">
                            <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-4" />
                            <p className="font-bold">¡Todos los alumnos están al día!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentsManagement;

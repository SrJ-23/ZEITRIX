import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  MapPin,
  Plus,
  Trash2,
  X,
  BookOpen,
  GraduationCap,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ScheduleEntry {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  asignacion_id: string;
  curso_nombre?: string;
  profesor_nombre?: string;
  salon_nombre?: string;
  salon_seccion?: string;
}

const HOURS = [
  { inicio: '08:00', fin: '09:00', label: '08:00' },
  { inicio: '09:00', fin: '10:00', label: '09:00' },
  { inicio: '10:00', fin: '11:00', label: '10:00' },
  { inicio: '11:00', fin: '12:00', label: '11:00' },
  { inicio: '12:00', fin: '13:00', label: '12:00' },
  { inicio: '13:00', fin: '14:00', label: '13:00' },
  { inicio: '14:00', fin: '15:00', label: '14:00' },
  { inicio: '15:00', fin: '16:00', label: '15:00' },
];
const DAYS = [
  { num: 1, name: 'Lunes' },
  { num: 2, name: 'Martes' },
  { num: 3, name: 'Miércoles' },
  { num: 4, name: 'Jueves' },
  { num: 5, name: 'Viernes' },
];

const ScheduleManagement: React.FC = () => {
  const [viewType, setViewType] = useState<'salon' | 'profesor'>('salon');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [showModal, setShowModal] = useState<{ dayNum: number; dayName: string; inicio: string; fin: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [salons, setSalons] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  const [formData, setFormData] = useState({ asignacion_id: '' });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [salonsRes, teachersRes, assignmentsRes] = await Promise.all([
          supabase.from('salones').select('id, nombre, seccion').order('nombre'),
          supabase.from('usuarios').select('id, nombre_completo').eq('role', 'docente').order('nombre_completo'),
          supabase.from('asignaciones_cursos').select(`
            id,
            salon_id,
            profesor_id,
            curso:cursos(nombre),
            salon:salones(nombre, seccion),
            profesor:usuarios!profesor_id(nombre_completo)
          `)
        ]);

        if (salonsRes.data) setSalons(salonsRes.data);
        if (teachersRes.data) setTeachers(teachersRes.data);
        if (assignmentsRes.data) setAssignments(assignmentsRes.data);
      } catch (err) {
        console.error('Error loading schedule data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedEntity) { setSchedules([]); return; }
    loadSchedules();
  }, [selectedEntity, viewType]);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('horarios')
        .select(`
          id,
          dia_semana,
          hora_inicio,
          hora_fin,
          asignacion_id,
          asignacion:asignaciones_cursos(
            curso:cursos(nombre),
            salon:salones(nombre, seccion),
            profesor:usuarios!profesor_id(nombre_completo)
          )
        `);

      if (error) throw error;

      const filtered = (data || []).filter((h: any) => {
        if (viewType === 'salon') {
          return h.asignacion?.salon?.nombre + ' ' + h.asignacion?.salon?.seccion === selectedEntity;
        } else {
          return h.asignacion?.profesor?.nombre_completo === selectedEntity;
        }
      }).map((h: any) => ({
        id: h.id,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        asignacion_id: h.asignacion_id,
        curso_nombre: h.asignacion?.curso?.nombre,
        profesor_nombre: h.asignacion?.profesor?.nombre_completo,
        salon_nombre: h.asignacion?.salon?.nombre,
        salon_seccion: h.asignacion?.salon?.seccion
      }));

      setSchedules(filtered);
    } catch (err) {
      console.error('Error loading schedules:', err);
    }
  };

  const handleAddEntry = async () => {
    if (!showModal || !formData.asignacion_id) return;
    try {
      const { error } = await supabase.from('horarios').insert([{
        dia_semana: showModal.dayNum,
        hora_inicio: showModal.inicio,
        hora_fin: showModal.fin,
        asignacion_id: formData.asignacion_id
      }]);
      if (error) throw error;
      setFormData({ asignacion_id: '' });
      setShowModal(null);
      await loadSchedules();
    } catch (err: any) {
      alert('Error al agregar clase: ' + err.message);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase.from('horarios').delete().eq('id', id);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const getEntryAt = (dayNum: number, horaInicio: string) => {
    return schedules.find(s => s.dia_semana === dayNum && s.hora_inicio === horaInicio);
  };

  const availableAssignments = assignments.filter(a => {
    if (viewType === 'salon') {
      return (a.salon?.nombre + ' ' + a.salon?.seccion) === selectedEntity;
    } else {
      return a.profesor?.nombre_completo === selectedEntity;
    }
  });

  const salonOptions = salons.map(s => `${s.nombre} ${s.seccion}`);
  const teacherOptions = teachers.map(t => t.nombre_completo);

  if (loading) {
    return <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Calendario Académico</h2>
          <p className="text-slate-500">Gestión de horarios de 8:00 AM a 4:00 PM.</p>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
          <button
            onClick={() => { setViewType('salon'); setSelectedEntity(''); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewType === 'salon' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <MapPin className="w-4 h-4" />
            Salones
          </button>
          <button
            onClick={() => { setViewType('profesor'); setSelectedEntity(''); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewType === 'profesor' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <GraduationCap className="w-4 h-4" />
            Profesores
          </button>
        </div>
      </header>

      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-sm">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              {viewType === 'salon' ? 'Seleccionar Salón Académico' : 'Seleccionar Personal Docente'}
            </label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 transition-all cursor-pointer"
            >
              <option value="">{viewType === 'salon' ? '--- Escoger Salón ---' : '--- Escoger Profesor ---'}</option>
              {(viewType === 'salon' ? salonOptions : teacherOptions).map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          {selectedEntity && (
            <div className="flex-1 text-right animate-in fade-in slide-in-from-right-2 duration-500">
              <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                Edición Activa: {selectedEntity}
              </span>
            </div>
          )}
        </div>

        {/* Google Calendar Style Grid */}
        <div className="overflow-hidden rounded-[24px] border border-slate-100 shadow-inner">
          <div className="grid grid-cols-[100px_repeat(5,1fr)] bg-slate-50/80 border-b border-slate-100 backdrop-blur-sm">
            <div className="p-4 border-r border-slate-100"></div>
            {DAYS.map(day => (
              <div key={day.num} className="p-4 text-center text-[11px] font-black text-slate-500 uppercase tracking-widest border-l border-slate-100">
                {day.name}
              </div>
            ))}
          </div>

          <div className="bg-white divide-y divide-slate-100">
            {HOURS.map(hour => (
              <div key={hour.inicio} className="grid grid-cols-[100px_repeat(5,1fr)] h-28 group">
                <div className="flex items-center justify-center text-[10px] font-black text-slate-300 bg-slate-50/30 border-r border-slate-100">
                  {hour.label}
                </div>
                {DAYS.map(day => {
                  const entry = getEntryAt(day.num, hour.inicio);
                  return (
                    <div
                      key={day.num}
                      onClick={() => !entry && selectedEntity && setShowModal({ dayNum: day.num, dayName: day.name, inicio: hour.inicio, fin: hour.fin })}
                      className={`relative border-l border-slate-50 p-2.5 transition-all ${!entry && selectedEntity ? 'hover:bg-indigo-50/40 cursor-pointer group/cell' : ''}`}
                    >
                      {entry ? (
                        <div className="h-full w-full bg-indigo-600 text-white rounded-2xl p-3 shadow-sm flex flex-col justify-between animate-in zoom-in-95 duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all">
                          <div>
                            <div className="flex items-center gap-1.5 opacity-80 mb-1">
                              <BookOpen className="w-2.5 h-2.5" />
                              <span className="text-[9px] font-black uppercase tracking-tight truncate">{entry.curso_nombre}</span>
                            </div>
                            <p className="text-xs font-bold leading-tight">
                              {viewType === 'salon' ? entry.profesor_nombre : `${entry.salon_nombre} ${entry.salon_seccion}`}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            className="absolute bottom-2 right-2 p-2 bg-red-500 rounded-xl hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        selectedEntity && (
                          <div className="h-full w-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                            <Plus className="w-6 h-6 text-indigo-300 stroke-[3]" />
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <CalendarClock className="w-6 h-6 text-indigo-600" />
                Nueva Clase
              </h3>
              <button onClick={() => setShowModal(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="mb-8 p-6 bg-slate-50 rounded-[24px] flex items-center justify-around text-xs font-black text-slate-400 uppercase tracking-widest border border-slate-100">
              <span className="text-indigo-600">{showModal.dayName}</span>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
              <span className="text-slate-700">{showModal.inicio} - {showModal.fin}</span>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Asignación (Curso / Profesor / Salón)</label>
                <select
                  value={formData.asignacion_id}
                  onChange={(e) => setFormData({ asignacion_id: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                >
                  <option value="">Seleccionar curso asignado...</option>
                  {availableAssignments.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.curso?.nombre} — {viewType === 'salon' ? a.profesor?.nombre_completo : `${a.salon?.nombre} ${a.salon?.seccion}`}
                    </option>
                  ))}
                </select>
                {availableAssignments.length === 0 && (
                  <p className="text-xs text-orange-500 font-bold mt-2">No hay cursos asignados a este {viewType === 'salon' ? 'salón' : 'profesor'}. Créalos en Gestión de Plantel → Cursos Asignados.</p>
                )}
              </div>

              <button
                onClick={handleAddEntry}
                disabled={!formData.asignacion_id}
                className="w-full py-5 bg-indigo-900 hover:bg-black text-white font-black rounded-[24px] transition-all shadow-xl shadow-indigo-100 disabled:opacity-40 mt-4 uppercase tracking-widest text-xs"
              >
                Confirmar Clase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder state */}
      {!selectedEntity && (
        <div className="py-24 flex flex-col items-center justify-center text-slate-300">
          <div className="p-8 bg-slate-50 rounded-[48px] mb-6">
            <CalendarClock className="w-20 h-20 opacity-20" />
          </div>
          <p className="text-sm font-black uppercase tracking-widest">Selecciona un {viewType === 'salon' ? 'Salón' : 'Profesor'} para comenzar</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;

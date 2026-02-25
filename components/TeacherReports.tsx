import React, { useState, useEffect } from 'react';
import { Sparkles, Send, AlertTriangle, Info, BookOpen, Users, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TeacherReports: React.FC<{ user: any }> = ({ user }) => {
  const [salonCourse, setSalonCourse] = useState('');
  const [student, setStudent] = useState('');
  const [reportType, setReportType] = useState('informativo');
  const [description, setDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [loadingData, setLoadingData] = useState(true);
  const [salonCourses, setSalonCourses] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);

  // Cargar asignaciones reales al montar
  useEffect(() => {
    const loadAssignments = async () => {
      setLoadingData(true);
      try {
        let query = supabase.from('asignaciones_cursos').select(`
          id,
          salon_id,
          curso:cursos(nombre),
          salon:salones(nombre, seccion),
          profesor:usuarios!profesor_id(nombre_completo)
        `);

        // Si es docente, filtrar solo sus asignaciones
        if (user.role === 'docente' && user.id) {
          query = query.eq('profesor_id', user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        setSalonCourses((data || []).map((a: any) => ({
          id: a.id,
          salon_id: a.salon_id,
          label: `${a.salon?.nombre} ${a.salon?.seccion} — ${a.curso?.nombre}`
        })));
      } catch (err) {
        console.error('Error loading assignments:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadAssignments();
  }, [user.id, user.role]);

  // Cargar alumnos al seleccionar salón/curso
  useEffect(() => {
    if (!salonCourse) { setStudentsList([]); return; }
    const selected = salonCourses.find(sc => sc.id === salonCourse);
    if (!selected) return;

    const loadStudents = async () => {
      const { data } = await supabase
        .from('alumnos')
        .select('id, nombres, apellidos')
        .eq('salon_id', selected.salon_id)
        .order('nombres');
      setStudentsList(data || []);
    };
    loadStudents();
  }, [salonCourse, salonCourses]);

  // Funcion para llamar al endpoint seguro (Serverless Function)
  const generateAISuggestion = async () => {
    if (!description.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/generate-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      if (!res.ok) throw new Error('Error al conectar con el asistente');

      const data = await res.json();
      if (data.suggestion) setDescription(data.suggestion.trim());
    } catch (e) {
      console.error("Error obteniendo sugerencia:", e);
      alert("No se pudo conectar con el asistente IA. Verifica tu conexión.");
    } finally {
      setAiLoading(false);
    }
  };

  const getRecipientInfo = () => {
    if (reportType === 'conducta') {
      return {
        text: 'Se enviará notificación privada al APODERADO del alumno.',
        icon: Users,
        color: 'text-orange-600',
        bg: 'bg-orange-50'
      };
    }
    return {
      text: 'Se enviará notificación a TODO EL GRUPO del salón.',
      icon: MessageSquare,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    };
  };

  const recipient = getRecipientInfo();

  if (loadingData) {
    return <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Reportes de Alumnos</h2>
        <p className="text-slate-500">Registra incidencias, felicitaciones o avances académicos.</p>
      </header>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          {/* Paso 1: Salón y Curso */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Seleccionar Salón y Curso
            </label>
            <select
              value={salonCourse}
              onChange={(e) => {
                setSalonCourse(e.target.value);
                setStudent('');
              }}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 transition-all"
            >
              <option value="">Escoge un salón asignado...</option>
              {salonCourses.map(sc => (
                <option key={sc.id} value={sc.id}>{sc.label}</option>
              ))}
            </select>
          </div>

          {/* Paso 2: Tipo de Reporte */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700">Tipo de Reporte</label>
            <div className="flex gap-3">
              {[
                { id: 'conducta', label: 'Conducta', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
                { id: 'academico', label: 'Académico', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'informativo', label: 'Informativo', icon: Info, color: 'text-indigo-600', bg: 'bg-indigo-50' }
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setReportType(type.id);
                    if (type.id !== 'conducta') setStudent('');
                  }}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${reportType === type.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}
                >
                  <type.icon className={`w-6 h-6 ${type.color}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Destinatario Informativo */}
          <div className={`p-4 rounded-xl flex items-center gap-3 border ${recipient.bg.replace('bg-', 'border-')} ${recipient.bg}`}>
            <recipient.icon className={`w-5 h-5 ${recipient.color}`} />
            <span className={`text-xs font-bold ${recipient.color}`}>{recipient.text}</span>
          </div>

          {/* Paso 3: Selector de Alumno (Solo si es Conducta) */}
          {reportType === 'conducta' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600" />
                Alumno involucrado
              </label>
              <select
                value={student}
                disabled={!salonCourse}
                onChange={(e) => setStudent(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-slate-700 transition-all disabled:opacity-50"
              >
                <option value="">Seleccionar alumno del curso...</option>
                {studentsList.map(s => (
                  <option key={s.id} value={s.id}>{s.nombres} {s.apellidos}</option>
                ))}
              </select>
              {!salonCourse && <p className="text-[10px] text-orange-500 font-bold uppercase">Debes seleccionar un salón primero</p>}
            </div>
          )}

          {/* Área de Descripción */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">Descripción del Reporte</label>
              <button
                type="button"
                onClick={generateAISuggestion}
                disabled={aiLoading || !description}
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 bg-indigo-50 px-3 py-1.5 rounded-full transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? 'Mejorando...' : 'Asistente IA'}
              </button>
            </div>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={reportType === 'conducta' ? "Describe el incidente detalladamente..." : "Escribe el aviso general para el salón..."}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            ></textarea>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!salonCourse || (reportType === 'conducta' && !student) || !description}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              <Send className="w-4 h-4" />
              Enviar Reporte {reportType === 'conducta' ? 'Privado' : 'Grupal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherReports;

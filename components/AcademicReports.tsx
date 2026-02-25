import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Download,
  Printer,
  Eye,
  Users,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  GraduationCap,
  Star,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const AcademicReports: React.FC<{ user: any }> = ({ user }) => {
  const [selectedSalonId, setSelectedSalonId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [salons, setSalons] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [coursesResults, setCoursesResults] = useState<any[]>([]);

  // Cargar salones reales
  useEffect(() => {
    const loadSalons = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('salones')
        .select('id, nombre, seccion, tutor:usuarios(nombre_completo)')
        .order('nombre');
      setSalons(data || []);
      setLoading(false);
    };
    loadSalons();
  }, []);

  // Cargar alumnos cuando se selecciona un salón
  useEffect(() => {
    if (!selectedSalonId) { setStudents([]); return; }
    const loadStudents = async () => {
      const { data } = await supabase
        .from('alumnos')
        .select('id, nombres, apellidos, dni')
        .eq('salon_id', selectedSalonId)
        .order('nombres');
      setStudents(data || []);
    };
    loadStudents();
  }, [selectedSalonId]);

  const selectedSalon = salons.find(s => s.id === selectedSalonId);

  // Generar reporte: cargar notas reales de todas las asignaciones del salón
  const handleGenerate = async () => {
    try {
      // Obtener asignaciones del salón
      const { data: asignaciones } = await supabase
        .from('asignaciones_cursos')
        .select(`
          id,
          curso:cursos(nombre),
          profesor:usuarios!profesor_id(nombre_completo)
        `)
        .eq('salon_id', selectedSalonId);

      if (!asignaciones || asignaciones.length === 0) {
        alert('No hay cursos asignados en este salón.');
        return;
      }

      // Para cada asignación, cargar su config y las notas
      const results = [];
      for (const asig of asignaciones) {
        // Config
        const { data: config } = await supabase
          .from('notas_config')
          .select('*')
          .eq('asignacion_id', asig.id)
          .maybeSingle();

        const weights = config
          ? { practicas: config.peso_practicas, examenes: config.peso_examenes, tareas: config.peso_tareas }
          : { practicas: 20, examenes: 70, tareas: 10 };
        const counts = config
          ? { practicas: config.num_practicas, examenes: config.num_examenes, tareas: config.num_tareas }
          : { practicas: 2, examenes: 1, tareas: 2 };

        results.push({
          asignacion_id: asig.id,
          name: (asig as any).curso?.nombre || 'Sin nombre',
          prof: (asig as any).profesor?.nombre_completo || 'Sin docente',
          weights,
          counts
        });
      }

      setCoursesResults(results);
      setIsPreviewing(true);
    } catch (err) {
      console.error('Error generating report:', err);
    }
  };

  // Calcular promedio de un alumno en un curso
  const calculateStudentAvg = (notas: any[], weights: any, counts: any) => {
    const getAvg = (tipo: string, count: number) => {
      const vals = notas.filter(n => n.tipo === tipo).sort((a: any, b: any) => a.indice - b.indice);
      if (count === 0) return 0;
      let sum = 0;
      for (let i = 0; i < count; i++) sum += (vals[i]?.valor || 0);
      return sum / count;
    };
    const pAvg = getAvg('practicas', counts.practicas);
    const eAvg = getAvg('examenes', counts.examenes);
    const tAvg = getAvg('tareas', counts.tareas);
    return {
      practicas: parseFloat(pAvg.toFixed(1)),
      examenes: parseFloat(eAvg.toFixed(1)),
      tareas: parseFloat(tAvg.toFixed(1)),
      final: parseFloat(((pAvg * weights.practicas / 100) + (eAvg * weights.examenes / 100) + (tAvg * weights.tareas / 100)).toFixed(1))
    };
  };

  const ReportCard = ({ student }: { student: any }) => {
    const [studentResults, setStudentResults] = useState<any[]>([]);
    const [loadingReport, setLoadingReport] = useState(true);

    useEffect(() => {
      const loadNotes = async () => {
        setLoadingReport(true);
        const results = [];
        for (const course of coursesResults) {
          const { data: notas } = await supabase
            .from('notas')
            .select('tipo, indice, valor')
            .eq('asignacion_id', course.asignacion_id)
            .eq('alumno_id', student.id);

          const avgs = calculateStudentAvg(notas || [], course.weights, course.counts);
          results.push({ ...course, ...avgs });
        }
        setStudentResults(results);
        setLoadingReport(false);
      };
      loadNotes();
    }, [student.id]);

    if (loadingReport) {
      return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    return (
      <div className="bg-white border-[10px] border-slate-50 p-12 rounded-[40px] shadow-2xl max-w-4xl mx-auto my-8 print:shadow-none print:border-none">
        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-8 mb-8">
          <div>
            <h1 className="text-4xl font-black text-indigo-900 tracking-tighter">EduControl Pro</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Libreta de Notas {new Date().getFullYear()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-slate-400 uppercase">Institución Educativa</p>
            <p className="font-bold text-slate-800">Colegio Privado San Marcos</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="bg-slate-50 p-6 rounded-3xl">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Alumno</p>
            <p className="text-xl font-black text-slate-800">{student.nombres} {student.apellidos}</p>
            <p className="text-sm text-slate-500 font-medium">DNI: {student.dni}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Grado y Sección</p>
            <p className="text-xl font-black text-slate-800">{selectedSalon?.nombre} {selectedSalon?.seccion}</p>
            <p className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 fill-indigo-600" /> Tutor: {selectedSalon?.tutor?.nombre_completo || 'Sin asignar'}
            </p>
          </div>
        </div>

        <table className="w-full text-left mb-12">
          <thead>
            <tr className="border-b-2 border-slate-100">
              <th className="py-4 text-xs font-black uppercase text-slate-400">Área Académica</th>
              <th className="py-4 text-xs font-black uppercase text-slate-400 text-center">Pract.</th>
              <th className="py-4 text-xs font-black uppercase text-slate-400 text-center">Exám.</th>
              <th className="py-4 text-xs font-black uppercase text-slate-400 text-center">Tareas</th>
              <th className="py-4 text-xs font-black uppercase text-indigo-600 text-right">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {studentResults.map((c: any) => (
              <tr key={c.asignacion_id}>
                <td className="py-6">
                  <p className="font-bold text-slate-800">{c.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{c.prof}</p>
                </td>
                <td className="py-6 text-center text-sm font-bold text-slate-600">{c.practicas}</td>
                <td className="py-6 text-center text-sm font-bold text-slate-600">{c.examenes}</td>
                <td className="py-6 text-center text-sm font-bold text-slate-600">{c.tareas}</td>
                <td className="py-6 text-right">
                  <span className={`text-lg font-black ${c.final >= 11 ? 'text-indigo-600' : 'text-red-500'}`}>
                    {c.final}
                  </span>
                </td>
              </tr>
            ))}
            {studentResults.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400 font-medium">No hay notas registradas para este alumno.</td></tr>
            )}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-12 pt-12 border-t-2 border-slate-100 mt-12">
          <div className="text-center">
            <div className="h-0.5 bg-slate-200 mb-2 w-full"></div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Firma del Tutor ({selectedSalon?.tutor?.nombre_completo || 'Sin asignar'})</p>
          </div>
          <div className="text-center">
            <div className="h-0.5 bg-slate-200 mb-2 w-full"></div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Firma de Dirección</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  if (isPreviewing) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex items-center justify-between">
          <button onClick={() => setIsPreviewing(false)} className="flex items-center gap-2 text-indigo-600 font-black text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" /> Volver a Parámetros
          </button>
          <div className="flex gap-3">
            <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-xl shadow-indigo-100" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimir / Exportar
            </button>
          </div>
        </header>
        <div className="space-y-12">
          {selectedStudentId ? (
            <ReportCard student={students.find(s => s.id === selectedStudentId)} />
          ) : (
            students.map(student => (
              <React.Fragment key={student.id}>
                <ReportCard student={student} />
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Reportes Académicos</h2>
        <p className="text-slate-500">Genera libretas de notas individuales o por salón completo.</p>
      </header>
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-12">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
              <h4 className="text-indigo-600 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Paso 1: Filtro de Grupo
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Seleccionar Salón</label>
                  <select
                    value={selectedSalonId}
                    onChange={(e) => { setSelectedSalonId(e.target.value); setSelectedStudentId(''); }}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="">Todos los salones...</option>
                    {salons.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.seccion}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {selectedSalon && (
              <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutor Responsable</p>
                  <p className="text-sm font-bold text-slate-700">{selectedSalon.tutor?.nombre_completo || 'Sin asignar'}</p>
                </div>
              </div>
            )}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <h4 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Paso 2: Especificación
              </h4>
              <select
                value={selectedStudentId}
                disabled={!selectedSalonId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold disabled:opacity-50"
              >
                <option value="">--- Todo el Salón ---</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.nombres} {s.apellidos}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center p-8 bg-indigo-900 rounded-[40px] text-white relative overflow-hidden group">
            <h4 className="text-xl font-black mb-2">Generación Automática</h4>
            <p className="text-indigo-200 text-center text-sm mb-8 px-4 opacity-70">
              El sistema generará una libreta detallada incluyendo el promedio del salón y la firma del tutor asignado.
            </p>
            <button
              onClick={handleGenerate}
              disabled={!selectedSalonId}
              className="w-full bg-white text-indigo-900 font-black py-4 rounded-2xl hover:bg-indigo-50 transition-all disabled:opacity-50 uppercase text-xs tracking-widest"
            >
              Ver Vista Previa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicReports;

import React, { useState, useEffect } from 'react';
import {
  BookMarked,
  Settings,
  Save,
  PieChart,
  Plus,
  Star,
  Lock,
  Loader2
} from 'lucide-react';
import { Role } from '../types';
import { supabase } from '../lib/supabase';

interface GradeRecord {
  practicas: number[];
  examenes: number[];
  tareas: number[];
}

interface CourseConfig {
  weights: { practicas: number; examenes: number; tareas: number };
  counts: { practicas: number; examenes: number; tareas: number };
}

const GradesManagement: React.FC<{ user: { id?: string; role: Role; name: string; salonAsignado?: string } }> = ({ user }) => {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);

  const [selectedSalonId, setSelectedSalonId] = useState('');
  const [selectedAsignacionId, setSelectedAsignacionId] = useState('');

  const [editingWeights, setEditingWeights] = useState(false);

  // REGLA DE NEGOCIO: Solo superadmin y docente pueden editar notas. 
  // El Admin (Director) solo puede visualizar.
  const canEdit = user.role === 'superadmin' || user.role === 'docente';

  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, GradeRecord>>({});
  const [currentConfig, setCurrentConfig] = useState<CourseConfig>({
    weights: { practicas: 20, examenes: 70, tareas: 10 },
    counts: { practicas: 2, examenes: 1, tareas: 2 }
  });

  const [allSalons, setAllSalons] = useState<any[]>([]);

  // 1. Obtener todas las asignaciones al cargar
  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setLoadingInitial(true);
    try {
      // Siempre cargar salones reales para admin/superadmin
      if (user.role !== 'docente') {
        const { data: salonData } = await supabase.from('salones').select('id, nombre, seccion').order('nombre');
        setAllSalons(salonData || []);
      }

      let query = supabase.from('asignaciones_cursos').select(`
        id,
        salon_id,
        profesor_id,
        curso_id,
        curso:cursos(nombre),
        salon:salones(nombre, seccion),
        profesor:usuarios!profesor_id(nombre_completo)
      `);

      if (user.role === 'docente' && user.id) {
        query = query.eq('profesor_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssignments(data || []);

      // Auto-seleccionar primer salón si es docente
      if (user.role === 'docente' && data && data.length > 0) {
        setSelectedSalonId(data[0].salon_id);
      }
    } catch (err) {
      console.error('Error cargando asignaciones:', err);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Para docentes: derivar salones de sus asignaciones. Para admin: usar todos los salones.
  const uniqueSalons = React.useMemo(() => {
    if (user.role === 'docente') {
      return Array.from(new Map(assignments.map(a => [a.salon_id, { id: a.salon_id, nombre: a.salon?.nombre, seccion: a.salon?.seccion }])).values());
    }
    return allSalons.map(s => ({ id: s.id, nombre: s.nombre, seccion: s.seccion }));
  }, [assignments, allSalons, user.role]);

  const availableCursos = React.useMemo(() => {
    return assignments.filter(a => a.salon_id === selectedSalonId);
  }, [assignments, selectedSalonId]);

  const selectedAssignment = React.useMemo(() => {
    return assignments.find(a => a.id === selectedAsignacionId);
  }, [assignments, selectedAsignacionId]);

  // 2. Cargar datos cuando se selecciona una asignación
  useEffect(() => {
    if (selectedAsignacionId && selectedSalonId) {
      fetchGradesData();
    } else {
      setStudents([]);
      setGrades({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsignacionId, selectedSalonId]);

  const fetchGradesData = async () => {
    try {
      // 2a. Cargar alumnos del salón
      const { data: alumnosData } = await supabase.from('alumnos').select('*').eq('salon_id', selectedSalonId).order('nombres');
      setStudents(alumnosData || []);

      // 2b. Cargar Configuración de Notas
      const { data: configData } = await supabase.from('notas_config').select('*').eq('asignacion_id', selectedAsignacionId).single();

      let config: CourseConfig = {
        weights: { practicas: 20, examenes: 70, tareas: 10 },
        counts: { practicas: 2, examenes: 1, tareas: 2 }
      };

      if (configData) {
        config = {
          weights: { practicas: configData.peso_practicas, examenes: configData.peso_examenes, tareas: configData.peso_tareas },
          counts: { practicas: configData.num_practicas, examenes: configData.num_examenes, tareas: configData.num_tareas }
        };
      }
      setCurrentConfig(config);

      // 2c. Cargar Notas Reales
      const { data: notasData } = await supabase.from('notas').select('*').eq('asignacion_id', selectedAsignacionId);

      const parsedGrades: Record<string, GradeRecord> = {};
      (alumnosData || []).forEach((s: any) => {
        parsedGrades[s.id] = { practicas: [], examenes: [], tareas: [] };
        // Inicializar arrays con count correcto y ceros o nulos
        ['practicas', 'examenes', 'tareas'].forEach(t => {
          for (let i = 0; i < config.counts[t as keyof CourseConfig['counts']]; i++) {
            parsedGrades[s.id][t as keyof GradeRecord].push(0);
          }
        });
      });

      if (notasData) {
        notasData.forEach(nota => {
          if (parsedGrades[nota.alumno_id] && parsedGrades[nota.alumno_id][nota.tipo as keyof GradeRecord]) {
            parsedGrades[nota.alumno_id][nota.tipo as keyof GradeRecord][nota.indice] = parseFloat(nota.valor);
          }
        });
      }
      setGrades(parsedGrades);

    } catch (err) {
      console.error('Error cargando notas:', err);
    }
  };

  const updateConfig = (newConfig: Partial<CourseConfig>) => {
    if (!canEdit) return;
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateGrade = (studentId: string, category: keyof GradeRecord, index: number, value: string) => {
    if (!canEdit) return;
    let num = value === '' ? 0 : parseFloat(value);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 20) num = 20;

    setGrades(prev => {
      const studentGrades = { ...prev[studentId] };
      const newCategoryGrades = [...(studentGrades[category] || [])];
      while (newCategoryGrades.length <= index) newCategoryGrades.push(0);
      newCategoryGrades[index] = num;
      return { ...prev, [studentId]: { ...studentGrades, [category]: newCategoryGrades } };
    });
  };

  const calculateFinal = (studentId: string) => {
    const data = grades[studentId];
    if (!data) return "0.0";
    const { weights, counts } = currentConfig;
    const getAvg = (arr: number[], expectedCount: number) => {
      if (expectedCount === 0) return 0;
      const validGrades = arr.slice(0, expectedCount);
      const sum = validGrades.reduce((a, b) => a + (b || 0), 0);
      return sum / expectedCount;
    };
    const pAvg = getAvg(data.practicas || [], counts.practicas);
    const eAvg = getAvg(data.examenes || [], counts.examenes);
    const tAvg = getAvg(data.tareas || [], counts.tareas);
    const result = (pAvg * (weights.practicas / 100)) + (eAvg * (weights.examenes / 100)) + (tAvg * (weights.tareas / 100));
    return result.toFixed(1);
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      // 1. Guardar Config
      const configPayload = {
        asignacion_id: selectedAsignacionId,
        peso_practicas: currentConfig.weights.practicas,
        peso_examenes: currentConfig.weights.examenes,
        peso_tareas: currentConfig.weights.tareas,
        num_practicas: currentConfig.counts.practicas,
        num_examenes: currentConfig.counts.examenes,
        num_tareas: currentConfig.counts.tareas
      };

      const { data: existingConf } = await supabase.from('notas_config').select('id').eq('asignacion_id', selectedAsignacionId).maybeSingle();
      if (existingConf) {
        await supabase.from('notas_config').update(configPayload).eq('id', existingConf.id);
      } else {
        await supabase.from('notas_config').insert([configPayload]);
      }

      // 2. Guardar Notas
      // Eliminar las existentes para reinserción limpia (O hacer upsert si se manejan PKs)
      await supabase.from('notas').delete().eq('asignacion_id', selectedAsignacionId);

      const notasToInsert: any[] = [];
      Object.keys(grades).forEach(alumnoId => {
        ['practicas', 'examenes', 'tareas'].forEach(tipo => {
          const arr = grades[alumnoId][tipo as keyof GradeRecord];
          arr.forEach((valor, index) => {
            notasToInsert.push({
              alumno_id: alumnoId,
              asignacion_id: selectedAsignacionId,
              tipo: tipo,
              indice: index,
              valor: valor
            });
          });
        });
      });

      if (notasToInsert.length > 0) {
        await supabase.from('notas').insert(notasToInsert);
      }

      alert("Planilla guardada exitosamente en la base de datos.");
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Planilla de Notas</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${canEdit ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
              {canEdit ? 'Edición Habilitada' : 'Modo Consulta (Solo Lectura)'}
            </p>
          </div>
        </div>
        {canEdit && selectedAsignacionId && (
          <button onClick={handleSaveGrades} disabled={saving} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Planilla'}
          </button>
        )}
      </header>

      <div className="grid lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Settings className="w-4 h-4" /> Parámetros Reales
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Salón Asignado</label>
                  <select
                    value={selectedSalonId}
                    onChange={(e) => { setSelectedSalonId(e.target.value); setSelectedAsignacionId(''); }}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 disabled:opacity-70"
                  >
                    <option value="">Seleccionar...</option>
                    {uniqueSalons.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.seccion}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Curso</label>
                  <select
                    value={selectedAsignacionId}
                    onChange={(e) => setSelectedAsignacionId(e.target.value)}
                    disabled={!selectedSalonId}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 disabled:opacity-50"
                  >
                    <option value="">Seleccionar Curso...</option>
                    {availableCursos.map(c => <option key={c.id} value={c.id}>{c.curso.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {selectedAssignment && (
              <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 relative group overflow-hidden">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Star className="w-3 h-3 fill-indigo-400" /> Profesor Dictante
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 font-black border border-indigo-100 shadow-sm">
                    {selectedAssignment.profesor?.nombre_completo.substring(0, 2).toUpperCase() || 'P'}
                  </div>
                  <div>
                    <p className="text-sm font-black text-indigo-900 leading-none mb-1">{selectedAssignment.profesor?.nombre_completo}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedAsignacionId && canEdit && (
              <div className="pt-8 border-t border-slate-50 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <PieChart className="w-4 h-4" /> Pesos
                  </h3>
                  <button onClick={() => setEditingWeights(!editingWeights)} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full uppercase hover:bg-indigo-100">
                    {editingWeights ? 'Listo' : 'Ajustar'}
                  </button>
                </div>

                <div className="space-y-8">
                  {['practicas', 'examenes', 'tareas'].map((k) => (
                    <div key={k} className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-700 tracking-wider">
                        <span>{k}</span>
                        <span>{currentConfig.weights[k as keyof CourseConfig['weights']]}%</span>
                      </div>
                      {editingWeights && (
                        <input
                          type="range" min="0" max="100"
                          value={currentConfig.weights[k as keyof CourseConfig['weights']]}
                          onChange={(e) => {
                            const newWeights = { ...currentConfig.weights, [k]: parseInt(e.target.value) };
                            updateConfig({ weights: newWeights });
                          }}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Columnas: {currentConfig.counts[k as keyof CourseConfig['counts']]}</span>
                        <div className="flex gap-1 ml-auto">
                          <button onClick={() => { const newCounts = { ...currentConfig.counts, [k]: currentConfig.counts[k as keyof CourseConfig['counts']] + 1 }; updateConfig({ counts: newCounts }); }} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all"><Plus className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedAsignacionId ? (
            <div className="bg-white rounded-[48px] border border-slate-100 shadow-sm overflow-hidden flex flex-col relative">
              {!canEdit && (
                <div className="absolute top-8 right-8 z-30">
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-5 py-2.5 rounded-full border border-amber-100 shadow-sm">
                    <Lock className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Vista Directiva: No Editable</span>
                  </div>
                </div>
              )}
              <div className="p-10 border-b border-slate-50 bg-slate-50/20">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                    <BookMarked className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-2xl tracking-tighter">{selectedAssignment?.curso?.nombre}</h3>
                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest">{selectedAssignment?.salon?.nombre} {selectedAssignment?.salon?.seccion}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left table-fixed min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                      <th className="px-10 py-6 w-72 bg-white sticky left-0 z-20">Estudiante</th>
                      {Array.from({ length: currentConfig.counts.practicas }).map((_, i) => (<th key={`p-${i}`} className="px-2 py-6 text-center border-l border-slate-100 bg-blue-50/20 text-blue-600">P{i + 1}</th>))}
                      {Array.from({ length: currentConfig.counts.examenes }).map((_, i) => (<th key={`e-${i}`} className="px-2 py-6 text-center border-l border-indigo-100 bg-indigo-50/40 text-indigo-700">E{i + 1}</th>))}
                      {Array.from({ length: currentConfig.counts.tareas }).map((_, i) => (<th key={`t-${i}`} className="px-2 py-6 text-center border-l border-slate-100 bg-orange-50/20 text-orange-600">T{i + 1}</th>))}
                      <th className="px-10 py-6 text-center w-40 border-l-4 border-slate-200 bg-slate-100/80 text-slate-800 font-black">Promedio Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-10 py-8 bg-white sticky left-0 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.02)]">
                          <p className="font-black text-slate-800 text-base">{student.nombres} {student.apellidos}</p>
                          <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">DNI: {student.dni}</p>
                        </td>
                        {Array.from({ length: currentConfig.counts.practicas }).map((_, i) => (
                          <td key={`p-val-${i}`} className="px-2 py-8 border-l border-slate-50">
                            <input disabled={!canEdit} type="number" min="0" max="20" value={grades[student.id]?.practicas[i] ?? ''} onChange={(e) => updateGrade(student.id, 'practicas', i, e.target.value)} className={`w-full text-center p-3 rounded-2xl text-sm font-black transition-all outline-none ${canEdit ? 'bg-slate-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-50 text-blue-700 focus:border-blue-200' : 'bg-transparent text-slate-400 border-none cursor-default'}`} />
                          </td>
                        ))}
                        {Array.from({ length: currentConfig.counts.examenes }).map((_, i) => (
                          <td key={`e-val-${i}`} className="px-2 py-8 border-l border-indigo-50 bg-indigo-50/5">
                            <input disabled={!canEdit} type="number" min="0" max="20" value={grades[student.id]?.examenes[i] ?? ''} onChange={(e) => updateGrade(student.id, 'examenes', i, e.target.value)} className={`w-full text-center p-3 rounded-2xl text-sm font-black transition-all outline-none ${canEdit ? 'bg-indigo-100/30 border border-transparent focus:bg-white focus:ring-4 focus:ring-indigo-100 text-indigo-900 focus:border-indigo-300' : 'bg-transparent text-slate-400 border-none cursor-default'}`} />
                          </td>
                        ))}
                        {Array.from({ length: currentConfig.counts.tareas }).map((_, i) => (
                          <td key={`t-val-${i}`} className="px-2 py-8 border-l border-slate-50">
                            <input disabled={!canEdit} type="number" min="0" max="20" value={grades[student.id]?.tareas[i] ?? ''} onChange={(e) => updateGrade(student.id, 'tareas', i, e.target.value)} className={`w-full text-center p-3 rounded-2xl text-sm font-black transition-all outline-none ${canEdit ? 'bg-slate-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-orange-50 text-orange-700 focus:border-orange-200' : 'bg-transparent text-slate-400 border-none cursor-default'}`} />
                          </td>
                        ))}
                        <td className="px-10 py-8 text-center border-l-4 border-slate-200 bg-slate-50/30">
                          <span className={`text-2xl font-black ${parseFloat(calculateFinal(student.id)) >= 11 ? 'text-indigo-600' : 'text-red-500'}`}>{calculateFinal(student.id)}</span>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-10 text-center text-slate-400 font-bold">No hay alumnos registrados en este salón.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[64px] border border-slate-100 shadow-sm p-32 text-center">
              <BookMarked className="w-20 h-20 text-indigo-600 opacity-20 mx-auto mb-10" />
              <h4 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Consola de Notas</h4>
              <p className="text-slate-400 max-w-sm mx-auto font-medium text-lg leading-relaxed">
                Seleccione un salón y curso asignado en el panel para visualizar la planilla oficial y cargar los alumnos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradesManagement;

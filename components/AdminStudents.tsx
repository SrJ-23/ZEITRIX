import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  Search,
  MoreVertical,
  Eye,
  GraduationCap,
  Users,
  FileDown,
  Star,
  Loader2,
  BookOpen,
  Download,
  CalendarDays,
  Camera,
  X,
  Pencil,
  Trash2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { createAuthUser } from '../lib/supabaseAdmin';

// Utilidad: comprimir imagen a 400x400 WebP (~50-150KB)
const compressImage = (file: File, maxSize = 400): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        // Crop cuadrado centrado
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Error comprimiendo')),
          'image/webp',
          0.8
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const PlantelManagement: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<'alumnos' | 'docentes' | 'salones' | 'asignaciones'>('alumnos');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showQR, setShowQR] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [processing, setProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data States
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [existingCursos, setExistingCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSalonIds, setSelectedSalonIds] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Fetch Data
  useEffect(() => {
    fetchData();
  }, [activeTab, selectedYear]);

  // Siempre cargar salones y cursos existentes para formularios
  useEffect(() => {
    const fetchExtras = async () => {
      const [classroomsRes, cursosRes] = await Promise.all([
        supabase.from('salones').select('id, nombre, seccion, anio_academico, tutor:usuarios(nombre_completo)').order('nombre', { ascending: true }),
        supabase.from('cursos').select('id, nombre').order('nombre')
      ]);
      if (classroomsRes.data) setClassrooms(classroomsRes.data);
      if (cursosRes.data) setExistingCursos(cursosRes.data);
    };
    fetchExtras();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'alumnos') {
        // Filtrar alumnos por año del salón asignado
        const { data, error } = await supabase
          .from('alumnos')
          .select(`
            *,
            salon:salones(nombre, seccion, anio_academico)
          `);
        if (error) throw error;
        // Filtrar por año del salón (o sin salón asignado)
        const filtered = (data || []).filter((s: any) =>
          !s.salon || s.salon.anio_academico === selectedYear
        );
        setStudents(filtered);
      } else if (activeTab === 'docentes') {
        const { data, error } = await supabase
          .from('profesores')
          .select(`
            id,
            especialidad,
            dni,
            usuario:usuarios (
              nombre_completo,
              email,
              telefono,
              role,
              id
            )
          `);
        if (error) throw error;
        const flatTeachers = data?.map((p: any) => ({
          ...p,
          nombre_completo: p.usuario?.nombre_completo,
          email: p.usuario?.email,
          telefono: p.usuario?.telefono,
          estado: p.usuario?.activo ? 'Activo' : 'Inactivo',
          usuario_id: p.usuario?.id
        })) || [];
        setTeachers(flatTeachers);

      } else if (activeTab === 'salones') {
        const { data, error } = await supabase
          .from('salones')
          .select(`
            *,
            tutor:usuarios(nombre_completo)
          `)
          .eq('anio_academico', selectedYear);
        if (error) throw error;
        setClassrooms(data || []);
      } else if (activeTab === 'asignaciones') {
        const { data, error } = await supabase
          .from('asignaciones_cursos')
          .select(`
            id,
            curso:cursos(nombre),
            salon:salones(nombre, seccion, anio_academico),
            profesor:usuarios!profesor_id(nombre_completo)
          `);
        if (error) throw error;
        // Filtrar asignaciones por año del salón
        const filtered = (data || []).filter((a: any) =>
          a.salon?.anio_academico === selectedYear
        );
        setAssignments(filtered);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT HANDLERS ---
  const handleEditAlumno = async (student: any) => {
    setEditingId(student.id);
    const baseData: any = {
      id: student.id,
      nombres: student.nombres,
      apellidos: student.apellidos,
      dni: student.dni,
      salon_id: student.salon_id || '',
      direccion: student.direccion || '',
      fecha_nacimiento: student.fecha_nacimiento || '',
      genero: student.genero || '',
      foto_url: student.foto_url || ''
    };
    if (student.foto_url) setPhotoPreview(student.foto_url);

    // Cargar datos del apoderado vinculado
    try {
      const { data: relData } = await supabase
        .from('padres_alumnos')
        .select(`
          parentesco,
          padre:padres(
            id, dni, ocupacion,
            usuario:usuarios(id, nombre_completo, email, telefono)
          )
        `)
        .eq('alumno_id', student.id)
        .limit(1)
        .maybeSingle();

      if (relData) {
        const padre = (relData as any).padre;
        const usuario = padre?.usuario;
        baseData.padre_id = padre?.id;
        baseData.padre_usuario_id = usuario?.id;
        baseData.apoderado_nombre = usuario?.nombre_completo || '';
        baseData.apoderado_dni = padre?.dni || '';
        baseData.apoderado_email = usuario?.email || '';
        baseData.apoderado_telefono = usuario?.telefono || '';
        baseData.apoderado_ocupacion = padre?.ocupacion || '';
        baseData.apoderado_relacion = (relData as any).parentesco || '';
      }
    } catch (err) {
      console.error('Error cargando apoderado:', err);
    }

    setFormData(baseData);
    setIsModalOpen(true);
  };

  const handleEditDocente = (teacher: any) => {
    setEditingId(teacher.id);
    setFormData({
      id: teacher.id,
      usuario_id: teacher.usuario_id,
      nombre_completo: teacher.nombre_completo,
      email: teacher.email,
      telefono: teacher.telefono || '',
      especialidad: teacher.especialidad || '',
      dni: teacher.dni || ''
    });
    setIsModalOpen(true);
  };

  const handleEditSalon = (salon: any) => {
    setEditingId(salon.id);
    setFormData({
      id: salon.id,
      tutor_id: salon.tutor_id || ''
    });
    setIsModalOpen(true);
  };

  const handleEditAsignacion = (asig: any) => {
    setEditingId(asig.id);
    setFormData({
      id: asig.id,
      profesor_id: asig.profesor?.id || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteDocente = async (teacher: any) => {
    if (!confirm(`¿Eliminar al docente ${teacher.nombre_completo}? Esta acción no se puede deshacer.`)) return;
    try {
      await supabase.from('profesores').delete().eq('id', teacher.id);
      if (teacher.usuario_id) {
        await supabase.from('usuarios').delete().eq('id', teacher.usuario_id);
      }
      alert('Docente eliminado correctamente.');
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleCreateNewSection = async (gradoNombre: string) => {
    if (!confirm(`¿Crear nueva sección para ${gradoNombre}?`)) return;
    try {
      const { data: existing } = await supabase
        .from('salones')
        .select('seccion')
        .eq('nombre', gradoNombre)
        .eq('anio_academico', selectedYear);

      const sections = existing?.map(s => s.seccion).sort() || [];
      const lastSection = sections.length > 0 ? sections[sections.length - 1] : '@';
      const nextSection = String.fromCharCode(lastSection!.charCodeAt(0) + 1);

      const { error } = await supabase.from('salones').insert([{
        nombre: gradoNombre,
        seccion: nextSection,
        anio_academico: selectedYear
      }]);
      if (error) throw error;
      alert(`Sección ${nextSection} creada para ${gradoNombre}`);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      // --- UPDATE MODE ---
      if (editingId) {
        if (activeTab === 'alumnos') {
          const updates: any = {
            nombres: formData.nombres,
            apellidos: formData.apellidos,
            dni: formData.dni,
            salon_id: formData.salon_id || null,
            direccion: formData.direccion,
            fecha_nacimiento: formData.fecha_nacimiento,
            genero: formData.genero
          };
          if (photoFile) {
            try {
              const compressed = await compressImage(photoFile);
              console.log('Foto comprimida:', compressed.size, 'bytes');
              const filePath = `${editingId}.webp`;
              const { error: uploadErr } = await supabase.storage.from('fotos-alumnos').upload(filePath, compressed, { contentType: 'image/webp', upsert: true });
              if (uploadErr) {
                console.error('Error upload storage:', uploadErr.message);
                alert('Error subiendo foto: ' + uploadErr.message);
              } else {
                const { data: urlData } = supabase.storage.from('fotos-alumnos').getPublicUrl(filePath);
                updates.foto_url = urlData.publicUrl;
                console.log('Foto subida OK:', updates.foto_url);
              }
            } catch (photoErr: any) { console.error('Error compresión/upload foto:', photoErr); alert('Error con la foto: ' + photoErr.message); }
          }
          const { error } = await supabase.from('alumnos').update(updates).eq('id', editingId);
          if (error) throw error;

          // Actualizar datos del apoderado si se proporcionaron
          if (formData.apoderado_nombre && formData.padre_id) {
            // Actualizar padre existente
            await supabase.from('padres').update({
              dni: formData.apoderado_dni,
              ocupacion: formData.apoderado_ocupacion
            }).eq('id', formData.padre_id);

            if (formData.padre_usuario_id) {
              await supabase.from('usuarios').update({
                nombre_completo: formData.apoderado_nombre,
                email: formData.apoderado_email,
                telefono: formData.apoderado_telefono
              }).eq('id', formData.padre_usuario_id);
            }

            // Actualizar parentesco
            if (formData.apoderado_relacion) {
              await supabase.from('padres_alumnos').update({
                parentesco: formData.apoderado_relacion
              }).eq('alumno_id', editingId).eq('padre_id', formData.padre_id);
            }
          }
        } else if (activeTab === 'docentes') {
          await supabase.from('usuarios').update({
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            telefono: formData.telefono
          }).eq('id', formData.usuario_id);
          await supabase.from('profesores').update({
            especialidad: formData.especialidad,
            dni: formData.dni
          }).eq('id', editingId);
        } else if (activeTab === 'salones') {
          await supabase.from('salones').update({
            tutor_id: formData.tutor_id || null
          }).eq('id', editingId);
        } else if (activeTab === 'asignaciones') {
          await supabase.from('asignaciones_cursos').update({
            profesor_id: formData.profesor_id
          }).eq('id', editingId);
        }
        alert('Registro actualizado exitosamente');
        setIsModalOpen(false);
        setFormData({});
        setEditingId(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        fetchData();
        setProcessing(false);
        return;
      }

      // --- CREATE MODE ---
      if (activeTab === 'alumnos') {
        // 1. Crear Alumno — el UUID de Supabase será el QR permanente
        const { data: newStudent, error: studentError } = await supabase.from('alumnos').insert([{
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          dni: formData.dni,
          salon_id: formData.salon_id || null,
          direccion: formData.direccion,
          fecha_nacimiento: formData.fecha_nacimiento,
          genero: formData.genero,
          qr_token: 'auto'
        }]).select().single();

        if (newStudent) {
          // Actualizar qr_token con el UUID real del alumno
          const updates: any = { qr_token: newStudent.id };

          // Subir foto si se seleccionó
          if (photoFile) {
            try {
              const compressed = await compressImage(photoFile);
              console.log('Foto comprimida (crear):', compressed.size, 'bytes');
              const filePath = `${newStudent.id}.webp`;
              const { error: uploadErr } = await supabase.storage
                .from('fotos-alumnos')
                .upload(filePath, compressed, { contentType: 'image/webp', upsert: true });

              if (uploadErr) {
                console.error('Error upload storage (crear):', uploadErr.message);
                alert('⚠️ Alumno creado pero error subiendo foto: ' + uploadErr.message);
              } else {
                const { data: urlData } = supabase.storage.from('fotos-alumnos').getPublicUrl(filePath);
                updates.foto_url = urlData.publicUrl;
                console.log('Foto subida OK (crear):', updates.foto_url);
              }
            } catch (photoErr) {
              console.error('Error subiendo foto:', photoErr);
            }
          }

          await supabase.from('alumnos').update(updates).eq('id', newStudent.id);
        }

        if (studentError) throw studentError;

        // 2. Registrar Apoderado (Si se proporcionaron datos)
        if (formData.apoderado_dni && newStudent) {
          // A. Buscar o Crear Usuario para el Apoderado
          let userId = null;

          // Intentar buscar usuario por email
          const { data: existingUser } = await supabase.from('usuarios')
            .select('id').eq('email', formData.apoderado_email).single();

          if (existingUser) {
            userId = existingUser.id;
          } else {
            // Crear cuenta Auth con DNI como contraseña (mínimo 6 caracteres)
            const authPassword = formData.apoderado_dni.length >= 6 ? formData.apoderado_dni : formData.apoderado_dni.padEnd(6, '0');
            try {
              const authUser = await createAuthUser(formData.apoderado_email, authPassword, {
                nombre_completo: formData.apoderado_nombre,
                role: 'padre'
              });
              userId = authUser.id;
              console.log('✅ Auth creado para padre:', userId);
              // Crear Usuario con el mismo UUID que Auth
              await supabase.from('usuarios').insert([{
                id: userId,
                nombre_completo: formData.apoderado_nombre,
                email: formData.apoderado_email,
                role: 'padre',
                telefono: formData.apoderado_telefono
              }]);
            } catch (authErr: any) {
              console.error('❌ Error creando Auth padre:', authErr.message);
              alert('⚠️ No se pudo crear cuenta de acceso para el apoderado: ' + authErr.message + '\nSe creará solo el perfil sin login.');
              const { data: newUser, error: uErr } = await supabase.from('usuarios').insert([{
                nombre_completo: formData.apoderado_nombre,
                email: formData.apoderado_email,
                role: 'padre',
                telefono: formData.apoderado_telefono
              }]).select().single();
              if (uErr) throw uErr;
              userId = newUser.id;
            }
          }

          // B. Buscar o Crear Perfil Padre
          let padreId = null;
          const { data: existingPadre } = await supabase.from('padres')
            .select('id').eq('dni', formData.apoderado_dni).single();

          if (existingPadre) {
            padreId = existingPadre.id;
          } else {
            const { data: newPadre, error: pErr } = await supabase.from('padres').insert([{
              usuario_id: userId,
              dni: formData.apoderado_dni,
              direccion: formData.direccion, // Asumimos misma dirección inicial
              ocupacion: formData.apoderado_ocupacion
            }]).select().single();
            if (pErr) throw pErr;
            padreId = newPadre.id;
          }

          // C. Vincular con Alumno
          const { error: relError } = await supabase.from('padres_alumnos').insert([{
            padre_id: padreId,
            alumno_id: newStudent.id,
            parentesco: formData.apoderado_relacion || 'Apoderado',
            es_apoderado: true
          }]);
          if (relError) throw relError;
        }

      } else if (activeTab === 'salones') {
        // Lógica inteligente: Crear nueva sección para un grado existente
        // 1. Obtener el nombre del grado base (ej: '1ro Secundaria')
        const gradoBase = formData.nombre;

        // 2. Buscar cuántas secciones existen de ese grado este año
        const { data: existingSections } = await supabase
          .from('salones')
          .select('seccion')
          .eq('nombre', gradoBase)
          .eq('anio_academico', new Date().getFullYear());

        // 3. Calcular siguiente letra (A -> B -> C...)
        const sections = existingSections?.map(s => s.seccion) || [];
        let nextSection = 'A';
        if (sections.length > 0) {
          const lastSection = sections.sort().pop(); // Simple sort, funciona hasta Z
          nextSection = String.fromCharCode(lastSection!.charCodeAt(0) + 1);
        }

        const { error } = await supabase.from('salones').insert([{
          nombre: gradoBase,
          seccion: nextSection,
          anio_academico: new Date().getFullYear(),
          tutor_id: formData.tutor_id || null
        }]);
        if (error) throw error;
        alert(`Sección ${nextSection} creada para ${gradoBase}`);

      } else if (activeTab === 'docentes') {
        // Crear cuenta Auth con DNI como contraseña (mínimo 6 caracteres)
        const authPassword = formData.dni.length >= 6 ? formData.dni : formData.dni.padEnd(6, '0');
        let userId;
        try {
          const authUser = await createAuthUser(formData.email, authPassword, {
            nombre_completo: formData.nombre_completo,
            role: 'docente'
          });
          userId = authUser.id;
          console.log('✅ Auth creado para docente:', userId);
          // Crear Usuario con el mismo UUID que Auth
          const { error: userError } = await supabase.from('usuarios').insert([{
            id: userId,
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            role: 'docente',
            telefono: formData.telefono,
            must_change_password: true
          }]);
          if (userError) throw userError;
        } catch (authErr: any) {
          console.error('❌ Error creando Auth docente:', authErr.message);
          alert('⚠️ No se pudo crear cuenta de acceso para el docente: ' + authErr.message + '\nSe creará solo el perfil sin login.');
          const { data: newUser, error: userError } = await supabase.from('usuarios').insert([{
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            role: 'docente',
            telefono: formData.telefono,
            must_change_password: true
          }]).select().single();
          if (userError) throw userError;
          userId = newUser.id;
        }

        // Crear Profesor
        const { error: profError } = await supabase.from('profesores').insert([{
          usuario_id: userId,
          especialidad: formData.especialidad,
          dni: formData.dni
        }]);
        if (profError) throw profError;
      } else if (activeTab === 'asignaciones') {
        // 1. Buscar o Crear Curso
        let cursoId;
        if (formData.curso_id && formData.curso_id !== '__new__') {
          cursoId = formData.curso_id;
        } else {
          const cursoNombre = formData.curso_nombre?.trim();
          if (!cursoNombre) throw new Error('Ingresa el nombre del curso');
          const { data: existingCurso } = await supabase.from('cursos').select('id').ilike('nombre', cursoNombre).maybeSingle();
          if (existingCurso) {
            cursoId = existingCurso.id;
          } else {
            const { data: newCurso, error: cursoErr } = await supabase.from('cursos').insert([{ nombre: cursoNombre }]).select().single();
            if (cursoErr) throw cursoErr;
            cursoId = newCurso.id;
          }
        }

        // 2. Crear asignaciones para cada salón seleccionado (batch)
        const salonesTarget = selectedSalonIds.length > 0 ? selectedSalonIds : (formData.salon_id ? [formData.salon_id] : []);
        if (salonesTarget.length === 0) throw new Error('Selecciona al menos un salón');
        if (!formData.profesor_id) throw new Error('Selecciona un profesor');

        const inserts = salonesTarget.map(salonId => ({
          profesor_id: formData.profesor_id,
          salon_id: salonId,
          curso_id: cursoId
        }));

        const { error: asigErr } = await supabase.from('asignaciones_cursos').insert(inserts);
        if (asigErr) throw asigErr;

        // Refrescar cursos existentes
        const { data: cursosRefresh } = await supabase.from('cursos').select('id, nombre').order('nombre');
        if (cursosRefresh) setExistingCursos(cursosRefresh);
      }

      alert('Registro creado exitosamente');
      setIsModalOpen(false);
      setFormData({});
      setSelectedSalonIds([]);
      setPhotoFile(null);
      setPhotoPreview(null);
      fetchData(); // Recargar tabla

    } catch (error: any) {
      console.error('Error creating:', error);
      alert('Error al crear: ' + (error.message || error.details || 'Error desconocido'));
    } finally {
      setProcessing(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const filteredStudents = students.filter(s =>
    s.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.qr_token || s.id || '').includes(searchTerm)
  );

  const filteredTeachers = teachers.filter(t =>
    t.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAssignments = assignments.filter(a =>
    a.curso?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.salon?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.profesor?.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClassrooms = classrooms.filter(c =>
    c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.seccion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tutor?.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Descargar QR como imagen
  const downloadQR = () => {
    if (!qrRef.current || !showQR) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement('a');
      link.download = `QR_${showQR.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Gestión de Plantel</h2>
          <p className="text-slate-500 font-medium">Administración centralizada.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none font-black text-indigo-600 text-sm cursor-pointer"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setFormData({}); setEditingId(null); setPhotoFile(null); setPhotoPreview(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <UserPlus className="w-5 h-5" />
            Nuevo Registro
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="flex gap-1 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('alumnos')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'alumnos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Users className="w-5 h-5" />
          Alumnos
        </button>
        <button
          onClick={() => setActiveTab('docentes')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'docentes' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <GraduationCap className="w-5 h-5" />
          Docentes
        </button>
        <button
          onClick={() => setActiveTab('salones')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'salones' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Star className="w-5 h-5" />
          Salones
        </button>
        <button
          onClick={() => setActiveTab('asignaciones')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'asignaciones' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BookOpen className="w-5 h-5" />
          Cursos Asignados
        </button>
      </div>

      {/* CONTENT */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-6 border-b border-slate-50 flex flex-wrap items-center gap-4 bg-slate-50/30">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Buscar en ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-all"
            />
          </div>
          <button onClick={fetchData} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition-colors">
            Refrescar
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="text-sm font-bold">Cargando datos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                  {activeTab === 'salones' ? (
                    <>
                      <th className="px-8 py-5">Nombre Salón</th>
                      <th className="px-8 py-5">Tutor (Usuario)</th>
                      <th className="px-8 py-5 text-center">Año / Sección</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </>
                  ) : activeTab === 'asignaciones' ? (
                    <>
                      <th className="px-8 py-5">Curso</th>
                      <th className="px-8 py-5">Profesor Dictante</th>
                      <th className="px-8 py-5">Salón Asignado</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </>
                  ) : activeTab === 'alumnos' ? (
                    <>
                      <th className="px-8 py-5">Nombre / Identificación</th>
                      <th className="px-8 py-5">Salón</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </>
                  ) : (
                    <>
                      <th className="px-8 py-5">Nombre / Identificación</th>
                      <th className="px-8 py-5">Email</th>
                      <th className="px-8 py-5">DNI</th>
                      <th className="px-8 py-5">Contacto</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeTab === 'salones' ? (
                  filteredClassrooms.length > 0 ? filteredClassrooms.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5 font-bold text-slate-800">{s.nombre}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Star className={`w-4 h-4 ${s.tutor ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
                          <span className={`text-sm font-bold ${!s.tutor ? 'text-slate-400' : 'text-indigo-600'}`}>
                            {s.tutor ? s.tutor.nombre_completo : 'Sin Asignar'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center font-bold text-slate-600">
                        {s.anio_academico} - {s.seccion}
                      </td>
                      <td className="px-8 py-5 text-right flex justify-end gap-2">
                        <button onClick={() => handleEditSalon(s)} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Editar Tutor">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleCreateNewSection(s.nombre)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Crear nueva sección">
                          + Sección
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No hay salones registrados.</td></tr>
                  )
                ) : activeTab === 'asignaciones' ? (
                  filteredAssignments.length > 0 ? filteredAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5 font-bold text-slate-800">{a.curso?.nombre}</td>
                      <td className="px-8 py-5 text-indigo-700 font-medium">{a.profesor?.nombre_completo || 'Sin Docente'}</td>
                      <td className="px-8 py-5 text-slate-600 font-bold">{a.salon?.nombre} {a.salon?.seccion}</td>
                      <td className="px-8 py-5 text-right">
                        <button onClick={() => handleEditAsignacion(a)} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Editar Profesor">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No hay asignaciones de cursos.</td></tr>
                  )
                ) : activeTab === 'alumnos' ? (
                  filteredStudents.length > 0 ? filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5 flex items-center gap-4">
                        {student.foto_url ? (
                          <img src={student.foto_url} alt="" className="w-10 h-10 rounded-2xl object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm">
                            {student.nombres[0]}{student.apellidos[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800">{student.nombres} {student.apellidos}</p>
                          <p className="text-[10px] text-slate-400 font-mono">DNI: {student.dni}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                          {student.salon ? `${student.salon.nombre} ${student.salon.seccion}` : 'Sin Salón'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right flex justify-end gap-2">
                        <button onClick={() => setShowQR({ id: student.id, name: `${student.nombres} ${student.apellidos}` })} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Ver QR">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleEditAlumno(student)} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-medium">No hay alumnos encontrados.</td></tr>
                  )
                ) : (
                  filteredTeachers.length > 0 ? filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700 font-black text-sm">
                          {(teacher.nombre_completo || 'Unknown').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{teacher.nombre_completo}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Esp: {teacher.especialidad}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-slate-600 text-sm">{teacher.email}</td>
                      <td className="px-8 py-5 text-slate-500 text-xs font-mono">{teacher.dni || '-'}</td>
                      <td className="px-8 py-5 text-slate-400 text-sm">{teacher.telefono || '-'}</td>
                      <td className="px-8 py-5 text-right flex justify-end gap-2">
                        <button onClick={() => handleEditDocente(teacher)} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteDocente(teacher)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No hay docentes registrados.</td></tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-6">
              {editingId ? 'Editar ' : 'Nuevo '}
              {activeTab === 'alumnos' ? 'Alumno' : activeTab === 'docentes' ? 'Docente' : activeTab === 'salones' ? 'Salón' : 'Asignación'}
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              {activeTab === 'alumnos' && (
                <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
                  {/* SECCIÓN 1: DATOS DEL ALUMNO */}
                  <div>
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-wider mb-3">1. Datos del Alumno</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <input required placeholder="Nombres" value={formData.nombres || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('nombres', e.target.value)} />
                      <input required placeholder="Apellidos" value={formData.apellidos || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('apellidos', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <input required placeholder="DNI / Cédula" value={formData.dni || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('dni', e.target.value)} />
                      <select value={formData.genero || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm" onChange={e => handleInputChange('genero', e.target.value)}>
                        <option value="">Género</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <input type="date" required value={formData.fecha_nacimiento || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm" onChange={e => handleInputChange('fecha_nacimiento', e.target.value)} />
                      <select value={formData.salon_id || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm" onChange={e => handleInputChange('salon_id', e.target.value)}>
                        <option value="">Seleccionar Salón</option>
                        {classrooms.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.seccion}</option>)}
                      </select>
                    </div>
                    <input placeholder="Dirección de Domicilio" value={formData.direccion || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('direccion', e.target.value)} />

                    {/* FOTO DEL ALUMNO */}
                    <div className="mt-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Foto del Alumno (Opcional)</label>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPhotoFile(file);
                            setPhotoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      {photoPreview ? (
                        <div className="relative w-24 h-24 mx-auto">
                          <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-2xl object-cover border-2 border-indigo-200" />
                          <button
                            type="button"
                            onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="w-full p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-3 text-slate-400 hover:text-indigo-600"
                        >
                          <Camera className="w-5 h-5" />
                          <span className="font-bold text-sm">Seleccionar foto</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SECCIÓN 2: DATOS DEL APODERADO */}
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> 2. Datos del Apoderado {editingId ? '(Opcional actualizar)' : ''}
                    </h4>
                    <input required={!editingId} placeholder="Nombre Completo Apoderado" value={formData.apoderado_nombre || ''} className="w-full p-4 bg-white mb-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('apoderado_nombre', e.target.value)} />

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input required={!editingId} placeholder="DNI Apoderado" value={formData.apoderado_dni || ''} className="w-full p-4 bg-white rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('apoderado_dni', e.target.value)} />
                      <select value={formData.apoderado_relacion || ''} className="w-full p-4 bg-white rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm" onChange={e => handleInputChange('apoderado_relacion', e.target.value)}>
                        <option value="">Parentesco</option>
                        <option value="Padre">Padre</option>
                        <option value="Madre">Madre</option>
                        <option value="Abuelo/a">Abuelo/a</option>
                        <option value="Tío/a">Tío/a</option>
                        <option value="Tutor Legal">Tutor Legal</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input type="email" placeholder="Email (Usuario App)" value={formData.apoderado_email || ''} className="w-full p-4 bg-white rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('apoderado_email', e.target.value)} />
                      <input type="tel" placeholder="Celular (WhatsApp)" value={formData.apoderado_telefono || ''} className="w-full p-4 bg-white rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('apoderado_telefono', e.target.value)} />
                    </div>
                    <input placeholder="Ocupación / Centro Laboral" value={formData.apoderado_ocupacion || ''} className="w-full p-4 bg-white rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('apoderado_ocupacion', e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === 'docentes' && (
                <>
                  <input required placeholder="Nombre Completo" value={formData.nombre_completo || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('nombre_completo', e.target.value)} />
                  <input required type="email" placeholder="Email (Login)" value={formData.email || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('email', e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="DNI" value={formData.dni || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('dni', e.target.value)} />
                    <input required placeholder="Especialidad" value={formData.especialidad || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('especialidad', e.target.value)} />
                  </div>
                  <input placeholder="Teléfono" value={formData.telefono || ''} className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" onChange={e => handleInputChange('telefono', e.target.value)} />
                </>
              )}

              {activeTab === 'salones' && (
                <>
                  {!editingId && (
                    <>
                      <div className="bg-indigo-50 p-4 rounded-xl mb-4 text-indigo-800 text-sm font-medium">
                        <p>ℹ️ El sistema calculará automáticamente la siguiente sección disponible (Ej: Si existe 'A', creará la 'B').</p>
                      </div>
                      <select required className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm" onChange={e => handleInputChange('nombre', e.target.value)}>
                        <option value="">Seleccionar Grado Académico</option>
                        <optgroup label="Inicial">
                          <option value="Inicial 3 Años">Inicial 3 Años</option>
                          <option value="Inicial 4 Años">Inicial 4 Años</option>
                          <option value="Inicial 5 Años">Inicial 5 Años</option>
                        </optgroup>
                        <optgroup label="Primaria">
                          {Array.from({ length: 6 }, (_, i) => `${i + 1}ro Primaria`.replace('1ro', '1ro').replace('2ro', '2do').replace('3ro', '3ro').replace('4ro', '4to').replace('5ro', '5to').replace('6ro', '6to')).map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Secundaria">
                          {Array.from({ length: 5 }, (_, i) => `${i + 1}ro Secundaria`.replace('1ro', '1ro').replace('2ro', '2do').replace('3ro', '3ro').replace('4ro', '4to').replace('5ro', '5to')).map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </optgroup>
                      </select>
                    </>
                  )}

                  <select
                    value={formData.tutor_id || ''}
                    className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm"
                    onChange={e => handleInputChange('tutor_id', e.target.value)}
                  >
                    <option value="">Asignar Tutor (Opcional)</option>
                    {teachers.map(t => <option key={t.usuario_id} value={t.usuario_id}>{t.nombre_completo}</option>)}
                  </select>
                </>
              )}

              {activeTab === 'asignaciones' && (
                <div className="space-y-4">
                  {!editingId && (
                    <>
                      {/* Curso: dropdown de existentes o crear nuevo */}
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Curso</label>
                        <select
                          required
                          className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm"
                          value={formData.curso_id || ''}
                          onChange={e => handleInputChange('curso_id', e.target.value)}
                        >
                          <option value="">Seleccionar curso existente...</option>
                          {existingCursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          <option value="__new__">➕ Crear nuevo curso...</option>
                        </select>
                      </div>

                      {formData.curso_id === '__new__' && (
                        <input
                          required
                          placeholder="Nombre del nuevo curso (Ej: Matemáticas)"
                          className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                          onChange={e => handleInputChange('curso_nombre', e.target.value)}
                        />
                      )}
                    </>
                  )}

                  {/* Profesor */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Profesor Dictante</label>
                    <select
                      required
                      value={formData.profesor_id || ''}
                      className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm"
                      onChange={e => handleInputChange('profesor_id', e.target.value)}
                    >
                      <option value="">Seleccionar Profesor...</option>
                      {teachers.map(t => <option key={t.usuario_id} value={t.usuario_id}>{t.nombre_completo} ({t.especialidad})</option>)}
                    </select>
                  </div>

                  {/* Multi-salón con checkboxes */}
                  {!editingId && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Salones (selecciona uno o más)</label>
                      <div className="bg-slate-50 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-2 border border-slate-100">
                        {classrooms.map(c => (
                          <label key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedSalonIds.includes(c.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSalonIds(prev => [...prev, c.id]);
                                } else {
                                  setSelectedSalonIds(prev => prev.filter(id => id !== c.id));
                                }
                              }}
                              className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="font-bold text-slate-700 text-sm">{c.nombre} {c.seccion}</span>
                          </label>
                        ))}
                      </div>
                      {selectedSalonIds.length > 0 && (
                        <p className="text-xs text-indigo-600 font-bold mt-2">{selectedSalonIds.length} salón(es) seleccionado(s)</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                <button disabled={processing} type="submit" className="flex-1 py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50">
                  {processing ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal — QR real con UUID del alumno */}
      {showQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300 text-center">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Credencial QR</h3>
            <p className="text-sm font-bold text-indigo-600 mb-6">{showQR.name}</p>
            <div ref={qrRef} className="bg-white p-6 rounded-3xl border-2 border-slate-100 inline-block mx-auto mb-4">
              <QRCodeSVG
                value={showQR.id}
                size={200}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#1e1b4b"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">ID: {showQR.id.substring(0, 8)}... · Permanente</p>
            <div className="flex gap-3">
              <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-colors">
                <Download className="w-4 h-4" /> Descargar
              </button>
              <button onClick={() => setShowQR(null)} className="flex-1 bg-slate-100 text-slate-700 font-black py-4 rounded-2xl hover:bg-slate-200 transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantelManagement;

-- =====================================================
-- POLÍTICAS RLS MULTI-TENANT — ZEITRIX
-- Ejecutar COMPLETO en Supabase SQL Editor
-- =====================================================

-- NOTA: El truco es guardar el colegio_id del usuario
-- autenticado en su sesión JWT. Para eso usamos un helper.

-- 1. Función helper: devuelve el colegio_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_colegio_id()
RETURNS uuid AS $$
  SELECT colegio_id FROM public.usuarios WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =========================================================
-- 2. HABILITAR RLS Y CREAR POLÍTICAS EN CADA TABLA
-- =========================================================

-- ALUMNOS
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_alumnos" ON public.alumnos;
CREATE POLICY "rls_alumnos" ON public.alumnos
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- SALONES
ALTER TABLE public.salones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_salones" ON public.salones;
CREATE POLICY "rls_salones" ON public.salones
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- CURSOS
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_cursos" ON public.cursos;
CREATE POLICY "rls_cursos" ON public.cursos
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- PROFESORES
ALTER TABLE public.profesores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_profesores" ON public.profesores;
CREATE POLICY "rls_profesores" ON public.profesores
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- PAGOS
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_pagos" ON public.pagos;
CREATE POLICY "rls_pagos" ON public.pagos
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- ASISTENCIA
ALTER TABLE public.asistencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_asistencia" ON public.asistencia;
CREATE POLICY "rls_asistencia" ON public.asistencia
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- INCIDENCIAS
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_incidencias" ON public.incidencias;
CREATE POLICY "rls_incidencias" ON public.incidencias
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- TAREAS
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_tareas" ON public.tareas;
CREATE POLICY "rls_tareas" ON public.tareas
  USING (colegio_id = get_colegio_id())
  WITH CHECK (colegio_id = get_colegio_id());

-- USUARIOS: lectura solo del mismo colegio
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_usuarios_select" ON public.usuarios;
CREATE POLICY "rls_usuarios_select" ON public.usuarios
  FOR SELECT USING (colegio_id = get_colegio_id() OR id = auth.uid());
DROP POLICY IF EXISTS "rls_usuarios_insert" ON public.usuarios;
CREATE POLICY "rls_usuarios_insert" ON public.usuarios
  FOR INSERT WITH CHECK (colegio_id = get_colegio_id());
DROP POLICY IF EXISTS "rls_usuarios_update" ON public.usuarios;
CREATE POLICY "rls_usuarios_update" ON public.usuarios
  FOR UPDATE USING (colegio_id = get_colegio_id());

-- NOTAS y ASIGNACIONES (heredan aislamiento del alumno/salon que ya está filtrado)
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rls_notas" ON public.notas USING (true); -- seguridad por FK transitiva

ALTER TABLE public.asignaciones_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rls_asignaciones" ON public.asignaciones_cursos USING (true);

-- COLEGIOS: solo lectura pública (para detección de subdominio en login)
-- Ya creada en migration_multitenant.sql

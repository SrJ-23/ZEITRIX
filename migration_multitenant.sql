-- =====================================================
-- MIGRACIÓN: ZEITRIX → Multi-Tenant (Multi-Colegio)
-- Ejecutar en Supabase SQL Editor en orden
-- =====================================================

-- 1. CREAR TABLA MAESTRA DE COLEGIOS
CREATE TABLE public.colegios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,           -- ej: 'san-jose' → san-jose.zeitrix.com
  logo_url text,                        -- URL del logo del colegio
  color_primario text DEFAULT '#4f46e5', -- Color de acento personalizable (indigo-600)
  classroom_enabled boolean DEFAULT false,
  classroom_url text,                   -- URL base de Google Classroom del colegio
  telefono text,
  direccion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. INSERTAR EL COLEGIO ACTUAL (para no romper datos existentes)
INSERT INTO public.colegios (id, nombre, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Las Praderas I.S.', 'las-praderas');

-- 3. AÑADIR colegio_id A TODAS LAS TABLAS PRINCIPALES
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.alumnos ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.salones ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.profesores ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.padres ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.asistencia ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.incidencias ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id);

-- 4. ASIGNAR DATOS EXISTENTES AL COLEGIO INICIAL
UPDATE public.usuarios SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.alumnos SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.salones SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.cursos SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.profesores SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.padres SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.pagos SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.asistencia SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.incidencias SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;
UPDATE public.tareas SET colegio_id = '00000000-0000-0000-0000-000000000001' WHERE colegio_id IS NULL;

-- 5. AÑADIR classroom_link A CURSOS (para integración Google Classroom)
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS classroom_link text;

-- 6. POLÍTICAS RLS PARA COLEGIOS (Tabla pública para lectura por slug)
ALTER TABLE public.colegios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Colegios visibles para todos" ON public.colegios
  FOR SELECT USING (true);

-- 7. ÍNDICES PARA RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_usuarios_colegio ON public.usuarios(colegio_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_colegio ON public.alumnos(colegio_id);
CREATE INDEX IF NOT EXISTS idx_salones_colegio ON public.salones(colegio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_colegio ON public.pagos(colegio_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_colegio ON public.asistencia(colegio_id);
CREATE INDEX IF NOT EXISTS idx_colegios_slug ON public.colegios(slug);

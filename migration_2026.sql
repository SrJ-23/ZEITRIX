-- Migration to add professional details for Students and Parents (2026 Standard)

-- 1. Mejorar tabla ALUMNOS
ALTER TABLE public.alumnos 
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
ADD COLUMN IF NOT EXISTS genero TEXT, -- 'M', 'F'
ADD COLUMN IF NOT EXISTS pais_origen TEXT DEFAULT 'Perú';

-- 2. Asegurar campos de PADRES (linked to Usuario)
-- Usuarios has (nombre_completo, email, telefono, role)
-- Padres table has (usuario_id, dni, ocupacion, mayor_grado_instruccion) checking fields...
ALTER TABLE public.padres
ADD COLUMN IF NOT EXISTS ocupacion TEXT,
ADD COLUMN IF NOT EXISTS centro_laboral TEXT,
ADD COLUMN IF NOT EXISTS estado_civil TEXT;

-- 3. Mejorar Relación PADRES_ALUMNOS
ALTER TABLE public.padres_alumnos
ADD COLUMN IF NOT EXISTS es_apoderado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vive_con_alumno BOOLEAN DEFAULT true;

-- 4. Indices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_padres_dni ON public.padres(dni);
CREATE INDEX IF NOT EXISTS idx_alumnos_dni ON public.alumnos(dni);

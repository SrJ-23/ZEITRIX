-- Schema completo para EduControl Pro (Supabase / PostgreSQL)

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de USUARIOS (Padres, Profesores, Admin)
-- Nota: Supabase Auth maneja la autenticación, pero podemos tener una tabla pública 'profiles' o 'usuarios'
-- para datos adicionales. Aquí simplificaremos para el MVP.

CREATE TABLE public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE -- 'admin', 'profesor', 'padre', 'asistencia'
);

INSERT INTO public.roles (name) VALUES ('admin'), ('profesor'), ('padre'), ('asistencia') ON CONFLICT DO NOTHING;

-- 2. Tabla de ALUMNOS (Estudiantes)
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    qr_token TEXT UNIQUE NOT NULL, -- El código QR único del estudiante
    grado TEXT, -- Ej: '3ro Primaria', '5to Secundaria'
    seccion TEXT, -- Ej: 'A', 'B'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla PADRES (o Apoderados)
-- Se vincula con los alumnos. Un alumno puede tener 1 o más padres.
CREATE TABLE public.parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    telefono TEXT NOT NULL, -- Para WhatsApp (formato internacional, e.g. 51999999999)
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla intermedia ALUMNOS <-> PADRES
CREATE TABLE public.student_parents (
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.parents(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, parent_id)
);

-- 4. Tabla de ASISTENCIA (Attendance)
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'presente', -- 'presente', 'tardanza', 'falta'
    device_id TEXT -- Opcional, para saber qué dispositivo escaneó
);

-- ÍIndices para búsqueda rápida
CREATE INDEX idx_students_qr ON public.students(qr_token);
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, timestamp);

-- POLÍTICAS DE SEGURIDAD (RLS - Row Level Security)
-- Importante para producción: habilitar RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Política simple: Permitir lectura pública (o restringida a autenticados si se prefiere)
-- Para MVP/Demo permitiremos acceso anonimo para lectura, pero escritura solo service_role o autenticados
create policy "Public read access" on public.students for select using (true);
create policy "Public read access" on public.attendance for select using (true);

-- Permitir insertar asistencia (puedes restringirlo más adelante)
create policy "Public insert access" on public.attendance for insert with check (true);

-- DATOS DE EJEMPLO (SEED DATA)
-- Inserta esto para probar
/*
INSERT INTO public.students (nombres, apellidos, qr_token, grado) 
VALUES 
('Juan', 'Pérez', 'STU_001_XYZ', '3ro Primaria'),
('Maria', 'López', 'STU_002_ABC', '5to Secundaria');

INSERT INTO public.parents (nombres, apellidos, telefono)
VALUES
('Padre Juan', 'Pérez', '51987654321'); -- Reemplazar con tu número real para probar WAHA

-- Vincular (asumiendo IDs generados, hacer esto manualmente en dashboard o script)
*/

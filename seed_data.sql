-- DATOS IICIALES DE PRUEBA (SEED DATA)
-- Ajustado al esquema real del usuario

-- 1. Insertar USUARIOS (Roles: admin, docente, padre, asistencia)
-- NOTA: En producción, estos usuarios deberían crearse vía Supabase Auth, pero aquí simulamos sus registros en la tabla 'usuarios'
INSERT INTO public.usuarios (nombre_completo, email, role, telefono) VALUES
('Director General', 'director@edu.com', 'admin', '555-1000'),
('Prof. Ricardo Morales', 'profesor@edu.com', 'docente', '555-2000'),
('Prof. Maria Garcia', 'maria@edu.com', 'docente', '555-2001'),
('Sr. Roberto Pérez', 'padre@edu.com', 'padre', '51987654321'), -- Teléfono para WAHA
('Personal Puerta', 'puerta@edu.com', 'asistencia', '555-3000')
ON CONFLICT (email) DO NOTHING;

-- 2. Insertar SALONES BASE (Inicial, Primaria, Secundaria - Sección A) para el AÑO ACTUAL
-- Limpieza opcional de datos antiguos o de prueba si se desea reiniciar
-- DELETE FROM public.salones WHERE anio_academico = EXTRACT(YEAR FROM CURRENT_DATE)::int;

INSERT INTO public.salones (nombre, seccion, anio_academico)
SELECT t.nombre, t.seccion, EXTRACT(YEAR FROM CURRENT_DATE)::int
FROM (VALUES 
  ('Inicial 3 Años', 'A'),
  ('Inicial 4 Años', 'A'),
  ('Inicial 5 Años', 'A'),
  ('1ro Primaria', 'A'),
  ('2do Primaria', 'A'),
  ('3ro Primaria', 'A'),
  ('4to Primaria', 'A'),
  ('5to Primaria', 'A'),
  ('6to Primaria', 'A'),
  ('1ro Secundaria', 'A'),
  ('2do Secundaria', 'A'),
  ('3ro Secundaria', 'A'),
  ('4to Secundaria', 'A'),
  ('5to Secundaria', 'A')
) AS t(nombre, seccion)
ON CONFLICT (nombre, seccion, anio_academico) DO NOTHING;

-- Asignar tutor al 3ro Primaria A (ejemplo dinámico)
WITH docente AS (SELECT id FROM public.usuarios WHERE email = 'profesor@edu.com'),
     salon AS (
         SELECT id FROM public.salones 
         WHERE nombre = '3ro Primaria' 
         AND seccion = 'A' 
         AND anio_academico = EXTRACT(YEAR FROM CURRENT_DATE)::int
     )
UPDATE public.salones SET tutor_id = (SELECT id FROM docente) WHERE id = (SELECT id FROM salon);

-- 3. Insertar ALUMNOS
-- 3. Insertar ALUMNOS (Datos Completos - Profesional)
-- Buscamos el salón de 3ro Primaria del año actual
WITH salon AS (
    SELECT id FROM public.salones 
    WHERE nombre = '3ro Primaria' 
    AND seccion = 'A' 
    AND anio_academico = EXTRACT(YEAR FROM CURRENT_DATE)::int
    LIMIT 1
)
INSERT INTO public.alumnos (nombres, apellidos, dni, salon_id, qr_token, direccion, fecha_nacimiento, genero, pais_origen)
VALUES 
('Juanito', 'Pérez', 'DNI12345', (SELECT id FROM salon), 'STU_001_XYZ', 'Av. Los Ficus 456, Lima', '2016-05-15', 'M', 'Perú'),
('Maria', 'Gomez', 'DNI67890', (SELECT id FROM salon), 'STU_002_ABC', 'Jr. Las Gardenias 789, Lima', '2016-08-20', 'F', 'Perú')
ON CONFLICT (dni) DO NOTHING;

-- 4. Registrar PROFESORES en su tabla específica (relación 1:1 con usuarios)
INSERT INTO public.profesores (usuario_id, especialidad, dni)
SELECT id, 'General', 'PROF123' FROM public.usuarios WHERE email = 'profesor@edu.com'
ON CONFLICT (usuario_id) DO NOTHING;

-- 5. Registrar PADRES (Datos Completos - Apoderado)
-- Primero creamos el registro en la tabla padres vinculado al usuario 'padre@edu.com'
WITH user_padre AS (SELECT id FROM public.usuarios WHERE email = 'padre@edu.com')
INSERT INTO public.padres (usuario_id, dni, ocupacion, centro_laboral, estado_civil)
SELECT id, 'PADRE123', 'Ingeniero Civil', 'Constructora S.A.', 'Casado' FROM user_padre
ON CONFLICT (dni) DO NOTHING;

-- Luego vinculamos Padre <-> Alumno (Juanito Pérez)
-- Seteamos 'es_apoderado' y 'vive_con_alumno'
WITH 
    p AS (SELECT id FROM public.padres WHERE dni = 'PADRE123'),
    a AS (SELECT id FROM public.alumnos WHERE qr_token = 'STU_001_XYZ')
INSERT INTO public.padres_alumnos (padre_id, alumno_id, parentesco, es_apoderado, vive_con_alumno)
SELECT p.id, a.id, 'Padre', true, true FROM p, a
ON CONFLICT DO NOTHING;

-- 6. Insertar ASISTENCIA de prueba (opcional)
WITH alum AS (SELECT id FROM public.alumnos WHERE qr_token = 'STU_001_XYZ')
INSERT INTO public.asistencia (alumno_id, fecha, hora_ingreso, estado)
VALUES ((SELECT id FROM alum), CURRENT_DATE, '07:55:00', 'presente');

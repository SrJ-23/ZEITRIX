
-- SQL Schema for EduControl Pro (Actualizado con Tutoría)


-- SQL Schema for EduControl Pro (Actualizado con Gestión de Notas)

-- ... (tablas anteriores se mantienen)

-- 12. Configuración de Fórmulas por Curso/Salón
CREATE TABLE curso_config_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID REFERENCES cursos(id),
    salon_id UUID REFERENCES salones(id),
    profesor_id UUID REFERENCES profesores(id),
    peso_practicas INTEGER DEFAULT 20, -- 20%
    peso_examenes INTEGER DEFAULT 70,  -- 70%
    peso_tareas INTEGER DEFAULT 10,    -- 10%
    UNIQUE(curso_id, salon_id)
);

-- 13. Registro de Notas
CREATE TABLE notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula_id UUID REFERENCES matriculas(id),
    curso_id UUID REFERENCES cursos(id),
    tipo VARCHAR(20), -- 'practica', 'examen', 'tarea'
    valor NUMERIC(4,2) CHECK (valor >= 0 AND valor <= 20),
    descripcion TEXT,
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Políticas RLS para Notas
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY profesor_manage_notas ON notas FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM asignaciones_docentes ad
        JOIN profesores p ON ad.profesor_id = p.id
        WHERE ad.curso_id = notas.curso_id 
        AND p.email = auth.email()
    )
);

-- 14. Extensión de Salones para Tutoría
ALTER TABLE salones ADD COLUMN tutor_id UUID REFERENCES profesores(id);

-- Comentario: Un profesor puede ser tutor de un solo salón a la vez para asegurar dedicación.
CREATE UNIQUE INDEX idx_unique_tutor_salon ON salones(tutor_id) WHERE tutor_id IS NOT NULL;

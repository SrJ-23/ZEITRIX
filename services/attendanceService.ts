
import { sendWhatsAppMessage } from './wahaService';
import { supabase } from '../lib/supabase';

const DEVICE_SECRET = 'MASTER_PC_SECRET_123'; // Simulation of device-secret
const HORA_LIMITE = 8; // 8:00 AM — después de esto es tardanza
const MINUTO_LIMITE = 0;

export interface AttendanceResult {
  success: boolean;
  message: string;
  studentName?: string;
  timestamp?: string;
  estado?: 'presente' | 'tardanza' | 'justificada';
}

export const registerAttendance = async (qrToken: string): Promise<AttendanceResult> => {
  try {
    // 1. Buscar alumno — primero por id (UUID), luego por qr_token (compatibilidad)
    let student: any = null;

    // Intentar por UUID directamente
    const { data: byId } = await supabase
      .from('alumnos')
      .select(`
        id,
        nombres,
        apellidos,
        salon_id,
        padres:padres_alumnos (
          padre:padres (
             usuario:usuarios (
               telefono
             )
          )
        )
      `)
      .eq('id', qrToken)
      .maybeSingle();

    if (byId) {
      student = byId;
    } else {
      // Fallback: buscar por qr_token (alumnos antiguos)
      const { data: byToken } = await supabase
        .from('alumnos')
        .select(`
          id,
          nombres,
          apellidos,
          salon_id,
          padres:padres_alumnos (
            padre:padres (
               usuario:usuarios (
                 telefono
               )
            )
          )
        `)
        .eq('qr_token', qrToken)
        .maybeSingle();

      student = byToken;
    }

    if (!student) {
      return { success: false, message: 'QR no reconocido o alumno no matriculado.' };
    }

    // 2. Registrar Asistencia
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Verificar duplicados
    const { data: existingRecords } = await supabase
      .from('asistencia')
      .select('id, hora_ingreso, estado')
      .eq('alumno_id', student.id)
      .eq('fecha', todayStr)
      .limit(1);

    if (existingRecords && existingRecords.length > 0) {
      const record = existingRecords[0];
      const estadoLabel = record.estado === 'tardanza' ? ' (Tardanza)' : record.estado === 'justificada' ? ' (Justificada)' : '';
      return {
        success: false,
        message: `El alumno ya registró su ingreso a las ${record.hora_ingreso || 'N/A'}${estadoLabel}`,
        studentName: `${student.nombres} ${student.apellidos}`,
        timestamp: record.hora_ingreso,
        estado: record.estado
      };
    }

    // Determinar estado: puntual o tardanza
    const hora = now.getHours();
    const minuto = now.getMinutes();
    const esTardanza = hora > HORA_LIMITE || (hora === HORA_LIMITE && minuto > MINUTO_LIMITE);
    const estado = esTardanza ? 'tardanza' : 'presente';

    // Insertar registro
    const { error: attendanceError } = await supabase
      .from('asistencia')
      .insert([
        {
          alumno_id: student.id,
          fecha: todayStr,
          hora_ingreso: timeStr,
          estado: estado
        }
      ]);

    if (attendanceError) {
      console.error('Error guardando asistencia:', attendanceError);
      return { success: false, message: 'Error de base de datos al guardar.' };
    }

    console.log(`Asistencia registrada para ${student.nombres} ${student.apellidos} a las ${timeStr} — ${estado}`);

    // 3. Notificar a Padres (via WAHA)
    const parentsRelations = student.padres || [];
    const estadoMsg = esTardanza ? ' (TARDANZA)' : '';

    for (const rel of parentsRelations) {
      const padreUsuario = (rel as any)?.padre?.usuario;

      if (padreUsuario && padreUsuario.telefono) {
        const notificationMsg = `Hola, el alumno ${student.nombres} ingresó al colegio a las ${timeStr}${estadoMsg}.`;
        await sendWhatsAppMessage(padreUsuario.telefono, notificationMsg);
      }
    }

    return {
      success: true,
      message: esTardanza ? 'Ingreso registrado como TARDANZA.' : 'Ingreso registrado correctamente.',
      studentName: `${student.nombres} ${student.apellidos}`,
      timestamp: timeStr,
      estado
    };

  } catch (err) {
    console.error('Error inesperado:', err);
    return { success: false, message: 'Error interno del servidor.' };
  }
};

// Justificación por tutor: registra asistencia sin hora visible
export const justifyAttendance = async (alumnoId: string): Promise<AttendanceResult> => {
  try {
    const { data: student } = await supabase
      .from('alumnos')
      .select('id, nombres, apellidos')
      .eq('id', alumnoId)
      .single();

    if (!student) {
      return { success: false, message: 'Alumno no encontrado.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Verificar si ya tiene registro hoy
    const { data: existing } = await supabase
      .from('asistencia')
      .select('id')
      .eq('alumno_id', alumnoId)
      .eq('fecha', todayStr)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        success: false,
        message: 'El alumno ya tiene un registro de asistencia hoy.',
        studentName: `${student.nombres} ${student.apellidos}`
      };
    }

    // Insertar como justificada — SIN hora de ingreso
    const { error } = await supabase
      .from('asistencia')
      .insert([{
        alumno_id: alumnoId,
        fecha: todayStr,
        hora_ingreso: null,
        estado: 'justificada'
      }]);

    if (error) throw error;

    return {
      success: true,
      message: 'Asistencia justificada correctamente.',
      studentName: `${student.nombres} ${student.apellidos}`,
      estado: 'justificada'
    };

  } catch (err) {
    console.error('Error justificando asistencia:', err);
    return { success: false, message: 'Error al justificar asistencia.' };
  }
};

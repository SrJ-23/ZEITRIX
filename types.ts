
export type Role = 'superadmin' | 'admin' | 'docente' | 'padre' | 'asistencia';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  salonAsignado?: string; // Para docentes tutores y padres
}

export interface Student {
  id: string;
  nombres: string;
  apellidos: string;
  dni: string;
  qr_token: string;
  estado: 'activo' | 'inactivo';
}

export interface AttendanceRecord {
  id: string;
  matricula_id: string;
  fecha: string;
  hora: string;
  tipo: 'presente' | 'tarde' | 'falta';
}


import { createClient } from '@supabase/supabase-js';

// Cliente con service_role para operaciones administrativas (crear usuarios Auth, resetear contraseñas)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY no configurada. Las funciones de administración de usuarios no funcionarán.');
}

export const supabaseAdmin = createClient(supabaseUrl || '', serviceRoleKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Crear usuario en Supabase Auth y devolver su UUID
 * @param email Email del usuario
 * @param password Contraseña (por defecto será el DNI)
 * @param metadata Datos extra opcionales
 */
export const createAuthUser = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Confirmar email automáticamente (no envía correo)
        user_metadata: metadata || {}
    });

    if (error) throw error;
    return data.user;
};

/**
 * Resetear contraseña de un usuario Auth
 * @param userId ID del usuario en Auth
 * @param newPassword Nueva contraseña
 */
export const resetAuthPassword = async (userId: string, newPassword: string) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
    });
    if (error) throw error;
};

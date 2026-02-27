
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

// Tipo del colegio (Tenant)
export interface Tenant {
    id: string;
    nombre: string;
    slug: string;
    logo_url: string | null;
    color_primario: string;
    classroom_enabled: boolean;
    classroom_url: string | null;
}

interface TenantContextType {
    tenant: Tenant | null;
    loading: boolean;
    error: string | null;
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    loading: true,
    error: null
});

// Hook para consumir el tenant en cualquier componente
export const useTenant = () => useContext(TenantContext);

/**
 * Extrae el slug del subdominio de la URL actual.
 * Ejemplos:
 *   san-jose.zeitrix.com      → 'san-jose'
 *   san-jose.zeitrix.vercel.app → 'san-jose'
 *   localhost:3000             → null (desarrollo local)
 *   zeitrix.com                → null (portal principal)
 */
const extractSlug = (): string | null => {
    const hostname = window.location.hostname;

    // Desarrollo local → buscar ?tenant=
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const params = new URLSearchParams(window.location.search);
        return params.get('tenant');
    }

    // Portal Principal → Ignorar si es el dominio base
    if (hostname === 'zeitrix.vercel.app' || hostname === 'zeitrix.com') {
        return null;
    }

    const parts = hostname.split('.');

    // Caso Vercel: xxx.vercel.app o sub.xxx.vercel.app
    if (hostname.endsWith('.vercel.app')) {
        // sub.dominio.vercel.app (4 partes o más)
        if (parts.length >= 4) return parts[0];

        // dominio.vercel.app (3 partes)
        // Ejemplo: zeitrix-las-praderas.vercel.app -> retorna 'zeitrix-las-praderas'
        return parts[0];
    }

    // Caso Dominio Propio: sub.tudominio.com (3 partes o más)
    if (parts.length >= 3) return parts[0];

    return null;
};

// Provider que envuelve toda la app
export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTenant = async () => {
            const slug = extractSlug();

            if (!slug) {
                // Sin subdominio → modo ZEITRIX default (portal principal o dev)
                setLoading(false);
                return;
            }

            try {
                const { data, error: fetchError } = await supabase
                    .from('colegios')
                    .select('id, nombre, slug, logo_url, color_primario, classroom_enabled, classroom_url')
                    .eq('slug', slug)
                    .eq('activo', true)
                    .single();

                if (fetchError || !data) {
                    setError(`Colegio "${slug}" no encontrado`);
                } else {
                    setTenant(data as Tenant);
                }
            } catch (err) {
                setError('Error al cargar los datos del colegio');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadTenant();
    }, []);

    return (
        <TenantContext.Provider value={{ tenant, loading, error }}>
            {children}
        </TenantContext.Provider>
    );
};


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

    // Desarrollo local → no hay subdominio
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // En desarrollo, se puede usar un query param: ?tenant=san-jose
        const params = new URLSearchParams(window.location.search);
        return params.get('tenant');
    }

    const parts = hostname.split('.');

    // dominio.vercel.app (3 partes) → parts[0] podría ser subdominio
    // sub.dominio.vercel.app (4 partes) → parts[0] es subdominio
    // dominio.com (2 partes) → no hay subdominio
    // sub.dominio.com (3 partes) → parts[0] es subdominio

    // Para Vercel: xxx.vercel.app = sin sub, xxx.yyy.vercel.app = con sub
    if (hostname.endsWith('.vercel.app')) {
        if (parts.length >= 4) return parts[0]; // sub.proyecto.vercel.app
        return null; // proyecto.vercel.app (sin subdominio)
    }

    // Para dominio propio: xxx.zeitrix.com = con sub
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

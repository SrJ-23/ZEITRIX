
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  QrCode,
  Users,
  LogOut,
  GraduationCap,
  CalendarClock,
  BookMarked,
  FileText,
  ClipboardList,
  DollarSign,
  X
} from 'lucide-react';
import { Role } from '../types';
import { useTenant } from '../lib/TenantContext';

interface SidebarProps {
  user: { name: string; role: Role };
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, isOpen, onClose }) => {
  const { tenant } = useTenant();
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'docente', 'padre'] },
    { name: 'Mi Hijo/a', path: '/parent', icon: Users, roles: ['padre'] },
    { name: 'Control Ingreso', path: '/attendance', icon: QrCode, roles: ['superadmin', 'admin', 'asistencia'] },
    { name: 'Gestión Plantel', path: '/plantel', icon: Users, roles: ['superadmin', 'admin'] },
    { name: 'Horarios', path: '/schedules', icon: CalendarClock, roles: ['superadmin', 'admin'] },
    { name: 'Gestión de Notas', path: '/grades', icon: BookMarked, roles: ['superadmin', 'admin', 'docente'] },
    { name: 'Incidencias', path: '/incidencias', icon: ClipboardList, roles: ['superadmin', 'docente'] },
    { name: 'Reportes Libretas', path: '/academic-reports', icon: FileText, roles: ['superadmin', 'admin', 'docente'] },
    { name: 'Mensualidades', path: '/payments', icon: DollarSign, roles: ['superadmin', 'admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <>
      {/* Overlay (solo móvil) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 bg-slate-950 text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl border-r border-white/5 z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Header con botón cerrar en móvil */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.nombre} className="w-10 h-10 rounded-2xl shadow-lg object-cover" />
            ) : (
              <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            )}
            <h1 className="text-xl font-black tracking-tighter">
              {tenant ? <span className="text-white">{tenant.nombre}</span> : <>ZEI<span className="text-indigo-400">TRIX</span></>}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto mt-4">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all text-xs font-black uppercase tracking-widest
                ${isActive
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'}
              `}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="px-5 py-4 mb-6 bg-white/5 rounded-3xl border border-white/5">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Usuario Activo</p>
            <p className="text-sm font-black truncate text-white">{user.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-5 py-4 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-2xl transition-all text-xs font-black uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  menus: string[];
  setAuth: (token: string, userId: number, role: string) => void;
  setRole: (role: string) => void;
  setMenus: (menus: string[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : null,
  role: localStorage.getItem('role'),
  menus: JSON.parse(localStorage.getItem('menus') || '[]'),
  setAuth: (token, userId, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('role', role);
    set({ token, userId, role });
  },
  setRole: (role) => { localStorage.setItem('role', role); set({ role }); },
  setMenus: (menus) => { localStorage.setItem('menus', JSON.stringify(menus)); set({ menus }); },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('menus');
    set({ token: null, userId: null, role: null, menus: [] });
  },
}));

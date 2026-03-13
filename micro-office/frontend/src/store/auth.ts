import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  setAuth: (token: string, userId: number, role: string) => void;
  setRole: (role: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : null,
  role: localStorage.getItem('role'),
  setAuth: (token, userId, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('role', role);
    set({ token, userId, role });
  },
  setRole: (role) => { localStorage.setItem('role', role); set({ role }); },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    set({ token: null, userId: null, role: null });
  },
}));

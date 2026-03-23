import { create } from 'zustand';

const storageKeys = {
  token: 'token',
  userId: 'userId',
  name: 'name',
  role: 'role',
  menus: 'menus',
  objectTypes: 'objectTypes',
} as const;

const readStoredArray = (key: string) => {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeStoredValue = (key: string, value: string | null) => {
  if (value == null || value === '') {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
};

const writeStoredArray = (key: string, value: string[]) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const clearPersistedAuth = () => {
  Object.values(storageKeys).forEach(key => localStorage.removeItem(key));
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = window.atob(padded);
  const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const parseJwtPayload = (token: string | null): Record<string, unknown> | null => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string | null, skewMs = 5000) => {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now() + skewMs;
};

const getInitialToken = () => {
  const token = localStorage.getItem(storageKeys.token);
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearPersistedAuth();
    return null;
  }
  return token;
};

interface AuthProfile {
  userId?: string | null;
  name?: string | null;
  role?: string | null;
  menus?: string[];
  objectTypes?: string[];
}

interface AuthState {
  token: string | null;
  userId: string | null;
  name: string | null;
  role: string | null;
  menus: string[];
  objectTypes: string[];
  isAuthReady: boolean;
  setAuth: (token: string, userId: string, role: string) => void;
  setName: (name: string | null) => void;
  setRole: (role: string) => void;
  setMenus: (menus: string[]) => void;
  setObjectTypes: (types: string[]) => void;
  setProfile: (profile: AuthProfile) => void;
  markAuthReady: () => void;
  logout: () => void;
}

const initialToken = getInitialToken();
const hasStoredToken = Boolean(initialToken);

export const useAuthStore = create<AuthState>(set => ({
  token: initialToken,
  userId: localStorage.getItem(storageKeys.userId),
  name: localStorage.getItem(storageKeys.name),
  role: localStorage.getItem(storageKeys.role),
  menus: readStoredArray(storageKeys.menus),
  objectTypes: readStoredArray(storageKeys.objectTypes),
  isAuthReady: !hasStoredToken,
  setAuth: (token, userId, role) => {
    localStorage.setItem(storageKeys.token, token);
    localStorage.setItem(storageKeys.userId, userId);
    writeStoredValue(storageKeys.role, role);
    localStorage.removeItem(storageKeys.name);
    writeStoredArray(storageKeys.menus, []);
    writeStoredArray(storageKeys.objectTypes, []);
    set({ token, userId, name: null, role, menus: [], objectTypes: [], isAuthReady: false });
  },
  setName: (name) => {
    writeStoredValue(storageKeys.name, name);
    set({ name });
  },
  setRole: (role) => {
    writeStoredValue(storageKeys.role, role);
    set({ role });
  },
  setMenus: (menus) => {
    writeStoredArray(storageKeys.menus, menus);
    set({ menus });
  },
  setObjectTypes: (types) => {
    writeStoredArray(storageKeys.objectTypes, types);
    set({ objectTypes: types });
  },
  setProfile: (profile) => {
    if (profile.userId !== undefined) {
      writeStoredValue(storageKeys.userId, profile.userId);
    }
    if (profile.name !== undefined) {
      writeStoredValue(storageKeys.name, profile.name);
    }
    if (profile.role !== undefined) {
      writeStoredValue(storageKeys.role, profile.role);
    }
    if (profile.menus !== undefined) {
      writeStoredArray(storageKeys.menus, profile.menus);
    }
    if (profile.objectTypes !== undefined) {
      writeStoredArray(storageKeys.objectTypes, profile.objectTypes);
    }
    set(state => ({
      userId: profile.userId !== undefined ? profile.userId : state.userId,
      name: profile.name !== undefined ? profile.name : state.name,
      role: profile.role !== undefined ? profile.role : state.role,
      menus: profile.menus !== undefined ? profile.menus : state.menus,
      objectTypes: profile.objectTypes !== undefined ? profile.objectTypes : state.objectTypes,
      isAuthReady: true,
    }));
  },
  markAuthReady: () => set({ isAuthReady: true }),
  logout: () => {
    clearPersistedAuth();
    set({ token: null, userId: null, name: null, role: null, menus: [], objectTypes: [], isAuthReady: true });
  },
}));

export const clearAuthState = () => {
  useAuthStore.getState().logout();
};

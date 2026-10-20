// Authentication API client

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthState {
  authenticated: boolean;
  user: User | null;
  // True when the auth check itself failed (network error, 5xx, ...), so
  // `authenticated: false` means "unknown", not "confirmed signed out".
  unavailable?: boolean;
}

export const authApi = {
  // Get current user
  getMe: async (): Promise<AuthState> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include'
      });
      if (!response.ok) {
        // 401/403 is a confirmed anonymous session; anything else is an
        // outage and must not be mistaken for "signed out".
        if (response.status === 401 || response.status === 403) {
          return { authenticated: false, user: null };
        }
        return { authenticated: false, user: null, unavailable: true };
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching auth state:', error);
      return { authenticated: false, user: null, unavailable: true };
    }
  },

  // Get Google login URL
  getLoginUrl: (redirectUrl?: string): string => {
    const redirect = redirectUrl || window.location.href;
    return `${API_BASE_URL}/auth/google?redirect=${encodeURIComponent(redirect)}`;
  },

  // Logout
  logout: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      return response.ok;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }
};

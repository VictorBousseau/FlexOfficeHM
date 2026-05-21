'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'flex-office-user-name';

export interface CurrentUser {
  /** Prenom courant (chaine vide si non defini). */
  userName: string;
  /** Enregistre/modifie le prenom (localStorage). */
  setUserName: (name: string) => void;
  /** True une fois la lecture localStorage effectuee (evite le flash SSR). */
  loaded: boolean;
}

/**
 * Gere le pseudo de l'utilisateur, persiste en localStorage.
 * La lecture est faite dans un useEffect pour eviter les erreurs d'hydratation SSR.
 */
export function useCurrentUser(): CurrentUser {
  const [userName, setUserNameState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setUserNameState(stored);
    } catch {
      // localStorage indisponible (mode prive, etc.) — on ignore.
    }
    setLoaded(true);
  }, []);

  const setUserName = useCallback((name: string) => {
    const trimmed = name.trim();
    setUserNameState(trimmed);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // ignore
    }
  }, []);

  return { userName, setUserName, loaded };
}

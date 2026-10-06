import { useState, useEffect, useContext, createContext } from "react";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[AUTH] onAuthStateChanged:', currentUser?.email ?? 'null');
      if (currentUser) {
        try {
          console.log('[AUTH] Verificando allowedEmails para:', currentUser.email);
          const snap = await getDoc(doc(db, 'allowedEmails', currentUser.email));
          console.log('[AUTH] snap.exists():', snap.exists());
          if (snap.exists()) {
            setUser(currentUser);
            setRole(snap.data().role || 'user');
            setAccessDenied(false);
          } else {
            console.log('[AUTH] Email não encontrado → signOut');
            setAccessDenied(true);
            setUser(null);
            setRole(null);
            await signOut(auth);
          }
        } catch (err) {
          console.error('[AUTH] Erro Firestore:', err.code, err.message);
          setUser(null);
          setRole(null);
          await signOut(auth);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, accessDenied, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

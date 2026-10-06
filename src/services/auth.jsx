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
      if (currentUser) {
        try {
          const snap = await getDoc(doc(db, 'allowedEmails', currentUser.email));
          if (snap.exists()) {
            setUser(currentUser);
            setRole(snap.data().role || 'user');
            setAccessDenied(false);
          } else {
            setAccessDenied(true);
            setUser(null);
            setRole(null);
            await signOut(auth);
          }
        } catch (err) {
          console.error('Erro ao verificar acesso:', err);
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

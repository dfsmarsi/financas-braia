import React, { useState, useEffect } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';

const provider = new GoogleAuthProvider();

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user]);

  // Verifica resultado de redirect ao carregar a página
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result) return;
        const snap = await getDoc(doc(db, 'allowedEmails', result.user.email));
        if (!snap.exists()) {
          await signOut(auth);
          setError('Acesso não autorizado. Contacta o administrador.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao entrar com Google. Tenta novamente.');
      }
    };
    checkRedirect();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Tenta popup primeiro; se bloqueado, usa redirect
      const result = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, 'allowedEmails', result.user.email));
      if (!snap.exists()) {
        await signOut(auth);
        setError('Acesso não autorizado. Contacta o administrador.');
      }
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
      } else if (err.code !== 'auth/popup-closed-by-user') {
        console.error(err);
        setError('Erro ao entrar com Google. Tenta novamente.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl">
        <h1 className="text-3xl font-bold text-blue-900 mb-2 text-center">Olá!</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">Entre para gerir suas contas.</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 py-3 px-4 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.8 6.5 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.8 6.5 29.2 4 24 4c-7.7 0-14.3 4.5-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.8-1.7 13.4-4.6l-6.2-5.2C29.3 35.6 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.6 4.8C9.9 39.7 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.6-2.7 4.7-5.1 6.2l6.2 5.2C40 36.2 43.7 30.6 43.7 24c0-1.3-.1-2.7-.1-4z"/>
          </svg>
          {loading ? 'A entrar...' : 'Entrar com Google'}
        </button>

        <p className="mt-8 text-center text-xs text-gray-400">
          Sistema privado • Acesso restrito
        </p>
      </div>
    </div>
  );
};

export default Login;

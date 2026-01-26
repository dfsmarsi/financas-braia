import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig'; // <--- CORRIGIDO AQUI (Linha 3)
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [userLogin, setUserLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // DEFINA O SEU DOMÍNIO FICTÍCIO AQUI
  const DOMAIN = "@financas.app"; 

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // LÓGICA DO NICKNAME:
    let emailFinal = userLogin.trim();
    if (!emailFinal.includes('@')) {
      emailFinal = `${emailFinal}${DOMAIN}`;
    }

    try {
      await signInWithEmailAndPassword(auth, emailFinal, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Utilizador ou senha incorretos.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Muitas tentativas falhadas. Tenta novamente mais tarde.");
      } else {
        setError("Erro ao entrar. Tenta novamente.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl">
        <h1 className="text-3xl font-bold text-blue-900 mb-2 text-center">Olá!</h1>
        <p className="text-gray-500 text-center mb-6 text-sm">Entre para gerir suas contas.</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Usuário</label>
            <input 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700" 
              type="text" 
              placeholder="Ex: braia"
              required
              autoFocus
              value={userLogin} 
              onChange={e => setUserLogin(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
            <input 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700" 
              type="password" 
              placeholder="••••••••"
              required
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>

          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>
        
        <p className="mt-6 text-center text-xs text-gray-400">
          Sistema privado • v1.0
        </p>
      </div>
    </div>
  );
};

export default Login;
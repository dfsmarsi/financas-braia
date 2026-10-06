import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Trash2, UserPlus, ArrowLeft } from 'lucide-react';

const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'allowedEmails'));
      setAllowedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    const email = newEmail.trim().toLowerCase();
    try {
      await setDoc(doc(db, 'allowedEmails', email), {
        email,
        role: newRole,
        addedBy: user.email,
        addedAt: serverTimestamp(),
      });
      setNewEmail('');
      setNewRole('user');
      showMessage(`${email} adicionado com sucesso.`);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      showMessage('Erro ao adicionar. Verifica as regras do Firestore.', 'error');
    }
    setAdding(false);
  };

  const handleRemove = async (email) => {
    if (email === user.email) {
      showMessage('Não podes remover a ti próprio.', 'error');
      return;
    }
    if (!window.confirm(`Remover acesso de ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'allowedEmails', email));
      showMessage(`Acesso de ${email} removido.`);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      showMessage('Erro ao remover.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            title="Voltar"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <Shield size={22} className="text-purple-600" />
          <h1 className="text-xl font-bold text-gray-800">Painel de Administração</h1>
        </div>

        {/* Formulário de adição */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <UserPlus size={18} /> Conceder Acesso
          </h2>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="email@gmail.com"
              required
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="user">Utilizador</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all text-sm disabled:opacity-70 whitespace-nowrap"
            >
              {adding ? 'Adicionando...' : 'Adicionar'}
            </button>
          </form>

          {message.text && (
            <p className={`mt-3 text-sm p-3 rounded-lg ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-100'
                : 'bg-green-50 text-green-700 border border-green-100'
            }`}>
              {message.text}
            </p>
          )}
        </div>

        {/* Lista de utilizadores */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-4">
            Acessos Permitidos {!loading && <span className="text-gray-400 font-normal text-sm">({allowedUsers.length})</span>}
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Carregando...</p>
          ) : allowedUsers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Nenhum acesso registado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {allowedUsers.map(u => (
                <li key={u.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 font-bold text-sm">
                        {u.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 text-sm truncate">{u.email}</span>
                        {u.email === user.email && (
                          <span className="text-xs text-gray-400">(você)</span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.role === 'admin' ? 'Admin' : 'Utilizador'}
                      </span>
                    </div>
                  </div>

                  {u.email !== user.email && (
                    <button
                      onClick={() => handleRemove(u.email)}
                      className="ml-3 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Remover acesso"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Apenas emails listados aqui conseguem entrar no sistema.
        </p>
      </div>
    </div>
  );
};

export default AdminPanel;

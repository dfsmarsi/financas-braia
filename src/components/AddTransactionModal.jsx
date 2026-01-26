import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'; // Importamos updateDoc e doc
import { db } from '../services/firebaseConfig';
import { useAuth } from '../services/auth'; // Atenção ao import correto do auth

const AddTransactionModal = ({ onClose, onSuccess, initialData }) => {
  const { auth } = useAuth ? useAuth() : { auth: {} }; // Ajuste de segurança caso useAuth varie
  const user = auth?.currentUser; // Pega o usuário direto do auth se necessário
  
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [isFixed, setIsFixed] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Preenche os campos se for Edição
  useEffect(() => {
    if (initialData) {
      setDesc(initialData.description);
      setAmount(initialData.amount);
      setType(initialData.type);
      setIsFixed(initialData.isFixed || false);
    }
  }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user && !initialData) return; // Segurança básica
    setLoading(true);
    
    try {
      const transactionData = {
        description: desc,
        amount: parseFloat(amount),
        type,
        isFixed,
        // Mantém a data original se for edição, ou cria nova se for novo
        date: initialData ? initialData.date : new Date(), 
        // Se for novo, precisa do uid. Se for edição, não precisa reenviar
        ...(initialData ? {} : { uid: user.uid })
      };

      if (initialData) {
        // MODO EDIÇÃO: Atualiza o documento existente
        const ref = doc(db, "transactions", initialData.id);
        await updateDoc(ref, transactionData);
      } else {
        // MODO CRIAÇÃO: Cria um novo
        await addDoc(collection(db, "transactions"), transactionData);
      }

      onSuccess(); // Recarrega a tela
      onClose();   // Fecha modal
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar. Verifique o console.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-blue-900 mb-4">
          {initialData ? 'Editar Registro' : 'Novo Registro'}
        </h2>
        
        <form onSubmit={handleSave} className="space-y-4">
          <input 
            required
            className="w-full border p-2 rounded outline-none focus:border-blue-500" 
            value={desc} 
            onChange={e => setDesc(e.target.value)}
            placeholder="Descrição (ex: Internet)"
          />
          <div className="flex gap-4">
            <input 
              type="number" step="0.01" required
              className="w-full border p-2 rounded outline-none focus:border-blue-500"
              value={amount}
              onChange={e => setAmount(e.target.value)} 
              placeholder="Valor"
            />
            <select className="border p-2 rounded" value={type} onChange={e => setType(e.target.value)}>
              <option value="expense">Débito (-)</option>
              <option value="income">Crédito (+)</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" id="fixed" 
              checked={isFixed} onChange={e => setIsFixed(e.target.checked)}
            />
            <label htmlFor="fixed" className="text-gray-700">
              Conta Fixa {isFixed && <span className="text-xs text-blue-600">(Atualiza todos os meses)</span>}
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-gray-500 px-4 hover:bg-gray-100 rounded">Cancelar</button>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AddTransactionModal;
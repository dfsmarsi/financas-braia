import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'; 
import { db } from '../services/firebaseConfig';
import { useAuth } from '../services/auth';
import { addMonths, format } from 'date-fns';

const AddTransactionModal = ({ onClose, onSuccess, initialData, selectedDate }) => {
  const { user } = useAuth();
  
  // Estados do Formulário
  const [category, setCategory] = useState('single'); // single, installment, fixed
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [installments, setInstallments] = useState(2);
  const [fixedType, setFixedType] = useState('static'); // static (valor fixo), variable (zero inicial)
  const [loading, setLoading] = useState(false);
  
  // Carregar dados na Edição
  useEffect(() => {
    if (initialData) {
      setDesc(initialData.description);
      setType(initialData.type);
      
      // Verifica o tipo para preencher a UI corretamente
      if (initialData.isFixedVariable) {
        setCategory('fixed');
        setFixedType('variable');
        // Se for variável, tenta pegar o valor override daquele mês, ou o base
        const monthKey = format(selectedDate, 'yyyy-MM');
        const val = initialData.overrides && initialData.overrides[monthKey] !== undefined 
            ? initialData.overrides[monthKey] 
            : initialData.amount;
        setAmount(val);
      } else if (initialData.isFixed) {
        setCategory('fixed');
        setFixedType('static');
        setAmount(initialData.amount);
      } else {
        setCategory('single'); // Parcelas viram 'single' ao editar individualmente
        setAmount(initialData.amount);
      }
    }
  }, [initialData, selectedDate]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      const baseData = {
        uid: user.uid,
        description: desc,
        type,
        // Se for novo, usa a data selecionada. Se for edição, mantém a original.
        date: initialData ? initialData.date : (selectedDate || new Date()), 
      };

      // --- MODO EDIÇÃO ---
      if (initialData) {
        const ref = doc(db, "transactions", initialData.id);
        
        if (initialData.isFixedVariable) {
            // Lógica Especial: Fixa Variável
            // Não alteramos o valor global, mas sim o override deste mês
            const monthKey = format(selectedDate, 'yyyy-MM');
            const currentOverrides = initialData.overrides || {};
            
            await updateDoc(ref, {
                description: desc, // Descrição atualiza globalmente
                overrides: {
                    ...currentOverrides,
                    [monthKey]: parseFloat(amount)
                }
            });
        } else {
            // Edição Normal (Avulsa ou Fixa Estática)
            await updateDoc(ref, {
                ...baseData,
                amount: parseFloat(amount),
                isFixed: category === 'fixed',
                // Se mudou de categoria, removemos flags antigas
                isFixedVariable: false 
            });
        }

      } else {
        // --- MODO CRIAÇÃO (NOVO) ---
        
        if (category === 'single') {
            await addDoc(collection(db, "transactions"), {
                ...baseData,
                amount: parseFloat(amount),
                isFixed: false
            });
        } 
        else if (category === 'installment') {
            // Loop para criar X documentos
            const batchPromises = [];
            const val = parseFloat(amount);
            const dateStart = selectedDate || new Date();

            for (let i = 0; i < installments; i++) {
                const docDate = addMonths(dateStart, i);
                batchPromises.push(addDoc(collection(db, "transactions"), {
                    uid: user.uid,
                    description: `${desc} (${i+1}/${installments})`,
                    amount: val, // Valor da parcela (assumindo que o usuário digitou o valor DA PARCELA)
                    type,
                    isFixed: false,
                    installmentTotal: installments,
                    installmentCurrent: i+1,
                    date: docDate
                }));
            }
            await Promise.all(batchPromises);
        } 
        else if (category === 'fixed') {
            const isVar = fixedType === 'variable';
            await addDoc(collection(db, "transactions"), {
                ...baseData,
                amount: isVar ? 0 : parseFloat(amount), // Se variavel, base é 0
                isFixed: true,
                isFixedVariable: isVar,
                overrides: {} // Mapa vazio para os valores futuros
            });
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-bold text-blue-900 mb-6">
          {initialData ? 'Editar Registro' : 'Novo Registro'}
        </h2>
        
        <form onSubmit={handleSave} className="space-y-5">
          
          {/* SELEÇÃO DE TIPO (Só aparece ao criar novo) */}
          {!initialData && (
              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg">
                <button type="button" onClick={() => setCategory('single')} className={`py-2 text-sm font-bold rounded-md transition-all ${category === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Avulsa</button>
                <button type="button" onClick={() => setCategory('installment')} className={`py-2 text-sm font-bold rounded-md transition-all ${category === 'installment' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Parcelada</button>
                <button type="button" onClick={() => setCategory('fixed')} className={`py-2 text-sm font-bold rounded-md transition-all ${category === 'fixed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Fixa</button>
              </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
            <input 
              required
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
              value={desc} 
              onChange={e => setDesc(e.target.value)}
              placeholder="Ex: Mercado"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                {category === 'installment' ? 'Valor da Parcela' : 'Valor'}
              </label>
              <input 
                type="number" step="0.01" required={category !== 'fixed' || fixedType === 'static'}
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={amount}
                onChange={e => setAmount(e.target.value)} 
                disabled={category === 'fixed' && fixedType === 'variable' && !initialData} // Desabilita valor se for criar fixa variável nova (inicia com 0)
                placeholder={category === 'fixed' && fixedType === 'variable' && !initialData ? "Inicia em 0.00" : "0.00"}
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
              <select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={type} onChange={e => setType(e.target.value)}>
                <option value="expense">Débito (-)</option>
                <option value="income">Crédito (+)</option>
              </select>
            </div>
          </div>

          {/* CAMPOS ESPECÍFICOS DE PARCELADO */}
          {category === 'installment' && !initialData && (
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. Parcelas</label>
                <input 
                    type="number" min="2" max="60" required
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={installments}
                    onChange={e => setInstallments(e.target.value)} 
                />
             </div>
          )}

          {/* CAMPOS ESPECÍFICOS DE FIXA */}
          {category === 'fixed' && (
             <div className="bg-blue-50 p-3 rounded-xl flex flex-col gap-2">
                <p className="text-xs font-bold text-blue-900 uppercase">Configuração Fixa</p>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            name="fixType" 
                            checked={fixedType === 'static'} 
                            onChange={() => setFixedType('static')}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Valor Fixo (Internet)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            name="fixType" 
                            checked={fixedType === 'variable'} 
                            onChange={() => { setFixedType('variable'); if(!initialData) setAmount(''); }}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Valor Variável (Cartão)</span>
                    </label>
                </div>
                {fixedType === 'variable' && (
                    <p className="text-xs text-blue-600 mt-1">
                        {initialData 
                            ? "Alterando o valor apenas deste mês." 
                            : "A conta será criada com valor R$ 0,00 e você deve atualizar manualmente a cada mês."}
                    </p>
                )}
             </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="text-gray-500 font-medium px-4 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-70">
              {loading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AddTransactionModal;
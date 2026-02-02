import React, { useState, useEffect, useRef } from 'react';
import { addDoc, collection, doc, updateDoc, getDocs, query, where, writeBatch, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore'; 
import { db } from '../services/firebaseConfig';
import { useAuth } from '../services/auth';
import { addMonths, format } from 'date-fns';
import { Trash2 } from 'lucide-react';

const AddTransactionModal = ({ onClose, onSuccess, initialData, selectedDate }) => {
  const { user } = useAuth();
  const amountInputRef = useRef(null);

  const [category, setCategory] = useState('single'); 
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [installments, setInstallments] = useState(2);
  const [fixedType, setFixedType] = useState('static');
  const [loading, setLoading] = useState(false);
  
  // Foco no Valor ao abrir
  useEffect(() => {
    if (amountInputRef.current) {
        amountInputRef.current.focus();
    }
  }, []);

  const cleanDescription = (fullDesc) => {
    if (!fullDesc) return '';
    let cleaned = fullDesc.split(' Liquidada(as):')[0];
    cleaned = cleaned.split(' / Liquidada')[0];
    cleaned = cleaned.replace(/\s\(Liquidado\)$/, '');
    cleaned = cleaned.replace(/\s\(\d+\/\d+\)$/, '');
    return cleaned;
  };

  useEffect(() => {
    if (initialData) {
      if (initialData.installmentTotal) {
          setDesc(cleanDescription(initialData.description));
      } else {
          setDesc(initialData.description);
      }

      setType(initialData.type);
      
      if (initialData.isFixedVariable) {
        setCategory('fixed');
        setFixedType('variable');
        const monthKey = format(selectedDate, 'yyyy-MM');
        const val = initialData.overrides && initialData.overrides[monthKey] !== undefined 
            ? initialData.overrides[monthKey] 
            : initialData.amount;
        setAmount(val);
      } else if (initialData.isFixed) {
        setCategory('fixed');
        setFixedType('static');
        setAmount(initialData.amount);
      } else if (initialData.installmentTotal) {
        setCategory('installment');
        setAmount(initialData.amount);
        setInstallments(initialData.installmentTotal);
      } else {
        setCategory('single');
        setAmount(initialData.amount);
      }
    }
  }, [initialData, selectedDate]);

  // Função EXCLUIR
  const handleDeleteTransaction = async () => {
    const confirmMsg = initialData.groupId
        ? "Tem certeza que deseja apagar? Isso apagará TODAS as parcelas deste lançamento."
        : "Tem certeza que deseja apagar este lançamento?";

    if(!confirm(confirmMsg)) return;

    setLoading(true);
    try {
        if (initialData.groupId) {
            const q = query(collection(db, "transactions"), where("groupId", "==", initialData.groupId), where("uid", "==", user.uid));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        } else {
            await deleteDoc(doc(db, "transactions", initialData.id));
        }
        onSuccess();
        onClose();
    } catch (error) {
        console.error(error);
        alert("Erro ao excluir: " + error.message);
    }
    setLoading(false);
  };

  const handlePay = async () => {
    setLoading(true);
    try {
        const ref = doc(db, "transactions", initialData.id);
        if (initialData.isFixed) {
            const monthKey = format(selectedDate, 'yyyy-MM');
            const currentOverrides = initialData.overrides || {};
            await updateDoc(ref, {
                overrides: { ...currentOverrides, [monthKey]: 0 },
                paidMonths: arrayUnion(monthKey) 
            });
        } else {
            await updateDoc(ref, { amount: 0, isPaid: true });
        }
        onSuccess();
        onClose();
    } catch (error) {
        console.error(error);
        alert("Erro ao pagar conta.");
    }
    setLoading(false);
  }

  const handleUnpay = async () => {
    if(!confirm("Deseja desmarcar esta conta como paga? Para contas avulsas/parceladas, você precisará editar o valor manualmente depois.")) return;
    setLoading(true);
    try {
        const ref = doc(db, "transactions", initialData.id);
        if (initialData.isFixed) {
            const monthKey = format(selectedDate, 'yyyy-MM');
            const currentOverrides = initialData.overrides || {};
            const newOverrides = { ...currentOverrides };
            delete newOverrides[monthKey];
            await updateDoc(ref, {
                overrides: newOverrides,
                paidMonths: arrayRemove(monthKey) 
            });
        } else {
            await updateDoc(ref, { isPaid: false });
        }
        onSuccess();
        onClose();
    } catch (error) {
        console.error(error);
        alert("Erro ao desmarcar pagamento.");
    }
    setLoading(false);
  }

  const handleStopRecurring = async () => {
    if(!confirm("Deseja encerrar esta conta fixa? Ela deixará de aparecer nos próximos meses, mas o histórico será mantido.")) return;
    setLoading(true);
    try {
        const ref = doc(db, "transactions", initialData.id);
        await updateDoc(ref, { endDate: selectedDate });
        onSuccess();
        onClose();
    } catch (error) {
        console.error(error);
        alert("Erro ao encerrar conta.");
    }
    setLoading(false);
  }

  const handleLiquidate = async () => {
    if(!confirm("Deseja liquidar todas as parcelas futuras? O valor restante será somado nesta conta.")) return;
    setLoading(true);
    try {
        const batch = writeBatch(db);
        if (initialData.groupId) {
            const q = query(collection(db, "transactions"), where("groupId", "==", initialData.groupId), where("uid", "==", user.uid));
            const snapshot = await getDocs(q);
            let futureAmount = 0;
            let liquidatedCount = 1; 
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.installmentCurrent > initialData.installmentCurrent) {
                    futureAmount += Number(data.amount);
                    liquidatedCount++; 
                    batch.delete(docSnap.ref); 
                }
            });
            const currentRef = doc(db, "transactions", initialData.id);
            const installmentInfo = ` (${initialData.installmentCurrent}/${initialData.installmentTotal})`;
            const cleanFullDescription = `${desc}${installmentInfo}`;
            batch.update(currentRef, {
                amount: Number(initialData.amount) + futureAmount,
                description: cleanFullDescription, 
                isLiquidated: true,
                liquidatedCount: liquidatedCount
            });
            await batch.commit();
            onSuccess();
            onClose();
        } else {
            alert("Erro: Sem vínculo de grupo.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao liquidar.");
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      const baseData = {
        uid: user.uid,
        description: desc, 
        type,
        date: initialData ? initialData.date : (selectedDate || new Date()), 
      };

      if (initialData) {
        const ref = doc(db, "transactions", initialData.id);
        
        if (initialData.isFixedVariable && category === 'fixed' && fixedType === 'variable') {
            const monthKey = format(selectedDate, 'yyyy-MM');
            const currentOverrides = initialData.overrides || {};
            await updateDoc(ref, {
                description: desc, 
                overrides: { ...currentOverrides, [monthKey]: parseFloat(amount) }
            });
        } 
        else if (initialData.installmentCurrent === 1 && category === 'installment' && initialData.groupId) {
             if(confirm("Ao editar a parcela 1, toda a série será recriada. Continuar?")) {
                const q = query(collection(db, "transactions"), where("groupId", "==", initialData.groupId), where("uid", "==", user.uid));
                const snap = await getDocs(q);
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();

                const newGroupId = Date.now().toString();
                const batchNew = [];
                const val = parseFloat(amount);
                const dateStart = initialData.date && initialData.date.toDate ? initialData.date.toDate() : (initialData.date || new Date());
                const qtdParcelas = parseInt(installments);

                for (let i = 0; i < qtdParcelas; i++) {
                    const docDate = addMonths(dateStart, i);
                    batchNew.push(addDoc(collection(db, "transactions"), {
                        ...baseData, 
                        description: `${desc} (${i+1}/${qtdParcelas})`, 
                        amount: val, isFixed: false,
                        installmentTotal: qtdParcelas, installmentCurrent: i+1, groupId: newGroupId, date: docDate
                    }));
                }
                await Promise.all(batchNew);
             }
        }
        else {
            if (category === 'installment' && initialData.groupId) {
                const batch = writeBatch(db);
                const q = query(collection(db, "transactions"), where("groupId", "==", initialData.groupId), where("uid", "==", user.uid));
                const snap = await getDocs(q);
                snap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    let newNameWithNumber = `${desc} (${data.installmentCurrent}/${data.installmentTotal})`;
                    if (docSnap.id === initialData.id) {
                        batch.update(docSnap.ref, {
                            description: newNameWithNumber,
                            amount: parseFloat(amount),
                            type
                        });
                    } else {
                        batch.update(docSnap.ref, {
                            description: newNameWithNumber
                        });
                    }
                });
                await batch.commit();
            } else {
                await updateDoc(ref, {
                    ...baseData,
                    amount: parseFloat(amount),
                    isFixed: category === 'fixed',
                    isFixedVariable: category === 'fixed' && fixedType === 'variable',
                    installmentTotal: category === 'installment' ? parseInt(installments) : null,
                    installmentCurrent: category === 'installment' ? 1 : null,
                    overrides: (category === 'fixed' && fixedType === 'variable') ? (initialData.overrides || {}) : {}
                });
            }
        }
      } else {
        if (category === 'single') {
            await addDoc(collection(db, "transactions"), { ...baseData, amount: parseFloat(amount), isFixed: false });
        } 
        else if (category === 'installment') {
            const batchPromises = [];
            const val = parseFloat(amount);
            const dateStart = selectedDate || new Date();
            const newGroupId = Date.now().toString(); 
            const qtdParcelas = parseInt(installments);
            for (let i = 0; i < qtdParcelas; i++) {
                const docDate = addMonths(dateStart, i);
                batchPromises.push(addDoc(collection(db, "transactions"), {
                    uid: user.uid, 
                    description: `${desc} (${i+1}/${qtdParcelas})`, 
                    amount: val, type, isFixed: false,
                    installmentTotal: qtdParcelas, installmentCurrent: i+1, groupId: newGroupId, date: docDate
                }));
            }
            await Promise.all(batchPromises);
        } 
        else if (category === 'fixed') {
            const isVar = fixedType === 'variable';
            await addDoc(collection(db, "transactions"), {
                ...baseData, amount: isVar ? 0 : parseFloat(amount), isFixed: true, isFixedVariable: isVar, overrides: {} 
            });
        }
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    }
    setLoading(false);
  };

  const isInstallmentChild = initialData && initialData.installmentCurrent > 1;
  const isLiquidated = initialData && (initialData.isLiquidated || (initialData.description && initialData.description.toLowerCase().includes('liquidada')));
  
  let isPaid = false;
  if (initialData) {
      if (initialData.isFixed) {
          const monthKey = format(selectedDate, 'yyyy-MM');
          if (initialData.paidMonths && initialData.paidMonths.includes(monthKey)) isPaid = true;
      } else {
          isPaid = initialData.isPaid;
      }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
        
        {/* --- MUDANÇA AQUI: CABEÇALHO COM BOTÃO DE EXCLUIR --- */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-blue-900">
                {initialData ? 'Editar lançamento' : 'Novo lançamento'}
            </h2>

            {/* Ícone de Lixeira no TOPO (só se estiver editando) */}
            {initialData && (
                <button 
                    type="button" 
                    onClick={handleDeleteTransaction} 
                    className="p-2 text-red-500 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                    title="Excluir"
                >
                    <Trash2 size={22} />
                </button>
            )}
        </div>
        
        <form onSubmit={handleSave} className="space-y-5">
          {!isInstallmentChild && (
              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg">
                <button type="button" onClick={() => setCategory('single')} className={`py-2 text-sm font-bold rounded-md transition-all ${category === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}>Avulsa</button>
                <button type="button" onClick={() => setCategory('installment')} className={`py-2 text-sm font-bold rounded-md transition-all ${category === 'installment' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}>Parcelada</button>
                <button type="button" onClick={() => setCategory('fixed')} className={`py-2 text-sm font-bold rounded-md transition-all ${category === 'fixed' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}>Fixa</button>
              </div>
          )}
          
          {isInstallmentChild && (
             <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-xs border border-yellow-200">
                Editando parcela {initialData.installmentCurrent}/{initialData.installmentTotal}.
             </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
            <input 
                required 
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 uppercase" 
                value={desc} 
                onChange={e => setDesc(e.target.value.toUpperCase())} 
                placeholder="Ex: MERCADO" 
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{category === 'installment' ? 'Valor da Parcela' : 'Valor'}</label>
              <input ref={amountInputRef} type="number" step="0.01" required={category !== 'fixed' || fixedType === 'static'} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={amount} onChange={e => setAmount(e.target.value)} disabled={(category === 'fixed' && fixedType === 'variable' && !initialData) || isInstallmentChild} placeholder="0.00" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
              <select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={type} onChange={e => setType(e.target.value)} disabled={isInstallmentChild}>
                <option value="expense">Débito (-)</option>
                <option value="income">Crédito (+)</option>
              </select>
            </div>
          </div>

          {category === 'installment' && (
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. Parcelas</label>
                <input type="number" min="2" max="60" required className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={installments} onChange={e => setInstallments(e.target.value)} disabled={isInstallmentChild} />
             </div>
          )}

          {category === 'fixed' && (
             <div className="bg-blue-50 p-3 rounded-xl flex flex-col gap-2">
                <p className="text-xs font-bold text-blue-900 uppercase">Configuração de valor de conta Fixa</p>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={fixedType === 'static'} onChange={() => setFixedType('static')} className="text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">Fixo</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={fixedType === 'variable'} onChange={() => { setFixedType('variable'); if(!initialData) setAmount(''); }} className="text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">Variável (Ex: cartão)</span></label>
                </div>
             </div>
          )}

          <div className="pt-2 flex justify-between items-center">
            <div className="flex gap-1">
                {isInstallmentChild && initialData.groupId && !isPaid && (
                    isLiquidated ? (
                         <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 flex items-center gap-1 cursor-not-allowed">
                            ✓ Liquidada
                        </span>
                    ) : (
                        <button type="button" onClick={handleLiquidate} className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 hover:bg-orange-100">
                            ⚡ Liquidar
                        </button>
                    )
                )}

                {/* SÓ MOSTRA SE FOR DESPESA */}
                {initialData && type === 'expense' && (
                    isPaid ? (
                        <button type="button" onClick={handleUnpay} className="text-xs font-bold text-green-700 bg-green-50 px-2 py-2 rounded-lg border border-green-300 hover:bg-green-100 flex items-center">
                            ↩ Desfazer
                        </button>
                    ) : (
                        <button type="button" onClick={handlePay} className="text-xs font-bold text-green-600 bg-green-50 px-2 py-2 rounded-lg border border-green-200 hover:bg-green-100">
                            💲 Pagar
                        </button>
                    )
                )}
                
                {initialData && initialData.isFixed && !initialData.endDate && (
                    <button type="button" onClick={handleStopRecurring} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-100">⛔ Encerrar</button>
                )}
            </div>

            <div className="flex ml-7 gap-2">
                <button type="button" onClick={onClose} className="bg-gray-200 text-gray-600 rounded-lg font-medium px-3 hover:bg-gray-300">Cancelar</button>
                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-70">{loading ? '...' : 'Salvar'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AddTransactionModal;
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore'; 
import { db, auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth'; 
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Shield } from 'lucide-react';
import { useAuth } from '../services/auth';
import MonthCard from '../components/MonthCard';
import AddTransactionModal from '../components/AddTransactionModal';

const DashBoard = () => {
  const { role } = useAuth();
  const [salary, setSalary] = useState(0);
  const [monthsToShow, setMonthsToShow] = useState(12);
  const [startMonth, setStartMonth] = useState(new Date());
  const [billingOffset, setBillingOffset] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [displayName, setDisplayName] = useState('');
  
  const [modalData, setModalData] = useState({ isOpen: false, date: null, transaction: null });
  
  const scrollRef = useRef(null);
  const hasScrolledRef = useRef(false);

  const navigate = useNavigate();
  const user = auth.currentUser;

  const fetchData = async () => {
    if (!user) return;

    // 1. Busca Transações primeiro (precisamos delas para a lógica de data)
    const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    const loadedTransactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setTransactions(loadedTransactions);

    // 2. Busca Dados do Usuário
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    const rawName = user.displayName || user.email.split('@')[0];
    let finalName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    if (userDoc.exists()) {
      const data = userDoc.data();
      setSalary(data.salary || 0);
      if (data.monthsToShow) setMonthsToShow(data.monthsToShow);
      if (data.billingOffset !== undefined) setBillingOffset(data.billingOffset);
      if (data.displayName) finalName = data.displayName;
      
      // --- LÓGICA DE DATA INICIAL (START MONTH) ---
      if (data.startMonth) {
          // CASO 1: Usuário já fechou um mês manualmente. Respeitamos a data salva.
          setStartMonth(data.startMonth.toDate());
      } else {
          // CASO 2: Nenhum mês fechado. Calculamos dinamicamente.
          if (loadedTransactions.length > 0) {
              // Procura a transação mais antiga de todas
              const oldestDate = loadedTransactions.reduce((earliest, t) => {
                  const tDate = t.date.toDate();
                  return tDate < earliest ? tDate : earliest;
              }, new Date());
              
              // Define o início como o mês dessa transação mais antiga
              setStartMonth(startOfMonth(oldestDate));
          } else {
              // Se não tem nenhuma transação, começa hoje
              setStartMonth(startOfMonth(new Date()));
          }
      }
    } else {
       // Usuário novo sem cadastro no banco
       setStartMonth(startOfMonth(new Date()));
    }
    
    setDisplayName(finalName);
  };

  useEffect(() => { 
    const timer = setTimeout(() => {
        if(auth.currentUser) fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasScrolledRef.current) return;

    const scrollTimer = setTimeout(() => {
        const currentCard = document.getElementById('month-card-0'); 
        if (currentCard) {
            currentCard.scrollIntoView({ 
                behavior: 'smooth', 
                inline: 'center', 
                block: 'nearest' 
            });
            hasScrolledRef.current = true;
        }
    }, 800); 
    return () => clearTimeout(scrollTimer);
  }, [startMonth]); 

  const handleCloseMonth = async (dateToClose) => {
    const confirmText = "Tem certeza que deseja fechar este mês?\n\nTodas as contas deste mês serão apagadas permanentemente (inclusive a parcela deste mês de contas parceladas).\nO dashboard começará a partir do mês seguinte.";
    if (!confirm(confirmText)) return;

    const start = startOfMonth(dateToClose);
    const end = endOfMonth(dateToClose);
    const batch = writeBatch(db);

    const toDelete = transactions.filter(t => {
        if (t.isFixed) return false;
        const tDate = t.date.toDate();
        return tDate >= start && tDate <= end;
    });

    toDelete.forEach(t => {
        const ref = doc(db, "transactions", t.id);
        batch.delete(ref);
    });

    const nextMonth = addMonths(start, 1);
    const userRef = doc(db, "users", user.uid);
    
    // Salva explicitamente o novo mês de início no banco
    batch.update(userRef, { startMonth: Timestamp.fromDate(nextMonth) });

    await batch.commit();

    hasScrolledRef.current = false;
    setStartMonth(nextMonth);
    fetchData();
  };

  const handleDelete = async (transaction) => {
    if(!confirm("Tem certeza que deseja apagar? Se for parcelada, apagará todas.")) return;

    const isGroup = transaction.groupId && transaction.installmentTotal;
    
    if (isGroup) {
        const q = query(collection(db, "transactions"), where("groupId", "==", transaction.groupId), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    } else {
        await deleteDoc(doc(db, "transactions", transaction.id));
    }
    
    fetchData();
  };
  
  const handleUpdateSalary = async () => {
      const val = prompt("Qual o valor do salário mensal?", salary);
      if(val) {
          const num = parseFloat(val);
          if(!isNaN(num)) {
            setSalary(num);
            if (user) await setDoc(doc(db, "users", user.uid), { salary: num }, { merge: true });
          }
      }
  }

  const handleToggleBillingOffset = async () => {
    const next = billingOffset === 0 ? 1 : 0;
    setBillingOffset(next);
    if (user) await setDoc(doc(db, "users", user.uid), { billingOffset: next }, { merge: true });
  };

  const handleUpdateMonths = async () => {
      const val = prompt("Quantos meses à frente deseja visualizar?", monthsToShow);
      if(val) {
          const num = parseInt(val);
          if (num > 0 && num <= 60) { 
            setMonthsToShow(num);
            if (user) await setDoc(doc(db, "users", user.uid), { monthsToShow: num }, { merge: true });
          } else {
            alert("Por favor, insira um número entre 1 e 60.");
          }
      }
  }

  const handleUpdateName = async () => {
    const newName = prompt("Como você quer ser chamado?", displayName);
    if (newName && newName.trim() !== "") {
        setDisplayName(newName);
        if (user) await setDoc(doc(db, "users", user.uid), { displayName: newName }, { merge: true });
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  const handleEdit = (transaction, dateContext) => {
    setModalData({ isOpen: true, date: dateContext, transaction: transaction });
  };

  const handleNew = (dateContext) => {
    setModalData({ isOpen: true, date: dateContext, transaction: null });
  }

  const handleCloseModal = () => {
    setModalData({ isOpen: false, date: null, transaction: null });
  }

  const months = Array.from({ length: monthsToShow }, (_, i) => addMonths(startMonth, i));

  return (
    <div className="fixed inset-0 bg-blue-50 flex flex-col overflow-hidden">
      <style>{`
        html, body {
          overscroll-behavior-y: none;
          overflow: hidden;
          height: 100%;
          width: 100%;
          position: fixed;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #DBEAFE; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2563EB; 
          border-radius: 10px;
          border: 3px solid #DBEAFE; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1E40AF; 
        }
      `}</style>

      <header className="shrink-0 bg-blue-600 p-4 text-white flex flex-col md:flex-row gap-4 justify-between items-center shadow-md z-10 w-full">
        
        <div 
            onClick={handleUpdateName} 
            className="flex items-center gap-2 cursor-pointer hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors select-none"
            title="Clique para alterar seu nome"
        >
            <div className="bg-blue-800 p-2 rounded-full">
                <User size={20} />
            </div>
            <div>
                <p className="text-xs text-blue-200">Bem-vindo(a),</p>
                <h1 className="font-bold text-lg leading-tight">{displayName}</h1>
            </div>
        </div>
        
        <div className="flex gap-2 flex-wrap justify-center md:justify-end items-center">
            <button
                onClick={handleToggleBillingOffset}
                className={`text-xs px-3 py-2 rounded transition-colors flex items-center gap-1 shadow-sm border ${billingOffset === 1 ? 'bg-yellow-500 hover:bg-yellow-600 border-yellow-400/30' : 'bg-blue-700 hover:bg-blue-800 border-blue-500/30'}`}
                title={billingOffset === 1 ? 'Modo Fatura: pago mês seguinte' : 'Modo Normal: pago no mês'}
            >
                🧾 {billingOffset === 1 ? 'Fatura' : 'Normal'}
            </button>
            <button
                onClick={handleUpdateMonths}
                className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded transition-colors flex items-center gap-1 shadow-sm border border-blue-500/30"
                title="Configurar Meses"
            >
                📅 {monthsToShow} Meses
            </button>
            <button 
                onClick={handleUpdateSalary} 
                className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded transition-colors flex items-center gap-1 shadow-sm border border-blue-500/30"
                title="Configurar Salário"
            >
                💰 R$ {parseFloat(salary).toFixed(2)}
            </button>
            
            {role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white p-2 rounded transition-colors flex items-center gap-1 shadow-sm"
                title="Painel Admin"
              >
                <Shield size={16} />
              </button>
            )}
            <button
                onClick={handleLogout}
                className="ml-2 text-xs bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors flex items-center gap-1 shadow-sm"
                title="Sair"
            >
                <LogOut size={16} />
            </button>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 w-full overflow-x-auto snap-x snap-mandatory flex gap-4 p-4 pb-6 items-start custom-scrollbar"
      >
        {months.map((date, i) => (
          <div 
            key={i} 
            id={'month-card-' + i} 
            className="snap-center shrink-0 w-[90vw] md:w-[400px] h-full"
          >
            <MonthCard
                date={date}
                salary={salary}
                allTransactions={transactions}
                billingOffset={billingOffset}
                onDelete={handleDelete} 
                onEdit={handleEdit}
                onAdd={handleNew}
                onCloseMonth={i === 0 ? () => handleCloseMonth(date) : null}
            />
          </div>
        ))}
      </div>

      {modalData.isOpen && (
        <AddTransactionModal 
            initialData={modalData.transaction} 
            selectedDate={modalData.date}
            onClose={handleCloseModal} 
            onSuccess={fetchData} 
        />
      )}
    </div>
  );
};

export default DashBoard;
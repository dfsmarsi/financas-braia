import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore'; 
import { db, auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth'; 
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react'; 
import MonthCard from '../components/MonthCard';
import AddTransactionModal from '../components/AddTransactionModal';

const DashBoard = () => {
  const [salary, setSalary] = useState(0);
  const [monthsToShow, setMonthsToShow] = useState(12);
  const [startMonth, setStartMonth] = useState(new Date()); 
  const [transactions, setTransactions] = useState([]);
  const [displayName, setDisplayName] = useState('');
  
  const [modalData, setModalData] = useState({ isOpen: false, date: null, transaction: null });
  
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const user = auth.currentUser;

  const fetchData = async () => {
    if (!user) return;

    const emailNick = user.email.split('@')[0];
    let finalName = emailNick.charAt(0).toUpperCase() + emailNick.slice(1);

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setSalary(data.salary || 0);
      if (data.monthsToShow) setMonthsToShow(data.monthsToShow);
      if (data.displayName) finalName = data.displayName;
      
      if (data.startMonth) {
          setStartMonth(data.startMonth.toDate());
      } else {
          setStartMonth(new Date());
      }
    }
    
    setDisplayName(finalName);

    const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { 
    const timer = setTimeout(() => {
        if(auth.currentUser) fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const scrollTimer = setTimeout(() => {
        const currentCard = document.getElementById('month-card-0'); 
        if (currentCard) {
            currentCard.scrollIntoView({ 
                behavior: 'smooth', 
                inline: 'center', 
                block: 'nearest' 
            });
        }
    }, 800); 
    return () => clearTimeout(scrollTimer);
  }, [transactions, monthsToShow]);

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
    
    batch.update(userRef, { startMonth: Timestamp.fromDate(nextMonth) });

    await batch.commit();
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
    // AJUSTE CRÍTICO: 'fixed inset-0' trava a tela e impede rolagem do body
    <div className="fixed inset-0 bg-blue-50 flex flex-col overflow-hidden">
      <style>{`
        /* Bloqueia o Pull-to-Refresh e rolagem do Body */
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

      {/* HEADER */}
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
            
            <button 
                onClick={handleLogout} 
                className="ml-2 text-xs bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors flex items-center gap-1 shadow-sm"
                title="Sair"
            >
                <LogOut size={16} />
            </button>
        </div>
      </header>

      {/* ÁREA DE SCROLL */}
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
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore'; 
import { db, auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth'; 
import { addMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react'; 
import MonthCard from '../components/MonthCard';
import AddTransactionModal from '../components/AddTransactionModal';

const DashBoard = () => {
  const [salary, setSalary] = useState(0);
  const [monthsToShow, setMonthsToShow] = useState(12);
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

  // --- DELETE ATUALIZADO (Sempre apaga o grupo todo se for parcelado) ---
  const handleDelete = async (transaction) => {
    if(!confirm("Tem certeza que deseja apagar? Se for parcelada, apagará todas.")) return;

    const isGroup = transaction.groupId && transaction.installmentTotal;
    
    if (isGroup) {
        // Apaga TODAS as parcelas do grupo automaticamente
        const q = query(collection(db, "transactions"), where("groupId", "==", transaction.groupId), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    } else {
        // Apaga conta avulsa ou fixa
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

  const months = Array.from({ length: monthsToShow }, (_, i) => addMonths(new Date(), i));

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <style>{`
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

      <header className="bg-blue-600 p-4 text-white flex flex-col md:flex-row gap-4 justify-between items-center shadow-md">
        
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
                onClick={() => navigate('/history')} 
                className="text-xs bg-white text-blue-600 px-3 py-2 rounded font-bold hover:bg-blue-50 shadow-sm"
            >
                Histórico
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

      <div 
        ref={scrollRef}
        className="flex-1 overflow-x-auto snap-x snap-mandatory flex gap-4 p-4 items-start custom-scrollbar pb-8"
      >
        {months.map((date, i) => (
          <div 
            key={i} 
            id={'month-card-' + i} 
            className="snap-center shrink-0 w-[90vw] md:w-[400px]"
          >
            <MonthCard 
                date={date} 
                salary={salary} 
                allTransactions={transactions} 
                onDelete={handleDelete} 
                onEdit={handleEdit}
                onAdd={handleNew} 
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
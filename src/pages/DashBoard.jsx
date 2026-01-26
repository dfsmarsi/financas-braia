// src/pages/DashBoard.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig'; // Certifique-se que o import do auth está correto
import { addMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import MonthCard from '../components/MonthCard';
import AddTransactionModal from '../components/AddTransactionModal';

const DashBoard = () => {
  const [salary, setSalary] = useState(0);
  const [monthsToShow, setMonthsToShow] = useState(12);
  const [transactions, setTransactions] = useState([]);
  
  // Estado para controlar o Modal (Data e Transação)
  const [modalData, setModalData] = useState({ isOpen: false, date: null, transaction: null });
  
  const navigate = useNavigate();
  const user = auth.currentUser;

  const fetchData = async () => {
    if (!user) return;

    // Buscar Configurações do Usuário
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setSalary(data.salary || 0);
      if (data.monthsToShow) setMonthsToShow(data.monthsToShow);
    }

    // Buscar Transações
    const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { 
    // Pequeno delay para garantir que o auth carregou
    const timer = setTimeout(() => {
        if(auth.currentUser) fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // --- AÇÕES ---

  const handleDelete = async (id) => {
    if(confirm("Tem certeza que deseja apagar?")) {
        await deleteDoc(doc(db, "transactions", id));
        fetchData();
    }
  };
  
  // FUNÇÕES QUE TINHAM SUMIDO (RESTAURADAS AQUI)
  const handleUpdateSalary = async () => {
      const val = prompt("Qual o valor do salário mensal?", salary);
      if(val) {
          const num = parseFloat(val);
          if(!isNaN(num)) {
            setSalary(num);
            if (user) {
                await setDoc(doc(db, "users", user.uid), { salary: num }, { merge: true });
            }
          }
      }
  }

  const handleUpdateMonths = async () => {
      const val = prompt("Quantos meses à frente deseja visualizar?", monthsToShow);
      if(val) {
          const num = parseInt(val);
          if (num > 0 && num <= 60) { 
            setMonthsToShow(num);
            if (user) {
                await setDoc(doc(db, "users", user.uid), { monthsToShow: num }, { merge: true });
            }
          } else {
            alert("Por favor, insira um número entre 1 e 60.");
          }
      }
  }

  // --- CONTROLE DO MODAL ---

  // Abre para EDIÇÃO
  const handleEdit = (transaction, dateContext) => {
    setModalData({ isOpen: true, date: dateContext, transaction: transaction });
  };

  // Abre para NOVA conta
  const handleNew = (dateContext) => {
    setModalData({ isOpen: true, date: dateContext, transaction: null });
  }

  const handleCloseModal = () => {
    setModalData({ isOpen: false, date: null, transaction: null });
  }

  // Gera a lista de meses
  const months = Array.from({ length: monthsToShow }, (_, i) => addMonths(new Date(), i));

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <header className="bg-blue-600 p-4 text-white flex flex-wrap gap-2 justify-between items-center shadow-md">
        <h1 className="font-bold text-lg">Minhas Finanças</h1>
        
        <div className="flex gap-2 flex-wrap justify-end">
            <button 
                onClick={handleUpdateMonths} 
                className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded transition-colors flex items-center gap-1"
            >
                📅 {monthsToShow} Meses
            </button>
            <button 
                onClick={handleUpdateSalary} 
                className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded transition-colors flex items-center gap-1"
            >
                💰 Salário: {parseFloat(salary).toFixed(2)}
            </button>
            <button 
                onClick={() => navigate('/history')} 
                className="text-xs bg-white text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-50"
            >
                Histórico
            </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex gap-4 p-4 items-start">
        {months.map((date, i) => (
          <div key={i} className="snap-center shrink-0 w-[90vw] md:w-[400px]">
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
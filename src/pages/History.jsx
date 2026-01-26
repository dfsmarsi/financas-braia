import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../services/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import HistoryChart from '../components/HistoryChart';
import { useNavigate } from 'react-router-dom';

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const getData = async () => {
      if (!user) return;
      const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
      const snap = await getDocs(q);
      
      const grouped = {};
      snap.docs.forEach(doc => {
        const t = doc.data();
        if (t.type === 'expense') {
          const key = format(t.date.toDate(), 'MMM/yy', { locale: ptBR });
          grouped[key] = (grouped[key] || 0) + Number(t.amount);
        }
      });

      setChartData(Object.keys(grouped).map(k => ({ name: k, total: grouped[k] })));
    };
    getData();
  }, [user]);

  return (
    <div className="p-4 bg-blue-50 min-h-screen">
      <button onClick={() => navigate('/')} className="mb-4 text-blue-600 font-bold">← Voltar</button>
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold text-blue-900 mb-4">Histórico de Gastos</h2>
        <HistoryChart data={chartData} />
      </div>
    </div>
  );
};

export default History;
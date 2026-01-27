import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { format, subMonths, isSameMonth, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const History = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // 1. Busca TODAS as transações
        const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const allTransactions = snap.docs.map(d => ({...d.data(), date: d.data().date.toDate()}));

        // 2. Define os últimos 12 meses para analisar
        const monthsToAnalyze = [];
        for (let i = 11; i >= 0; i--) {
            monthsToAnalyze.push(subMonths(new Date(), i));
        }

        // 3. Calcula o total gasto em cada mês (Recriando a lógica do Dashboard)
        const historyData = monthsToAnalyze.map(monthDate => {
            
            const monthKey = format(monthDate, 'yyyy-MM');
            
            // Filtra e Soma as transações deste mês específico
            const totalInMonth = allTransactions.reduce((acc, t) => {
                // Queremos apenas DESPESAS
                if (t.type !== 'expense') return acc;

                let amountToAdd = 0;

                // LÓGICA 1: Conta Fixa (Existe em todos os meses APÓS sua criação)
                if (t.isFixed) {
                    // Só conta se a data de criação for anterior ou igual ao mês analisado
                    if (t.date <= endOfMonth(monthDate)) {
                        if (t.isFixedVariable) {
                            // Se for variável, tenta pegar o override, senão pega o base
                            const override = t.overrides && t.overrides[monthKey];
                            amountToAdd = override !== undefined ? Number(override) : Number(t.amount);
                        } else {
                            amountToAdd = Number(t.amount);
                        }
                    }
                } 
                // LÓGICA 2: Avulsa ou Parcela (Verifica se cai exatamente neste mês)
                else {
                    if (isSameMonth(t.date, monthDate)) {
                        amountToAdd = Number(t.amount);
                    }
                }

                return acc + amountToAdd;
            }, 0);

            return {
                monthKey: monthKey,
                date: monthDate,
                value: totalInMonth
            };
        });

        setChartData(historyData);

      } catch (error) {
        console.error("Erro ao carregar histórico", error);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Encontrar o valor máximo para escalar as barras
  const maxValue = Math.max(...chartData.map(d => d.value), 100);

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <header className="bg-white p-4 shadow-sm flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full text-blue-600">
            <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-blue-900">Histórico de Gastos</h1>
      </header>

      <div className="flex-1 p-4 flex flex-col items-center">
        <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-5xl h-[550px] flex flex-col">
            <h2 className="text-gray-500 text-sm font-bold uppercase mb-6 tracking-wider">Últimos 12 Meses</h2>
            
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">Carregando...</div>
            ) : (
                <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                    <div className="flex items-end gap-8 h-full min-w-max px-4">
                        {chartData.map((item) => {
                            const heightPerc = (item.value / maxValue) * 100;
                            const monthLabel = format(item.date, 'MMM/yy', { locale: ptBR });
                            const valueLabel = item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                            return (
                                <div key={item.monthKey} className="flex flex-col items-center group min-w-[80px]">
                                    
                                    {/* Tooltip flutuante */}
                                    <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 text-white text-xs py-1 px-2 rounded absolute -mt-8 pointer-events-none z-10 whitespace-nowrap">
                                        {valueLabel}
                                    </div>

                                    {/* Barra */}
                                    <div 
                                        className="w-full bg-blue-500 rounded-t-lg transition-all duration-500 hover:bg-blue-600 relative group-hover:shadow-lg opacity-80 hover:opacity-100"
                                        style={{ height: `${Math.max(heightPerc, 1)}%`, minHeight: '4px' }}
                                    ></div>
                                    
                                    {/* LEGENDA FORMATADA COMO PEDIDO */}
                                    <div className="mt-3 text-center w-max">
                                        <p className="text-xs font-bold text-gray-700 uppercase">
                                            {monthLabel} <span className="text-gray-400 font-normal normal-case">({valueLabel})</span>
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default History;
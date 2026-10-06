import React from 'react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCheck, Plus, ArrowDown, ArrowUp } from 'lucide-react';

const MonthCard = ({ date, salary, allTransactions, billingOffset = 0, onDelete, onEdit, onAdd, onCloseMonth }) => {

  // No modo fatura, o título avança 1 mês mas os dados ficam intocados
  const displayDate = billingOffset > 0 ? addMonths(date, billingOffset) : date;

  // --- LÓGICA DE FILTRO (inalterada — usa sempre a data real) ---
  const monthTransactions = allTransactions.filter(t => {
      const tDate = t.date.toDate();
      const tMonthKey = tDate.getFullYear() * 12 + tDate.getMonth();
      const cardMonthKey = date.getFullYear() * 12 + date.getMonth();

      if (!t.isFixed) {
          return tMonthKey === cardMonthKey;
      }
      if (cardMonthKey < tMonthKey) return false;
      if (t.endDate) {
          const endD = t.endDate.toDate();
          const endMonthKey = endD.getFullYear() * 12 + endD.getMonth();
          if (cardMonthKey > endMonthKey) return false;
      }
      return true;
  })
  // --- ORDENAÇÃO (Fixa Var > Fixa > Parc > Avulsas[Crédito > Débito]) ---
  .sort((a, b) => {
      const getWeight = (item) => {
          if (item.type === 'expense') {
              if (item.isFixed && item.isFixedVariable) return 1; 
              if (item.isFixed) return 2;                         
              if (item.installmentTotal) return 3;                
          }
          return 4; // Avulsas e Entradas
      };

      const weightA = getWeight(a);
      const weightB = getWeight(b);

      if (weightA !== weightB) return weightA - weightB;

      if (weightA === 4) {
          if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
      }

      return a.description.localeCompare(b.description);
  });

  // Totais
  const monthKey = format(date, 'yyyy-MM');

  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => {
      const val = t.overrides?.[monthKey] !== undefined ? t.overrides[monthKey] : t.amount;
      return acc + Number(val);
  }, 0);

  const totalExpense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      const val = t.overrides?.[monthKey] !== undefined ? t.overrides[monthKey] : t.amount;
      return acc + Number(val);
  }, 0);

  const balance = (salary + totalIncome) - totalExpense;
  const isPositive = balance >= 0;

  return (
    <div className="bg-white w-full h-full rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden relative border border-white/50">
      
      <style>{`
        .smooth-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .smooth-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .smooth-scroll::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
      `}</style>

      {/* --- 1. CABEÇALHO (Fixo) --- */}
      <div className={`p-5 shrink-0 ${isPositive ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-red-500 to-red-600'} text-white shadow-sm z-20`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold capitalize leading-tight">
                {format(displayDate, 'MMMM', { locale: ptBR })}
              </h2>
              <p className="text-sm opacity-80 font-medium">
                {format(displayDate, 'yyyy')}
                {billingOffset > 0 && (
                  <span className="ml-2 text-yellow-200 text-xs font-semibold capitalize">
                    📋 ref. {format(date, 'MMM', { locale: ptBR })}
                  </span>
                )}
              </p>
            </div>
            {onCloseMonth && (
               <button onClick={onCloseMonth} className="bg-blue-400 p-2 rounded-lg hover:bg-blue-300 transition-all ml-1" title="Fechar Mês">
                  <CalendarCheck size={22} className="text-white" />
               </button>
            )}
          </div>
          <div className="text-right">
             <span className="text-[10px] uppercase opacity-75 font-bold block mb-0.5">Disponível</span>
             <div className="text-2xl font-bold tracking-tight">
               R$ {balance.toFixed(2)}
             </div>
          </div>
        </div>
      </div>

      {/* --- 2. ÁREA DE AÇÃO FIXA --- */}
      <div className="p-3 bg-gray-50 border-b border-gray-100 z-10 shrink-0">
        <button 
            onClick={() => onAdd(date)}
            className="w-full py-2 bg-blue-100 border border-gray-200 rounded-xl text-blue-600 font-bold flex items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm active:scale-[0.98]"
        >
            <div className="bg-blue-200 p-1 rounded-full">
                <Plus size={16} />
            </div>
            <span className="text-sm">Novo Lançamento</span>
        </button>
      </div>

      {/* --- 3. LISTA DE CONTAS --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 smooth-scroll bg-white">
        
        {monthTransactions.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">
                Nenhuma conta neste mês.
            </div>
        )}

        {monthTransactions.map((t) => {
             const monthKey = format(date, 'yyyy-MM');
             const isPaid = t.isFixed ? t.paidMonths?.includes(monthKey) : t.isPaid;
             
             const itemAmount = t.overrides && t.overrides[monthKey] !== undefined 
                ? t.overrides[monthKey] 
                : t.amount;

             return (
              <div 
                key={t.id} 
                onClick={() => onEdit(t, date)}
                className={`relative bg-white border border-gray-100 rounded-xl p-3 shadow-sm active:bg-gray-50 transition-all cursor-pointer flex justify-between items-center group ${isPaid ? 'opacity-60 grayscale-[0.5]' : ''}`}
              >
                
                {/* ESQUERDA: Ícone Seta + Texto */}
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    
                    {/* Ícone Seta */}
                    <div className={`shrink-0 ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                        {t.type === 'income' ? <ArrowDown size={20} strokeWidth={2.5} /> : <ArrowUp size={20} strokeWidth={2.5} />}
                    </div>

                    {/* Descrição e Tags */}
                    <div className="min-w-0">
                        <p className={`font-bold text-gray-800 text-md uppercase truncate leading-snug ${isPaid ? 'line-through text-gray-400' : ''}`}>
                            {t.description}
                        </p>
                        
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 flex-wrap">
                            
                            {/* TAG AVULSA (Novo) */}
                            {!t.isFixed && !t.installmentTotal && (
                                <span className="bg-gray-100 text-gray-500 px-1.5 rounded font-bold border border-gray-200">
                                    AVULSA
                                </span>
                            )}

                            {/* TAG FIXA / FIXA VAR */}
                            {t.isFixed && (
                                <span className={`px-1.5 rounded font-bold border ${t.isFixedVariable 
                                    ? 'bg-orange-50 text-orange-600 border-orange-100' 
                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                }`}>
                                    {t.isFixedVariable ? 'FIXA VAR' : 'FIXA'}
                                </span>
                            )}

                            {/* TAG PARCELADA */}
                            {t.installmentTotal && (
                                <span className="bg-purple-50 text-purple-600 px-1.5 rounded font-bold border border-purple-100">
                                    PARC
                                </span>
                            )}

                            {/* TAG PAGO */}
                            {isPaid && <span className="text-green-600 font-bold ml-1">✓ PAGO</span>}
                        </p>
                    </div>
                </div>

                {/* DIREITA: Valor */}
                <div className="text-right shrink-0 ml-2">
                    <p className={`font-bold text-md ${t.type === 'income' ? 'text-green-700' : 'text-red-800'}`}>
                        {t.type === 'income' ? '+' : '-'} {parseFloat(itemAmount).toFixed(2)}
                    </p>
                </div>

              </div>
            );
        })}
        
        <div className="h-4"></div> 
      </div>
      
      {/* --- 4. RODAPÉ (Fixo) --- */}
      <div className="bg-white p-2 text-sm text-gray-700 flex justify-between items-center border-t border-gray-100 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
         <div className="flex gap-3">
            <span className="text-green-600 font-bold bg-green-100 px-2 py-1 rounded-md">+{totalIncome.toFixed(2)}</span>
            <span className="text-red-500 font-bold bg-red-100 px-2 py-1 rounded-md">-{totalExpense.toFixed(2)}</span>
         </div>
         <div className="flex items-center gap-1">
             <span>Salário:</span>
             <span className="font-bold text-gray-700 bg-gray-200 px-2 py-1 rounded-md">R$ {parseFloat(salary).toFixed(2)}</span>
         </div>
      </div>

    </div>
  );
};

export default MonthCard;
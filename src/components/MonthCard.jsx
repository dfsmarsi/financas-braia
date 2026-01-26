import React, { useMemo } from 'react';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MonthCard = ({ date, salary, allTransactions, onDelete, onEdit }) => {
  
  const monthTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (t.isFixed) return true; 
      const tDate = t.date.toDate();
      return isSameMonth(tDate, date);
    });
  }, [allTransactions, date]);

  const totalExpenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
    
  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const finalBalance = (Number(salary) + totalIncome) - totalExpenses;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 flex flex-col h-[70vh] w-full relative">
      <div className="bg-blue-600 p-4 text-white text-center rounded-t-2xl">
        <h2 className="text-2xl font-bold capitalize">
          {format(date, 'MMMM', { locale: ptBR })}
        </h2>
        <p className="opacity-80 text-sm">{format(date, 'yyyy')}</p>
      </div>

      <div className="p-4 bg-blue-50 border-b border-blue-100 space-y-2">
        <div className="flex justify-between text-blue-900 text-sm">
          <span>Salário:</span>
          <span className="font-bold">R$ {parseFloat(salary).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-red-600 text-sm">
          <span>Gastos:</span>
          <span className="font-bold">- R$ {totalExpenses.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold text-blue-900 mt-2 border-t border-blue-200 pt-2">
          <span>Restante:</span>
          <span className={finalBalance >= 0 ? "text-green-600" : "text-red-600"}>
            R$ {finalBalance.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <table className="w-full text-left text-sm">
          <thead className="text-blue-400 border-b">
            <tr>
              <th className="pb-2 pl-2">Descrição</th>
              <th className="pb-2 text-right pr-2">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monthTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-blue-50 group">
                <td className="py-3 pl-2 text-gray-700">
                  {t.description} 
                  {t.isFixed && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">FIXO</span>}
                </td>
                <td className={`py-3 pr-2 text-right font-bold ${t.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                  {t.type === 'expense' ? '-' : '+'} {Number(t.amount).toFixed(2)}
                  
                  {/* BOTÕES DE AÇÃO */}
                  <div className="inline-flex ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(t)} className="text-blue-400 hover:text-blue-600 mr-2" title="Editar">
                      ✎
                    </button>
                    <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-500" title="Excluir">
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthCard;
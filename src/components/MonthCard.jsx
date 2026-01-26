// src/components/MonthCard.jsx
import React, { useMemo } from 'react';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus } from 'lucide-react';

const MonthCard = ({ date, salary, allTransactions, onDelete, onEdit, onAdd }) => {

  const monthKey = format(date, 'yyyy-MM'); // Chave única do mês ex: "2024-02"

  // 1. Processar Transações
  const processedTransactions = useMemo(() => {
    return allTransactions
      .filter(t => {
        // Se for Fixa, entra sempre. Se for normal, checa a data.
        if (t.isFixed) return true;
        const tDate = t.date.toDate();
        return isSameMonth(tDate, date);
      })
      .map(t => {
        // LÓGICA DE VALOR DINÂMICO PARA CONTA FIXA VARIÁVEL
        if (t.isFixedVariable) {
          // Verifica se existe um override para este mês específico
          const overrideValue = t.overrides && t.overrides[monthKey];
          // Se existir override, usa ele. Se não, usa o valor base (que geralmente será 0)
          return { ...t, amount: overrideValue !== undefined ? Number(overrideValue) : Number(t.amount) };
        }
        return t;
      });
  }, [allTransactions, date, monthKey]);

  // 2. Cálculos
  const totalExpenses = processedTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalIncome = processedTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const finalBalance = (Number(salary) + totalIncome) - totalExpenses;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 flex flex-col h-[70vh] w-full relative">

      {/* Cabeçalho com Botão de Adicionar */}
      <div className="bg-blue-600 p-4 text-white flex justify-between items-center rounded-t-2xl">
        <div className="flex-1">
          <h2 className="text-2xl font-bold capitalize leading-none">
            {format(date, 'MMMM', { locale: ptBR })}
          </h2>
          <p className="opacity-80 text-xs">{format(date, 'yyyy')}</p>
        </div>
        <button
          onClick={() => onAdd(date)}
          className="bg-white text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors shadow-sm"
          title="Adicionar neste mês"
        >
          <Plus size={20} strokeWidth={3} />
        </button>
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
          <tbody className="divide-y divide-gray-100">
            {processedTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-blue-50 group">
                <td className="py-3 pl-2 text-gray-700">
                  <div className="font-medium">{t.description}</div>
                  {t.isFixed && !t.isFixedVariable && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">FIXO</span>}
                  {t.isFixedVariable && <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded">FIXO VAR</span>}
                  {t.installmentTotal && <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">PARC</span>}
                </td>
                <td className={`py-3 pr-2 text-right font-bold ${t.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                  {t.type === 'expense' ? '-' : '+'} {Number(t.amount).toFixed(2)}

                  <div className="inline-flex ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(t, date)} className="text-blue-400 hover:text-blue-600 mr-2">✎</button>
                    <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-500">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {processedTransactions.length === 0 && <p className="text-center text-gray-300 mt-4 text-xs">Vazio</p>}
      </div>
    </div>
  );
};

export default MonthCard;
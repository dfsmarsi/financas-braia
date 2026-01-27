// src/components/MonthCard.jsx
import React, { useMemo } from 'react';
import { format, isSameMonth, startOfMonth, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2 } from 'lucide-react'; 

const MonthCard = ({ date, salary, allTransactions, onDelete, onEdit, onAdd }) => {
  
  const monthKey = format(date, 'yyyy-MM'); 

  const processedTransactions = useMemo(() => {
    return allTransactions
      .filter(t => {
        const tDate = t.date.toDate();
        const cardMonthStart = startOfMonth(date);

        // LÓGICA DE CONTA FIXA
        if (t.isFixed) {
            // 1. Não mostrar se o mês do card for ANTERIOR à criação
            if (isBefore(cardMonthStart, startOfMonth(tDate))) {
                return false;
            }
            // 2. Não mostrar se a conta já foi ENCERRADA
            if (t.endDate) {
                const endDate = t.endDate.toDate();
                if (isAfter(cardMonthStart, startOfMonth(endDate))) {
                    return false;
                }
            }
            return true;
        }

        // LÓGICA DE CONTA AVULSA/PARCELADA
        return isSameMonth(tDate, date);
      })
      .map(t => {
        if (t.isFixedVariable) {
          const overrideValue = t.overrides && t.overrides[monthKey];
          return { ...t, amount: overrideValue !== undefined ? Number(overrideValue) : Number(t.amount) };
        }
        return t;
      });
  }, [allTransactions, date, monthKey]);

  const totalExpenses = processedTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
    
  const totalIncome = processedTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const finalBalance = (Number(salary) + totalIncome) - totalExpenses;

  const renderTag = (t) => {
    const baseClasses = "text-[10px] px-2 py-1 rounded font-bold border min-w-[80px] text-center flex justify-center uppercase tracking-wider";

    if (t.isFixedVariable) return <span className={`${baseClasses} bg-orange-100 text-orange-700 border-orange-200`}>Fixo Var</span>;
    if (t.isFixed) return <span className={`${baseClasses} bg-blue-100 text-blue-700 border-blue-200`}>Fixo</span>;
    if (t.installmentTotal) return <span className={`${baseClasses} bg-purple-100 text-purple-700 border-purple-200`}>Parc {t.installmentCurrent}/{t.installmentTotal}</span>;
    return <span className={`${baseClasses} bg-gray-200 text-gray-600 border-gray-300`}>Avulsa</span>;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-blue-600 flex flex-col h-[80vh] w-full relative">
      
      {/* Cabeçalho */}
      <div className="bg-blue-600 p-4 text-white flex justify-between items-center rounded-t-2xl">
        <div className="flex-1">
            <h2 className="text-2xl font-bold capitalize leading-none">{format(date, 'MMMM', { locale: ptBR })}</h2>
            <p className="opacity-80 text-xs">{format(date, 'yyyy')}</p>
        </div>
        <button onClick={() => onAdd(date)} className="bg-white text-blue-600 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors shadow-sm">
             <Plus size={22} strokeWidth={3} />
        </button>
      </div>

      {/* Resumo Financeiro */}
      <div className="p-4 bg-blue-50 border-b border-blue-100 space-y-2">
        <div className="flex justify-between text-blue-900 text-md">
          <span>Salário:</span>
          <span className="font-bold">R$ {parseFloat(salary).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-green-600 text-md">
          <span>Entradas:</span>
          <span className="font-bold">+ R$ {totalIncome.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-red-600 text-md">
          <span>Saídas:</span>
          <span className="font-bold">- R$ {totalExpenses.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold text-blue-900 mt-2 border-t border-blue-200 pt-2">
          <span>Restante:</span>
          <span className={finalBalance >= 0 ? "text-blue-900" : "text-red-600"}>R$ {finalBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="flex-1 overflow-y-auto rounded-b-2xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-blue-200 sticky top-0 z-10 shadow-sm">
            <tr>
               <th className="py-3 pl-4 text-sm font-semibold text-blue-900">Descrição</th>
               <th className="py-3 pr-4 text-right text-sm font-semibold text-blue-900">Valor</th>
            </tr>
          </thead>
          <tbody>
            {processedTransactions.map((t) => {
              // Verifica se é liquidada (pela flag nova ou pelo texto antigo)
              const isLiquidated = t.isLiquidated || (t.description && t.description.toLowerCase().includes('liquidada'));
              
              // Limpa o texto da descrição para exibição (tira o sufixo antigo se existir)
              let displayDesc = t.description;
              if (displayDesc) {
                  displayDesc = displayDesc.split(' / Liquidada')[0].replace(' (Liquidado)', '');
              }

              return (
              <tr key={t.id} className="group even:bg-blue-50/80 transition-colors border-b border-blue-100/100">
                <td className="py-4 pl-4 text-gray-800 align-middle">
                  
                  {/* Descrição + Tag Liquidada (lado a lado) */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                      <div className="text-base font-medium text-gray-900">{displayDesc}</div>
                      
                      {isLiquidated && (
                        // AQUI ESTÁ A ALTERAÇÃO NO TEXTO DA TAG
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 font-bold whitespace-nowrap">
                            Liquidada(as): {t.liquidatedCount || 1}
                        </span>
                      )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {renderTag(t)}
                    <div className="h-4 w-px bg-gray-300 mx-1 hidden md:block"></div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => onEdit(t, date)} className="text-blue-400 hover:text-blue-700 transition-colors flex items-center gap-1 p-1 hover:bg-blue-100 rounded">
                            <Pencil size={15} />
                        </button>
                        <button onClick={() => onDelete(t)} className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 p-1 hover:bg-gray-300 rounded">
                            <Trash2 size={15} />
                        </button>
                    </div>
                  </div>
                </td>
                <td className={`py-4 pr-4 text-right font-bold align-middle ${t.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                  <span className="text-lg whitespace-nowrap">{t.type === 'expense' ? '-' : '+'} {Number(t.amount).toFixed(2)}</span>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        {processedTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <p>Nenhuma conta lançada.</p>
                <button onClick={() => onAdd(date)} className="mt-2 text-blue-500 font-bold hover:underline">Adicionar agora</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default MonthCard;
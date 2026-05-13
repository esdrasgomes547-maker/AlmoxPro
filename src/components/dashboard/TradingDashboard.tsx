import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const data = [
  { name: '0', value: 3 },
  { name: '2', value: 2.5 },
  { name: '4', value: 4 },
  { name: '6', value: 3.5 },
  { name: '8', value: 5 },
  { name: '10', value: 4.8 },
  { name: '12', value: 6 },
];

const activity = [
  { label: "Venda: Produto D (3un)", value: "R$ 120,00", type: 'positive' },
  { label: "Ajuste: Produto E (1un)", value: "- R$ 55,00", type: 'negative' },
  { label: "Venda: Produto A (1un)", value: "R$ 1.200,00", type: 'positive' },
  { label: "Venda: Produto B (2un)", value: "R$ 450,00", type: 'positive' },
];

export function TradingDashboard() {
  return (
    <div className="bg-[#0D1117] p-6 rounded-xl border border-border">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-white/70 text-sm font-bold tracking-widest uppercase">
          Total Valor de Venda do Estoque
        </h2>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-white text-4xl font-bold font-mono">R$ 45.312,80</span>
          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded font-medium">
            +3.2% (↑)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Chart Card */}
        <Card className="lg:col-span-2 bg-[#161B22] border-green-500/30 shadow-none">
          <CardContent className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#30363d" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363d', borderRadius: '8px' }}
                    itemStyle={{ color: '#00ffaa' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#00ffaa" 
                    strokeWidth={3} 
                    fill="url(#colorValue)" 
                    fillOpacity={0.1}
                />
                <defs>
                   <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ffaa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00ffaa" stopOpacity={0}/>
                    </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-[10px] text-white/40">
              <span>Baseado em 283 itens</span>
              <span>Últimos 30 dias</span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Ticker */}
        <Card className="bg-[#161B22] border-none shadow-none">
          <CardContent className="p-6">
            <h3 className="text-white/70 text-[10px] font-bold uppercase mb-4">Fluxo de Caixa (Real-Time)</h3>
            <div className="space-y-4">
              {activity.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-white/70 truncate flex-1">{item.label}</span>
                  <span className={cn("font-mono font-bold ml-2", item.type === 'positive' ? 'text-green-400' : 'text-red-400')}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-4 border-t border-white/10">
                <span className="text-white/50 text-[11px]">Top 3 SKUs por Valor:</span>
                <p className="text-white text-[11px] mt-1">1. Válvula Clesse - R$ 12k</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

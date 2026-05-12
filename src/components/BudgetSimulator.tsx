import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, Search, Plus, Minus, FileText, Download, Calculator, Trash2 } from 'lucide-react';
import { InventoryItem } from '../types';
import {
  formatBRL,
  formatNumber,
  preciseMultiply,
  preciseSum,
  normalizeSearch,
  generateBudgetPDF,
  exportToCSV,
} from '../lib/exportService';

interface BudgetItem {
  inventoryItem: InventoryItem;
  qty: number;
  unitPrice: number;
  total: number;
}

interface BudgetSimulatorProps {
  inventory: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function BudgetSimulator({ inventory, isOpen, onClose }: BudgetSimulatorProps) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(true);

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    const normalized = normalizeSearch(searchTerm);
    return inventory.filter(item =>
      normalizeSearch(item.name).includes(normalized) ||
      normalizeSearch(item.id).includes(normalized) ||
      normalizeSearch(item.category).includes(normalized)
    );
  }, [inventory, searchTerm]);

  const grandTotal = useMemo(() => {
    return preciseSum(budgetItems.map(item => item.total));
  }, [budgetItems]);

  const addItem = (item: InventoryItem) => {
    const existing = budgetItems.find(b => b.inventoryItem.id === item.id);
    if (existing) {
      updateQty(item.id, existing.qty + 1);
      return;
    }
    setBudgetItems(prev => [...prev, {
      inventoryItem: item,
      qty: 1,
      unitPrice: item.price,
      total: item.price,
    }]);
  };

  const removeItem = (itemId: string) => {
    setBudgetItems(prev => prev.filter(b => b.inventoryItem.id !== itemId));
  };

  const updateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId);
      return;
    }
    setBudgetItems(prev => prev.map(b => {
      if (b.inventoryItem.id !== itemId) return b;
      const total = preciseMultiply(newQty, b.unitPrice);
      return { ...b, qty: newQty, total };
    }));
  };

  const updatePrice = (itemId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setBudgetItems(prev => prev.map(b => {
      if (b.inventoryItem.id !== itemId) return b;
      const total = preciseMultiply(b.qty, newPrice);
      return { ...b, unitPrice: newPrice, total };
    }));
  };

  const clearBudget = () => {
    setBudgetItems([]);
    setClientName('');
    setNotes('');
  };

  const handleExportPDF = () => {
    const items = budgetItems.map(b => ({
      name: b.inventoryItem.name,
      qty: b.qty,
      unitPrice: b.unitPrice,
      total: b.total,
    }));
    generateBudgetPDF(items, clientName, notes);
  };

  const handleExportCSV = () => {
    const headers = ['Material', 'Quantidade', 'Valor Unitário (R$)', 'Subtotal (R$)'];
    const rows = budgetItems.map(b => [
      b.inventoryItem.name,
      b.qty,
      b.unitPrice,
      b.total,
    ]);
    rows.push(['TOTAL DO ORÇAMENTO', '', '', grandTotal]);
    exportToCSV(headers, rows as any, 'orcamento_almoxpro');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-5xl shadow-xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <CardTitle className="text-xl">Simulação de Orçamento</CardTitle>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                Monte um orçamento e exporte em PDF ou planilha
              </p>
            </div>
          </div>
          <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={onClose}>
            <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Painel de Seleção de Itens */}
          {showAddPanel && (
            <div className="w-full lg:w-[340px] p-4 border-b lg:border-b-0 lg:border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 flex flex-col shrink-0 max-h-[300px] lg:max-h-none overflow-hidden">
              <div className="relative mb-3">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="text"
                  placeholder="Buscar material..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredInventory.map(item => {
                  const isAdded = budgetItems.some(b => b.inventoryItem.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors border ${
                        isAdded
                          ? 'bg-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/20'
                          : 'border-transparent hover:bg-[hsl(var(--accent))]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate pr-2">{item.name}</span>
                        {isAdded ? (
                          <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 rounded">
                            ADICIONADO
                          </span>
                        ) : (
                          <Plus className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">{item.id}</span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">•</span>
                        <span className="text-xs font-medium text-[hsl(var(--primary))]">{formatBRL(item.price)}</span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">• Estoque: {item.qty}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredInventory.length === 0 && (
                  <div className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">
                    Nenhum material encontrado.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Painel do Orçamento */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Info do Cliente */}
            <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">
                    Nome do Cliente (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">
                    Observações
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Válido por 15 dias"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tabela do Orçamento */}
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center w-[140px]">Quantidade</TableHead>
                    <TableHead className="text-right w-[130px]">Valor Unit.</TableHead>
                    <TableHead className="text-right w-[130px]">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetItems.map((budgetItem) => (
                    <TableRow key={budgetItem.inventoryItem.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{budgetItem.inventoryItem.name}</div>
                        <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                          {budgetItem.inventoryItem.id} • {budgetItem.inventoryItem.category}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            className="h-7 w-7 rounded-md border border-[hsl(var(--border))] flex items-center justify-center hover:bg-[hsl(var(--accent))] transition-colors"
                            onClick={() => updateQty(budgetItem.inventoryItem.id, budgetItem.qty - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={budgetItem.qty}
                            onChange={(e) => updateQty(budgetItem.inventoryItem.id, Number(e.target.value) || 0)}
                            className="w-14 h-7 text-center text-sm font-mono font-medium border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--background))] focus:ring-1 focus:ring-[hsl(var(--primary))] outline-none"
                          />
                          <button
                            className="h-7 w-7 rounded-md border border-[hsl(var(--border))] flex items-center justify-center hover:bg-[hsl(var(--accent))] transition-colors"
                            onClick={() => updateQty(budgetItem.inventoryItem.id, budgetItem.qty + 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={budgetItem.unitPrice}
                          onChange={(e) => updatePrice(budgetItem.inventoryItem.id, parseFloat(e.target.value) || 0)}
                          className="w-24 h-7 text-right text-sm font-mono border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--background))] px-2 focus:ring-1 focus:ring-[hsl(var(--primary))] outline-none"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm">
                        {formatBRL(budgetItem.total)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeItem(budgetItem.inventoryItem.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-[hsl(var(--muted-foreground))] hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {budgetItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-[hsl(var(--muted-foreground))]">
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Selecione materiais à esquerda para montar o orçamento.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer com total e ações */}
            <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">
                    Total do Orçamento
                  </div>
                  <div className="text-2xl font-black text-[hsl(var(--primary))] font-mono">
                    {formatBRL(grandTotal)}
                  </div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {budgetItems.length} {budgetItems.length === 1 ? 'item' : 'itens'} • {budgetItems.reduce((a, b) => a + b.qty, 0)} unidades
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {budgetItems.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearBudget} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Limpar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={budgetItems.length === 0}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Google Sheets
                  </Button>
                  <Button size="sm" onClick={handleExportPDF} disabled={budgetItems.length === 0}>
                    <FileText className="h-4 w-4 mr-1.5" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

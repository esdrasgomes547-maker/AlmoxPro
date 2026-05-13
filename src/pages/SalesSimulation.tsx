import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2 } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { useOrganization } from "../lib/tenant";

export function SalesSimulation() {
  const { orgId } = useOrganization();
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ id: string, name: string, price: number, qty: number }[]>([]);
  const [currentItem, setCurrentItem] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/inventory`), limit(2000));
    const unsub = onSnapshot(q, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/inventory`));
    return () => unsub();
  }, [orgId]);

  const addItem = () => {
    const product = inventory.find(i => i.id === currentItem);
    if (product) {
      setSelectedItems([...selectedItems, { id: product.id, name: product.name, price: product.price, qty }]);
    }
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.id !== id));
  };

  const total = useMemo(() => selectedItems.reduce((sum, item) => sum + (item.price * item.qty), 0), [selectedItems]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text(`Simulação de Venda - ${new Date().toLocaleDateString()}`, 14, 15);
    
    const tableData = selectedItems.map(item => [
      item.name,
      item.qty.toString(),
      `R$ ${item.price.toFixed(2)}`,
      `R$ ${(item.qty * item.price).toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [['Produto', 'Quantidade', 'Valor Unitário', 'Total']],
      body: tableData,
      startY: 20,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Total da Simulação: R$ ${total.toFixed(2)}`, 14, finalY);
    
    doc.save('simulacao_venda.pdf');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Simulação de Venda</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-4">
            <select 
                value={currentItem}
                onChange={e => setCurrentItem(e.target.value)}
                className="w-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Selecione um produto</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>{item.name} (R$ {item.price.toFixed(2)})</option>
              ))}
            </select>
            <input 
                type="number" 
                min={1} 
                value={qty} 
                onChange={e => setQty(Number(e.target.value))} 
                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Valor Unitário</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>R$ {item.price.toFixed(2)}</TableCell>
                  <TableCell>R$ {(item.qty * item.price).toFixed(2)}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="font-bold text-lg">Total: R$ {total.toFixed(2)}</div>
            <Button onClick={downloadPDF}><Download className="mr-2 h-4 w-4" /> Baixar Resumo</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

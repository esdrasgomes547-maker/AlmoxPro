import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileBarChart } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { useOrganization } from "../lib/tenant";

export function Reports() {
  const { orgId } = useOrganization();
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/inventory`), limit(2000));
    const unsub = onSnapshot(q, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/inventory`));
    return () => unsub();
  }, [orgId]);

  const reportData = useMemo(() => {
    const data: Record<string, { qty: number, totalValue: number }> = {};
    inventory.forEach(item => {
      if (!data[item.category]) {
        data[item.category] = { qty: 0, totalValue: 0 };
      }
      data[item.category].qty += item.qty;
      data[item.category].totalValue += (item.qty * item.price);
    });
    return data;
  }, [inventory]);

  const grandTotal = Object.values(reportData).reduce((sum, cat) => sum + cat.totalValue, 0);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatório de Inventário Completo - ${new Date().toLocaleDateString()}`, 14, 15);
    
    const tableData = inventory.map(item => [
      item.name,
      item.category,
      item.qty.toString(),
      `R$ ${item.price.toFixed(2)}`,
      `R$ ${(item.qty * item.price).toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [['Produto', 'Categoria', 'Quantidade', 'Valor Un.', 'Total Venda']],
      body: tableData,
      startY: 20,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Valor Total do Inventário: R$ ${grandTotal.toFixed(2)}`, 14, finalY);
    
    doc.save('relatorio_inventario_completo.pdf');
  };

  const downloadCSV = () => {
    const headers = ['Produto', 'Categoria', 'Quantidade', 'Valor Un.', 'Total Venda'];
    const rows = inventory.map(item => [
      item.name,
      item.category,
      item.qty,
      item.price.toFixed(2),
      (item.qty * item.price).toFixed(2)
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "relatorio_inventario.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Relatórios de Inventário</h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCSV}><Download className="mr-2 h-4 w-4" /> Baixar CSV</Button>
            <Button onClick={downloadPDF}><Download className="mr-2 h-4 w-4" /> Baixar PDF</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventário Total Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Quantidade Disponível</TableHead>
                <TableHead>Valor Total de Venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(reportData).map(([cat, data]) => (
                <TableRow key={cat}>
                  <TableCell className="font-medium">{cat}</TableCell>
                  <TableCell>{data.qty}</TableCell>
                  <TableCell>R$ {data.totalValue.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 p-4 bg-muted rounded-lg font-bold text-lg">
            Soma Total Valor de Venda: R$ {grandTotal.toFixed(2)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

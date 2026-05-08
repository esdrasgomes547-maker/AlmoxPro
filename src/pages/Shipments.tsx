import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Download, ArrowUpRight, ArrowDownRight, PackageCheck, Send, CheckCircle2, Clock, X, Trash2, Edit2, Mail, Phone } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc } from "firebase/firestore";
import { sendWhatsAppNotification, sendEmailReport, generateShipmentsReport } from "../lib/notificationService";
import { useOrganization } from "../lib/tenant";

const initialShipments: any[] = [];

export function Shipments() {
  const { orgId } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [shipments, setShipments] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newShipmentForm, setNewShipmentForm] = useState({ destination: "", items: 1, driver: "", vehicle: "", status: "PENDING" });

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/shipments`));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setShipments(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/shipments`);
    });
    return () => unsub();
  }, [orgId]);

  const filteredData = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return shipments.filter(item => 
      item.destination.toLowerCase().includes(term) || 
      item.id.toLowerCase().includes(term)
    );
  }, [shipments, searchTerm]);

  const { entregasHoje, emPreparacao } = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      entregasHoje: shipments.filter(s => s.status === 'DELIVERED' && s.date === todayStr).length,
      emPreparacao: shipments.filter(s => s.status === 'PREPARING').length
    };
  }, [shipments]);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setNewShipmentForm({
      destination: item.destination,
      items: item.items,
      driver: item.driver || "",
      vehicle: item.vehicle || "",
      status: item.status || "PENDING"
    });
    setIsAddModalOpen(true);
  };

  const handleSaveShipment = async () => {
    if (!orgId) return;
    const newShipment = {
      ...newShipmentForm,
      date: new Date().toISOString().split('T')[0], // we might want to preserve the old date if editing, but for simplicity let's keep it or just don't overwrite if edit
    };
    
    try {
      if (editingId) {
        // preserve the original date if editing
        const existing = shipments.find(s => s.id === editingId);
        await setDoc(doc(db, `organizations/${orgId}/shipments`, editingId), { ...newShipment, date: existing?.date || newShipment.date }, { merge: true });
      } else {
        const newId = `EXP-${String(Math.floor(Math.random() * 10000) + 23400)}`;
        await setDoc(doc(db, `organizations/${orgId}/shipments`, newId), newShipment);
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setNewShipmentForm({ destination: "", items: 1, driver: "", vehicle: "", status: "PENDING" });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/shipments/${editingId || 'new'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if(!orgId) return;
    if(window.confirm("Deseja apagar esta expedição?")) {
      try {
        await deleteDoc(doc(db, `organizations/${orgId}/shipments`, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/shipments/${id}`);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'DELIVERED': return <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Entregue</Badge>;
      case 'SHIPPED': return <Badge variant="default" className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600"><Send className="h-3 w-3" /> Em Trânsito</Badge>;
      case 'PREPARING': return <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10"><PackageCheck className="h-3 w-3" /> Separando</Badge>;
      case 'PENDING': return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expedição</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Gerencie as saídas e entregas de materiais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const report = generateShipmentsReport(shipments);
            sendEmailReport("", "Relatório de Expedições - TECGAS", report);
          }}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => {
            const report = generateShipmentsReport(shipments);
            sendWhatsAppNotification("", report);
          }}>
            <Phone className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Expedição
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
            <Send className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entregasHoje}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Preparação</CardTitle>
            <PackageCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emPreparacao}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-2 w-full max-w-sm relative">
            <Search className="h-4 w-4 absolute left-3 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text" 
              placeholder="Buscar por ID ou destino..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
            />
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex shrink-0">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </CardHeader>
        <CardContent className="p-0 mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Expedição</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="hidden lg:table-cell">Motorista / Veículo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium text-xs">{item.id}</TableCell>
                  <TableCell className="font-medium">{item.destination}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-[hsl(var(--muted-foreground))]">{new Date(item.date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-center font-mono">{item.items}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-sm">{item.driver}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.vehicle}</div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end space-x-1">
                    <Button variant="ghost" size="sm" className="h-8 text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" onClick={() => handleEdit(item)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhuma expedição encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Shipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
              <CardTitle className="text-xl">{editingId ? 'Editar Expedição' : 'Nova Expedição'}</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Destino</label>
                <input 
                  type="text" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  placeholder="Ex: Filial Sul - Curitiba"
                  value={newShipmentForm.destination}
                  onChange={(e) => setNewShipmentForm({...newShipmentForm, destination: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motorista</label>
                  <input 
                    type="text" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="Ex: João Souza"
                    value={newShipmentForm.driver}
                    onChange={(e) => setNewShipmentForm({...newShipmentForm, driver: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Veículo</label>
                  <input 
                    type="text" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="Ex: DEF-5678"
                    value={newShipmentForm.vehicle}
                    onChange={(e) => setNewShipmentForm({...newShipmentForm, vehicle: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantidade de Itens</label>
                <input 
                  type="number" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  value={newShipmentForm.items}
                  onChange={(e) => setNewShipmentForm({...newShipmentForm, items: Number(e.target.value)})}
                />
              </div>
              <div className="pt-4 flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveShipment} disabled={!newShipmentForm.destination}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

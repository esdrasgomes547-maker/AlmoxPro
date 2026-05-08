import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Download, Star, Phone, Mail, X, Trash2, Edit2 } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { sendWhatsAppNotification, sendEmailReport, generateSuppliersReport } from "../lib/notificationService";
import { useOrganization } from "../lib/tenant";

const initialSuppliers: any[] = [];

export function Suppliers() {
  const { orgId } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: "", category: "Conexões", phone: "", email: "" });

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/suppliers`));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSuppliers(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/suppliers`);
    });
    return () => unsub();
  }, [orgId]);

  const filteredData = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return suppliers.filter(item => 
      item.name.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setNewSupplierForm({
      name: item.name,
      category: item.category,
      phone: item.phone || "",
      email: item.email || ""
    });
    setIsAddModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!orgId) return;
    try {
      if (editingId) {
        // We preserve rating and status using updateDoc
        await updateDoc(doc(db, `organizations/${orgId}/suppliers`, editingId), newSupplierForm);
      } else {
        const newId = `FOR-${String(Math.floor(Math.random() * 1000) + 100).padStart(3, '0')}`;
        const newSupplier = {
          ...newSupplierForm,
          rating: 0,
          status: "REVIEW_NEEDED",
        };
        await setDoc(doc(db, `organizations/${orgId}/suppliers`, newId), newSupplier);
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setNewSupplierForm({ name: "", category: "Conexões", phone: "", email: "" });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/suppliers/${editingId || 'new'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if(!orgId) return;
    if(window.confirm("Deseja apagar este fornecedor?")) {
      try {
        await deleteDoc(doc(db, `organizations/${orgId}/suppliers`, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/suppliers/${id}`);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ACTIVE': return <Badge variant="success">Ativo</Badge>;
      case 'INACTIVE': return <Badge variant="secondary">Inativo</Badge>;
      case 'REVIEW_NEEDED': return <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">Em Revisão</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Gerencie seus contatos e avaliações de fornecedores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const report = generateSuppliersReport(suppliers);
            sendEmailReport("", "Relatório de Fornecedores - TECGAS", report);
          }}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => {
            const report = generateSuppliersReport(suppliers);
            sendWhatsAppNotification("", report);
          }}>
            <Phone className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-2 w-full max-w-sm relative">
            <Search className="h-4 w-4 absolute left-3 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou categoria..." 
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
                <TableHead>Fornecedor</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">Contato</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="truncate max-w-[200px]">{item.name}</div>
                    <div className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{item.id}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{item.category}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-[hsl(var(--muted-foreground))]" /> {item.phone}</div>
                    <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]"><Mail className="h-3 w-3" /> <a href={`mailto:${item.email}`} className="hover:underline">{item.email}</a></div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400 mr-1" />
                      <span className="font-medium text-sm">{item.rating.toFixed(1)}</span>
                    </div>
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
                  <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum fornecedor encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
              <CardTitle className="text-xl">{editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Fornecedor</label>
                <input 
                  type="text" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  placeholder="Ex: Empresa xyz S/A"
                  value={newSupplierForm.name}
                  onChange={(e) => setNewSupplierForm({...newSupplierForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  value={newSupplierForm.category}
                  onChange={(e) => setNewSupplierForm({...newSupplierForm, category: e.target.value})}
                >
                  <option>Conexões</option>
                  <option>Tubulações</option>
                  <option>Equipamentos</option>
                  <option>Ferramentas</option>
                  <option>EPI</option>
                  <option>Outros</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone</label>
                  <input 
                    type="tel" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="(00) 0000-0000"
                    value={newSupplierForm.phone}
                    onChange={(e) => setNewSupplierForm({...newSupplierForm, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input 
                    type="email" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="email@empresa.com"
                    value={newSupplierForm.email}
                    onChange={(e) => setNewSupplierForm({...newSupplierForm, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveSupplier} disabled={!newSupplierForm.name}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

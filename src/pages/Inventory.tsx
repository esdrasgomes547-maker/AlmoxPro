import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, Plus, Download, Filter, History, X, ArrowUpRight, ArrowDownRight, Trash2, Edit2, Archive, Phone, Mail, Database } from "lucide-react";
import { db, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { sendWhatsAppNotification, sendEmailReport, generateInventoryReport } from "../lib/notificationService";
import { useOrganization } from "../lib/tenant";

export function Inventory() {
  const { orgId } = useOrganization();
  const [searchParams] = useSearchParams();
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [newMovement, setNewMovement] = useState({ type: "IN", qty: 0, reason: "" });

  useEffect(() => {
    if (!selectedProduct || !orgId) {
      setHistory([]);
      return;
    }
    const q = query(collection(db, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`));
    const unsub = onSnapshot(q, (snap) => {
      const h = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(h);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`));
    return () => unsub();
  }, [selectedProduct, orgId]);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/inventory`));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/inventory`);
    });
    return () => unsub();
  }, [orgId]);

  const filteredData = React.useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return inventory.filter(item => 
      item.name.toLowerCase().includes(lowerTerm) || 
      item.id.toLowerCase().includes(lowerTerm)
    );
  }, [inventory, searchTerm]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedItems(e.target.checked ? filteredData.map(item => item.id) : []);
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, id] : prev.filter(item => item !== id));
  };

  const handleDeleteSelected = async () => {
    if(!orgId) return;
    if(window.confirm(`Tem certeza que deseja arquivar ${selectedItems.length} produtos?`)) {
      for (const id of selectedItems) {
        try {
          await deleteDoc(doc(db, `organizations/${orgId}/inventory`, id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/inventory/${id}`);
        }
      }
      setSelectedItems([]);
    }
  };

  const handleUpdateStatus = async () => {
    if (!orgId) return;
    for (const id of selectedItems) {
      const item = inventory.find(i => i.id === id);
      if (item) {
        try {
          await updateDoc(doc(db, `organizations/${orgId}/inventory`, id), {
            status: 'OK',
            qty: Math.max(item.qty, item.minQty + 10)
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}/inventory/${id}`);
        }
      }
    }
    setSelectedItems([]);
  };

  const seedGLPCatalog = async () => {
    if (!orgId) return;
    const glpParts = [
      { name: "Tubo de Cobre Classe A 15mm", category: "Tubulações", location: "A1", minQty: 50, price: 45.0, qty: 100 },
      { name: "Válvula Esfera Angular 1/2\"", category: "Conexões", location: "B2", minQty: 20, price: 35.5, qty: 45 },
      { name: "Regulador de Pressão 1º Estágio Azul", category: "Equipamentos", location: "C1", minQty: 5, price: 120.0, qty: 12 },
      { name: "Manômetro 0-10 bar GLP", category: "Ferramentas", location: "C3", minQty: 10, price: 85.0, qty: 15 },
      { name: "Luva de Raspa", category: "EPI", location: "E1", minQty: 30, price: 25.0, qty: 40 },
      { name: "Válvula de Retenção de Latão 3/4\"", category: "Conexões", location: "B3", minQty: 15, price: 65.0, qty: 25 },
      { name: "Pig Tail 50cm P02", category: "Conexões", location: "B4", minQty: 20, price: 45.0, qty: 18 },
      { name: "Manifold 2+2 Cilíndros", category: "Equipamentos", location: "D1", minQty: 2, price: 450.0, qty: 5 },
    ];
    
    for (const part of glpParts) {
      const newId = `GLP-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
      const status = part.qty <= part.minQty ? 'WARNING' : 'OK';
      try {
        await setDoc(doc(db, `organizations/${orgId}/inventory`, newId), { ...part, status });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}/inventory/${newId}`);
      }
    }
  };

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: "", category: "Conexões", location: "", qty: 0, minQty: 10, price: 0 });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newItemForm.name.trim()) errors.name = "O nome é obrigatório.";
    if (!newItemForm.category.trim()) errors.category = "A categoria é obrigatória.";
    if (!newItemForm.location.trim()) errors.location = "A localização é obrigatória.";
    if (newItemForm.qty < 0) errors.qty = "A quantidade não pode ser negativa.";
    if (newItemForm.minQty < 0) errors.minQty = "A quantidade mínima não pode ser negativa.";
    if (newItemForm.price < 0) errors.price = "O valor não pode ser negativo.";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (field: string, value: any) => {
    setNewItemForm(prev => ({ ...prev, [field]: value }));
    const errorMsg = validateField(field, value);
    setFormErrors(prev => ({
      ...prev,
      [field]: errorMsg
    }));
  };

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'name': return !value.trim() ? "O nome é obrigatório." : "";
      case 'category': return !value.trim() ? "A categoria é obrigatória." : "";
      case 'location': return !value.trim() ? "A localização é obrigatória." : "";
      case 'qty': return value < 0 ? "A quantidade não pode ser negativa." : "";
      case 'minQty': return value < 0 ? "A quantidade mínima não pode ser negativa." : "";
      case 'price': return value < 0 ? "O valor não pode ser negativo." : "";
      default: return "";
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setNewItemForm({
      name: item.name,
      category: item.category,
      location: item.location,
      qty: item.qty,
      minQty: item.minQty,
      price: item.price || 0
    });
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!validateForm() || !orgId) return;

    let newStatus = 'OK';
    if(newItemForm.qty <= 0) newStatus = 'OUT_OF_STOCK';
    else if(newItemForm.qty <= newItemForm.minQty) newStatus = 'CRITICAL';
    else if(newItemForm.qty <= newItemForm.minQty + 5) newStatus = 'WARNING';

    const newProduct = {
      ...newItemForm,
      status: newStatus,
    };
    
    try {
      if (editingId) {
        await updateDoc(doc(db, `organizations/${orgId}/inventory`, editingId), newProduct);
      } else {
        const newId = `GLP-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
        await setDoc(doc(db, `organizations/${orgId}/inventory`, newId), newProduct);
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setFormErrors({});
      setNewItemForm({ name: "", category: "Conexões", location: "", qty: 0, minQty: 10, price: 0 });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/inventory/${editingId || 'new'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OK': return <Badge variant="success">Em Estoque</Badge>;
      case 'WARNING': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">Atenção</Badge>;
      case 'CRITICAL': return <Badge variant="destructive">Estoque Crítico</Badge>;
      case 'OUT_OF_STOCK': return <Badge variant="outline" className="text-[hsl(var(--muted-foreground))] border-[hsl(var(--muted-foreground))]">Esgotado</Badge>;
      default: return null;
    }
  }

  const openHistory = (product: any) => {
    setSelectedProduct(product);
  };

  const handleAddMovement = async () => {
    if (!newMovement.reason || newMovement.qty <= 0 || !orgId) return;
    const movementId = `MOV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const user = auth.currentUser;
    const movData = {
      type: newMovement.type,
      qty: newMovement.qty,
      reason: newMovement.reason,
      date: new Date().toISOString(),
      user: user?.displayName || "Usuário",
      userEmail: user?.email || "email@exemplo.com",
    };

    try {
       const newQty = selectedProduct.qty + (newMovement.type === "IN" ? newMovement.qty : -newMovement.qty);
       let newStatus = selectedProduct.status;
       if(newQty <= 0) newStatus = 'OUT_OF_STOCK';
       else if(newQty <= selectedProduct.minQty) newStatus = 'CRITICAL';
       else if(newQty <= selectedProduct.minQty + 5) newStatus = 'WARNING';
       else newStatus = 'OK';

       await updateDoc(doc(db, `organizations/${orgId}/inventory`, selectedProduct.id), {
         qty: newQty,
         status: newStatus
       });

       await setDoc(doc(db, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`, movementId), movData);
       setNewMovement({ type: "IN", qty: 0, reason: "" });
       
       // Update selectedProduct so the UI updates
       setSelectedProduct({ ...selectedProduct, qty: newQty, status: newStatus });
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`);
    }
  };

  const sortedHistory = React.useMemo(() => {
    return [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history]);

  const allSelected = filteredData.length > 0 && selectedItems.length === filteredData.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < filteredData.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Estoque</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Gerencie seus produtos, SKUs e alocação no armazém.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {inventory.length === 0 && (
            <Button variant="secondary" size="sm" onClick={seedGLPCatalog} className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20">
              <Database className="h-4 w-4 mr-2" />
              Catálogo GLP
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            const report = generateInventoryReport(inventory);
            sendEmailReport("", "Relatório de Estoque - TECGAS", report);
          }}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => {
            const report = generateInventoryReport(inventory);
            sendWhatsAppNotification("", report);
          }}>
            <Phone className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-2 w-full max-w-sm relative">
            <Search className="h-4 w-4 absolute left-3 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text" 
              placeholder="Buscar por SKU ou Nome..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
            />
          </div>
          
          {selectedItems.length > 0 ? (
            <div className="flex items-center space-x-2 animate-in fade-in zoom-in-95 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-3 py-1.5 rounded-md text-sm font-medium">
              <span>{selectedItems.length} {selectedItems.length === 1 ? 'selecionado' : 'selecionados'}</span>
              <div className="w-px h-4 bg-[hsl(var(--primary))]/20 mx-2" />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 hover:text-[hsl(var(--primary))]" onClick={handleUpdateStatus}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Reabastecer
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 hover:text-[hsl(var(--primary))]" onClick={() => console.log(`Exportando ${selectedItems.length} selecionados`)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Exportar
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:bg-destructive/10" onClick={handleDeleteSelected}>
                <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="hidden sm:flex shrink-0">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] px-4 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-[hsl(var(--muted-foreground))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                    checked={allSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                    onChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[100px]">SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">Localização</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="hidden md:table-cell text-right">Valor Unit.</TableHead>
                <TableHead className="hidden sm:table-cell text-center w-[140px]">Status</TableHead>
                <TableHead className="text-center w-[80px]">Histórico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id} data-state={selectedItems.includes(item.id) ? "selected" : undefined}>
                  <TableCell className="px-4 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-[hsl(var(--muted-foreground))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                      checked={selectedItems.includes(item.id)}
                      onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium text-xs truncate max-w-[80px]">{item.id}</TableCell>
                  <TableCell className="font-medium">
                    <div className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-xs" title={item.name}>{item.name}</div>
                    <div className="sm:hidden mt-1">{getStatusBadge(item.status)}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[hsl(var(--muted-foreground))]">{item.category}</TableCell>
                  <TableCell className="hidden lg:table-cell text-[hsl(var(--muted-foreground))] text-sm">{item.location}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <span className={item.qty < item.minQty ? 'text-destructive' : ''}>
                      {item.qty}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right font-mono text-sm max-w-[100px] truncate">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} title="Editar">
                      <Edit2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openHistory(item)} title="Ver Histórico">
                      <History className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
              <CardTitle className="text-xl">{editingId ? 'Editar Produto' : 'Adicionar Produto'}</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => { setIsAddModalOpen(false); setFormErrors({}); }}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Produto <span className="text-destructive">*</span></label>
                <input 
                  type="text" 
                  className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.name ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                  placeholder="Ex: Teclado Mecânico"
                  value={newItemForm.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
                {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria <span className="text-destructive">*</span></label>
                  <select 
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.category ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    <option value="Conexões">Conexões</option>
                    <option value="Tubulações">Tubulações</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Ferramentas">Ferramentas</option>
                    <option value="Materiais de Consumo">Materiais de Consumo</option>
                    <option value="EPI">EPI</option>
                  </select>
                  {formErrors.category && <p className="text-xs text-destructive mt-1">{formErrors.category}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localização <span className="text-destructive">*</span></label>
                  <input 
                    type="text" 
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.location ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    placeholder="Ex: B2 - C3"
                    value={newItemForm.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                  />
                  {formErrors.location && <p className="text-xs text-destructive mt-1">{formErrors.location}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qtd.</label>
                  <input 
                    type="number" 
                    min="0"
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.qty ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.qty === 0 && !newItemForm.qty.toString() ? '' : newItemForm.qty}
                    onChange={(e) => handleChange('qty', e.target.value ? Number(e.target.value) : 0)}
                  />
                  {formErrors.qty && <p className="text-xs text-destructive mt-1">{formErrors.qty}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qtd. Min</label>
                  <input 
                    type="number" 
                    min="0"
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.minQty ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.minQty === 0 && !newItemForm.minQty.toString() ? '' : newItemForm.minQty}
                    onChange={(e) => handleChange('minQty', e.target.value ? Number(e.target.value) : 0)}
                  />
                  {formErrors.minQty && <p className="text-xs text-destructive mt-1">{formErrors.minQty}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.price ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.price === 0 && !newItemForm.price.toString() ? '' : newItemForm.price}
                    onChange={(e) => handleChange('price', e.target.value ? parseFloat(e.target.value) : 0)}
                  />
                  {formErrors.price && <p className="text-xs text-destructive mt-1">{formErrors.price}</p>}
                </div>
              </div>
              <div className="pt-4 flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => { setIsAddModalOpen(false); setFormErrors({}); }}>Cancelar</Button>
                <Button onClick={handleSaveProduct}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
              <div>
                <CardTitle className="text-xl">Histórico de Movimentação</CardTitle>
                <div className="flex items-center mt-1 space-x-2">
                  <span className="uppercase font-mono text-xs font-semibold bg-[hsl(var(--muted))] px-2 py-0.5 rounded text-[hsl(var(--muted-foreground))]">{selectedProduct.id}</span>
                  <span className="text-sm font-medium">{selectedProduct.name}</span>
                </div>
              </div>
              <button 
                className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors"
                onClick={() => setSelectedProduct(null)}
              >
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden flex-1 flex flex-col lg:flex-row">
              <div className="w-full lg:w-[380px] p-6 border-b lg:border-b-0 lg:border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 flex flex-col justify-center shrink-0">
                <div className="w-full bg-[hsl(var(--background))] p-5 rounded-xl border border-[hsl(var(--border))] shadow-sm space-y-5">
                 <h4 className="font-bold flex items-center mb-2">
                    <History className="w-5 h-5 mr-2 text-[hsl(var(--primary))]" />
                    Nova Movimentação
                 </h4>
                 
                 <div className="space-y-4">
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-[hsl(var(--foreground))]">Operação</label>
                     <div className="grid grid-cols-2 gap-3">
                       <Button 
                         variant={newMovement.type === "IN" ? "default" : "outline"} 
                         className={newMovement.type === "IN" ? "bg-emerald-600 hover:bg-emerald-700 h-10" : "h-10 border-dashed"}
                         onClick={() => setNewMovement({...newMovement, type: "IN"})}
                       >
                         <ArrowDownRight className="w-4 h-4 mr-1.5" /> Entrada
                       </Button>
                       <Button 
                         variant={newMovement.type === "OUT" ? "default" : "outline"} 
                         className={newMovement.type === "OUT" ? "bg-amber-600 hover:bg-amber-700 h-10" : "h-10 border-dashed"}
                         onClick={() => setNewMovement({...newMovement, type: "OUT"})}
                       >
                         <ArrowUpRight className="w-4 h-4 mr-1.5" /> Saída
                       </Button>
                     </div>
                   </div>
                   
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-[hsl(var(--foreground))]">Quantidade</label>
                     <input 
                       type="number" 
                       min="1"
                       className="w-full h-11 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))] outline-none text-base font-medium shadow-sm transition-shadow"
                       placeholder="0"
                       value={newMovement.qty || ""}
                       onChange={(e) => setNewMovement({...newMovement, qty: Number(e.target.value)})}
                     />
                   </div>
                   
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-[hsl(var(--foreground))]">Motivo / Descrição</label>
                     <textarea 
                       rows={2}
                       placeholder={newMovement.type === "IN" ? "Ex: NF-e 1234 de Fornecedor" : "Ex: Retirada p/ OS #1002"}
                       className="w-full p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))] outline-none text-sm resize-none shadow-sm transition-shadow"
                       value={newMovement.reason}
                       onChange={(e) => setNewMovement({...newMovement, reason: e.target.value})}
                     />
                   </div>
                 </div>
                 
                 <Button 
                   size="lg"
                   className="w-full h-11 font-semibold text-base mt-2" 
                   onClick={handleAddMovement} 
                   disabled={!newMovement.reason || newMovement.qty <= 0}
                 >
                   Registrar Movimentação
                 </Button>
                </div>
              </div>
              <div className="w-full lg:flex-1 overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-[hsl(var(--card))] z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[120px]">Data</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead>Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedHistory.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                          {new Date(mov.date).toLocaleDateString('pt-BR')} <br className="hidden sm:block" />
                          <span className="hidden sm:inline">{new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}</span>
                        </TableCell>
                        <TableCell>
                          {mov.type === 'IN' ? (
                            <div className="flex items-center text-emerald-600 font-medium text-xs sm:text-sm">
                              <ArrowDownRight className="h-4 w-4 mr-1" /> Entrada
                            </div>
                          ) : (
                            <div className="flex items-center text-amber-600 font-medium text-xs sm:text-sm">
                              <ArrowUpRight className="h-4 w-4 mr-1" /> Saída
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-[hsl(var(--muted-foreground))] text-sm max-w-[150px] truncate" title={mov.reason}>
                          {mov.reason}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {mov.type === 'IN' ? '+' : '-'}{mov.qty}
                        </TableCell>
                        <TableCell className="text-sm">
                          {mov.user}
                        </TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          Nenhuma movimentação para este produto.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

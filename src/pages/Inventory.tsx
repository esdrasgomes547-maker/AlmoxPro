import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, Plus, Download, Filter, History, X, ArrowUpRight, ArrowDownRight, Trash2, Edit2, Archive, Phone, Mail, Database, QrCode, Upload } from "lucide-react";
import { db, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, orderBy, limit, startAfter, getDocs, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { sendWhatsAppNotification, sendEmailReport, generateInventoryReport } from "../lib/notificationService";
import { useOrganization } from "../lib/tenant";
import { InventoryItem, MovementItem, Category } from "../types";
import { isDemo } from '../lib/demo';

export function Inventory() {
  const { orgId } = useOrganization();
  console.log("DEBUG: orgId is", orgId);
  const [searchParams] = useSearchParams();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<MovementItem[]>([]);
  const [newMovement, setNewMovement] = useState({ type: "IN" as "IN" | "OUT", qty: 0, reason: "" });

  // QR Code and CSV states
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrInput, setQrInput] = useState("");
  const [qrScanResult, setQrScanResult] = useState<InventoryItem | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [qrQtyUpdate, setQrQtyUpdate] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // CSV Parsing helper
  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length <= 1) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const items: Partial<InventoryItem>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));

      const item: any = {};
      headers.forEach((header, index) => {
        const val = values[index];
        if (val === undefined) return;
        if (header === 'nome' || header === 'name') {
          item.name = val;
        } else if (header === 'categoria' || header === 'category') {
          item.category = val;
        } else if (header === 'localizacao' || header === 'localização' || header === 'location') {
          item.location = val;
        } else if (header === 'qtd' || header === 'quantidade' || header === 'qty') {
          item.qty = Number(val) || 0;
        } else if (header === 'minqty' || header === 'qtdmin' || header === 'minimo' || header === 'min') {
          item.minQty = Number(val) || 0;
        } else if (header === 'preco' || header === 'preço' || header === 'price' || header === 'valor') {
          item.price = Number(val.replace('R$', '').replace(',', '.').trim()) || 0;
        }
      });
      
      if (item.name) {
        items.push(item);
      }
    }
    return items;
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        alert("Nenhum item válido encontrado no CSV. Verifique o cabeçalho: name, category, location, qty, minQty, price");
        return;
      }

      let successCount = 0;
      for (const item of parsed) {
        const newId = `GLP-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
        let status = 'OK';
        const qty = item.qty || 0;
        const minQty = item.minQty || 0;
        if (qty <= 0) status = 'OUT_OF_STOCK';
        else if (qty <= minQty) status = 'CRITICAL';
        else if (qty <= minQty + 5) status = 'WARNING';

        try {
          await setDoc(doc(db, `organizations/${orgId}/inventory`, newId), {
            name: item.name || "Produto Sem Nome",
            category: item.category || "Geral",
            location: item.location || "A1",
            qty: qty,
            minQty: minQty,
            price: item.price || 0,
            status
          });
          successCount++;
        } catch (error) {
          console.error("Erro ao importar item CSV:", item, error);
        }
      }
      alert(`${successCount} itens importados com sucesso!`);
      setIsCsvModalOpen(false);
    };
    reader.readAsText(file);
  };

  // QR Code camera stream setup
  useEffect(() => {
    let videoStream: MediaStream | null = null;
    if (isQrModalOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          videoStream = stream;
          setCameraStream(stream);
        })
        .catch(err => {
          console.warn("Câmera não disponível ou permissão negada. Usando simulador.", err);
        });
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setQrScanResult(null);
      setQrInput("");
    }
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isQrModalOpen]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // QR Code Scan processing
  const processQrCode = (sku: string) => {
    const cleanSku = sku.trim();
    if (!cleanSku) return;
    const found = inventory.find(i => i.id.toLowerCase() === cleanSku.toLowerCase());
    if (found) {
      setQrScanResult(found);
      setQrInput("");
    } else {
      alert("SKU / QR Code não encontrado no inventário!");
    }
  };

  const handleQrMovement = async (type: 'IN' | 'OUT') => {
    if (!qrScanResult || !orgId) return;
    const user = auth.currentUser;
    const movementId = `MOV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const newQty = qrScanResult.qty + (type === "IN" ? qrQtyUpdate : -qrQtyUpdate);
    
    let newStatus = qrScanResult.status;
    if(newQty <= 0) newStatus = 'OUT_OF_STOCK';
    else if(newQty <= qrScanResult.minQty) newStatus = 'CRITICAL';
    else if(newQty <= qrScanResult.minQty + 5) newStatus = 'WARNING';
    else newStatus = 'OK';

    const movData = {
      type,
      qty: qrQtyUpdate,
      reason: type === "IN" ? "Entrada rápida via QR Code" : "Saída rápida via QR Code",
      date: new Date().toISOString(),
      user: user?.displayName || "Usuário QR",
      userEmail: user?.email || "email@exemplo.com",
    };

    try {
      await updateDoc(doc(db, `organizations/${orgId}/inventory`, qrScanResult.id), {
        qty: newQty,
        status: newStatus
      });
      await setDoc(doc(db, `organizations/${orgId}/inventory/${qrScanResult.id}/movements`, movementId), movData);
      
      const updatedItem = { ...qrScanResult, qty: newQty, status: newStatus };
      setQrScanResult(updatedItem);
      // Also update overall inventory state list
      setInventory(prev => prev.map(item => item.id === qrScanResult.id ? updatedItem : item));
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a movimentação.");
    }
  };

  useEffect(() => {
    if (!selectedProduct || !orgId) {
      setHistory([]);
      return;
    }
    // Optimizing massive database: Adding limit and orderBy
    const q = query(
      collection(db, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`),
      orderBy("date", "desc"),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      const h = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovementItem));
      setHistory(h);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`));
    return () => unsub();
  }, [selectedProduct, orgId]);

  useEffect(() => {
    if (!orgId || orgId === "undefined") return;
    const q = query(collection(db, `organizations/${orgId}/categories`));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      setCategories(items);
    }, (error) => {
      console.error("DEBUG: Failed to list categories for orgId:", orgId, "error:", error);
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/categories`);
    });
    return () => unsub();
  }, [orgId]);

  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    // Optimizing massive database: Limit the total loaded items if the database grows massively
    const q = query(collection(db, `organizations/${orgId}/inventory`), orderBy("name"), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      setInventory(items);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/inventory`);
      setLoading(false);
    });
    return () => unsub();
  }, [orgId]);

  const loadMore = async () => {
    if (!orgId || !lastVisible) return;
    setLoading(true);
    const nextQ = query(
      collection(db, `organizations/${orgId}/inventory`),
      orderBy("name"),
      startAfter(lastVisible),
      limit(20)
    );
    const snap = await getDocs(nextQ);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
    setInventory(prev => [...prev, ...items]);
    setLastVisible(snap.docs[snap.docs.length - 1] || null);
    setLoading(false);
  };

  const filteredData = React.useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return inventory.filter(item => 
      item.name.toLowerCase().includes(lowerTerm) || 
      item.id.toLowerCase().includes(lowerTerm)
    );
  }, [inventory, searchTerm]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach(item => {
        map.set(item.category, (map.get(item.category) || 0) + item.qty);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [inventory]);

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
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<{ productId: string, productName: string } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: "", category: "Conexões", location: "", qty: 0, minQty: 10, price: 0 });
  const [newCategoryForm, setNewCategoryForm] = useState({ name: "", description: "", purpose: "", photoUrl: "" });
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
    if (isDemo()) return;
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

  const handleSaveCategory = async () => {
    if (isDemo()) return;
    if (!orgId || !newCategoryForm.name) return;
    try {
      const newId = newCategoryForm.name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, `organizations/${orgId}/categories`, newId), newCategoryForm);
      setIsCategoryModalOpen(false);
      setNewCategoryForm({ name: "", description: "", purpose: "", photoUrl: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}/categories`);
    }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    setDeleteProductConfirm({ productId, productName });
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductConfirm || !orgId) return;
    try {
        await deleteDoc(doc(db, `organizations/${orgId}/inventory`, deleteProductConfirm.productId));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/inventory/${deleteProductConfirm.productId}`);
    }
    setDeleteProductConfirm(null);
  };

  const confirmDeleteCategory = async () => {
    if (isDemo()) return;
    if (!orgId || !categoryToDelete) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/categories`, categoryToDelete.id));
      setIsDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/categories/${categoryToDelete.id}`);
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

  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(history.length / itemsPerPage);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return history.slice(start, start + itemsPerPage);
  }, [history, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProduct]);

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
          <Button variant="outline" size="sm" onClick={() => setIsQrModalOpen(true)} className="bg-purple-600/10 text-purple-600 hover:bg-purple-600/20 border-purple-500/20">
            <QrCode className="h-4 w-4 mr-2" />
            Scanner QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCsvModalOpen(true)} className="bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 border-emerald-500/20">
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quantidade por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Categorias</h2>
          <Button size="sm" onClick={() => setIsCategoryModalOpen(true)}>
             <Plus className="h-4 w-4 mr-2" /> Nova Categoria
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(cat => {
            const catItems = inventory.filter(i => i.category === cat.name);
            const totalQty = catItems.reduce((acc, curr) => acc + curr.qty, 0);
            const totalValue = catItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
            return (
              <Card key={cat.id} className="relative p-5">
                <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-destructive" onClick={() => { setCategoryToDelete(cat); setIsDeleteCategoryModalOpen(true); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden">
                      {cat.photoUrl ? <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-500">Foto</div>}
                   </div>
                   <div>
                     <CardTitle className="text-lg">{cat.name}</CardTitle>
                     <p className="text-xs text-muted-foreground">{cat.purpose}</p>
                   </div>
                </div>
                <p className="text-sm mb-4">{cat.description}</p>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div className="bg-muted p-2 rounded">
                    <span className="block text-muted-foreground">Qtd</span>
                    <span className="font-bold">{totalQty}</span>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <span className="block text-muted-foreground">Valor</span>
                    <span className="font-bold text-primary">R$ {totalValue.toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2 mt-4 max-h-40 overflow-y-auto">
                    {catItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-sm border-b pb-1">
                        <span className="truncate flex-1">{item.name} ({item.qty})</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProduct(item.id, item.name); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                </div>
              </Card>
            )
          })}
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
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(item.id, item.name)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
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
          {lastVisible && (
            <div className="p-4 text-center">
              <Button onClick={loadMore} disabled={loading} variant="outline">
                {loading ? "Carregando..." : "Carregar mais"}
              </Button>
            </div>
          )}
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
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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
                <Button onClick={() => {
                  console.log("DEBUG: Botão de salvar clicado. editingId:", editingId);
                  handleSaveProduct();
                }}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <Card className="w-full max-w-sm shadow-xl p-6 space-y-4">
              <CardTitle>Nova Categoria</CardTitle>
              <input type="text" placeholder="Nome" className="w-full p-2 border rounded" value={newCategoryForm.name} onChange={e => setNewCategoryForm({...newCategoryForm, name: e.target.value})} />
              <input type="text" placeholder="Descrição" className="w-full p-2 border rounded" value={newCategoryForm.description} onChange={e => setNewCategoryForm({...newCategoryForm, description: e.target.value})} />
              <input type="text" placeholder="Finalidade" className="w-full p-2 border rounded" value={newCategoryForm.purpose} onChange={e => setNewCategoryForm({...newCategoryForm, purpose: e.target.value})} />
              <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancelar</Button>
                 <Button onClick={handleSaveCategory}>Adicionar</Button>
              </div>
           </Card>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {isDeleteCategoryModalOpen && categoryToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm shadow-xl p-6 space-y-4">
            <CardTitle>Confirmar Exclusão</CardTitle>
            <p className="text-sm">Tem certeza que deseja apagar a categoria <strong>{categoryToDelete.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteCategoryModalOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteCategory}>Apagar</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteProductConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm shadow-xl p-6 space-y-4">
            <CardTitle>Confirmar Exclusão</CardTitle>
            <p className="text-sm">Tem certeza que deseja apagar o produto <strong>{deleteProductConfirm.productName}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteProductConfirm(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteProduct}>Apagar</Button>
            </div>
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
              <div className="w-full lg:flex-1 flex flex-col min-h-[400px]">
                <div className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Data</TableHead>
                        <TableHead>Op.</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistory.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                            <div className="font-medium">{new Date(mov.date).toLocaleDateString('pt-BR')}</div>
                            <div className="text-[10px] opacity-70">{new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}</div>
                          </TableCell>
                          <TableCell>
                            {mov.type === 'IN' ? (
                              <div className="flex items-center text-emerald-600 font-medium text-xs">
                                <ArrowDownRight className="h-4 w-4 mr-1" /> Entrada
                              </div>
                            ) : (
                              <div className="flex items-center text-amber-600 font-medium text-xs">
                                <ArrowUpRight className="h-4 w-4 mr-1" /> Saída
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-[hsl(var(--muted-foreground))] text-sm max-w-[150px] truncate" title={mov.reason}>
                            {mov.reason}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            <span className={mov.type === 'IN' ? 'text-emerald-600' : 'text-amber-600'}>
                              {mov.type === 'IN' ? '+' : '-'}{mov.qty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-[hsl(var(--muted-foreground))]">
                            {mov.user.split(' ')[0]}
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-[hsl(var(--muted-foreground))]">
                            <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            Nenhuma movimentação registrada.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="p-4 border-t border-[hsl(var(--border))] flex items-center justify-between bg-[hsl(var(--muted))]/10 shrink-0">
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Página <span className="font-medium text-[hsl(var(--foreground))]">{currentPage}</span> de <span className="font-medium text-[hsl(var(--foreground))]">{totalPages}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="h-8 w-8 p-0"
                      >
                        <span className="sr-only">Anterior</span>
                        <ArrowDownRight className="h-4 w-4 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="h-8 w-8 p-0"
                      >
                        <span className="sr-only">Próxima</span>
                        <ArrowDownRight className="h-4 w-4 -rotate-90" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
              <CardTitle className="text-xl">Importar Itens via CSV</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setIsCsvModalOpen(false)}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Selecione um arquivo CSV com as colunas: <strong>name, category, location, qty, minQty, price</strong>.
              </p>
              
              <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-lg p-6 text-center cursor-pointer hover:border-[hsl(var(--primary))]/50 transition-colors relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCsvUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="h-10 w-10 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
                <p className="text-sm font-medium">Clique ou arraste o arquivo CSV aqui</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Apenas arquivos .csv</p>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,name,category,location,qty,minQty,price\nTubo Cobre 15mm,Tubulações,A1,100,50,45.0\nVálvula 1/2,Conexões,B2,45,20,35.5\n";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "modelo_estoque.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Baixar Modelo CSV
                </Button>
                <Button variant="ghost" onClick={() => setIsCsvModalOpen(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR Code / Barcode Scanner Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
              <CardTitle className="text-xl flex items-center gap-2">
                <QrCode className="h-5 w-5 text-purple-500" />
                Leitor / Scanner de QR Code
              </CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setIsQrModalOpen(false)}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto space-y-4 flex-1">
              {!qrScanResult ? (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden border border-purple-500/20 aspect-video flex items-center justify-center">
                    {cameraStream ? (
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-[hsl(var(--muted-foreground))] p-4">
                        <QrCode className="h-12 w-12 mx-auto mb-2 text-purple-500/50 animate-pulse" />
                        <p className="text-sm">Buscando câmera ou usando simulador...</p>
                      </div>
                    )}
                    {/* Scanning overlay frame */}
                    <div className="absolute inset-0 pointer-events-none border-2 border-purple-500/30 m-8 rounded-lg flex items-center justify-center">
                      <div className="w-full h-0.5 bg-purple-500 absolute top-0 animate-[bounce_2s_infinite]" />
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      processQrCode(qrInput);
                    }}
                    className="space-y-2"
                  >
                    <label className="text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))] tracking-wider">
                      Leitura Manual ou Pistola de Código
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Escaneie ou digite o SKU (ex: GLP-0001)..." 
                        value={qrInput}
                        onChange={(e) => setQrInput(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        autoFocus
                      />
                      <Button type="submit" className="bg-purple-600 hover:bg-purple-700">Buscar</Button>
                    </div>
                  </form>

                  <div className="border-t border-[hsl(var(--border))] pt-4 space-y-2">
                    <label className="text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))] tracking-wider block">
                      Simular Leitura
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {inventory.slice(0, 4).map(item => (
                        <Button 
                          key={item.id} 
                          variant="outline" 
                          size="sm" 
                          onClick={() => processQrCode(item.id)}
                          className="justify-start truncate font-mono text-xs"
                        >
                          Scan {item.id}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-lg">{qrScanResult.name}</h4>
                      <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] mt-0.5">{qrScanResult.id}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="bg-muted px-2 py-0.5 rounded font-mono">Qtd: {qrScanResult.qty}</span>
                        <span className="bg-muted px-2 py-0.5 rounded">Mín: {qrScanResult.minQty}</span>
                        <span className="bg-muted px-2 py-0.5 rounded">Loc: {qrScanResult.location}</span>
                      </div>
                    </div>
                    {getStatusBadge(qrScanResult.status)}
                  </div>

                  <div className="bg-[hsl(var(--muted))]/30 p-4 rounded-lg space-y-4">
                    <h5 className="font-semibold text-sm">Registrar Movimentação Rápida</h5>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium">Quantidade:</label>
                      <input 
                        type="number" 
                        min="1"
                        value={qrQtyUpdate}
                        onChange={(e) => setQrQtyUpdate(Math.max(1, Number(e.target.value)))}
                        className="w-20 h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-center font-mono font-bold focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <Button 
                        onClick={() => handleQrMovement('IN')} 
                        className="bg-emerald-600 hover:bg-emerald-700 h-11"
                      >
                        <ArrowDownRight className="w-4 h-4 mr-1.5" /> Registrar Entrada
                      </Button>
                      <Button 
                        onClick={() => handleQrMovement('OUT')} 
                        className="bg-amber-600 hover:bg-amber-700 h-11"
                      >
                        <ArrowUpRight className="w-4 h-4 mr-1.5" /> Registrar Saída
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <Button variant="outline" onClick={() => setQrScanResult(null)}>
                      Escanear Outro
                    </Button>
                    <Button variant="ghost" onClick={() => setIsQrModalOpen(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType, functions } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Search, ShieldAlert, CreditCard, Activity, Play, Ban, CheckCircle2, UserPlus, Shield, Loader2 } from 'lucide-react';

export function MasterPanel() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [organizations, setOrganizations] = useState<Record<string, any>>({});
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddMasterModalOpen, setIsAddMasterModalOpen] = useState(false);
  const [targetUserUid, setTargetUserUid] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    // 1. Escuta a coleção subscriptions em tempo real
    const unsubSubs = onSnapshot(collection(db, "subscriptions"), (snap) => {
      setSubscriptions(snap.docs.map(doc => ({ orgId: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "subscriptions"));

    // 2. Escuta a coleção users em tempo real
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const uMap: Record<string, any> = {};
      snap.forEach(doc => {
        uMap[doc.id] = { uid: doc.id, ...doc.data() };
      });
      setUsers(uMap);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "users"));

    // 3. Escuta a coleção organizations em tempo real
    const unsubOrgs = onSnapshot(collection(db, "organizations"), (snap) => {
      const oMap: Record<string, any> = {};
      snap.forEach(doc => {
        oMap[doc.id] = { orgId: doc.id, ...doc.data() };
      });
      setOrganizations(oMap);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "organizations"));

    return () => {
      unsubSubs();
      unsubUsers();
      unsubOrgs();
    };
  }, []);

  // Métricas do painel calculadas dinamicamente
  const { totalOrgs, activeOrgs, overdueOrgs, newThisMonth, mrr } = React.useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active').length;
    const overdue = subscriptions.filter(s => s.status === 'overdue').length;
    
    // Calcula novos clientes do mês atual
    const now = new Date();
    const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonthCount = subscriptions.filter(s => {
      if (!s.createdAt) return false;
      const createdDate = new Date(s.createdAt);
      return createdDate >= firstOfCurrentMonth;
    }).length;

    return {
      totalOrgs: subscriptions.length,
      activeOrgs: active,
      overdueOrgs: overdue,
      newThisMonth: newThisMonthCount,
      mrr: active * 10.00
    };
  }, [subscriptions]);

  // Ações chamando as Cloud Functions
  const handlePromoteToMaster = async (uid: string) => {
    if (!uid) return;
    if (!confirm("Tem certeza que deseja promover este usuário a Administrador Master?")) return;
    
    setActionLoading(uid);
    try {
      const setMasterRoleFn = httpsCallable(functions, 'setMasterRole');
      await setMasterRoleFn({ uid });
      alert("Usuário promovido a Master com sucesso.");
    } catch (e: any) {
      alert("Erro ao promover usuário: " + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (orgId: string, uid: string, makeActive: boolean) => {
    if (!orgId || !uid) return;
    const actionText = makeActive ? "reativar" : "suspender";
    if (!confirm(`Deseja realmente ${actionText} o acesso deste cliente?`)) return;

    setActionLoading(orgId);
    try {
      const updateUserRoleFn = httpsCallable(functions, 'updateUserRole');
      await updateUserRoleFn({
        targetUid: uid,
        role: makeActive ? "premium_max" : "inactive",
        orgId: orgId,
        plan: makeActive ? "premium_max" : "inactive"
      });
      alert(`Cliente ${actionText}do com sucesso.`);
    } catch (e: any) {
      alert(`Erro ao ${actionText} cliente: ` + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromoteInputMaster = async () => {
    if (!targetUserUid) return;
    setIsAddMasterModalOpen(false);
    await handlePromoteToMaster(targetUserUid);
    setTargetUserUid('');
  };

  // Filtragem de clientes por busca (Org ID, Nome da Empresa ou E-mail)
  const filteredClients = React.useMemo(() => {
    return subscriptions.filter(sub => {
      const orgName = organizations[sub.orgId]?.name || '';
      // Procura o email do admin associado ao uid da assinatura
      const adminEmail = users[sub.uid]?.email || '';
      
      const term = searchTerm.toLowerCase();
      return sub.orgId.toLowerCase().includes(term) ||
             orgName.toLowerCase().includes(term) ||
             adminEmail.toLowerCase().includes(term);
    });
  }, [subscriptions, organizations, users, searchTerm]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo Master</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-1">Gestão centralizada de clientes, assinaturas e permissões SaaS do ALTEC.</p>
        </div>
        <Button onClick={() => setIsAddMasterModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
          <Shield className="w-4 h-4 mr-2" /> Promover a Master (UID)
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Total de Organizações</CardTitle>
            <Activity className="h-4 w-4 text-[hsl(var(--primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{totalOrgs}</div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Assinaturas cadastradas na base</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Receita Mensal (MRR)</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-500">R$ {mrr.toFixed(2)}</div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Com base em {activeOrgs} contas Premium Max ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Inadimplentes (Overdue)</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-500">{overdueOrgs}</div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Contas pendentes de compensação</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Novos Clientes (Mês)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-500">{newThisMonth}</div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Registrados neste ciclo mensal</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader className="border-b border-[hsl(var(--border))] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Listagem de Clientes</CardTitle>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Busque e altere o status de assinatura e acessos do sistema.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text" 
              placeholder="Buscar por Org ID, Empresa ou Email..." 
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org ID</TableHead>
                  <TableHead>Nome da Empresa</TableHead>
                  <TableHead>E-mail do Administrador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próximo Vencimento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                      Nenhum cliente localizado com os critérios informados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map(sub => {
                    const orgName = organizations[sub.orgId]?.name || `Organização ${sub.orgId}`;
                    const adminEmail = users[sub.uid]?.email || 'Não informado';
                    const nextBilling = sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString('pt-BR') : 'N/A';
                    const isUserMaster = users[sub.uid]?.role === 'master';

                    return (
                      <TableRow key={sub.orgId}>
                        <TableCell className="font-mono text-xs font-semibold">{sub.orgId}</TableCell>
                        <TableCell className="font-medium">{orgName}</TableCell>
                        <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">{adminEmail}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            sub.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20 font-bold' : 
                            sub.status === 'overdue' ? 'bg-red-500/10 text-red-500 border-red-500/20 font-bold' : 
                            sub.status === 'pending' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20 font-bold' :
                            'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                          }>
                            {sub.status === 'active' && 'Ativo'}
                            {sub.status === 'overdue' && 'Atrasado'}
                            {sub.status === 'pending' && 'Pendente'}
                            {sub.status === 'inactive' && 'Inativo'}
                            {sub.status === 'deleted' && 'Cancelado'}
                            {!['active', 'overdue', 'pending', 'inactive', 'deleted'].includes(sub.status) && sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{nextBilling}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {actionLoading === sub.orgId ? (
                              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))] mr-4" />
                            ) : (
                              <>
                                {sub.status !== 'active' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs font-semibold border-green-500/30 hover:bg-green-500/10 text-green-600"
                                    onClick={() => handleUpdateStatus(sub.orgId, sub.uid, true)}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Reativar
                                  </Button>
                                )}
                                {sub.status === 'active' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs font-semibold border-red-500/30 hover:bg-red-500/10 text-red-500"
                                    onClick={() => handleUpdateStatus(sub.orgId, sub.uid, false)}
                                  >
                                    <Ban className="h-3 w-3 mr-1" /> Suspender
                                  </Button>
                                )}
                                {!isUserMaster && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs font-semibold border-purple-500/30 hover:bg-purple-500/10 text-purple-600"
                                    onClick={() => handlePromoteToMaster(sub.uid)}
                                  >
                                    <Shield className="h-3 w-3 mr-1" /> Promover Master
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Add Master por UID */}
      {isAddMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
             <CardHeader className="border-b border-[hsl(var(--border))]">
               <CardTitle className="text-xl">Promover Usuário por UID</CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <p className="text-xs text-[hsl(var(--muted-foreground))] leading-normal">
                 Insira o UID do Firebase do usuário. Ao promover, ele receberá a role Master e terá acesso ilimitado a todas as organizações e painéis administrativos do sistema.
               </p>
               <div>
                 <label className="text-xs font-bold mb-1.5 block uppercase tracking-wider text-[hsl(var(--muted-foreground))]">UID do Usuário alvo</label>
                 <input 
                    type="text" 
                    value={targetUserUid}
                    onChange={(e) => setTargetUserUid(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/40 outline-none"
                    placeholder="Ex: dH7Bf8fG7H6fF7G8..."
                 />
               </div>
               <div className="flex justify-end space-x-2 pt-2 border-t border-[hsl(var(--border))]">
                 <Button variant="outline" onClick={() => setIsAddMasterModalOpen(false)}>Cancelar</Button>
                 <Button 
                   className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5" 
                   disabled={!targetUserUid} 
                   onClick={handlePromoteInputMaster}
                 >
                   <UserPlus className="h-4 w-4" />
                   Promover a Master
                 </Button>
               </div>
             </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}

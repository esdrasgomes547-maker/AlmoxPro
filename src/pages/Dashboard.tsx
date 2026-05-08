import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight, PackageCheck, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { db, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";

export function Dashboard() {
  const { orgId } = useOrganization();
  const [inventory, setInventory] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Personalized Greeting
  const displayName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || "Visitante";
  const firstName = displayName.split(' ')[0];
  const capFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // Generate chart data dynamically from shipments
  const salesData = React.useMemo(() => {
    const data = [...shipments]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .reduce((acc: any[], current) => {
        const dateLabel = new Date(current.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
        
        const existing = acc.find(item => item.name === dateLabel);
        if (existing) {
          existing.value += current.items;
        } else {
          acc.push({ name: dateLabel, value: current.items });
        }
        return acc;
      }, []);

    if (data.length === 0) {
      data.push({ name: "Sem dados", value: 0 });
    } else if (data.length === 1) {
      data.unshift({ name: "Início", value: 0 });
    }
    return data;
  }, [shipments]);

  useEffect(() => {
    if (!orgId) return;

    const unsubSettings = onSnapshot(doc(db, `organizations/${orgId}/settings`, "default"), snap => {
      if (snap.exists()) setCompanySettings(snap.data());
    });

    const unsubInv = onSnapshot(query(collection(db, `organizations/${orgId}/inventory`)), snap => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/inventory`));

    const unsubShip = onSnapshot(query(collection(db, `organizations/${orgId}/shipments`)), snap => {
      setShipments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/shipments`));

    return () => {
      unsubSettings();
      unsubInv();
      unsubShip();
    }
  }, [orgId]);

  const { alerts, shippedCount, inTransitCount, totalVolume } = React.useMemo(() => {
    return {
      alerts: inventory.filter(item => item.status === 'WARNING' || item.status === 'CRITICAL' || item.status === 'OUT_OF_STOCK'),
      shippedCount: shipments.filter(s => s.status === 'DELIVERED' || s.status === 'SHIPPED').length,
      inTransitCount: shipments.filter(s => s.status === 'PREPARING' || s.status === 'PENDING').length,
      totalVolume: inventory.reduce((acc, item) => acc + item.qty, 0)
    };
  }, [inventory, shipments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Olá, {capFirstName}
              {companySettings?.companyName && (
                <span className="text-[hsl(var(--muted-foreground))] font-normal ml-1">
                  da {companySettings.companyName}
                </span>
              )}
            </h1>
            {localStorage.getItem('master_bypass') === 'true' && (
              <span className="bg-yellow-500/10 text-yellow-600 text-[10px] font-black px-2 py-0.5 rounded border border-yellow-500/20 uppercase tracking-tight">Master Bypass</span>
            )}
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            {companySettings?.welcomeMessage || "Bem-vindo(a) de volta! Acompanhe seus principais indicadores logísticos."}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link to="/app/inventory">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
              <Package className="h-4 w-4 mr-2" />
              Estoque
            </button>
          </Link>
          <Link to="/app/shipments">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
              <Truck className="h-4 w-4 mr-2" />
              Expedições
            </button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/app/shipments" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-md cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Enviados</CardTitle>
              <PackageCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{shippedCount}</div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center mt-1">
                <span className="text-emerald-500 flex items-center mr-1">
                  <ArrowUpRight className="h-3 w-3" />
                  +12.5%
                </span> 
                vs. mês anterior
              </p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/app/shipments" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-md cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Trânsito</CardTitle>
              <Truck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{inTransitCount}</div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center mt-1">
                <span className="text-destructive flex items-center mr-1">
                  <ArrowDownRight className="h-3 w-3" />
                  -4.1%
                </span> 
                vs. mês anterior
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/app/inventory" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-md cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volume em Estoque</CardTitle>
              <Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {totalVolume.toLocaleString()}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center mt-1">
                <span className="text-emerald-500 flex items-center mr-1">
                  <ArrowUpRight className="h-3 w-3" />
                  +2.1%
                </span> 
                vs. mês anterior
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/app/inventory" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-md cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Ruptura</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-amber-600">{alerts.length}</div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                SKUs abaixo do estoque mínimo
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-1 md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Fluxo de Expedição</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3 lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle>Alertas de Estoque</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Itens que precisam de reposição</p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
            {alerts.length === 0 ? (
              <div className="text-sm text-[hsl(var(--muted-foreground))] h-full flex flex-col items-center justify-center py-8 text-center">
                <PackageCheck className="h-8 w-8 mb-2 text-emerald-500/50" />
                Nenhum alerta. Estoque saudável.
              </div>
            ) : (
              alerts.map(item => (
                <div key={item.id} className="flex flex-col space-y-2 border-b border-[hsl(var(--border))] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold truncate pr-2" title={item.name}>{item.name}</h4>
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{item.id}</span>
                    </div>
                    {item.status === 'CRITICAL' || item.status === 'OUT_OF_STOCK' ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">CRÍTICO</span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">ATENÇÃO</span>
                    )}
                  </div>
                  <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs font-medium">
                      <div>
                        Atual: <span className={item.qty < item.minQty ? 'text-destructive font-bold font-mono' : 'font-mono'}>{item.qty}</span>
                      </div>
                      <div>
                        Mínimo: <span className="font-mono">{item.minQty}</span>
                      </div>
                    </div>
                    <Link to={`/app/inventory?search=${item.id}`} className="flex items-center text-xs font-medium text-[hsl(var(--primary))] hover:underline">
                      Ver detalhes <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

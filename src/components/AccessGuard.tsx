import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSubscription } from '../lib/useSubscription';
import { auth } from '../lib/firebase';
import { Loader2, ShieldAlert, CreditCard, LogOut } from 'lucide-react';
import { Button } from './ui/button';

interface AccessGuardProps {
  children: React.ReactNode;
  requireMaster?: boolean;
}

export function AccessGuard({ children, requireMaster = false }: AccessGuardProps) {
  const { role, isActive, isMaster, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  // Verifica se há usuário autenticado
  const user = auth.currentUser;
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Restrição de Administrador Master
  if (requireMaster) {
    if (isMaster || user.email === "esdrasgomes547@gmail.com") {
      return <>{children}</>;
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Acesso Restrito</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))] max-w-md">
          Apenas administradores do painel master possuem permissão para visualizar esta página.
        </p>
        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={() => navigate('/app/dashboard')}>
            Voltar ao App
          </Button>
          <Button variant="secondary" onClick={() => auth.signOut().then(() => navigate('/'))}>
            Sair da Conta
          </Button>
        </div>
      </div>
    );
  }

  // Se o usuário for master ou premium_max ativo, renderiza as telas
  if (isActive) {
    return <>{children}</>;
  }

  // Se a assinatura estiver inativa ou pendente, exibe a tela de Acesso Bloqueado
  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="max-w-md w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto">
          <CreditCard className="h-8 w-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">Acesso Bloqueado</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Sua assinatura do plano **Premium Max (R$ 10/mês)** está inativa ou aguardando confirmação de pagamento.
          </p>
        </div>

        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-left">
          <p className="text-xs text-orange-700 dark:text-orange-400 font-medium leading-tight">
            Se você acabou de realizar o pagamento via Pix, a liberação é imediata. Tente recarregar a página. Caso tenha pago via Boleto, o processamento pode levar até 2 dias úteis.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button className="w-full h-12 text-md font-semibold" onClick={() => navigate('/subscribe')}>
            Assinar Agora (R$ 10,00/mês)
          </Button>
          <Button variant="outline" className="w-full h-12 flex items-center justify-center gap-2" onClick={() => auth.signOut().then(() => navigate('/'))}>
            <LogOut className="h-4 w-4" />
            Sair e Usar Outra Conta
          </Button>
        </div>
      </div>
    </div>
  );
}

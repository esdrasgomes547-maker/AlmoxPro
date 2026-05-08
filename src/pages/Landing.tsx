import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Truck, Users, ShieldCheck, Clock, Layers } from 'lucide-react';
import { TecgasLogo } from '../components/TecgasLogo';
import { auth, signInWithGoogle } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const isBypass = localStorage.getItem('master_bypass') === 'true';
      if (user || isBypass) {
        navigate('/app/dashboard');
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] selection:bg-[hsl(var(--primary))]/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8">
              <TecgasLogo />
            </div>
            <span className="font-bold text-xl tracking-tight">Almox pro</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogin}>
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32 px-4 container mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto">
          Gestão industrial de estoque e logística. <br className="hidden md:block"/> 
          <span className="text-[hsl(var(--primary))]">Simples, rápido, no controle.</span>
        </h1>
        <p className="text-xl text-[hsl(var(--muted-foreground))] mb-10 max-w-2xl mx-auto">
          Evite rupturas, acompanhe expedições e avalie fornecedores em um só lugar. A solução perfeita para a área de GLP e operações pesadas.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg" onClick={handleLogin}>
            Começar agora
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg" onClick={handleLogin}>
            Ver demonstração
          </Button>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-4">Plataforma Segura · Google Cloud · Realtime DB</p>
      </section>

      {/* Problemas */}
      <section className="py-20 bg-[hsl(var(--accent))]/10 border-y border-[hsl(var(--border))]">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-sm">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center mb-6">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">"Perdeu peça no almoxarifado?"</h3>
              <p className="text-[hsl(var(--muted-foreground))]">Localize cada SKU rapidamente. Defina estoques mínimos e receba alertas antes que a operação pare.</p>
            </div>
            <div className="bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-sm">
              <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center mb-6">
                <Truck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">"Expedição sem rastreio?"</h3>
              <p className="text-[hsl(var(--muted-foreground))]">Registre a saída de veículos, motoristas e itens. Acompanhe se o pedido chegou ou está em devolução.</p>
            </div>
            <div className="bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-sm">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">"Fornecedor sumiu?"</h3>
              <p className="text-[hsl(var(--muted-foreground))]">Centralize notas fiscais e contatos de fornecedores. Avalie-os em estrelas para compras melhores.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Tudo que sua operação precisa</h2>
          <p className="text-[hsl(var(--muted-foreground))]">Trazendo tecnologia para chão de fábrica e logística.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          <div className="flex space-x-4">
            <ShieldCheck className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2">Controle em Tempo Real</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">O Firestore sync garante que quem está no galpão vê o mesmo dado que você de casa.</p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Clock className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2">Alertas Automáticos</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Visualização de ponto crítico e produtos esgotados, com relatórios enviados pelo Whatsapp ou E-mail.</p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Layers className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2">Histórico de Movimentações</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Auditoria completa. Saiba exatamente quem retirou, adicionou ou transferiu produtos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-[hsl(var(--card))] border-y border-[hsl(var(--border))]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">Pronto para assumir o controle?</h2>
          <p className="text-xl text-[hsl(var(--muted-foreground))] mb-10">
            Simplifique sua gestão logística agora mesmo.
          </p>
          <Button size="lg" className="h-14 px-12 text-lg" onClick={handleLogin}>
            Acessar o Painel
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Perguntas Frequentes</h2>
          <p className="text-[hsl(var(--muted-foreground))]">Tire suas dúvidas ou entre em contato conosco.</p>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-2">Como faço para acessar?</h3>
            <p className="text-[hsl(var(--muted-foreground))]">O acesso é restrito via login. Você pode entrar com sua conta Google ou os dados fornecidos pelo administrador master.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Preciso pagar mensalidade?</h3>
            <p className="text-[hsl(var(--muted-foreground))]">A plataforma opera em modelo direto. Fale com seu administrador para autorização de acesso ao painel completo.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Como adiciono novos funcionários?</h3>
            <p className="text-[hsl(var(--muted-foreground))]">Todos os usuários que fizerem login com a conta associada à sua chave Mestra garantem acesso à plataforma, bastando sincronizar o ambiente.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Vocês atendem apenas a área de GLP?</h3>
            <p className="text-[hsl(var(--muted-foreground))]">Embora idealizado com operações de GLP em mente (com estoque de tubos, conexões etc.), o sistema se adequa perfeitamente a várias realidades de almoxarifado ou gestão logística pesada.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="w-6 h-6 grayscale opacity-80"><TecgasLogo /></div>
          <span className="font-bold text-lg uppercase">Almox pro</span>
        </div>
        <p>&copy; 2026 Almox pro. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}

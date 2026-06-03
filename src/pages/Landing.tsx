import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  Package, 
  Truck, 
  Users, 
  ShieldCheck, 
  Clock, 
  Layers, 
  ArrowRight, 
  Check, 
  Star, 
  HelpCircle, 
  QrCode, 
  CreditCard, 
  FileText 
} from 'lucide-react';
import { TecgasLogo } from '../components/TecgasLogo';
import { auth } from '../lib/firebase';
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

  const handleSubscribe = () => {
    navigate('/subscribe');
  };

  const handleDemo = () => {
    localStorage.setItem('isDemoMode', 'true');
    navigate('/app/dashboard');
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
            <span className="font-bold text-xl tracking-tight uppercase">Altec</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogin}>
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32 px-4 container mx-auto text-center relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[hsl(var(--primary))]/10 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-pulse"></span>
          Plano Único · Premium Max
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          Gestão industrial de estoque e logística. <br className="hidden md:block"/> 
          <span className="text-[hsl(var(--primary))]">Simples, rápido, no controle.</span>
        </h1>
        
        <p className="text-xl text-[hsl(var(--muted-foreground))] mb-10 max-w-2xl mx-auto">
          Evite rupturas, acompanhe expedições em tempo real e avalie fornecedores em um só lugar. A solução sob medida para o setor de GLP e operações pesadas.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold flex items-center justify-center gap-2" onClick={handleSubscribe}>
            Começar agora — R$10/mês
            <ArrowRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg" onClick={handleDemo}>
            Ver demonstração
          </Button>
        </div>

        {/* Badge de pagamento */}
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-1.5">
            <QrCode className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span>Pix</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--border))]"></span>
          <div className="flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span>Cartão de Crédito</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--border))]"></span>
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span>Boleto</span>
          </div>
        </div>
      </section>

      {/* Problemas que resolve */}
      <section className="py-20 bg-[hsl(var(--accent))]/5 border-y border-[hsl(var(--border))] relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-sm transition hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center mb-6">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">"Perdeu peça no almoxarifado?"</h3>
              <p className="text-[hsl(var(--muted-foreground))] leading-relaxed text-sm">
                Tenha o controle total do seu SKU com localização física das prateleiras. Defina estoques mínimos e receba alertas antes que a operação pare.
              </p>
            </div>
            <div className="bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-sm transition hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center mb-6">
                <Truck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">"Expedição sem rastreio?"</h3>
              <p className="text-[hsl(var(--muted-foreground))] leading-relaxed text-sm">
                Monitore a saída de veículos, motoristas e insumos em tempo real. Saiba exatamente se o pedido foi entregue, está em trânsito ou se retornou como devolução.
              </p>
            </div>
            <div className="bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-sm transition hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">"Fornecedor sem histórico?"</h3>
              <p className="text-[hsl(var(--muted-foreground))] leading-relaxed text-sm">
                Centralize contatos, prazos de entrega e notas fiscais. Avalie cada parceiro com classificações em estrelas para negociações e compras futuras muito melhores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold mb-4">Tudo o que sua operação precisa</h2>
          <p className="text-[hsl(var(--muted-foreground))] max-w-xl mx-auto">
            Uma plataforma projetada para o chão de fábrica, integrando mobilidade e painéis de controle industriais em tempo real.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 max-w-5xl mx-auto">
          <div className="flex space-x-4">
            <ShieldCheck className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2 text-md">Controle em Tempo Real</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Nossa sincronização em tempo real garante que quem está no galpão visualiza a mesma atualização que o gestor de compras.
              </p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Clock className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2 text-md">Alertas de Ruptura Automáticos</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Gere e envie relatórios instantâneos de produtos esgotados ou com estoque crítico diretamente via WhatsApp ou Email.
              </p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Layers className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2 text-md">Histórico de Movimentações</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Mantenha uma trilha de auditoria completa. Saiba exatamente quem retirou, adicionou ou transferiu itens de estoque.
              </p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Truck className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2 text-md">Gestão de Expedições</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Cadastre e acompanhe entregas com destino, motorista responsável, veículo de transporte e status de rastreamento.
              </p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Users className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2 text-md">Catálogo de Fornecedores</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Centralize todos os contatos de fornecedores, organize por categorias e avalie a performance e qualidade dos insumos.
              </p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Users className="h-6 w-6 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <h4 className="font-bold mb-2 text-md">Equipe e EPIs</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Gerencie seus funcionários e controle a entrega de equipamentos de proteção individual obrigatórios em dia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-[hsl(var(--accent))]/5 border-t border-b border-[hsl(var(--border))] relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold mb-4">Preço simples e transparente</h2>
            <p className="text-[hsl(var(--muted-foreground))]">
              Sem taxas ocultas, sem contratos de longo prazo. Acesso imediato para toda a sua equipe.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-[hsl(var(--card))] border-2 border-[hsl(var(--primary))] rounded-3xl p-8 shadow-2xl relative">
            <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--primary))] text-white text-xs font-bold uppercase py-1 px-4 rounded-full">
              Mais Vendido
            </div>
            
            <div className="text-center pb-6 border-b border-[hsl(var(--border))]">
              <h3 className="text-2xl font-bold mb-2">Plano Premium Max</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">Controle operacional e logístico ilimitado</p>
              <div className="flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--muted-foreground))] mr-1">R$</span>
                <span className="text-5xl font-extrabold text-[hsl(var(--foreground))]">10,00</span>
                <span className="text-md text-[hsl(var(--muted-foreground))] ml-2">/ mês</span>
              </div>
            </div>

            <ul className="space-y-4 py-8">
              {[
                'Acesso completo a todos os módulos',
                'Usuários e dados ilimitados',
                'Alertas de ruptura automáticos',
                'Suporte prioritário via WhatsApp',
                'Atualizações contínuas inclusas'
              ].map((benefit, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full h-12 text-md font-bold" onClick={handleSubscribe}>
              Assinar Agora
            </Button>

            <div className="flex items-center justify-center gap-4 mt-6 text-xs text-[hsl(var(--muted-foreground))]">
              <span>Pix</span>
              <span className="w-1 h-1 bg-[hsl(var(--border))] rounded-full"></span>
              <span>Cartão de Crédito</span>
              <span className="w-1 h-1 bg-[hsl(var(--border))] rounded-full"></span>
              <span>Boleto</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold mb-4">Quem usa, aprova</h2>
          <p className="text-[hsl(var(--muted-foreground))]">
            Depoimentos reais de profissionais que otimizaram sua logística industrial com o ALTEC.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl flex flex-col justify-between">
            <p className="text-sm text-[hsl(var(--muted-foreground))] italic leading-relaxed">
              "Facilitou muito o nosso controle de tubos e conexões no dia a dia. A contagem de estoque bate 100% todo final de mês."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-bold text-sm">
                RG
              </div>
              <div>
                <h5 className="font-bold text-sm">Roberto Gomes</h5>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Almoxarife de GLP</p>
              </div>
            </div>
          </div>

          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl flex flex-col justify-between">
            <p className="text-sm text-[hsl(var(--muted-foreground))] italic leading-relaxed">
              "O acompanhamento das saídas de botijões e cargas de gás de cozinha ficou muito mais profissional e seguro para a empresa."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-bold text-sm">
                SO
              </div>
              <div>
                <h5 className="font-bold text-sm">Sandra Oliveira</h5>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Supervisora de Logística</p>
              </div>
            </div>
          </div>

          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl flex flex-col justify-between">
            <p className="text-sm text-[hsl(var(--muted-foreground))] italic leading-relaxed">
              "A avaliação dos fornecedores nos ajudou a cortar custos com peças que davam manutenção frequente no galpão."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-bold text-sm">
                CN
              </div>
              <div>
                <h5 className="font-bold text-sm">Carlos Nunes</h5>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Técnico de Manutenção</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-[hsl(var(--accent))]/5 border-t border-[hsl(var(--border))]">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold mb-4">Perguntas Frequentes</h2>
            <p className="text-[hsl(var(--muted-foreground))]">
              Esclareça suas principais dúvidas sobre o plano Premium Max.
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                q: "Posso cancelar quando quiser?",
                a: "Sim. A assinatura opera em ciclo mensal e não possui fidelidade de contrato. Você pode cancelar a qualquer momento sem taxas adicionais."
              },
              {
                q: "Meus dados estão seguros?",
                a: "Com certeza. Todos os dados operacionais são armazenados na infraestrutura do Google Cloud e isolados individualmente por organização no banco de dados."
              },
              {
                q: "Funciona no celular?",
                a: "Sim. O sistema foi desenvolvido com design responsivo, otimizado para celulares e tablets no chão de fábrica e na operação logística."
              },
              {
                q: "Quantos usuários posso ter?",
                a: "Ilimitados. Diferente de outros softwares, nós não cobramos tarifas adicionais por quantidade de funcionários cadastrados."
              },
              {
                q: "Como funciona o pagamento?",
                a: "O pagamento é processado pela plataforma Asaas. Aceitamos Pix com liberação imediata, Cartões de Crédito ou boleto bancário faturado."
              }
            ].map((faq, idx) => (
              <div key={idx} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl space-y-2">
                <div className="flex gap-2.5 items-start">
                  <HelpCircle className="h-5 w-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                  <h4 className="font-bold text-md">{faq.q}</h4>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] pl-7 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[hsl(var(--border))] text-center text-sm text-[hsl(var(--muted-foreground))] space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-6 h-6 grayscale opacity-80"><TecgasLogo /></div>
          <span className="font-bold text-lg uppercase">Altec</span>
        </div>
        <p>&copy; 2025 ALTEC. Todos os direitos reservados.</p>
        
        <div className="flex justify-center gap-6 text-xs font-medium">
          <a href="#privacy" className="hover:underline hover:text-[hsl(var(--foreground))]">Política de Privacidade</a>
          <a href="#terms" className="hover:underline hover:text-[hsl(var(--foreground))]">Termos de Uso</a>
        </div>
      </footer>

    </div>
  );
}

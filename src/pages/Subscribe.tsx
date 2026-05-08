import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TecgasLogo } from '../components/TecgasLogo';
import { auth, signInWithGoogle } from '../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CreditCard, QrCode, FileText, CheckCircle, Loader2 } from 'lucide-react';

export function Subscribe() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form Data
  const [formData, setFormData] = useState({
    name: '', email: '', cpfCnpj: '', phone: '', paymentMethod: 'PIX'
  });

  const [cardData, setCardData] = useState({
    number: '', holderName: '', expiryMonth: '', expiryYear: '', ccv: ''
  });

  const [result, setResult] = useState<any>(null); // To store Pix QR, Boleto URL, etc.

  const handleLoginFirst = async () => {
    try {
      if (!auth.currentUser) {
        await signInWithGoogle();
      }
      setFormData(prev => ({ 
        ...prev, 
        name: auth.currentUser?.displayName || '',
        email: auth.currentUser?.email || ''
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckout = async () => {
    if (!auth.currentUser) {
      setError("Você deve entrar com sua conta Google primeiro (no topo da tela).");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const functions = getFunctions();
      const createAsaasCustomerAndSubscription = httpsCallable(functions, 'createAsaasCustomerAndSubscription');
      
      const payload: any = {
        name: formData.name,
        email: formData.email,
        cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
        phone: formData.phone.replace(/\D/g, ''),
        paymentMethod: formData.paymentMethod
      };

      if (formData.paymentMethod === 'CREDIT_CARD') {
        payload.creditCard = {
          holderName: cardData.holderName,
          number: cardData.number,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          ccv: cardData.ccv
        };
        payload.creditCardHolderInfo = {
          name: formData.name,
          email: formData.email,
          cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
          postalCode: "00000000", // Simples
          addressNumber: "0",
          phone: formData.phone.replace(/\D/g, '')
        };
      }

      const res = await createAsaasCustomerAndSubscription(payload);
      setResult((res.data as any));
      setStep(3);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erro ao processar assinatura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center py-10 px-4">
      <div className="w-12 h-12 mb-8" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
        <TecgasLogo />
      </div>
      
      <div className="max-w-xl w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header Steps */}
        <div className="bg-[hsl(var(--muted))] p-6 border-b border-[hsl(var(--border))]">
          <h2 className="text-2xl font-bold mb-2">Assinar Almox pro</h2>
          <p className="text-[hsl(var(--muted-foreground))]">Comece a usar agora por apenas R$ 10,00 mensais.</p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 text-center font-medium border-b border-destructive/20">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="p-6 md:p-8">
          
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in">
               {!auth.currentUser && (
                <div className="bg-[hsl(var(--primary))]/10 p-4 rounded-lg flex items-center justify-between border border-[hsl(var(--primary))]/20">
                  <span className="text-sm">Para continuar, vincule com Google:</span>
                  <Button size="sm" onClick={handleLoginFirst}>Logar com Google</Button>
                </div>
               )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nome Completo</label>
                  <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">E-mail</label>
                  <input type="email" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!!auth.currentUser?.email} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">CPF/CNPJ</label>
                    <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                      value={formData.cpfCnpj} onChange={e => setFormData({...formData, cpfCnpj: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">WhatsApp</label>
                    <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                      value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
              </div>

              <Button className="w-full h-12 text-lg" 
                disabled={!formData.name || !formData.email || !formData.cpfCnpj || !auth.currentUser} 
                onClick={() => setStep(2)}>
                Próximo Passo
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="font-medium text-lg">Como quer pagar?</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={() => setFormData({...formData, paymentMethod: 'PIX'})}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${formData.paymentMethod === 'PIX' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'}`}
                >
                  <QrCode className="h-6 w-6" />
                  <span className="text-sm font-medium">Pix</span>
                </button>
                <button 
                  onClick={() => setFormData({...formData, paymentMethod: 'CREDIT_CARD'})}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${formData.paymentMethod === 'CREDIT_CARD' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'}`}
                >
                  <CreditCard className="h-6 w-6" />
                  <span className="text-sm font-medium">Cartão</span>
                </button>
                <button 
                  onClick={() => setFormData({...formData, paymentMethod: 'BOLETO'})}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${formData.paymentMethod === 'BOLETO' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'}`}
                >
                  <FileText className="h-6 w-6" />
                  <span className="text-sm font-medium">Boleto</span>
                </button>
              </div>

              {formData.paymentMethod === 'CREDIT_CARD' && (
                <div className="space-y-4 pt-4 border-t border-[hsl(var(--border))]">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Número do Cartão</label>
                    <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                      value={cardData.number} onChange={e => setCardData({...cardData, number: e.target.value.replace(/\D/g, '')})} maxLength={16} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nome Impresso no Cartão</label>
                    <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                      value={cardData.holderName} onChange={e => setCardData({...cardData, holderName: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Mês (MM)</label>
                      <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                        value={cardData.expiryMonth} onChange={e => setCardData({...cardData, expiryMonth: e.target.value})} maxLength={2} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Ano (AAAA)</label>
                      <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                        value={cardData.expiryYear} onChange={e => setCardData({...cardData, expiryYear: e.target.value})} maxLength={4} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">CVV</label>
                      <input type="text" className="w-full h-12 px-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                        value={cardData.ccv} onChange={e => setCardData({...cardData, ccv: e.target.value})} maxLength={4} />
                    </div>
                  </div>
                </div>
              )}

              {formData.paymentMethod === 'PIX' && (
                <p className="text-[hsl(var(--muted-foreground))] text-sm text-center py-4">O QR Code e o Código Copia-E-Cola serão gerados na próxima etapa.</p>
              )}

              {formData.paymentMethod === 'BOLETO' && (
                <p className="text-[hsl(var(--muted-foreground))] text-sm text-center py-4">O boleto será gerado e enviado para seu email após a confirmação.</p>
              )}

              <div className="flex space-x-4">
                <Button variant="outline" className="h-12 w-1/3" onClick={() => setStep(1)} disabled={loading}>
                  Voltar
                </Button>
                <Button className="h-12 w-2/3 flex-1" onClick={handleCheckout} disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto"/> : 'Finalizar Assinatura'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95">
              <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold">Quase lá!</h2>
              
              {formData.paymentMethod === 'PIX' && (
                <div className="max-w-sm mx-auto space-y-4">
                  <p className="text-[hsl(var(--muted-foreground))]">Realize o pagamento de **R$ 10,00** para ativar sua conta.</p>
                  
                  <div className="flex flex-col items-center space-y-6 p-6 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--muted))]/30">
                    <div className="w-full space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] text-left block">Chave PIX (Celular)</label>
                       <div className="flex items-center gap-2 p-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg">
                          <span className="font-mono text-lg font-bold flex-1 text-left">91986181270</span>
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-8 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText("91986181270");
                            }}
                          >
                             Copiar
                          </Button>
                       </div>
                    </div>

                    <div className="w-full space-y-1 py-1 border-t border-b border-[hsl(var(--border))]">
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Valor a pagar:</p>
                      <p className="text-2xl font-black text-[hsl(var(--primary))]">R$ 10,00</p>
                    </div>

                    <div className="w-full text-left p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                       <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium leading-tight">
                         Após o pagamento, seu acesso será liberado. Guarde o comprovante de transferência.
                       </p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4">O sistema verifica automaticamente os pagamentos recebidos.</p>
                </div>
              )}

              {formData.paymentMethod === 'BOLETO' && (
                <div className="max-w-sm mx-auto space-y-4">
                  <p className="text-[hsl(var(--muted-foreground))]">O boleto está disponível para pagamento.</p>
                  <a href={result?.invoiceUrl} target="_blank" rel="noreferrer" className="w-full block bg-[hsl(var(--primary))] text-white py-3 rounded-md font-semibold mt-4">
                    Visualizar Boleto
                  </a>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4">O acesso pode levar até 2 dias úteis para ser liberado via boleto.</p>
                </div>
              )}

              {formData.paymentMethod === 'CREDIT_CARD' && (
                <div className="max-w-sm mx-auto space-y-4">
                  <p className="text-[hsl(var(--muted-foreground))]">Sua assinatura está sendo processada.</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4">Se aprovada, seu acesso será liberado em instantes.</p>
                </div>
              )}

              <div className="pt-8 mb-4">
                <Button variant="outline" className="w-full max-w-sm" onClick={() => navigate('/app/dashboard')}>
                  Ir para o App (Verifica Acesso)
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

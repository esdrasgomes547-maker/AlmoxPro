import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { TecgasLogo } from '../components/TecgasLogo';
import { auth, signInWithGoogle, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { CreditCard, QrCode, FileText, CheckCircle, Loader2, ClipboardCheck, ArrowLeft } from 'lucide-react';

export function Subscribe() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dados do Formulário
  const [formData, setFormData] = useState({
    name: '', email: '', cpfCnpj: '', phone: '', paymentMethod: 'PIX'
  });

  const [cardData, setCardData] = useState({
    number: '', holderName: '', expiryMonth: '', expiryYear: '', ccv: ''
  });

  const [result, setResult] = useState<any>(null); // Armazena QR Code Pix, boleto URL, etc.
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutos em segundos

  // Countdown timer para Pix
  useEffect(() => {
    if (step === 3 && formData.paymentMethod === 'PIX' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, timeLeft, formData.paymentMethod]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    } catch (e: any) {
      console.error(e);
      setError("Erro ao autenticar com Google: " + e.message);
    }
  };

  const handleCheckout = async () => {
    if (!auth.currentUser) {
      setError("Você deve entrar com sua conta Google primeiro.");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
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
          postalCode: "00000000",
          addressNumber: "0",
          phone: formData.phone.replace(/\D/g, '')
        };
      }

      const res = await createAsaasCustomerAndSubscription(payload);
      const data = res.data as any;
      setResult(data);
      
      // Se for cartão de crédito e o status for aprovado (CONFIRMED/RECEIVED), redireciona direto
      if (formData.paymentMethod === 'CREDIT_CARD' && (data.status === 'CONFIRMED' || data.status === 'RECEIVED')) {
        navigate('/app/dashboard');
      } else {
        setStep(3);
      }

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erro ao processar a assinatura.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (result?.pixCopyPaste) {
      navigator.clipboard.writeText(result.pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center py-10 px-4 selection:bg-[hsl(var(--primary))]/30">
      <div className="w-12 h-12 mb-8" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <TecgasLogo />
      </div>
      
      <div className="max-w-xl w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header Steps */}
        <div className="bg-[hsl(var(--muted))]/50 p-6 border-b border-[hsl(var(--border))]">
          <h2 className="text-2xl font-bold mb-1">Assinar ALTEC</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {step === 1 && "Passo 1: Identificação Operacional"}
            {step === 2 && "Passo 2: Escolha do Método de Pagamento"}
            {step === 3 && "Passo 3: Conclusão do Pagamento"}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 text-center font-medium border-b border-destructive/20 text-sm">
            {error}
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-md font-semibold text-[hsl(var(--muted-foreground))]">Gerando sua assinatura...</p>
          </div>
        ) : (
          <div className="p-6 md:p-8">
            
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {!auth.currentUser ? (
                  <div className="bg-[hsl(var(--primary))]/10 p-4 rounded-xl border border-[hsl(var(--primary))]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <span className="text-sm font-medium">Vincule sua conta Google primeiro:</span>
                    <Button size="sm" onClick={handleLoginFirst}>Entrar com Google</Button>
                  </div>
                ) : (
                  <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold">
                    Autenticado como: {auth.currentUser.email}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nome Completo</label>
                    <input 
                      type="text" 
                      className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40" 
                      value={formData.name} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })} 
                      placeholder="Nome do responsável pelo almoxarifado"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]" 
                      value={formData.email} 
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">CPF ou CNPJ</label>
                      <input 
                        type="text" 
                        className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40" 
                        value={formData.cpfCnpj} 
                        onChange={e => setFormData({ ...formData, cpfCnpj: e.target.value })}
                        placeholder="Apenas números"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">WhatsApp</label>
                      <input 
                        type="text" 
                        className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40" 
                        value={formData.phone} 
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Ex: (91) 98888-8888"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full h-12 text-md font-semibold" 
                  disabled={!formData.name || !formData.cpfCnpj || !formData.phone || !auth.currentUser} 
                  onClick={() => setStep(2)}
                >
                  Ir para Pagamento
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h3 className="font-semibold text-lg">Selecione o meio de pagamento:</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <button 
                    onClick={() => setFormData({ ...formData, paymentMethod: 'PIX' })}
                    className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition duration-200 ${formData.paymentMethod === 'PIX' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]/50'}`}
                  >
                    <QrCode className="h-6 w-6" />
                    <span className="text-sm font-semibold">Pix</span>
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, paymentMethod: 'CREDIT_CARD' })}
                    className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition duration-200 ${formData.paymentMethod === 'CREDIT_CARD' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]/50'}`}
                  >
                    <CreditCard className="h-6 w-6" />
                    <span className="text-sm font-semibold">Cartão</span>
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, paymentMethod: 'BOLETO' })}
                    className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition duration-200 ${formData.paymentMethod === 'BOLETO' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]/50'}`}
                  >
                    <FileText className="h-6 w-6" />
                    <span className="text-sm font-semibold">Boleto</span>
                  </button>
                </div>

                {formData.paymentMethod === 'CREDIT_CARD' && (
                  <div className="space-y-4 pt-4 border-t border-[hsl(var(--border))] animate-in fade-in duration-300">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Número do Cartão</label>
                      <input 
                        type="text" 
                        className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                        value={cardData.number} 
                        onChange={e => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, '') })} 
                        maxLength={16}
                        placeholder="0000 0000 0000 0000"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Nome Impresso no Cartão</label>
                      <input 
                        type="text" 
                        className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                        value={cardData.holderName} 
                        onChange={e => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                        placeholder="COMO CONSTA NO CARTÃO"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Validade Mês</label>
                        <input 
                          type="text" 
                          className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                          value={cardData.expiryMonth} 
                          onChange={e => setCardData({ ...cardData, expiryMonth: e.target.value.replace(/\D/g, '') })} 
                          maxLength={2}
                          placeholder="MM"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Validade Ano</label>
                        <input 
                          type="text" 
                          className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                          value={cardData.expiryYear} 
                          onChange={e => setCardData({ ...cardData, expiryYear: e.target.value.replace(/\D/g, '') })} 
                          maxLength={4}
                          placeholder="AAAA"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">CVV</label>
                        <input 
                          type="text" 
                          className="w-full h-12 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                          value={cardData.ccv} 
                          onChange={e => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, '') })} 
                          maxLength={4}
                          placeholder="CVV"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'PIX' && (
                  <div className="bg-[hsl(var(--muted))]/30 p-4 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
                    A liberação é automática e imediata após o pagamento do código QR Code PIX.
                  </div>
                )}

                {formData.paymentMethod === 'BOLETO' && (
                  <div className="bg-[hsl(var(--muted))]/30 p-4 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
                    O boleto bancário será gerado e enviado para seu e-mail. A compensação pode levar até 2 dias úteis.
                  </div>
                )}

                <div className="flex gap-4 pt-4 border-t border-[hsl(var(--border))]">
                  <Button variant="outline" className="h-12 w-1/3 flex items-center justify-center gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button className="h-12 w-2/3 flex-1 font-semibold" onClick={handleCheckout}>
                    Confirmar Assinatura (R$ 10)
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black">Falta muito pouco!</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Realize o pagamento para liberar seu acesso.</p>
                </div>

                {formData.paymentMethod === 'PIX' && (
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="flex flex-col items-center space-y-4 p-6 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--muted))]/30">
                      {result?.pixQrCode && (
                        <div className="p-3 bg-white rounded-lg border border-gray-200">
                          <img 
                            src={`data:image/png;base64,${result.pixQrCode}`} 
                            alt="QR Code Pix" 
                            className="w-44 h-44" 
                          />
                        </div>
                      )}
                      
                      <div className="w-full text-center space-y-1">
                        <span className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">Valor a pagar:</span>
                        <p className="text-2xl font-black text-[hsl(var(--primary))]">R$ 10,00</p>
                      </div>

                      {result?.pixCopyPaste && (
                        <div className="w-full space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] text-left block">Código Copia e Cola</label>
                          <div className="flex items-center gap-2 p-2.5 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg">
                            <input 
                              type="text" 
                              readOnly 
                              value={result.pixCopyPaste} 
                              className="font-mono text-xs text-left bg-transparent border-none outline-none flex-1 truncate select-all"
                            />
                            <Button 
                              size="sm" 
                              variant={copied ? "default" : "secondary"} 
                              className="h-8 px-3 shrink-0" 
                              onClick={handleCopyCode}
                            >
                              {copied ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : "Copiar"}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-2">
                        Tempo restante para expiração do PIX: {formatTime(timeLeft)}
                      </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-left text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
                      Após o pagamento, o webhook do Asaas avisa nossa API e seu login é liberado de imediato. Clique no botão abaixo após realizar o Pix.
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'BOLETO' && (
                  <div className="max-w-sm mx-auto space-y-4">
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">O boleto foi faturado e o link está disponível para pagamento.</p>
                    <a 
                      href={result?.invoiceUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="w-full block bg-[hsl(var(--primary))] text-white py-3 rounded-lg font-bold text-center hover:opacity-90 transition duration-200"
                    >
                      Visualizar Boleto Bancário
                    </a>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4">
                      O acesso será liberado em até 2 dias úteis após a compensação do boleto.
                    </p>
                  </div>
                )}

                {formData.paymentMethod === 'CREDIT_CARD' && (
                  <div className="max-w-sm mx-auto space-y-4 text-sm">
                    <p className="text-[hsl(var(--muted-foreground))]">Sua assinatura está sendo analisada e processada pela operadora.</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Se aprovada, seu acesso será liberado em instantes.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-[hsl(var(--border))]">
                  <Button className="w-full max-w-sm h-12 font-semibold" onClick={() => navigate('/app/dashboard')}>
                    Verificar Acesso e Entrar no Painel
                  </Button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

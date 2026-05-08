import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, User, Lock, Building, Truck, Globe, MapPin, Upload, X, Loader2 } from "lucide-react";
import { useTheme } from "../components/ThemeProvider";
import { db, handleFirestoreError, OperationType, storage } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useOrganization } from "../lib/tenant";

export function Settings() {
  const { orgId } = useOrganization();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [settings, setSettings] = useState({
    companyName: "Almox pro - Gestão",
    avatarUrl: "",
    welcomeMessage: "",
    cnpj: "00.000.000/0001-00",
    email: "contato@almoxpro.com.br",
    phone: "(11) 4002-8922",
    lowStockAlerts: true,
    shipmentUpdates: true,
    dailyEmail: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!orgId) return;
      try {
        const docRef = doc(db, `organizations/${orgId}/settings`, "default");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as any);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `organizations/${orgId}/settings/default`);
      }
    };
    fetchSettings();
  }, [orgId]);

  const handleSave = async (section: string) => {
    if (!orgId) return;
    try {
      await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), settings);
      alert(`${section} salvas com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `organizations/${orgId}/settings/default`);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    // Aumentamos o limite para 5MB já que Storage aguenta bem
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      // Criar referência no Storage: organizations/{orgId}/logo
      const fileRef = ref(storage, `organizations/${orgId}/assets/logo_${Date.now()}`);
      
      // Upload do arquivo
      const snapshot = await uploadBytes(fileRef, file);
      
      // Pegar URL de download
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      setSettings(prev => ({ ...prev, avatarUrl: downloadUrl }));
      
      // Salvar imediatamente para persistir o novo link no banco
      await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), {
        ...settings,
        avatarUrl: downloadUrl
      });
      
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao fazer upload da imagem para a nuvem.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeAvatar = () => {
    setSettings(prev => ({ ...prev, avatarUrl: "" }));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Gerencie as preferências da sua conta e configurações do sistema.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Building className="h-5 w-5 mr-2 text-[hsl(var(--primary))]" />
              Dados da Empresa
            </CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Informações globais da Tecgas e ALTEC.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Empresa</label>
                <input type="text" className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Logo da Empresa</label>
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 rounded-lg border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center overflow-hidden bg-[hsl(var(--muted))]/30 group">
                      {settings.avatarUrl ? (
                        <>
                          <img src={settings.avatarUrl} alt="Logo Preview" className="h-full w-full object-contain" />
                          <button 
                            onClick={removeAvatar}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-5 w-5 text-white" />
                          </button>
                        </>
                      ) : (
                        <Building className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange}
                      />
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Selecionar Imagem
                      </Button>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Armazenamento em Nuvem Ativado. Máx: 5MB.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Ou link externo</label>
                    <input 
                      type="text" 
                      placeholder="https://exemplo.com/logo.jpg" 
                      className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                      value={settings.avatarUrl} 
                      onChange={e => setSettings({...settings, avatarUrl: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Mensagem de Boas-vindas Personalizada</label>
                <input 
                  type="text" 
                  placeholder="Ex: Estamos felizes em ter você aqui!" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" 
                  value={settings.welcomeMessage || ""} 
                  onChange={e => setSettings({...settings, welcomeMessage: e.target.value})} 
                />
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Esta mensagem aparecerá no Dashboard de todos os usuários da sua empresa.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CNPJ</label>
                <input type="text" className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" value={settings.cnpj} onChange={e => setSettings({...settings, cnpj: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email de Contato</label>
                <input type="email" className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone Principal</label>
                <input type="tel" className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={() => handleSave('Informações da empresa')}>Salvar Informações</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <User className="h-5 w-5 mr-2 text-[hsl(var(--primary))]" />
              Preferências de Interface
            </CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Personalize a aparência do sistema para você.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Tema da Aplicação</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setTheme('light')}
                  className={`flex-1 flex items-center justify-center p-4 rounded-lg border-2 ${theme === 'light' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'} transition-all`}
                >
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                       <div className="w-5 h-5 rounded-full bg-yellow-400"></div>
                    </div>
                    <span className="text-sm font-medium">Claro</span>
                  </div>
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`flex-1 flex items-center justify-center p-4 rounded-lg border-2 ${theme === 'dark' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'} transition-all`}
                >
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 shadow-sm flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.5)]"></div>
                    </div>
                    <span className="text-sm font-medium">Escuro</span>
                  </div>
                </button>
                <button 
                  onClick={() => setTheme('system')}
                  className={`flex-1 flex items-center justify-center p-4 rounded-lg border-2 ${theme === 'system' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'} transition-all`}
                >
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-900 border border-gray-300 shadow-sm flex items-center justify-center">
                       <Globe className="h-5 w-5 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium">Sistema</span>
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Bell className="h-5 w-5 mr-2 text-[hsl(var(--primary))]" />
              Notificações e Alertas
            </CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Configure como e quando você deseja ser notificado.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Alertas de Estoque Baixo</h4>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Receba notificações quando um produto atingir a quantidade mínima (CRÍTICO/WARNING).</p>
                </div>
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]" checked={settings.lowStockAlerts} onChange={e => setSettings({...settings, lowStockAlerts: e.target.checked})} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Atualizações de Expedição</h4>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Notificações sobre envios, alterações de status e entregas.</p>
                </div>
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]" checked={settings.shipmentUpdates} onChange={e => setSettings({...settings, shipmentUpdates: e.target.checked})} />
              </div>
              <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-4">
                <div>
                  <h4 className="text-sm font-medium">Email Diário</h4>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Resumo diário do status do estoque e movimentos do dia.</p>
                </div>
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]" checked={settings.dailyEmail} onChange={e => setSettings({...settings, dailyEmail: e.target.checked})} />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={() => handleSave('Preferências de notificação')}>Atualizar Preferências</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

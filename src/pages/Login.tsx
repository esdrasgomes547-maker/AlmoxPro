import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TecgasLogo } from '../components/TecgasLogo';
import { signInWithGoogle, loginWithEmail, createUserWithEmail, auth, db, signInAnonymousUser } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, ShieldCheck, Mail, Lock, Chrome, Eye, EyeOff } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const isBypass = localStorage.getItem('master_bypass') === 'true';
      if (user || isBypass) {
        navigate('/app/dashboard');
      }
      setInitialLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        if (formData.password !== formData.confirmPassword) {
          setError('As senhas não coincidem.');
          setLoading(false);
          return;
        }
        if (!formData.login.includes('@')) {
          setError('Use um e-mail válido para o cadastro.');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmail(formData.login, formData.password);
        
        // Criar perfil inicial no Firestore
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: formData.login,
          orgId: 'demo-org',
          role: 'user',
          plan: 'free',
          createdAt: new Date().toISOString()
        });

        navigate('/app/dashboard');
        return;
      }

      // Chave Mestra do Criador
      if (formData.login.toLowerCase() === 'bresdrasalmox' && formData.password === 'Bresdras7507@') {
         localStorage.setItem('master_bypass', 'true');
         try {
           await signInAnonymousUser();
         } catch (anonErr: any) {
           console.warn('Anonymous Auth disabled:', anonErr);
           if (anonErr.code === 'auth/admin-restricted-operation') {
             // Mesmo sem anon auth, permitimos o bypass via localStorage, 
             // mas avisamos que o DB será demo-only
             console.log('Using local-only bypass');
           }
         }
         navigate('/app/dashboard');
         return;
      }

      // Login normal (email real)
      if (formData.login.includes('@')) {
        localStorage.removeItem('master_bypass');
        await loginWithEmail(formData.login, formData.password);
        navigate('/app/dashboard');
      } else {
        setError('Por favor, insira um e-mail válido ou use a Chave Mestra.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(isRegistering ? 'Erro ao criar conta. Tente outro e-mail.' : 'Falha no login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('master_bypass');
      await signInWithGoogle();
      navigate('/app/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="w-full max-w-md space-y-8 bg-[hsl(var(--card))] p-8 rounded-2xl border border-[hsl(var(--border))] shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12">
              <TecgasLogo />
            </div>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            {isRegistering ? 'Criar Conta' : 'Acesso ao Almox pro'}
          </h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            {isRegistering ? 'Cadastre-se para começar a gerenciar sua operação' : 'Entre para gerenciar sua operação'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <input
                type="text"
                required
                className="block w-full pl-10 pr-3 py-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
                placeholder={isRegistering ? "Seu melhor e-mail" : "E-mail ou Login Mestre"}
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="block w-full pl-10 pr-10 py-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
                placeholder={isRegistering ? "Crie uma senha" : "Sua senha"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {isRegistering && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-10 pr-10 py-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
                  placeholder="Confirme sua senha"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-lg font-semibold shadow-lg shadow-black/20"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isRegistering ? 'Cadastrar' : 'Entrar')}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
              onClick={() => setIsRegistering(!isRegistering)}
            >
              {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
            </button>
          </div>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[hsl(var(--border))]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]">Ou continue com</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-11 flex items-center justify-center gap-2 border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <Chrome className="h-5 w-5" />
              <span>Entrar com Google</span>
            </>
          )}
        </Button>

        <div className="mt-8 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Proteção de dados garantida pela infraestrutura Google Cloud & Firebase.
          </p>
        </div>
      </div>
    </div>
  );
}

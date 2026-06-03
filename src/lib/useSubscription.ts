import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export function useSubscription() {
  const [role, setRole] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    let refreshInterval: NodeJS.Timeout | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      if (user) {
        // Função para obter claims do token
        const updateClaims = async (force = false) => {
          try {
            const tokenResult = await user.getIdTokenResult(force);
            const claims = tokenResult.claims;
            const userRole = (claims.role as string) || null;
            const userPlan = (claims.plan as string) || null;

            setRole(userRole);
            setPlan(userPlan);
            setIsMaster(userRole === 'master');
          } catch (e) {
            console.error("Erro ao obter Custom Claims do usuário:", e);
          }
        };

        // Força o refresh na autenticação para obter as claims mais recentes
        await updateClaims(true);

        // Agendar renovação do token a cada 55 minutos
        refreshInterval = setInterval(() => {
          console.log("Renovando token do Firebase Auth...");
          updateClaims(true);
        }, 55 * 60 * 1000);

        // Acompanha o documento de dados do usuário em tempo real no Firestore
        unsubDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setOrgId(data.orgId || null);
            // Sincroniza claims se houver divergência detectada no banco
            if (data.role && data.role !== role) {
              updateClaims(true);
            }
          }
          setLoading(false);
        }, (error) => {
          console.warn("Aviso ao ler perfil de usuário no Firestore:", error.message);
          setLoading(false);
        });

      } else {
        setRole(null);
        setPlan(null);
        setOrgId(null);
        setIsMaster(false);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [role]);

  // Considerado ativo se possuir role premium_max ou master
  const isActive = role === 'premium_max' || role === 'master';

  return {
    role,
    plan,
    orgId,
    loading,
    isActive,
    isMaster
  };
}

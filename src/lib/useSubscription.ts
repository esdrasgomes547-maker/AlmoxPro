import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType, signInAnonymousUser } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

export function useSubscription() {
  const [role, setRole] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isMasterRole, setIsMasterRole] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    let unsubMaster: (() => void) | undefined;

    const checkBypass = () => {
      const isBypass = localStorage.getItem('master_bypass') === 'true';
      if (isBypass) {
        setIsMasterRole(true);
        return true;
      }
      return false;
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const isBypassed = checkBypass();

      if (user) {
        if (user.email === "esdrasgomes547@gmail.com" || isBypassed) {
          setIsMasterRole(true);
        } else if (user.email) {
          unsubMaster = onSnapshot(doc(db, "masters", user.email), (snap) => {
             if (snap.exists()) setIsMasterRole(true);
             else setIsMasterRole(false);
          }, (err) => console.warn("Master check restriction:", err.message));
        }

        unsubDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setRole(data.role || null);
            setOrgId(data.orgId || null);
            setPlan(data.plan || null);
          }
          setLoading(false);
        }, (error) => {
          console.warn("User data restriction:", error.message);
          setLoading(false);
        });

      } else {
        setRole(null);
        setOrgId(null);
        setPlan(null);
        if (isBypassed) {
          setIsMasterRole(true);
          // Auto sign in if bypassed but no user (e.g. refresh)
          signInAnonymousUser().catch(err => {
            console.warn("Anonymous auth failed in background:", err.message);
            // If auth fails, we should still allow the app to show the structure,
            // even if Firestore data will be restricted.
            setLoading(false);
          });
          // If we are bypassed, we can allow loading to finish quickly
          setLoading(false);
        } else {
          setIsMasterRole(false);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      if (unsubMaster) unsubMaster();
    };
  }, []);

  return {
    role,
    plan,
    orgId,
    loading,
    isActive: true, // SaaS removido: todos têm acesso total agora
    isMaster: isMasterRole
  };
}

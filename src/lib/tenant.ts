import { useSubscription } from "./useSubscription";

/**
 * Retorna o `orgId` do usuário autenticado no sistema.
 * É baseado nos dados de `useSubscription` (que consolida o Custom Claim ou Firestore doc).
 */
export function useOrganization() {
  const { orgId, loading, role, isMaster } = useSubscription();
  
  // Se for master e não tiver orgId (bypass), usamos um padrão para visualização
  const effectiveOrgId = (isMaster && !orgId) ? "demo-org" : orgId;

  return { orgId: effectiveOrgId, loading, role, isMaster, realOrgId: orgId };
}

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

// Helper para ativar a assinatura e setar claims
async function activateSubscriptionHelper(
  orgId: string,
  uid: string,
  asaasCustomerId: string,
  asaasSubscriptionId: string,
  plan: string
) {
  console.log(`Definindo Custom Claims para uid: ${uid}`);
  // 1. Seta custom claims { role: "premium_max", plan: "premium_max" }
  await admin.auth().setCustomUserClaims(uid, { role: "premium_max", plan: "premium_max" });

  // 2. Cria/atualiza /subscriptions/{orgId}
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  console.log(`Atualizando /subscriptions/${orgId} no Firestore`);
  await db.collection("subscriptions").doc(orgId).set({
    status: "active",
    plan: plan,
    asaasCustomerId,
    asaasSubscriptionId,
    nextBillingDate: nextBillingDate.toISOString(),
    updatedAt: new Date().toISOString(),
    uid: uid
  }, { merge: true });

  // 3. Cria /organizations/{orgId} se não existir
  console.log(`Verificando existência de /organizations/${orgId}`);
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    await orgRef.set({
      name: `Organização ${orgId}`,
      createdAt: new Date().toISOString()
    });
  }

  // 4. Cria/atualiza /users/{uid} com orgId, role, plan
  console.log(`Atualizando /users/${uid} com orgId e role premium_max`);
  await db.collection("users").doc(uid).set({
    orgId,
    role: "premium_max",
    plan: plan,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// 1. setMasterRole: Promove um usuário a administrador master
export const setMasterRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário deve estar autenticado.");
  }

  const callerUid = request.auth.uid;
  const callerUserDoc = await db.collection("users").doc(callerUid).get();
  const callerRole = callerUserDoc.data()?.role;

  // Permite se o chamador for master em custom claims, no banco, ou for o email principal
  const isCallerMaster = request.auth.token.role === "master" || 
                         callerRole === "master" || 
                         request.auth.token.email === "esdrasgomes547@gmail.com";

  if (!isCallerMaster) {
    throw new HttpsError("permission-denied", "Apenas administradores masters podem promover outros usuários.");
  }

  const targetUid = request.data.uid;
  if (!targetUid) {
    throw new HttpsError("invalid-argument", "O UID do usuário alvo é obrigatório.");
  }

  console.log(`Promovendo UID ${targetUid} a master`);
  await admin.auth().setCustomUserClaims(targetUid, { role: "master" });

  await db.collection("users").doc(targetUid).set({
    role: "master",
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { success: true, message: `Usuário ${targetUid} promovido a master.` };
});

// 2. activateSubscription: Ativação manual de assinatura por um admin master
export const activateSubscription = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário deve estar autenticado.");
  }

  const isCallerMaster = request.auth.token.role === "master" || 
                         request.auth.token.email === "esdrasgomes547@gmail.com";
  if (!isCallerMaster) {
    throw new HttpsError("permission-denied", "Apenas administradores masters podem ativar assinaturas manualmente.");
  }

  const { orgId, uid, asaasCustomerId, asaasSubscriptionId, plan } = request.data;
  if (!orgId || !uid) {
    throw new HttpsError("invalid-argument", "orgId e uid são obrigatórios.");
  }

  await activateSubscriptionHelper(
    orgId,
    uid,
    asaasCustomerId || "",
    asaasSubscriptionId || "",
    plan || "premium_max"
  );

  return { success: true, message: "Assinatura ativada com sucesso." };
});

// 3. createAsaasCustomerAndSubscription: Cria cliente e assinatura no Asaas
export const createAsaasCustomerAndSubscription = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário deve estar autenticado.");
  }

  const uid = request.auth.uid;
  const { name, email, cpfCnpj, phone, paymentMethod, creditCard, creditCardHolderInfo } = request.data;

  if (!name || !email || !cpfCnpj || !phone || !paymentMethod) {
    throw new HttpsError("invalid-argument", "Dados obrigatórios ausentes.");
  }

  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  if (!ASAAS_API_KEY) {
    throw new HttpsError("failed-precondition", "A chave da API do Asaas não está configurada no servidor.");
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  let orgId = userSnap.data()?.orgId;
  if (!orgId) {
    orgId = `org_${uid}`;
  }

  try {
    const ASAAS_ENV = process.env.ASAAS_ENV || "sandbox";
    const ASAAS_BASE = ASAAS_ENV === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    console.log(`Criando cliente no Asaas (${ASAAS_ENV})...`);
    const customerRes = await axios.post(`${ASAAS_BASE}/customers`, {
      name,
      email,
      cpfCnpj,
      phone,
      notificationDisabled: true
    }, {
      headers: { access_token: ASAAS_API_KEY }
    });

    const asaasCustomerId = customerRes.data.id;
    console.log(`Cliente criado com ID Asaas: ${asaasCustomerId}`);

    // Data de vencimento da primeira parcela da assinatura (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDueDate = tomorrow.toISOString().split("T")[0];

    console.log("Criando assinatura no Asaas...");
    const subPayload: any = {
      customer: asaasCustomerId,
      billingType: paymentMethod, // PIX, CREDIT_CARD, BOLETO
      value: 10.00,
      nextDueDate,
      cycle: "MONTHLY",
      description: "Assinatura AlmoxPro Premium Max"
    };

    if (paymentMethod === "CREDIT_CARD" && creditCard && creditCardHolderInfo) {
      subPayload.creditCard = creditCard;
      subPayload.creditCardHolderInfo = creditCardHolderInfo;
    }

    const subRes = await axios.post(`${ASAAS_BASE}/subscriptions`, subPayload, {
      headers: { access_token: ASAAS_API_KEY }
    });

    const asaasSubscriptionId = subRes.data.id;
    console.log(`Assinatura criada com ID Asaas: ${asaasSubscriptionId}`);

    // Registra no Firestore como pendente
    await db.collection("subscriptions").doc(orgId).set({
      uid,
      status: "pending",
      plan: "premium_max",
      asaasCustomerId,
      asaasSubscriptionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.collection("users").doc(uid).set({
      orgId,
      email,
      role: "inactive",
      plan: "premium_max",
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Busca a primeira cobrança pendente para retornar detalhes (PIX copia-e-cola / Boleto URL)
    console.log("Buscando pagamentos da assinatura...");
    const paymentsRes = await axios.get(`${ASAAS_BASE}/payments?subscription=${asaasSubscriptionId}`, {
      headers: { access_token: ASAAS_API_KEY }
    });

    const payments = paymentsRes.data.data;
    if (!payments || payments.length === 0) {
      throw new Error("Nenhuma cobrança gerada para esta assinatura.");
    }

    const paymentId = payments[0].id;
    const invoiceUrl = payments[0].invoiceUrl || payments[0].bankSlipUrl;

    const responseData: any = {
      success: true,
      orgId,
      asaasCustomerId,
      asaasSubscriptionId,
      paymentId,
      invoiceUrl,
      status: payments[0].status
    };

    if (paymentMethod === "PIX") {
      console.log("Buscando QR Code do Pix...");
      const pixRes = await axios.get(`${ASAAS_BASE}/payments/${paymentId}/pixQrCode`, {
        headers: { access_token: ASAAS_API_KEY }
      });
      responseData.pixQrCode = pixRes.data.encodedImage;
      responseData.pixCopyPaste = pixRes.data.payload;
    }

    return responseData;

  } catch (error: any) {
    const errorDetails = error.response?.data?.errors?.[0]?.description || error.message || "Erro de integração com Asaas.";
    console.error("Detalhes do erro do Asaas:", JSON.stringify(error.response?.data || error.message));
    throw new HttpsError("internal", errorDetails);
  }
});

// 4. updateUserRole: Permite master alterar role de qualquer usuário (e.g. reativar, suspender)
export const updateUserRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário deve estar autenticado.");
  }

  const callerUid = request.auth.uid;
  const callerUserDoc = await db.collection("users").doc(callerUid).get();
  const callerRole = callerUserDoc.data()?.role;

  const isCallerMaster = request.auth.token.role === "master" || 
                         callerRole === "master" || 
                         request.auth.token.email === "esdrasgomes547@gmail.com";

  if (!isCallerMaster) {
    throw new HttpsError("permission-denied", "Apenas administradores masters podem alterar permissões.");
  }

  const { targetUid, role, orgId, plan } = request.data;
  if (!targetUid || !role) {
    throw new HttpsError("invalid-argument", "targetUid e role são obrigatórios.");
  }

  console.log(`Alterando role de UID ${targetUid} para ${role}`);
  await admin.auth().setCustomUserClaims(targetUid, { role, plan: plan || role });

  const userUpdate: any = {
    role,
    updatedAt: new Date().toISOString()
  };
  if (orgId) userUpdate.orgId = orgId;
  if (plan) userUpdate.plan = plan;

  await db.collection("users").doc(targetUid).set(userUpdate, { merge: true });

  if (orgId) {
    await db.collection("subscriptions").doc(orgId).set({
      status: role === "premium_max" ? "active" : role === "inactive" ? "inactive" : role,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  return { success: true, message: `Permissões do usuário ${targetUid} atualizadas.` };
});

// 5. asaasWebhook: Endpoint público para notificações de pagamento do Asaas
export const asaasWebhook = onRequest({ cors: true }, async (req, res) => {
  try {
    const token = req.headers["asaas-access-token"];
    const localToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (localToken && token !== localToken) {
      console.warn("Token de webhook incorreto recebido.");
      res.status(200).send("Unauthorized");
      return;
    }

    const event = req.body;
    console.log("Evento Webhook Asaas:", JSON.stringify(event));

    const eventName = event.event;
    // O Asaas pode enviar subscription de formas diferentes no webhook de pagamento
    const subscriptionId = event.payment?.subscription || event.subscription;

    if (!subscriptionId) {
      console.warn("ID da assinatura ausente no payload.");
      res.status(200).send("No subscription ID");
      return;
    }

    // Busca a assinatura correspondente no Firestore
    const subQuery = await db.collection("subscriptions")
      .where("asaasSubscriptionId", "==", subscriptionId)
      .limit(1)
      .get();

    if (subQuery.empty) {
      console.warn(`Assinatura não cadastrada no Firestore para Asaas ID: ${subscriptionId}`);
      res.status(200).send("Subscription not found");
      return;
    }

    const subDoc = subQuery.docs[0];
    const orgId = subDoc.id;
    const subData = subDoc.data();
    const uid = subData.uid;

    if (eventName === "PAYMENT_CONFIRMED" || eventName === "PAYMENT_RECEIVED") {
      console.log(`Confirmando pagamento da org: ${orgId}, user: ${uid}`);
      await activateSubscriptionHelper(
        orgId,
        uid,
        subData.asaasCustomerId || event.payment?.customer || "",
        subscriptionId,
        "premium_max"
      );
    } else if (eventName === "PAYMENT_OVERDUE") {
      console.log(`Pagamento em atraso para a org: ${orgId}, user: ${uid}`);
      // Remove claims de acesso ativo
      await admin.auth().setCustomUserClaims(uid, { role: "inactive", plan: "inactive" });
      await db.collection("subscriptions").doc(orgId).update({
        status: "overdue",
        updatedAt: new Date().toISOString()
      });
      await db.collection("users").doc(uid).update({
        role: "inactive",
        plan: "inactive",
        updatedAt: new Date().toISOString()
      });
    } else if (eventName === "PAYMENT_DELETED") {
      console.log(`Assinatura deletada para a org: ${orgId}, user: ${uid}`);
      await admin.auth().setCustomUserClaims(uid, { role: "inactive", plan: "inactive" });
      await db.collection("subscriptions").doc(orgId).update({
        status: "deleted",
        updatedAt: new Date().toISOString()
      });
      await db.collection("users").doc(uid).update({
        role: "inactive",
        plan: "inactive",
        updatedAt: new Date().toISOString()
      });
    }

    res.status(200).send("OK");
  } catch (error: any) {
    console.error("Erro no processamento do webhook Asaas:", error);
    res.status(200).send(`Error: ${error.message}`);
  }
});

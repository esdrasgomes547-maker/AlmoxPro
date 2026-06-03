import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis de ambiente do arquivo .env na raiz do projeto
dotenv.config({ path: path.join(__dirname, '../.env') });

// Inicializa o SDK Admin do Firebase usando credenciais padrão de aplicativo (Google Application Default Credentials)
// Para uso local, defina a variável GOOGLE_APPLICATION_CREDENTIALS apontando para o arquivo JSON da sua chave de serviço.
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const uidsString = process.env.MASTER_UIDS || '';
const uids = uidsString.split(',').map(u => u.trim()).filter(Boolean);

if (uids.length === 0) {
  console.error("Nenhum UID especificado na variável MASTER_UIDS em .env");
  process.exit(1);
}

async function run() {
  console.log(`Iniciando promoção de masters para os UIDs: ${uids.join(', ')}`);
  const db = admin.firestore();
  
  for (const uid of uids) {
    try {
      console.log(`\nDefinindo custom claim { role: "master" } para o UID: ${uid}`);
      await admin.auth().setCustomUserClaims(uid, { role: 'master' });
      
      console.log(`Atualizando cadastro do usuário no Firestore...`);
      await db.collection('users').doc(uid).set({
        role: 'master',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      console.log(`Sucesso para o UID: ${uid}`);
    } catch (e: any) {
      console.error(`Erro ao processar o UID ${uid}:`, e.message || e);
    }
  }
  console.log("\nProcesso concluído.");
}

run().catch(err => {
  console.error("Erro na execução do script:", err);
});

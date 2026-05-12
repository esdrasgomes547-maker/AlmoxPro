import { formatBRL, preciseMultiply, preciseSum } from './exportService';

export const sendWhatsAppNotification = (phone: string, message: string) => {
  // Format phone number to remove non-numeric characters
  const formattedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  window.open(url, '_blank');
};

export const sendEmailReport = (email: string, subject: string, reportBody: string) => {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(reportBody);
  const url = `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
  window.open(url, '_blank');
};

export const generateSuppliersReport = (suppliers: any[]) => {
  const date = new Date().toLocaleDateString('pt-BR');
  let report = `*RELATÓRIO DE FORNECEDORES - Almox Pro (${date})*\n\n`;
  
  const active = suppliers.filter(s => s.status === 'ACTIVE');
  const review = suppliers.filter(s => s.status === 'REVIEW_NEEDED');
  
  report += `*Resumo:* ${suppliers.length} fornecedores cadastrados\n`;
  report += `Aprovados: ${active.length} | Em Revisão: ${review.length}\n\n`;

  report += `*Aprovados (${active.length}):*\n`;
  active.forEach(item => {
    report += `- [${item.category}] ${item.name} (${item.phone})\n`;
  });
  
  report += `\n*Aguardando Revisão (${review.length}):*\n`;
  review.forEach(item => {
    report += `- [${item.category}] ${item.name} (${item.phone})\n`;
  });
  
  return report;
};

export const generateShipmentsReport = (shipments: any[]) => {
  const date = new Date().toLocaleDateString('pt-BR');
  let report = `*RELATÓRIO DE EXPEDIÇÕES - Almox Pro (${date})*\n\n`;
  
  const inTransit = shipments.filter(s => s.status === 'SHIPPED');
  const delivered = shipments.filter(s => s.status === 'DELIVERED');
  const pending = shipments.filter(s => s.status === 'PENDING' || s.status === 'PREPARING');
  const totalItems = shipments.reduce((acc, s) => acc + (s.items || 0), 0);
  
  report += `*Resumo:* ${shipments.length} expedições registradas\n`;
  report += `Entregues: ${delivered.length} | Em Trânsito: ${inTransit.length} | Pendentes: ${pending.length}\n`;
  report += `Total de itens expedidos: ${totalItems}\n\n`;

  report += `*Em Trânsito (${inTransit.length}):*\n`;
  inTransit.forEach(item => {
    report += `- [${item.id}] Destino: ${item.destination} (Mot: ${item.driver})\n`;
  });
  
  report += `\n*Pendentes / Preparando (${pending.length}):*\n`;
  pending.forEach(item => {
    report += `- [${item.id}] ${item.destination} (Itens: ${item.items})\n`;
  });
  
  return report;
};

export const generateInventoryReport = (inventory: any[]) => {
  const date = new Date().toLocaleDateString('pt-BR');
  let report = `*RELATÓRIO DE ESTOQUE - Almox Pro (${date})*\n\n`;
  
  const critical = inventory.filter(i => i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK');
  const warning = inventory.filter(i => i.status === 'WARNING');
  const ok = inventory.filter(i => i.status === 'OK');
  
  // Cálculo preciso do valor total de estoque
  const totalQty = inventory.reduce((acc, item) => acc + item.qty, 0);
  const totalValue = preciseSum(inventory.map(item => preciseMultiply(item.qty, item.price)));

  report += `*━━━ RESUMO GERAL ━━━*\n`;
  report += `SKUs cadastrados: ${inventory.length}\n`;
  report += `Quantidade total em estoque: ${totalQty} unidades\n`;
  report += `💰 *Valor total em estoque: ${formatBRL(totalValue)}*\n`;
  report += `⚠️ Itens críticos: ${critical.length}\n`;
  report += `🟡 Itens em atenção: ${warning.length}\n`;
  report += `✅ Itens regulares: ${ok.length}\n\n`;

  report += `*Itens Críticos / Faltantes (${critical.length}):*\n`;
  critical.forEach(item => {
    const itemTotal = preciseMultiply(item.qty, item.price);
    report += `- ${item.name} (${item.category}): ${item.qty} un (Min: ${item.minQty}) | ${formatBRL(item.price)}/un | Total: ${formatBRL(itemTotal)}\n`;
  });

  if (warning.length > 0) {
    report += `\n*Itens em Atenção (${warning.length}):*\n`;
    warning.forEach(item => {
      const itemTotal = preciseMultiply(item.qty, item.price);
      report += `- ${item.name}: ${item.qty} un (Min: ${item.minQty}) | Total: ${formatBRL(itemTotal)}\n`;
    });
  }
  
  report += `\n*Itens Regulares (${ok.length}):*\n`;
  ok.forEach(item => {
    const itemTotal = preciseMultiply(item.qty, item.price);
    report += `- ${item.name}: ${item.qty} un | ${formatBRL(itemTotal)}\n`;
  });

  report += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `*VALOR TOTAL DO ESTOQUE: ${formatBRL(totalValue)}*\n`;
  
  return report;
};

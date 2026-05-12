/**
 * Serviço de Exportação e Cálculo Preciso
 * Todas as operações monetárias usam centavos (inteiros) para evitar erros de ponto flutuante.
 */

// ─── Cálculos Precisos (baseado em centavos) ────────────────────────────
/**
 * Multiplica dois números de forma precisa, evitando erros de ponto flutuante.
 * Converte para centavos, multiplica, e converte de volta.
 */
export function preciseMultiply(a: number, b: number): number {
  const centA = Math.round(a * 100);
  const centB = Math.round(b * 100);
  return (centA * centB) / 10000;
}

/**
 * Soma um array de números de forma precisa.
 */
export function preciseSum(values: number[]): number {
  const totalCents = values.reduce((acc, val) => acc + Math.round(val * 100), 0);
  return totalCents / 100;
}

/**
 * Subtrai b de a de forma precisa.
 */
export function preciseSubtract(a: number, b: number): number {
  return (Math.round(a * 100) - Math.round(b * 100)) / 100;
}

// ─── Formatação BRL ─────────────────────────────────────────────────────
/**
 * Formata um número para moeda brasileira (R$).
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata número com separador de milhar (pt-BR).
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

// ─── Exportação CSV (compatível com Google Sheets) ──────────────────────
/**
 * Exporta dados para CSV e dispara download automático.
 * O CSV usa ponto-e-vírgula como separador (padrão pt-BR) e BOM para acentuação.
 */
export function exportToCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const BOM = '\uFEFF'; // Byte Order Mark para encoding UTF-8
  const separator = ';';

  const csvHeader = headers.join(separator);
  const csvRows = rows.map(row =>
    row.map(cell => {
      if (typeof cell === 'string') {
        // Escapa aspas duplas e envolve em aspas se necessário
        const escaped = cell.replace(/"/g, '""');
        return cell.includes(separator) || cell.includes('"') || cell.includes('\n')
          ? `"${escaped}"`
          : escaped;
      }
      // Números: usa vírgula como separador decimal (pt-BR)
      return String(cell).replace('.', ',');
    }).join(separator)
  );

  const csvContent = BOM + [csvHeader, ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

// ─── Exportação de Inventário para CSV ──────────────────────────────────
export function exportInventoryCSV(inventory: any[]): void {
  const headers = ['SKU', 'Produto', 'Categoria', 'Localização', 'Quantidade', 'Qtd. Mínima', 'Valor Unitário (R$)', 'Valor Total (R$)', 'Status'];

  const rows = inventory.map(item => {
    const valorTotal = preciseMultiply(item.qty, item.price);
    return [
      item.id,
      item.name,
      item.category,
      item.location,
      item.qty,
      item.minQty,
      item.price,
      valorTotal,
      getStatusLabel(item.status),
    ];
  });

  // Linha de totais
  const totalQty = inventory.reduce((acc, item) => acc + item.qty, 0);
  const totalValue = preciseSum(inventory.map(item => preciseMultiply(item.qty, item.price)));
  rows.push(['', '', '', 'TOTAL GERAL', totalQty, '', '', totalValue, '']);

  exportToCSV(headers, rows, 'estoque_almoxpro');
}

// ─── Exportação de Expedições para CSV ──────────────────────────────────
export function exportShipmentsCSV(shipments: any[]): void {
  const headers = ['Expedição', 'Destino', 'Data', 'Itens', 'Motorista', 'Veículo', 'Status'];

  const rows = shipments.map(item => [
    item.id,
    item.destination,
    new Date(item.date).toLocaleDateString('pt-BR'),
    item.items,
    item.driver || '',
    item.vehicle || '',
    getShipmentStatusLabel(item.status),
  ]);

  exportToCSV(headers, rows, 'expedicoes_almoxpro');
}

// ─── Geração de Relatório PDF (via impressão) ───────────────────────────
/**
 * Gera um relatório HTML formatado e abre para impressão como PDF.
 */
export function generatePrintableReport(
  title: string,
  subtitle: string,
  tableHeaders: string[],
  tableRows: string[][],
  summaryItems?: { label: string; value: string }[]
): void {
  const date = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const tableHeadersHTML = tableHeaders.map(h => `<th>${h}</th>`).join('');
  const tableRowsHTML = tableRows.map(row =>
    `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('');

  const summaryHTML = summaryItems ? `
    <div class="summary">
      ${summaryItems.map(item => `
        <div class="summary-item">
          <span class="summary-label">${item.label}</span>
          <span class="summary-value">${item.value}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #0a4c8a; padding-bottom: 20px; }
    .header h1 { font-size: 22px; color: #0a4c8a; margin-bottom: 4px; }
    .header .subtitle { color: #666; font-size: 13px; }
    .header .date { text-align: right; color: #666; font-size: 11px; }
    .summary { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
    .summary-item { background: #f0f6ff; border: 1px solid #d0e2f7; border-radius: 8px; padding: 12px 18px; flex: 1; min-width: 150px; }
    .summary-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 4px; }
    .summary-value { display: block; font-size: 18px; font-weight: 700; color: #0a4c8a; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #0a4c8a; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
    tr:nth-child(even) { background: #f8f9fc; }
    tr:last-child td { font-weight: 700; border-top: 2px solid #0a4c8a; background: #f0f6ff; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 15px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${title}</h1>
      <div class="subtitle">${subtitle}</div>
    </div>
    <div class="date">
      <div>Gerado em: ${date}</div>
      <div>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
  ${summaryHTML}
  <table>
    <thead><tr>${tableHeadersHTML}</tr></thead>
    <tbody>${tableRowsHTML}</tbody>
  </table>
  <div class="footer">
    Almox Pro &bull; Relatório gerado automaticamente &bull; ${date}
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

// ─── Relatório PDF do Inventário ────────────────────────────────────────
export function generateInventoryPDF(inventory: any[]): void {
  const totalQty = inventory.reduce((acc, item) => acc + item.qty, 0);
  const totalValue = preciseSum(inventory.map(item => preciseMultiply(item.qty, item.price)));
  const criticalCount = inventory.filter(i => i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK').length;

  const headers = ['SKU', 'Produto', 'Categoria', 'Local', 'Qtd.', 'Mín.', 'Valor Unit.', 'Valor Total', 'Status'];

  const rows = inventory.map(item => {
    const valorTotal = preciseMultiply(item.qty, item.price);
    return [
      item.id,
      item.name,
      item.category,
      item.location,
      String(item.qty),
      String(item.minQty),
      formatBRL(item.price),
      formatBRL(valorTotal),
      getStatusLabel(item.status),
    ];
  });

  // Linha de total
  rows.push(['', '', '', 'TOTAL', String(totalQty), '', '', formatBRL(totalValue), '']);

  generatePrintableReport(
    'Relatório de Estoque',
    'Almox Pro — Controle de Inventário',
    headers,
    rows,
    [
      { label: 'Total de Itens', value: formatNumber(totalQty) },
      { label: 'Valor Total em Estoque', value: formatBRL(totalValue) },
      { label: 'SKUs Cadastrados', value: String(inventory.length) },
      { label: 'Alertas Críticos', value: String(criticalCount) },
    ]
  );
}

// ─── Relatório PDF de Orçamento ─────────────────────────────────────────
export function generateBudgetPDF(
  items: { name: string; qty: number; unitPrice: number; total: number }[],
  clientName: string,
  notes: string
): void {
  const grandTotal = preciseSum(items.map(i => i.total));

  const headers = ['#', 'Material', 'Qtd.', 'Valor Unitário', 'Subtotal'];
  const rows = items.map((item, index) => [
    String(index + 1),
    item.name,
    String(item.qty),
    formatBRL(item.unitPrice),
    formatBRL(item.total),
  ]);

  rows.push(['', '', '', 'TOTAL DO ORÇAMENTO', formatBRL(grandTotal)]);

  generatePrintableReport(
    'Simulação de Orçamento',
    clientName ? `Cliente: ${clientName}` : 'Almox Pro — Orçamento Simulado',
    headers,
    rows,
    [
      { label: 'Itens no Orçamento', value: String(items.length) },
      { label: 'Valor Total', value: formatBRL(grandTotal) },
      { label: 'Observações', value: notes || 'Nenhuma' },
    ]
  );
}

// ─── Labels de Status em PT-BR ──────────────────────────────────────────
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'OK': return 'Em Estoque';
    case 'WARNING': return 'Atenção';
    case 'CRITICAL': return 'Estoque Crítico';
    case 'OUT_OF_STOCK': return 'Esgotado';
    default: return status;
  }
}

export function getShipmentStatusLabel(status: string): string {
  switch (status) {
    case 'DELIVERED': return 'Entregue';
    case 'SHIPPED': return 'Em Trânsito';
    case 'PREPARING': return 'Separando';
    case 'PENDING': return 'Pendente';
    default: return status;
  }
}

// ─── Normalização de texto para busca ───────────────────────────────────
/**
 * Remove acentos e normaliza texto para busca eficiente em PT-BR.
 */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

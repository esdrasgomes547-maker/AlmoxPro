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

// ─── RF20: Relatório de Inventário por Categoria (PDF) ──────────────────
/**
 * Gera um relatório PDF agrupado por categoria com:
 * - Quantidade disponível por categoria
 * - Valor total de venda por categoria
 * - Soma do valor total de todas as categorias
 * - Data de emissão do relatório
 */
export function generateCategoryReportPDF(inventory: any[]): void {
  const now = new Date();
  const emissionDate = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const emissionTime = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });

  // Agrupar por categoria
  const categoryMap = new Map<string, { qty: number; totalValue: number; skuCount: number; items: any[] }>();

  for (const item of inventory) {
    const cat = item.category || 'Sem Categoria';
    const current = categoryMap.get(cat) || { qty: 0, totalValue: 0, skuCount: 0, items: [] };
    current.qty += item.qty;
    current.totalValue = preciseSum([current.totalValue, preciseMultiply(item.qty, item.price)]);
    current.skuCount += 1;
    current.items.push(item);
    categoryMap.set(cat, current);
  }

  // Ordenar categorias por valor total (decrescente)
  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].totalValue - a[1].totalValue);

  const grandTotalQty = inventory.reduce((acc, item) => acc + item.qty, 0);
  const grandTotalValue = preciseSum(inventory.map(item => preciseMultiply(item.qty, item.price)));

  // Gerar tabela de resumo por categoria
  const categoryRows = categories.map(([catName, data]) => `
    <tr>
      <td style="font-weight:600;">${catName}</td>
      <td style="text-align:center;">${data.skuCount}</td>
      <td style="text-align:center; font-family: monospace;">${formatNumber(data.qty)}</td>
      <td style="text-align:right; font-family: monospace; font-weight:600;">${formatBRL(data.totalValue)}</td>
    </tr>
  `).join('');

  // Gerar tabela detalhada por categoria
  const detailSections = categories.map(([catName, data]) => {
    const itemRows = data.items
      .sort((a: any, b: any) => (b.qty * b.price) - (a.qty * a.price))
      .map((item: any) => {
        const itemTotal = preciseMultiply(item.qty, item.price);
        return `
          <tr>
            <td style="font-family:monospace; font-size:10px;">${item.id}</td>
            <td>${item.name}</td>
            <td style="text-align:center;">${item.location}</td>
            <td style="text-align:center; font-family:monospace;">${item.qty}</td>
            <td style="text-align:right; font-family:monospace;">${formatBRL(item.price)}</td>
            <td style="text-align:right; font-family:monospace; font-weight:600;">${formatBRL(itemTotal)}</td>
            <td style="text-align:center;">${getStatusLabel(item.status)}</td>
          </tr>
        `;
      }).join('');

    return `
      <div class="category-section">
        <h3>${catName} <span class="cat-count">${data.skuCount} itens • ${formatNumber(data.qty)} un • ${formatBRL(data.totalValue)}</span></h3>
        <table>
          <thead>
            <tr>
              <th style="width:90px;">SKU</th>
              <th>Produto</th>
              <th style="width:70px;">Local</th>
              <th style="width:60px;">Qtd.</th>
              <th style="width:100px;">Valor Unit.</th>
              <th style="width:110px;">Valor Total</th>
              <th style="width:90px;">Status</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Inventário por Categoria</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #0a4c8a; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #0a4c8a; margin-bottom: 4px; }
    .header .subtitle { color: #666; font-size: 13px; }
    .header .date { text-align: right; color: #666; font-size: 11px; }
    .header .date strong { display: block; color: #0a4c8a; font-size: 12px; }
    .summary { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .summary-item { background: #f0f6ff; border: 1px solid #d0e2f7; border-radius: 8px; padding: 14px 20px; flex: 1; min-width: 140px; }
    .summary-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 4px; font-weight: 600; }
    .summary-value { display: block; font-size: 20px; font-weight: 800; color: #0a4c8a; }
    .summary-value.highlight { color: #0d7c3d; font-size: 22px; }
    h2 { font-size: 16px; color: #0a4c8a; margin: 24px 0 12px; border-bottom: 2px solid #e0e8f0; padding-bottom: 8px; }
    h2.summary-title { margin-top: 0; }
    .category-section { margin-bottom: 20px; page-break-inside: avoid; }
    .category-section h3 { font-size: 13px; color: #333; margin-bottom: 6px; padding: 6px 10px; background: #f0f4f8; border-left: 3px solid #0a4c8a; border-radius: 0 4px 4px 0; }
    .cat-count { font-weight: 400; color: #888; font-size: 11px; margin-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #0a4c8a; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e8e8e8; font-size: 11px; }
    tr:nth-child(even) { background: #fafbfd; }
    .total-row td { font-weight: 700; border-top: 2px solid #0a4c8a; background: #f0f6ff; font-size: 12px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 15px; }
    .emission { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 8px 14px; display: inline-block; margin-bottom: 20px; font-size: 11px; }
    .emission strong { color: #d48806; }
    @media print { body { padding: 20px; } .category-section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Relatório de Inventário Total Atual</h1>
      <div class="subtitle">Almox Pro — Resumo por Categoria de Produtos</div>
    </div>
    <div class="date">
      <strong>Data de Emissão</strong>
      <div>${emissionDate}</div>
      <div>${emissionTime}</div>
    </div>
  </div>

  <div class="emission">
    📅 <strong>Emitido em:</strong> ${emissionDate} às ${emissionTime}
  </div>

  <div class="summary">
    <div class="summary-item">
      <span class="summary-label">Categorias</span>
      <span class="summary-value">${categories.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">SKUs Cadastrados</span>
      <span class="summary-value">${inventory.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Peças Disponíveis</span>
      <span class="summary-value">${formatNumber(grandTotalQty)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Valor Total de Venda do Estoque</span>
      <span class="summary-value highlight">${formatBRL(grandTotalValue)}</span>
    </div>
  </div>

  <h2 class="summary-title">Resumo por Categoria</h2>
  <table>
    <thead>
      <tr>
        <th>Categoria</th>
        <th style="text-align:center;">Nº de SKUs</th>
        <th style="text-align:center;">Peças Disponíveis</th>
        <th style="text-align:right;">Valor Total de Venda</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows}
      <tr class="total-row">
        <td>TOTAL GERAL</td>
        <td style="text-align:center;">${inventory.length}</td>
        <td style="text-align:center; font-family:monospace;">${formatNumber(grandTotalQty)}</td>
        <td style="text-align:right; font-family:monospace;">${formatBRL(grandTotalValue)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Detalhamento por Categoria</h2>
  ${detailSections}

  <div class="footer">
    Almox Pro &bull; Relatório de Inventário Total Atual &bull; Emitido em ${emissionDate} às ${emissionTime}
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

import type ExcelJSType from 'exceljs';
import { buildGroupsFromTable, type BulkImportParseResult } from './bulkImportUtils';

interface FieldDef {
  key: string;
  section: string;
  required: boolean;
  label: string;
  description: string;
  example: string;
  validationList?: string[];
}

const FIELDS: FieldDef[] = [
  { key: 'grupo_id', section: 'Identificação', required: true, label: 'ID do grupo',
    description: 'Agrupa linhas que pertencem ao mesmo produto. Repita o mesmo valor em todas as linhas de variação (cor/tamanho/sabor) desse produto.', example: '1' },
  { key: 'sku', section: 'Identificação', required: false, label: 'SKU',
    description: 'Código único do produto. Se já existir um produto com este SKU, ele é atualizado em vez de duplicado.', example: 'CAM-EST-01' },

  { key: 'titulo', section: 'Dados do produto', required: true, label: 'Título',
    description: 'Nome do produto exibido na vitrine. Preencha apenas na primeira linha do grupo.', example: 'Camiseta Estampada' },
  { key: 'descricao', section: 'Dados do produto', required: false, label: 'Descrição',
    description: 'Texto completo de descrição do produto.', example: 'Camiseta 100% algodão' },
  { key: 'categorias', section: 'Dados do produto', required: false, label: 'Categorias',
    description: 'Uma ou mais categorias separadas por ponto e vírgula ( ; ).', example: 'Camisetas;Promoção' },
  { key: 'marca', section: 'Dados do produto', required: false, label: 'Marca', description: 'Marca do produto.', example: 'Marca X' },
  { key: 'modelo', section: 'Dados do produto', required: false, label: 'Modelo', description: 'Modelo ou referência do produto.', example: '' },
  { key: 'condicao', section: 'Dados do produto', required: false, label: 'Condição',
    description: 'Selecione um valor da lista.', example: 'novo', validationList: ['novo', 'usado', 'seminovo'] },
  { key: 'genero', section: 'Dados do produto', required: false, label: 'Gênero',
    description: 'Selecione um valor da lista.', example: 'unissex', validationList: ['masculino', 'feminino', 'unissex'] },
  { key: 'status', section: 'Dados do produto', required: false, label: 'Status',
    description: 'Selecione um valor da lista.', example: 'disponivel', validationList: ['disponivel', 'vendido', 'reservado'] },
  { key: 'visivel_na_vitrine', section: 'Dados do produto', required: false, label: 'Visível na vitrine',
    description: 'Controla se o produto aparece publicamente na vitrine.', example: 'sim', validationList: ['sim', 'nao'] },

  { key: 'peso_kg', section: 'Dimensões e peso', required: false, label: 'Peso (kg)',
    description: 'Usado no cálculo de frete. Use ponto ou vírgula como separador decimal.', example: '0.2' },
  { key: 'altura_cm', section: 'Dimensões e peso', required: false, label: 'Altura (cm)', description: 'Usado no cálculo de frete.', example: '' },
  { key: 'largura_cm', section: 'Dimensões e peso', required: false, label: 'Largura (cm)', description: 'Usado no cálculo de frete.', example: '' },
  { key: 'comprimento_cm', section: 'Dimensões e peso', required: false, label: 'Comprimento (cm)', description: 'Usado no cálculo de frete.', example: '' },

  { key: 'preco', section: 'Preço e estoque', required: true, label: 'Preço',
    description: 'Preço de venda. Use vírgula ou ponto como separador decimal. Preencha apenas na primeira linha do grupo.', example: '59,90' },
  { key: 'preco_promocional', section: 'Preço e estoque', required: false, label: 'Preço promocional',
    description: 'Preço com desconto, menor que o preço normal.', example: '49,90' },
  { key: 'controla_estoque', section: 'Preço e estoque', required: false, label: 'Controla estoque',
    description: 'Se "sim", o sistema controla a quantidade disponível deste produto.', example: 'sim', validationList: ['sim', 'nao'] },

  { key: 'cor', section: 'Variação', required: false, label: 'Cor',
    description: 'Preencha só se este produto tiver variação de cor. Uma linha por combinação de cor/tamanho/sabor.', example: 'Azul' },
  { key: 'tamanho', section: 'Variação', required: false, label: 'Tamanho', description: 'Preencha só se este produto tiver variação de tamanho.', example: 'P' },
  { key: 'sabor', section: 'Variação', required: false, label: 'Sabor', description: 'Preencha só se este produto tiver variação de sabor.', example: '' },
  { key: 'estoque_variante', section: 'Variação', required: false, label: 'Estoque da variação',
    description: 'Quantidade em estoque desta linha (da variação, ou do produto quando não há variação).', example: '10' },

  { key: 'imagens', section: 'Mídia', required: false, label: 'Imagens (URLs)',
    description: 'Uma ou mais URLs de imagem separadas por barra vertical ( | ). Preencha apenas na primeira linha do grupo.',
    example: 'https://exemplo.com/foto1.jpg|https://exemplo.com/foto2.jpg' },
];

const SECTION_COLORS: Record<string, string> = {
  'Identificação': 'FFDDEBF7',
  'Dados do produto': 'FFE2EFDA',
  'Dimensões e peso': 'FFFFF2CC',
  'Preço e estoque': 'FFFCE4D6',
  'Variação': 'FFEAD1DC',
  'Mídia': 'FFD9D2E9',
};

const EXAMPLE_ROWS: Record<string, string>[] = [
  {
    grupo_id: '1', sku: 'CAM-EST-01', titulo: 'Camiseta Estampada', descricao: 'Camiseta 100% algodão',
    categorias: 'Camisetas', marca: 'Marca X', condicao: 'novo', genero: 'unissex', status: 'disponivel',
    visivel_na_vitrine: 'sim', peso_kg: '0.2', controla_estoque: 'sim', preco: '59.90', preco_promocional: '49.90',
    cor: 'Azul', tamanho: 'P', estoque_variante: '10',
    imagens: 'https://exemplo.com/foto1.jpg|https://exemplo.com/foto2.jpg',
  },
  { grupo_id: '1', cor: 'Azul', tamanho: 'M', estoque_variante: '5' },
  { grupo_id: '1', cor: 'Vermelho', tamanho: 'P', estoque_variante: '8' },
  {
    grupo_id: '2', sku: 'TENIS-CAS-42', titulo: 'Tênis Casual', descricao: 'Tênis confortável para o dia a dia',
    categorias: 'Calçados', marca: 'Marca Y', condicao: 'novo', genero: 'unissex', status: 'disponivel',
    visivel_na_vitrine: 'sim', controla_estoque: 'nao', preco: '199.90', imagens: 'https://exemplo.com/tenis.jpg',
  },
];

const HEADER_ROW = 2;
const FIRST_DATA_ROW = HEADER_ROW + 1;

async function loadExcelJS() {
  return (await import('exceljs')).default;
}

export async function generateBulkImportXlsxTemplate(): Promise<Blob> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VitrineTurbo';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Produtos', { views: [{ state: 'frozen', ySplit: HEADER_ROW }] });
  sheet.columns = FIELDS.map((f) => ({ key: f.key, width: Math.max(f.label.length, f.example.length, 12) + 4 }));

  const sectionRow = sheet.getRow(1);
  const headerRow = sheet.getRow(HEADER_ROW);

  FIELDS.forEach((f, i) => {
    const col = i + 1;
    const sectionCell = sectionRow.getCell(col);
    sectionCell.value = f.section;
    sectionCell.font = { bold: true, italic: true, size: 10, color: { argb: 'FF374151' } };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_COLORS[f.section] || 'FFF3F4F6' } };
    sectionCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerCell = headerRow.getCell(col);
    headerCell.value = f.key;
    headerCell.font = { bold: true, color: { argb: f.required ? 'FFFFFFFF' : 'FF1F2937' } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f.required ? 'FFDC2626' : 'FFE5E7EB' } };
    headerCell.alignment = { vertical: 'middle' };
    headerCell.note = {
      texts: [
        { font: { bold: true }, text: `${f.label} ${f.required ? '(obrigatório)' : '(opcional)'}\n` },
        { text: f.description + (f.example ? `\nExemplo: ${f.example}` : '') },
      ],
    } as ExcelJSType.Comment;
  });

  let runStart = 0;
  for (let i = 1; i <= FIELDS.length; i++) {
    if (i === FIELDS.length || FIELDS[i].section !== FIELDS[runStart].section) {
      if (i > runStart + 1) sheet.mergeCells(1, runStart + 1, 1, i);
      runStart = i;
    }
  }

  EXAMPLE_ROWS.forEach((example, rowOffset) => {
    const row = sheet.getRow(FIRST_DATA_ROW + rowOffset);
    FIELDS.forEach((f, i) => {
      const cell = row.getCell(i + 1);
      cell.value = example[f.key] ?? '';
      cell.font = { italic: true, color: { argb: 'FF6B7280' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
    });
  });

  const validationLastRow = FIRST_DATA_ROW + 500;
  FIELDS.forEach((f, i) => {
    if (!f.validationList) return;
    const col = i + 1;
    const colLetter = sheet.getColumn(col).letter;
    sheet.dataValidations.add(`${colLetter}${FIRST_DATA_ROW}:${colLetter}${validationLastRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${f.validationList.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: `Escolha um dos valores: ${f.validationList.join(', ')}`,
    });
  });

  const instructions = workbook.addWorksheet('Instruções');
  instructions.columns = [
    { header: 'Coluna', key: 'key', width: 22 },
    { header: 'Obrigatório', key: 'required', width: 14 },
    { header: 'O que é / valores aceitos', key: 'description', width: 70 },
    { header: 'Exemplo', key: 'example', width: 40 },
  ];
  instructions.getRow(1).font = { bold: true };
  instructions.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

  const intro = [
    'Como preencher esta planilha:',
    '1. Cada linha representa um produto ou uma variação (cor/tamanho/sabor) de um produto.',
    '2. Para um produto com variações, repita o mesmo "grupo_id" em várias linhas: preencha título, preço, categoria etc. apenas na primeira linha do grupo; nas linhas seguintes, preencha só cor/tamanho/sabor/estoque_variante.',
    '3. Colunas com cabeçalho vermelho na aba "Produtos" são obrigatórias.',
    '4. Use vírgula ou ponto para casas decimais em preços e pesos.',
    '5. Separe múltiplas categorias com ponto e vírgula ( ; ) e múltiplas imagens com barra vertical ( | ).',
    '6. Se o SKU já existir em um produto, ele será atualizado em vez de criar um duplicado.',
    '7. As primeiras linhas da aba "Produtos" (em itálico, com fundo amarelo claro) são só exemplo — edite ou apague antes de importar seus produtos reais.',
  ];
  intro.forEach((line, idx) => {
    const row = instructions.getRow(3 + idx);
    row.getCell(1).value = line;
    instructions.mergeCells(3 + idx, 1, 3 + idx, 4);
    row.getCell(1).font = idx === 0 ? { bold: true } : {};
    row.getCell(1).alignment = { wrapText: true };
  });

  const tableStart = 3 + intro.length + 2;
  instructions.getRow(tableStart - 1).values = ['Coluna', 'Obrigatório', 'O que é / valores aceitos', 'Exemplo'];
  instructions.getRow(tableStart - 1).font = { bold: true };
  instructions.getRow(tableStart - 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

  FIELDS.forEach((f, idx) => {
    const row = instructions.getRow(tableStart + idx);
    row.getCell(1).value = f.key;
    row.getCell(2).value = f.required ? 'Sim' : 'Não';
    row.getCell(3).value = f.validationList ? `${f.description} Valores: ${f.validationList.join(', ')}.` : f.description;
    row.getCell(4).value = f.example;
    row.getCell(3).alignment = { wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function cellToString(cell: ExcelJSType.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return String(v.result ?? '');
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as { text: unknown }).text ?? '');
    return cell.text ?? '';
  }
  return String(v);
}

function rowToStrings(row: ExcelJSType.Row, count: number): string[] {
  const out: string[] = [];
  for (let c = 1; c <= count; c++) out.push(cellToString(row.getCell(c)));
  return out;
}

export async function parseBulkImportXlsxFile(file: File): Promise<BulkImportParseResult> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { groups: [], errors: [{ row: 0, message: 'Planilha vazia ou inválida' }], totalRows: 0 };
  }

  let headerRowNumber = -1;
  let headers: string[] = [];
  const maxScan = Math.min(sheet.rowCount, 10);
  for (let r = 1; r <= maxScan; r++) {
    const values = rowToStrings(sheet.getRow(r), Math.max(sheet.columnCount, FIELDS.length));
    if (values.some((v) => v.trim().toLowerCase() === 'grupo_id')) {
      headerRowNumber = r;
      headers = values.map((v) => v.trim().toLowerCase());
      break;
    }
  }

  if (headerRowNumber === -1) {
    return { groups: [], errors: [{ row: 0, message: 'Cabeçalho não encontrado (coluna "grupo_id" ausente)' }], totalRows: 0 };
  }

  const dataRows: string[][] = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const values = rowToStrings(sheet.getRow(r), headers.length);
    if (values.every((v) => v.trim() === '')) continue;
    dataRows.push(values);
  }

  return buildGroupsFromTable(headers, dataRows, headerRowNumber + 1);
}

export interface BulkImportVariantRow {
  color: string | null;
  size: string | null;
  flavor: string | null;
  quantity: number | null;
}

export interface BulkImportGroup {
  grupo_id: string;
  sku: string | null;
  title: string;
  description: string | null;
  price: number;
  discounted_price: number | null;
  category: string[] | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  gender: string | null;
  status: string | null;
  is_visible_on_storefront: boolean | null;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  flat_stock_quantity: number | null;
  images: string[];
  variants: BulkImportVariantRow[];
  sourceRows: number[];
}

export interface BulkImportRowError {
  row: number;
  grupo_id?: string;
  message: string;
}

export interface BulkImportParseResult {
  groups: BulkImportGroup[];
  errors: BulkImportRowError[];
  totalRows: number;
}

const REQUIRED_HEADERS = ['grupo_id', 'titulo', 'preco'];

const EXPECTED_HEADERS = [
  'grupo_id', 'sku', 'titulo', 'descricao', 'categorias', 'marca', 'modelo',
  'condicao', 'genero', 'status', 'visivel_na_vitrine', 'peso_kg', 'altura_cm',
  'largura_cm', 'comprimento_cm', 'controla_estoque', 'preco', 'preco_promocional',
  'cor', 'tamanho', 'sabor', 'estoque_variante', 'imagens',
];

// Full state-machine parser over the whole file, not a naive split('\n') —
// a quoted field containing a real newline (e.g. a multi-line description)
// must stay one field, not become a row break.
function parseCsvRows(content: string): string[][] {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += char; i++; continue;
    }
    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ',') { pushField(); i++; continue; }
    if (char === '\r') {
      if (text[i + 1] === '\n') i++;
      pushRow(); i++; continue;
    }
    if (char === '\n') { pushRow(); i++; continue; }
    field += char; i++;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// Accepts "99.90", "99,90" and "1.234,56" (BR thousands+decimal). When both
// separators are present, whichever occurs LAST is the decimal separator —
// the other is a thousands separator and gets stripped entirely.
function parseBRNumber(raw: string | undefined): number | null {
  const s = (raw || '').trim();
  if (!s) return null;

  let normalized = s;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (hasComma) {
    normalized = s.replace(',', '.');
  }

  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

function parseBool(raw: string | undefined): boolean | null {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'sim') return true;
  if (s === 'nao' || s === 'não') return false;
  return null;
}

function splitSemicolon(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(';').map((s) => s.trim()).filter(Boolean);
}

function splitPipe(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

function blankToNull(raw: string | undefined): string | null {
  const s = (raw || '').trim();
  return s ? s : null;
}

interface RawRow {
  line: number;
  cols: Record<string, string>;
}

export function parseBulkImportCsv(content: string): BulkImportParseResult {
  const rows = parseCsvRows(content);
  const errors: BulkImportRowError[] = [];

  if (rows.length < 2) {
    return { groups: [], errors: [{ row: 0, message: 'Arquivo vazio ou sem dados' }], totalRows: 0 };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      groups: [],
      errors: [{ row: 1, message: `Colunas obrigatórias ausentes: ${missingHeaders.join(', ')}` }],
      totalRows: 0,
    };
  }

  const headerIndex = new Map<string, number>();
  headers.forEach((h, idx) => { if (EXPECTED_HEADERS.includes(h)) headerIndex.set(h, idx); });

  const rawRows: RawRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols: Record<string, string> = {};
    for (const [name, idx] of headerIndex) {
      cols[name] = rows[i][idx] ?? '';
    }
    rawRows.push({ line: i + 1, cols });
  }

  const groupsByKey = new Map<string, RawRow[]>();
  for (const raw of rawRows) {
    const grupoId = raw.cols['grupo_id']?.trim();
    if (!grupoId) {
      errors.push({ row: raw.line, message: 'grupo_id vazio — linha ignorada' });
      continue;
    }
    if (!groupsByKey.has(grupoId)) groupsByKey.set(grupoId, []);
    groupsByKey.get(grupoId)!.push(raw);
  }

  const groups: BulkImportGroup[] = [];
  const skuToGrupoId = new Map<string, string>();

  for (const [grupoId, groupRows] of groupsByKey) {
    const primary = groupRows[0];
    const title = primary.cols['titulo']?.trim();
    const price = parseBRNumber(primary.cols['preco']);

    if (!title) {
      errors.push({ row: primary.line, grupo_id: grupoId, message: 'título obrigatório vazio' });
      continue;
    }
    if (price === null) {
      errors.push({ row: primary.line, grupo_id: grupoId, message: `preço inválido: "${primary.cols['preco']}"` });
      continue;
    }

    // Product-level columns are authoritative from the first row of the
    // group; later rows are only checked for accidental, non-blank drift.
    const productFields: [string, string][] = [
      ['titulo', title], ['preco', String(price)], ['descricao', primary.cols['descricao'] || ''],
      ['marca', primary.cols['marca'] || ''], ['modelo', primary.cols['modelo'] || ''],
      ['categorias', primary.cols['categorias'] || ''],
    ];
    for (let i = 1; i < groupRows.length; i++) {
      const row = groupRows[i];
      for (const [field, primaryValue] of productFields) {
        const rowValue = (row.cols[field] || '').trim();
        if (rowValue && rowValue !== primaryValue.trim()) {
          errors.push({
            row: row.line,
            grupo_id: grupoId,
            message: `"${field}" diverge do restante do grupo (usando o valor da primeira linha) — corrija ou deixe em branco`,
          });
        }
      }
    }

    const sku = blankToNull(primary.cols['sku']);
    if (sku) {
      const existingGrupoId = skuToGrupoId.get(sku.toLowerCase());
      if (existingGrupoId && existingGrupoId !== grupoId) {
        errors.push({ row: primary.line, grupo_id: grupoId, message: `sku "${sku}" duplicado (também usado no grupo ${existingGrupoId})` });
        continue;
      }
      skuToGrupoId.set(sku.toLowerCase(), grupoId);
    }

    const variants: BulkImportVariantRow[] = [];
    const seenVariantKeys = new Set<string>();
    let flatStockQuantity: number | null = null;

    for (const row of groupRows) {
      const color = blankToNull(row.cols['cor']);
      const size = blankToNull(row.cols['tamanho']);
      const flavor = blankToNull(row.cols['sabor']);
      const quantityRaw = row.cols['estoque_variante'];
      const quantity = quantityRaw?.trim() ? parseBRNumber(quantityRaw) : null;

      if (quantityRaw?.trim() && quantity === null) {
        errors.push({ row: row.line, grupo_id: grupoId, message: `estoque_variante inválido: "${quantityRaw}"` });
      }

      if (!color && !size && !flavor) {
        if (groupRows.length > 1 && groupRows.some((r) => r !== row && (r.cols['cor'] || r.cols['tamanho'] || r.cols['sabor']))) {
          errors.push({ row: row.line, grupo_id: grupoId, message: 'linha sem cor/tamanho/sabor dentro de um grupo com variações — ignorada' });
          continue;
        }
        // single-row, non-variant product
        if (quantity !== null) flatStockQuantity = quantity;
        continue;
      }

      const key = `${(color || '').toLowerCase()}|${(size || '').toLowerCase()}|${(flavor || '').toLowerCase()}`;
      if (seenVariantKeys.has(key)) {
        errors.push({ row: row.line, grupo_id: grupoId, message: 'combinação cor/tamanho/sabor repetida no grupo — ignorada' });
        continue;
      }
      seenVariantKeys.add(key);
      variants.push({ color, size, flavor, quantity });
    }

    const rawImageUrls = splitPipe(primary.cols['imagens']);
    const images: string[] = [];
    for (const url of rawImageUrls) {
      if (/^https?:\/\//i.test(url)) {
        images.push(url);
      } else {
        errors.push({ row: primary.line, grupo_id: grupoId, message: `URL de imagem ignorada (precisa começar com http/https): "${url}"` });
      }
    }

    groups.push({
      grupo_id: grupoId,
      sku,
      title,
      description: blankToNull(primary.cols['descricao']),
      price,
      discounted_price: parseBRNumber(primary.cols['preco_promocional']),
      category: splitSemicolon(primary.cols['categorias']),
      brand: blankToNull(primary.cols['marca']),
      model: blankToNull(primary.cols['modelo']),
      condition: blankToNull(primary.cols['condicao']),
      gender: blankToNull(primary.cols['genero']),
      status: blankToNull(primary.cols['status']),
      is_visible_on_storefront: parseBool(primary.cols['visivel_na_vitrine']),
      weight_kg: parseBRNumber(primary.cols['peso_kg']),
      height_cm: parseBRNumber(primary.cols['altura_cm']),
      width_cm: parseBRNumber(primary.cols['largura_cm']),
      length_cm: parseBRNumber(primary.cols['comprimento_cm']),
      flat_stock_quantity: flatStockQuantity,
      images,
      variants,
      sourceRows: groupRows.map((r) => r.line),
    });
  }

  return { groups, errors, totalRows: rawRows.length };
}

export const BULK_IMPORT_BATCH_SIZE = 10;

export function chunkGroups(groups: BulkImportGroup[], size: number = BULK_IMPORT_BATCH_SIZE): BulkImportGroup[][] {
  const chunks: BulkImportGroup[][] = [];
  for (let i = 0; i < groups.length; i += size) {
    chunks.push(groups.slice(i, i + size));
  }
  return chunks;
}

export function getBulkImportTemplate(): string {
  const headers = EXPECTED_HEADERS.join(',');
  const rows = [
    '1,CAM-EST-01,Camiseta Estampada,Camiseta 100% algodão,Camisetas,Marca X,,novo,unissex,disponivel,sim,0.2,,,,sim,59.90,49.90,Azul,P,,10,https://exemplo.com/foto1.jpg|https://exemplo.com/foto2.jpg',
    '1,,,,,,,,,,,,,,,,,,Azul,M,,5,',
    '1,,,,,,,,,,,,,,,,,,Vermelho,P,,8,',
    '2,TENIS-CAS-42,Tênis Casual,Tênis confortável para o dia a dia,Calçados,Marca Y,,novo,unissex,disponivel,sim,,,,,nao,199.90,,,,,,https://exemplo.com/tenis.jpg',
  ];
  return [headers, ...rows].join('\n');
}

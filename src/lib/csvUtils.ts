import type { Product } from '@/types';

export function exportProductsToCSV(products: Product[], currency: string = 'BRL'): string {
  const headers = [
    'titulo',
    'preco',
    'preco_promocional',
    'descricao_curta',
    'categorias',
    'marca',
    'modelo',
    'condicao',
    'genero',
    'status',
    'visivel_na_vitrine',
    'cores',
    'tamanhos',
    'sabores',
    'controla_estoque',
    'quantidade_estoque',
    'url_imagem_destaque',
  ];

  const rows = products.map(p => [
    escapeCsv(p.title || ''),
    p.price || '',
    p.discounted_price || '',
    escapeCsv(p.short_description || ''),
    (p.category || []).join('; '),
    escapeCsv(p.brand || ''),
    escapeCsv(p.model || ''),
    p.condition || '',
    p.gender || '',
    p.status || 'disponivel',
    p.is_visible_on_storefront ? 'sim' : 'nao',
    (p.colors || []).join('; '),
    (p.sizes || []).join('; '),
    (p.flavors || []).join('; '),
    p.track_inventory ? 'sim' : 'nao',
    p.stock_quantity ?? '',
    p.featured_image_url || '',
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return csvContent;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedProduct {
  title: string;
  price: number | null;
  discounted_price: number | null;
  short_description: string;
  category: string[];
  brand: string;
  model: string;
  condition: string;
  gender: string;
  status: string;
  is_visible_on_storefront: boolean;
  colors: string[];
  sizes: string[];
  flavors: string[];
  track_inventory: boolean;
  stock_quantity: number | null;
}

export interface ImportResult {
  products: ParsedProduct[];
  errors: { row: number; message: string }[];
}

export function parseCSV(content: string): ImportResult {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    return { products: [], errors: [{ row: 0, message: 'Arquivo vazio ou sem dados' }] };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const titleIdx = headers.indexOf('titulo');
  const priceIdx = headers.indexOf('preco');
  const discountIdx = headers.indexOf('preco_promocional');
  const descIdx = headers.indexOf('descricao_curta');
  const catIdx = headers.indexOf('categorias');
  const brandIdx = headers.indexOf('marca');
  const modelIdx = headers.indexOf('modelo');
  const condIdx = headers.indexOf('condicao');
  const genderIdx = headers.indexOf('genero');
  const statusIdx = headers.indexOf('status');
  const visibleIdx = headers.indexOf('visivel_na_vitrine');
  const colorsIdx = headers.indexOf('cores');
  const sizesIdx = headers.indexOf('tamanhos');
  const flavorsIdx = headers.indexOf('sabores');
  const trackIdx = headers.indexOf('controla_estoque');
  const stockIdx = headers.indexOf('quantidade_estoque');

  if (titleIdx === -1) {
    return { products: [], errors: [{ row: 0, message: 'Coluna "titulo" obrigatoria nao encontrada' }] };
  }

  const products: ParsedProduct[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const title = (cols[titleIdx] || '').trim();

    if (!title) {
      errors.push({ row: i + 1, message: 'Titulo vazio' });
      continue;
    }

    const price = priceIdx >= 0 ? parseFloat(cols[priceIdx]) : null;
    if (priceIdx >= 0 && cols[priceIdx] && isNaN(price!)) {
      errors.push({ row: i + 1, message: `Preco invalido: "${cols[priceIdx]}"` });
      continue;
    }

    products.push({
      title,
      price: price && !isNaN(price) ? price : null,
      discounted_price: discountIdx >= 0 && cols[discountIdx] ? parseFloat(cols[discountIdx]) || null : null,
      short_description: descIdx >= 0 ? (cols[descIdx] || '').trim() : '',
      category: catIdx >= 0 ? splitSemicolon(cols[catIdx]) : [],
      brand: brandIdx >= 0 ? (cols[brandIdx] || '').trim() : '',
      model: modelIdx >= 0 ? (cols[modelIdx] || '').trim() : '',
      condition: condIdx >= 0 ? (cols[condIdx] || 'novo').trim() : 'novo',
      gender: genderIdx >= 0 ? (cols[genderIdx] || '').trim() : '',
      status: statusIdx >= 0 ? (cols[statusIdx] || 'disponivel').trim() : 'disponivel',
      is_visible_on_storefront: visibleIdx >= 0 ? cols[visibleIdx]?.trim().toLowerCase() === 'sim' : true,
      colors: colorsIdx >= 0 ? splitSemicolon(cols[colorsIdx]) : [],
      sizes: sizesIdx >= 0 ? splitSemicolon(cols[sizesIdx]) : [],
      flavors: flavorsIdx >= 0 ? splitSemicolon(cols[flavorsIdx]) : [],
      track_inventory: trackIdx >= 0 ? cols[trackIdx]?.trim().toLowerCase() === 'sim' : false,
      stock_quantity: stockIdx >= 0 && cols[stockIdx] ? parseInt(cols[stockIdx]) || null : null,
    });
  }

  return { products, errors };
}

function splitSemicolon(val: string | undefined): string[] {
  if (!val) return [];
  return val.split(';').map(s => s.trim()).filter(Boolean);
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function getCSVTemplate(): string {
  return exportProductsToCSV([]);
}

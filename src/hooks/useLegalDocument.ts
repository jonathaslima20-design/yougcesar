import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  version: string;
  content: string | null;
  is_active: boolean;
  updated_at: string;
}

interface UseLegalDocumentResult {
  document: LegalDocument | null;
  loading: boolean;
}

export function useLegalDocument(documentType: string): UseLegalDocumentResult {
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from('legal_documents')
        .select('id, document_type, title, version, content, is_active, updated_at')
        .eq('document_type', documentType)
        .eq('is_active', true)
        .maybeSingle();

      if (!cancelled) {
        setDocument(data ?? null);
        setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [documentType]);

  return { document, loading };
}

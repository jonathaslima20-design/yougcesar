import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProductTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TagAssignment {
  product_id: string;
  tag_id: string;
}

export function useProductTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchTags();
    fetchAssignments();
  }, [user?.id]);

  const fetchTags = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('product_tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  const fetchAssignments = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_tag_assignments')
        .select('product_id, tag_id');

      if (error) throw error;

      const map = new Map<string, string[]>();
      (data || []).forEach((a) => {
        const existing = map.get(a.product_id) || [];
        existing.push(a.tag_id);
        map.set(a.product_id, existing);
      });
      setAssignments(map);
    } catch (err) {
      console.error('Error fetching tag assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTag = async (name: string, color: string): Promise<ProductTag | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('product_tags')
        .insert({ user_id: user.id, name: name.trim(), color })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Uma tag com esse nome ja existe');
        } else {
          toast.error('Erro ao criar tag');
        }
        return null;
      }

      setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Tag "${name}" criada`);
      return data;
    } catch (err) {
      toast.error('Erro ao criar tag');
      return null;
    }
  };

  const deleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('product_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;

      setTags(prev => prev.filter(t => t.id !== tagId));
      setAssignments(prev => {
        const newMap = new Map(prev);
        for (const [productId, tagIds] of newMap.entries()) {
          newMap.set(productId, tagIds.filter(id => id !== tagId));
        }
        return newMap;
      });
      toast.success('Tag removida');
    } catch (err) {
      toast.error('Erro ao remover tag');
    }
  };

  const assignTag = async (productId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('product_tag_assignments')
        .insert({ product_id: productId, tag_id: tagId });

      if (error) {
        if (error.code === '23505') return;
        throw error;
      }

      setAssignments(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(productId) || [];
        if (!existing.includes(tagId)) {
          newMap.set(productId, [...existing, tagId]);
        }
        return newMap;
      });
    } catch (err) {
      toast.error('Erro ao atribuir tag');
    }
  };

  const removeTagFromProduct = async (productId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('product_tag_assignments')
        .delete()
        .eq('product_id', productId)
        .eq('tag_id', tagId);

      if (error) throw error;

      setAssignments(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(productId) || [];
        newMap.set(productId, existing.filter(id => id !== tagId));
        return newMap;
      });
    } catch (err) {
      toast.error('Erro ao remover tag do produto');
    }
  };

  const bulkAssignTag = async (productIds: string[], tagId: string) => {
    try {
      const inserts = productIds.map(pid => ({ product_id: pid, tag_id: tagId }));
      const { error } = await supabase
        .from('product_tag_assignments')
        .upsert(inserts, { onConflict: 'product_id,tag_id', ignoreDuplicates: true });

      if (error) throw error;

      setAssignments(prev => {
        const newMap = new Map(prev);
        for (const pid of productIds) {
          const existing = newMap.get(pid) || [];
          if (!existing.includes(tagId)) {
            newMap.set(pid, [...existing, tagId]);
          }
        }
        return newMap;
      });
      toast.success(`Tag adicionada a ${productIds.length} produtos`);
    } catch (err) {
      toast.error('Erro ao atribuir tag em lote');
    }
  };

  const bulkRemoveTag = async (productIds: string[], tagId: string) => {
    try {
      const { error } = await supabase
        .from('product_tag_assignments')
        .delete()
        .in('product_id', productIds)
        .eq('tag_id', tagId);

      if (error) throw error;

      setAssignments(prev => {
        const newMap = new Map(prev);
        for (const pid of productIds) {
          const existing = newMap.get(pid) || [];
          newMap.set(pid, existing.filter(id => id !== tagId));
        }
        return newMap;
      });
      toast.success(`Tag removida de ${productIds.length} produtos`);
    } catch (err) {
      toast.error('Erro ao remover tag em lote');
    }
  };

  const getProductTags = (productId: string): ProductTag[] => {
    const tagIds = assignments.get(productId) || [];
    return tags.filter(t => tagIds.includes(t.id));
  };

  return {
    tags,
    assignments,
    loading,
    createTag,
    deleteTag,
    assignTag,
    removeTagFromProduct,
    bulkAssignTag,
    bulkRemoveTag,
    getProductTags,
    refetch: () => { fetchTags(); fetchAssignments(); },
  };
}

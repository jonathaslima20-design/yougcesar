import { supabase } from './supabase';

/**
 * Extracts a human-readable error message from a Supabase Edge Function
 * invocation error. `error.context` is the raw fetch Response object (per
 * @supabase/functions-js), so its body must be read asynchronously via
 * .json()/.text() — accessing `.body` directly only ever returns the
 * unread ReadableStream, which silently masked every real error message
 * behind the generic fallback text.
 */
export async function parseEdgeFunctionError(error: any, fallback: string): Promise<string> {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.clone().json();
      const message = body?.error?.message || body?.error || body?.message;
      if (message) return message;
    } catch {
      try {
        const text = await error.context.clone().text();
        if (text) return text;
      } catch {
        // fall through to default below
      }
    }
  }
  return error?.message || fallback;
}

/**
 * Update user email using admin privileges
 */
export async function updateUserEmailAdmin(userId: string, newEmail: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('update-user-email', {
    body: { userId, newEmail },
  });

  if (error) {
    throw new Error(await parseEdgeFunctionError(error, 'Erro ao atualizar email'));
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao atualizar email');
  }
}

/**
 * Change user password using admin privileges
 */
export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('change-user-password', {
    body: { userId, newPassword },
  });

  if (error) {
    throw new Error(await parseEdgeFunctionError(error, 'Erro ao alterar senha'));
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao alterar senha');
  }
}

/**
 * Reset user password using admin privileges (alias for changeUserPassword)
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  return changeUserPassword(userId, newPassword);
}

/**
 * Clones user profile and initiates async product cloning
 * Products are now cloned in background batches to avoid timeout
 * Returns jobId for tracking clone progress
 */
export async function cloneUserComplete(
  originalUserId: string,
  newUserData: {
    email: string;
    password: string;
    name: string;
    slug: string;
  }
): Promise<{ newUserId: string; jobId?: string; totalProducts: number }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('clone-user', {
    body: { originalUserId, newUserData },
  });

  if (error) {
    throw new Error(await parseEdgeFunctionError(error, 'Erro ao clonar usuário'));
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao clonar usuário');
  }

  return {
    newUserId: data.newUserId,
    jobId: data.jobId,
    totalProducts: data.totalProducts || 0
  };
}

/**
 * Create a new user with admin privileges
 */
export async function createUser(userData: {
  email: string;
  password: string;
  name: string;
  country_code?: string;
  whatsapp?: string;
  role: string;
  plan_id?: string;
}): Promise<{ userId: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      ...userData,
      country_code: userData.country_code || '55'
    },
  });

  if (error) {
    throw new Error(await parseEdgeFunctionError(error, 'Erro ao criar usuário'));
  }

  if (data?.error) {
    throw new Error(data.error.message || data.error || 'Erro ao criar usuário');
  }

  return { userId: data.userId };
}

/**
 * Copy products and categories from one user to another using Edge Function
 * Uses SERVICE_ROLE_KEY to bypass RLS for admin operations
 */
export async function copyProductsBetweenUsers(sourceUserId: string, targetUserId: string, productIds?: string[]): Promise<{
  success: boolean;
  message: string;
  stats: {
    copiedCategories: number;
    copiedProducts: number;
    copiedImages: number;
    copiedPriceTiers: number;
    copiedWeightVariants: number;
  };
}> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  // Validate users exist first
  const [sourceUserData, targetUserData] = await Promise.all([
    supabase.from('users').select('id, name').eq('id', sourceUserId).maybeSingle(),
    supabase.from('users').select('id, name').eq('id', targetUserId).maybeSingle(),
  ]);

  if (sourceUserData.error) {
    throw new Error(`Erro ao validar usuário de origem: ${sourceUserData.error.message}`);
  }

  if (!sourceUserData.data) {
    throw new Error('Usuário de origem não encontrado');
  }

  if (targetUserData.error) {
    throw new Error(`Erro ao validar usuário de destino: ${targetUserData.error.message}`);
  }

  if (!targetUserData.data) {
    throw new Error('Usuário de destino não encontrado');
  }

  // If the caller didn't pre-filter which products to copy, fall back to every
  // product owned by the source user (the "copy all" mode).
  let resolvedProductIds = productIds;
  if (!resolvedProductIds) {
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('user_id', sourceUserId);

    if (fetchError) {
      throw new Error(`Erro ao buscar produtos: ${fetchError.message}`);
    }

    resolvedProductIds = products?.map(product => product.id) || [];
  }

  if (resolvedProductIds.length === 0) {
    throw new Error('Nenhum produto encontrado para copiar');
  }

  const { data, error } = await supabase.functions.invoke('copy-products-between-users', {
    body: { sourceUserId, targetUserId, productIds: resolvedProductIds },
  });

  if (error) {
    console.error('Edge function error:', { error, context: error.context });

    let errorMessage = await parseEdgeFunctionError(error, 'Erro ao copiar produtos');
    let details = '';

    if (error.context && typeof error.context.json === 'function') {
      try {
        const errorBody = await error.context.clone().json();
        details = errorBody?.details?.message || errorBody?.details || '';
      } catch {
        // no JSON body to pull extra details from — errorMessage above still stands
      }
    }

    // More specific error messages
    if (errorMessage.includes('Erro ao inserir')) {
      errorMessage = 'Erro ao inserir produtos: Verifique se há conflitos de nomes de produtos.';
    } else if (errorMessage.includes('No products found')) {
      errorMessage = 'O usuário de origem não possui produtos para copiar.';
    } else if (errorMessage.includes('Missing')) {
      errorMessage = 'Dados obrigatórios ausentes. Verifique se os usuários foram selecionados corretamente.';
    }

    const fullMessage = details ? `${errorMessage} (${details})` : errorMessage;
    throw new Error(fullMessage);
  }

  if (data?.error) {
    throw new Error(data.error.message || data.error || 'Erro ao copiar produtos');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Operação de cópia falhou');
  }

  return data;
}

export async function updateUserImageLimit(userId: string, maxImages: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { error } = await supabase
    .from('users')
    .update({ max_images_per_product: maxImages })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Erro ao atualizar limite de imagens');
  }
}

export async function updateUserImageLimitBulk(userIds: string[], maxImages: number): Promise<{
  success: boolean;
  affectedCount: number;
}> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  if (userIds.length === 0) {
    throw new Error('Nenhum usuário selecionado');
  }

  if (maxImages < 1 || maxImages > 50) {
    throw new Error('O limite deve estar entre 1 e 50 imagens');
  }

  const { error } = await supabase
    .from('users')
    .update({ max_images_per_product: maxImages })
    .in('id', userIds);

  if (error) {
    throw new Error(error.message || 'Erro ao atualizar limite de imagens em massa');
  }

  return {
    success: true,
    affectedCount: userIds.length
  };
}
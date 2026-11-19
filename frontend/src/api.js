/**
 * Chama a API. Em erro lança um Error com a mensagem do servidor (em português),
 * mais .status e .campo (qual campo do formulário está errado, quando houver).
 */
export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  let res;
  try {
    res = await fetch(`/api${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw Object.assign(new Error('Sem conexão com o servidor. Confira sua internet e tente de novo.'), { status: 0 });
  }
  let dados = null;
  try {
    const txt = await res.text();
    dados = txt ? JSON.parse(txt) : null;
  } catch {
    dados = null;
  }
  if (!res.ok) {
    const mensagem = dados?.erro ?? 'O servidor não respondeu como esperado. Tente de novo em instantes.';
    throw Object.assign(new Error(mensagem), { status: res.status, campo: dados?.campo });
  }
  return dados;
}

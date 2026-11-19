import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt com parâmetros da recomendação da OWASP (N=2^15, r=8, p=3).
// Os parâmetros vão junto no texto guardado, para poderem subir no futuro.
const PADRAO = { N: 2 ** 15, r: 8, p: 3 };
const TAMANHO = 64;

function derivar(senha, sal, { N, r, p }) {
  return new Promise((ok, falha) => {
    const maxmem = 256 * N * r + 1024 * 1024;
    scrypt(senha, sal, TAMANHO, { N, r, p, maxmem }, (e, chave) => (e ? falha(e) : ok(chave)));
  });
}

export async function gerarHash(senha) {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal, PADRAO);
  return ['scrypt', PADRAO.N, PADRAO.r, PADRAO.p, sal.toString('base64'), hash.toString('base64')].join('$');
}

export async function conferirSenha(senha, guardado) {
  const [alg, N, r, p, salB64, hashB64] = String(guardado).split('$');
  if (alg !== 'scrypt' || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const hash = await derivar(senha, Buffer.from(salB64, 'base64'), { N: Number(N), r: Number(r), p: Number(p) });
  return hash.length === esperado.length && timingSafeEqual(hash, esperado);
}

// Hash de uma senha que ninguém conhece. Usado quando o e-mail não existe,
// para a resposta demorar o mesmo tempo e não revelar quais e-mails têm conta.
let hashFalso;
export async function conferirSenhaFalsa(senha) {
  hashFalso ??= await gerarHash(randomBytes(16).toString('hex'));
  await conferirSenha(senha, hashFalso);
  return false;
}

const CORES = ['#5b4cf0', '#d1436b', '#15803d', '#b45309', '#0e7490', '#7e22ce', '#b91c1c', '#1d4ed8'];

/** Círculo com as iniciais da pessoa; a cor sai do @usuário, então é sempre a mesma. */
export default function Avatar({ nome = '?', usuario = '', tamanho = 36 }) {
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  let h = 0;
  for (const c of usuario || nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className="avatar"
      style={{ width: tamanho, height: tamanho, background: CORES[h % CORES.length], fontSize: tamanho * 0.4 }}
      aria-hidden="true"
    >
      {iniciais || '?'}
    </span>
  );
}

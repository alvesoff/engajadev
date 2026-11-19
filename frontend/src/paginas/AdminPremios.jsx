import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tempoRelativo } from '../api.js';
import { useSessao } from '../sessao.jsx';

const VAZIO = { nome: '', descricao: '', custo: '', estoque: '', tipo: 'brinde', diasDestaque: '', ativo: true };
const STATUS = { pendente: 'Pendente', entregue: 'Entregue', cancelado: 'Cancelado' };

function FormPremio({ inicial, aoSalvar, aoCancelar }) {
  const [c, setC] = useState(inicial);
  const [erro, setErro] = useState({});
  const [salvando, setSalvando] = useState(false);
  const mudar = (e) => {
    const { name, value, type, checked } = e.target;
    setC((x) => ({ ...x, [name]: type === 'checkbox' ? checked : value }));
    setErro({});
  };

  async function enviar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await aoSalvar({
        ...c,
        estoque: c.estoque === '' || c.estoque === null ? null : c.estoque,
        diasDestaque: c.tipo === 'destaque' ? c.diasDestaque : null,
      });
    } catch (e2) {
      setErro({ campo: e2.campo, mensagem: e2.message });
    } finally {
      setSalvando(false);
    }
  }

  const campo = (nome) => ({
    id: `premio-${nome}`,
    name: nome,
    value: c[nome] ?? '',
    onChange: mudar,
    'aria-invalid': erro.campo === nome ? 'true' : undefined,
  });

  return (
    <form className="formulario form-premio" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor="premio-nome">Nome</label>
        <input {...campo('nome')} maxLength={80} />
      </div>
      <div className="campo">
        <label htmlFor="premio-descricao">Descrição</label>
        <textarea {...campo('descricao')} rows={2} maxLength={300} />
      </div>
      <div className="campos-lado">
        <div className="campo">
          <label htmlFor="premio-custo">Custo (pontos)</label>
          <input {...campo('custo')} type="number" inputMode="numeric" min={1} step={1} />
        </div>
        <div className="campo">
          <label htmlFor="premio-estoque">Unidades</label>
          <input {...campo('estoque')} type="number" inputMode="numeric" min={0} step={1} placeholder="sem limite" />
        </div>
      </div>
      <div className="campos-lado">
        <div className="campo">
          <label htmlFor="premio-tipo">Tipo</label>
          <select {...campo('tipo')}>
            <option value="brinde">Brinde (entregue pela organização)</option>
            <option value="destaque">Destaque do post no feed</option>
          </select>
        </div>
        {c.tipo === 'destaque' && (
          <div className="campo">
            <label htmlFor="premio-diasDestaque">Dias em destaque</label>
            <input {...campo('diasDestaque')} type="number" inputMode="numeric" min={1} max={30} step={1} />
          </div>
        )}
      </div>
      <label className="caixa">
        <input type="checkbox" name="ativo" checked={c.ativo} onChange={mudar} /> Aparece no catálogo
      </label>
      {erro.mensagem && (
        <p className="erro-geral" role="alert">
          {erro.mensagem}
        </p>
      )}
      <div className="linha">
        <button type="submit" className="botao primario" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar prêmio'}
        </button>
        <button type="button" className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function AdminPremios() {
  const { eu, avisar, recarregar } = useSessao();
  const [premios, setPremios] = useState(null);
  const [resgates, setResgates] = useState(null);
  const [editando, setEditando] = useState(null); // null, 'novo' ou id
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const [p, r] = await Promise.all([api('/admin/premios'), api('/admin/resgates')]);
      setPremios(p.premios);
      setResgates(r.resgates);
    } catch (e) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    if (eu?.admin) carregar();
  }, [eu?.admin]);

  if (!eu?.admin)
    return (
      <div className="card vazio">
        <h1>Só quem administra vê esta tela.</h1>
      </div>
    );
  if (erro)
    return (
      <p className="erro-geral" role="alert">
        {erro}
      </p>
    );
  if (!premios) return <p className="carregando">Carregando…</p>;

  async function salvar(dados) {
    if (editando === 'novo') await api('/admin/premios', { metodo: 'POST', corpo: dados });
    else await api(`/admin/premios/${editando}`, { metodo: 'PUT', corpo: dados });
    setEditando(null);
    avisar({ tipo: 'ok', texto: 'Prêmio salvo.' });
    carregar();
  }

  async function mudarStatus(r, status) {
    try {
      await api(`/admin/resgates/${r.id}`, { metodo: 'PUT', corpo: { status } });
      avisar({ tipo: 'ok', texto: status === 'entregue' ? 'Marcado como entregue.' : 'Resgate cancelado. Os pontos voltaram para a pessoa.' });
      carregar();
      recarregar();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message });
    }
  }

  const pendentes = resgates.filter((r) => r.status === 'pendente');
  const outros = resgates.filter((r) => r.status !== 'pendente').slice(0, 20);

  return (
    <div className="pilha estreito">
      <h1>Prêmios (admin)</h1>
      <p className="sutil">
        Monte o catálogo e acompanhe os resgates. <Link to="/premios">Ver o catálogo como a comunidade vê</Link>
      </p>

      <section className="card">
        <div className="linha-entre">
          <h2>Resgates para entregar</h2>
          <span className="contador">{pendentes.length}</span>
        </div>
        {pendentes.length === 0 && <p className="sutil">Nenhum resgate esperando entrega.</p>}
        <ul className="lista-resgates">
          {pendentes.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.premio.nome}</strong>
                <span className="sutil">
                  {r.usuario.nome} (@{r.usuario.usuario}) · <a href={`mailto:${r.usuario.email}`}>{r.usuario.email}</a>
                </span>
                <small className="sutil">
                  {r.custo} pontos · {tempoRelativo(r.criadoEm)}
                </small>
              </div>
              <div className="linha">
                <button type="button" className="botao primario pequeno" onClick={() => mudarStatus(r, 'entregue')}>
                  Entregue
                </button>
                <button type="button" className="botao pequeno" onClick={() => mudarStatus(r, 'cancelado')}>
                  Cancelar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="linha-entre">
          <h2>Catálogo</h2>
          {editando !== 'novo' && (
            <button type="button" className="botao pequeno" onClick={() => setEditando('novo')}>
              Novo prêmio
            </button>
          )}
        </div>
        {editando === 'novo' && <FormPremio inicial={VAZIO} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />}
        <ul className="lista-premios">
          {premios.map((p) =>
            editando === p.id ? (
              <li key={p.id} className="editando">
                <FormPremio
                  inicial={{ ...p, estoque: p.estoque ?? '', diasDestaque: p.diasDestaque ?? '' }}
                  aoSalvar={salvar}
                  aoCancelar={() => setEditando(null)}
                />
              </li>
            ) : (
              <li key={p.id} className={p.ativo ? '' : 'inativo'}>
                <div>
                  <strong>{p.nome}</strong>
                  <small className="sutil">
                    {p.custo} pontos · {p.tipo === 'destaque' ? `destaque por ${p.diasDestaque} dias` : 'brinde'} ·{' '}
                    {p.estoque === null ? 'sem limite' : `${p.estoque} unidades`}
                    {!p.ativo && ' · fora do catálogo'}
                  </small>
                </div>
                <button type="button" className="botao pequeno" onClick={() => setEditando(p.id)}>
                  Editar
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      {outros.length > 0 && (
        <section className="card">
          <h2>Últimos resgates</h2>
          <ul className="lista-resgates">
            {outros.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.premio.nome}</strong>
                  <span className="sutil">
                    {r.usuario.nome} (@{r.usuario.usuario})
                  </span>
                </div>
                <span className={`status ${r.status}`}>{STATUS[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

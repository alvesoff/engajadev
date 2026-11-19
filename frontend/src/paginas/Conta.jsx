import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

/** Campo de senha com "Mostrar". */
function CampoSenha({ id, rotulo, valor, aoMudar, erro, dica, autoComplete }) {
  const [ver, setVer] = useState(false);
  const descrito = erro ? `${id}-erro` : dica ? `${id}-dica` : undefined;
  return (
    <div className={`campo${erro ? ' com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <div className="senha">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={erro ? 'true' : undefined}
          aria-describedby={descrito}
        />
        <button type="button" className="ver-senha" onClick={() => setVer((v) => !v)} aria-pressed={ver}>
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {erro ? (
        <p className="erro-campo" id={`${id}-erro`}>
          {erro}
        </p>
      ) : (
        dica && (
          <p className="dica" id={`${id}-dica`}>
            {dica}
          </p>
        )
      )}
    </div>
  );
}

const BIO_MAX = 160;

/** Nome e bio, que aparecem no perfil público. */
function EditarPerfil({ eu }) {
  const { avisar, recarregar } = useSessao();
  const [nome, setNome] = useState(eu.nome);
  const [bio, setBio] = useState(eu.bio ?? '');
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== eu.nome || bio.trim() !== (eu.bio ?? '');

  async function salvar(e) {
    e.preventDefault();
    if (nome.trim().length < 2) return setErros({ nome: 'O nome deve ter de 2 a 60 caracteres.' });
    setSalvando(true);
    try {
      const u = await api('/auth/perfil', { metodo: 'PUT', corpo: { nome, bio } });
      setNome(u.nome);
      setBio(u.bio);
      await recarregar();
      avisar({ tipo: 'ok', texto: 'Perfil atualizado.' });
    } catch (e2) {
      if (e2.campo) setErros({ [e2.campo]: e2.message });
      else avisar({ tipo: 'erro', texto: e2.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="formulario sem-borda" onSubmit={salvar} noValidate>
      <div className={`campo${erros.nome ? ' com-erro' : ''}`}>
        <label htmlFor="perfil-nome">Nome</label>
        <input
          id="perfil-nome"
          value={nome}
          maxLength={60}
          autoComplete="name"
          onChange={(e) => {
            setNome(e.target.value);
            setErros({});
          }}
          aria-invalid={erros.nome ? 'true' : undefined}
          aria-describedby={erros.nome ? 'perfil-nome-erro' : undefined}
        />
        {erros.nome && (
          <p className="erro-campo" id="perfil-nome-erro">
            {erros.nome}
          </p>
        )}
      </div>
      <div className={`campo${erros.bio ? ' com-erro' : ''}`}>
        <label htmlFor="perfil-bio">
          Bio <span className="sutil">(opcional)</span>
        </label>
        <textarea
          id="perfil-bio"
          value={bio}
          rows={3}
          maxLength={BIO_MAX}
          placeholder="Ex.: Dev front-end. Escrevo sobre React e acessibilidade."
          onChange={(e) => {
            setBio(e.target.value);
            setErros({});
          }}
          aria-invalid={erros.bio ? 'true' : undefined}
          aria-describedby={erros.bio ? 'perfil-bio-erro' : 'perfil-bio-dica'}
        />
        {erros.bio ? (
          <p className="erro-campo" id="perfil-bio-erro">
            {erros.bio}
          </p>
        ) : (
          <p className="dica" id="perfil-bio-dica">
            Aparece no seu perfil público. {bio.length}/{BIO_MAX} caracteres.
          </p>
        )}
      </div>
      <button type="submit" className="botao primario" disabled={salvando || !mudou}>
        {salvando ? 'Salvando…' : 'Salvar perfil'}
      </button>
    </form>
  );
}

export default function Conta() {
  const { eu, avisar } = useSessao();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [outras, setOutras] = useState(null);
  const [saindo, setSaindo] = useState(false);

  const contarSessoes = useCallback(() => {
    api('/auth/sessoes')
      .then((r) => setOutras(r.outras))
      .catch(() => setOutras(null));
  }, []);
  useEffect(contarSessoes, [contarSessoes]);

  async function trocar(e) {
    e.preventDefault();
    setErroGeral('');
    const novos = {};
    if (!atual) novos.senhaAtual = 'Informe sua senha atual.';
    if (nova.length < 8) novos.senhaNova = 'A senha precisa ter pelo menos 8 caracteres.';
    else if (nova !== repetir) novos.repetir = 'As duas senhas novas não são iguais.';
    setErros(novos);
    if (Object.keys(novos).length) return;
    setSalvando(true);
    try {
      const r = await api('/auth/senha', { metodo: 'PUT', corpo: { senhaAtual: atual, senhaNova: nova } });
      setAtual('');
      setNova('');
      setRepetir('');
      avisar({
        tipo: 'ok',
        texto:
          r.outrasSessoesEncerradas > 0
            ? `Senha trocada. Saímos da sua conta em ${r.outrasSessoesEncerradas} ${r.outrasSessoesEncerradas === 1 ? 'outro aparelho' : 'outros aparelhos'}.`
            : 'Senha trocada.',
      });
      contarSessoes();
    } catch (e2) {
      if (e2.campo) setErros({ [e2.campo]: e2.message });
      else setErroGeral(e2.message);
    } finally {
      setSalvando(false);
    }
  }

  async function sairDosOutros() {
    setSaindo(true);
    try {
      const r = await api('/auth/sair-dos-outros', { metodo: 'POST' });
      avisar({
        tipo: 'ok',
        texto: r.encerradas > 0 ? `Pronto: saímos da sua conta em ${r.encerradas} ${r.encerradas === 1 ? 'aparelho' : 'aparelhos'}.` : 'Não havia outros aparelhos conectados.',
      });
      contarSessoes();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message });
    } finally {
      setSaindo(false);
    }
  }

  if (!eu) return <p className="carregando">Carregando…</p>;

  return (
    <div className="pilha estreito">
      <h1>Minha conta</h1>
      <section className="card">
        <h2>Seu perfil</h2>
        <EditarPerfil eu={eu} />
      </section>

      <section className="card">
        <h2>Dados da conta</h2>
        <dl className="dados-conta">
          <dt>@usuário</dt>
          <dd>
            <Link to={`/u/${eu.usuario}`}>@{eu.usuario}</Link>
          </dd>
          <dt>E-mail</dt>
          <dd>{eu.email}</dd>
        </dl>
        <p className="sutil">Só você vê o seu e-mail. Ele não aparece no seu perfil.</p>
      </section>

      <section className="card">
        <h2>Trocar senha</h2>
        <form className="formulario sem-borda" onSubmit={trocar} noValidate>
          <CampoSenha
            id="senha-atual"
            rotulo="Senha atual"
            valor={atual}
            aoMudar={(v) => {
              setAtual(v);
              setErros((x) => ({ ...x, senhaAtual: undefined }));
            }}
            erro={erros.senhaAtual}
            autoComplete="current-password"
          />
          <CampoSenha
            id="senha-nova"
            rotulo="Nova senha"
            valor={nova}
            aoMudar={(v) => {
              setNova(v);
              setErros((x) => ({ ...x, senhaNova: undefined }));
            }}
            erro={erros.senhaNova}
            dica="Pelo menos 8 caracteres."
            autoComplete="new-password"
          />
          <CampoSenha
            id="senha-repetir"
            rotulo="Repita a nova senha"
            valor={repetir}
            aoMudar={(v) => {
              setRepetir(v);
              setErros((x) => ({ ...x, repetir: undefined }));
            }}
            erro={erros.repetir}
            autoComplete="new-password"
          />
          {erroGeral && (
            <p className="erro-geral" role="alert">
              {erroGeral}
            </p>
          )}
          <p className="sutil">Ao trocar a senha, sua conta sai dos outros aparelhos. Este continua conectado.</p>
          <button type="submit" className="botao primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Trocar senha'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Aparelhos conectados</h2>
        <p>
          {outras === null
            ? 'Carregando…'
            : outras === 0
              ? 'Sua conta está aberta só neste aparelho.'
              : `Além deste, sua conta está aberta em ${outras} ${outras === 1 ? 'outro aparelho' : 'outros aparelhos'}.`}
        </p>
        <p className="sutil">Esqueceu a conta aberta num computador emprestado? Saia dos outros aparelhos daqui.</p>
        <button type="button" className="botao com-espaco" onClick={sairDosOutros} disabled={saindo || outras === 0}>
          {saindo ? 'Saindo…' : 'Sair dos outros aparelhos'}
        </button>
      </section>
    </div>
  );
}

import { useRef, useState } from 'react';
import { api } from './api.js';

const VAZIO = { nome: '', usuario: '', email: '', senha: '' };

/** As mesmas regras do servidor, para avisar antes de enviar. O servidor confere de novo. */
function conferir(modo, c) {
  const e = {};
  const email = c.email.trim();
  if (modo === 'cadastro') {
    const nome = c.nome.trim();
    const usuario = c.usuario.trim().replace(/^@/, '');
    if (!nome) e.nome = 'Informe seu nome.';
    else if (nome.length < 2 || nome.length > 60) e.nome = 'O nome deve ter de 2 a 60 caracteres.';
    if (!usuario) e.usuario = 'Escolha um @usuário.';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(usuario)) {
      e.usuario = 'O @usuário deve ter de 3 a 20 caracteres, só letras sem acento, números ou _.';
    }
  }
  if (!email) e.email = 'Informe seu e-mail.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Este e-mail não parece válido. Confira se digitou certo.';
  if (modo === 'cadastro') {
    if (!c.senha) e.senha = 'Crie uma senha.';
    else if (c.senha.length < 8) e.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    else if (c.senha.length > 128) e.senha = 'A senha pode ter no máximo 128 caracteres.';
  } else if (!c.senha) e.senha = 'Informe sua senha.';
  return e;
}

function Campo({ nome, rotulo, erro, dica, ...props }) {
  const idErro = `${nome}-erro`;
  const idDica = `${nome}-dica`;
  return (
    <div className={`campo${erro ? ' com-erro' : ''}`}>
      <label htmlFor={nome}>{rotulo}</label>
      <input
        id={nome}
        name={nome}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={(erro ? idErro : dica && idDica) || undefined}
        {...props}
      />
      {erro ? (
        <p className="erro-campo" id={idErro}>
          {erro}
        </p>
      ) : (
        dica && (
          <p className="dica" id={idDica}>
            {dica}
          </p>
        )
      )}
    </div>
  );
}

export default function Entrar({ onEntrou }) {
  const [modo, setModo] = useState('entrar');
  const [campos, setCampos] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const form = useRef(null);
  const cadastro = modo === 'cadastro';

  function trocarModo(novo) {
    setModo(novo);
    setErros({});
    setErroGeral('');
  }

  function mudar(e) {
    const { name, value } = e.target;
    setCampos((c) => ({ ...c, [name]: value }));
    if (erros[name]) setErros((x) => ({ ...x, [name]: undefined }));
  }

  function focar(campo) {
    requestAnimationFrame(() => form.current?.querySelector(`[name="${campo}"]`)?.focus());
  }

  async function enviar(e) {
    e.preventDefault();
    setErroGeral('');
    const encontrados = conferir(modo, campos);
    setErros(encontrados);
    const primeiro = Object.keys(encontrados)[0];
    if (primeiro) return focar(primeiro);

    setEnviando(true);
    try {
      const u = cadastro
        ? await api('/auth/cadastro', { metodo: 'POST', corpo: campos })
        : await api('/auth/entrar', { metodo: 'POST', corpo: { email: campos.email, senha: campos.senha } });
      onEntrou(u);
    } catch (err) {
      if (err.campo) {
        setErros({ [err.campo]: err.message });
        focar(err.campo);
      } else {
        setErroGeral(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="entrar">
      <section className="apresentacao">
        <span className="marca">EngajaDev</span>
        <h1>Seu post de tecnologia merece ser visto.</h1>
        <p>
          A comunidade AceleraDev divulga os próprios posts e apoia os posts dos colegas. Entre para fazer parte.
        </p>
      </section>

      <form ref={form} className="cartao formulario" onSubmit={enviar} noValidate>
        <div className="abas" role="tablist" aria-label="Escolha uma opção">
          <button type="button" role="tab" aria-selected={!cadastro} onClick={() => trocarModo('entrar')}>
            Entrar
          </button>
          <button type="button" role="tab" aria-selected={cadastro} onClick={() => trocarModo('cadastro')}>
            Criar conta
          </button>
        </div>

        {cadastro && (
          <>
            <Campo nome="nome" rotulo="Nome" erro={erros.nome} value={campos.nome} onChange={mudar} autoComplete="name" />
            <Campo
              nome="usuario"
              rotulo="@usuário"
              erro={erros.usuario}
              dica="De 3 a 20 letras, números ou _. Ex.: ana_dev"
              value={campos.usuario}
              onChange={mudar}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
            />
          </>
        )}

        <Campo
          nome="email"
          rotulo="E-mail"
          erro={erros.email}
          type="email"
          inputMode="email"
          value={campos.email}
          onChange={mudar}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck="false"
        />

        <div className={`campo${erros.senha ? ' com-erro' : ''}`}>
          <label htmlFor="senha">Senha</label>
          <div className="senha">
            <input
              id="senha"
              name="senha"
              type={verSenha ? 'text' : 'password'}
              value={campos.senha}
              onChange={mudar}
              autoComplete={cadastro ? 'new-password' : 'current-password'}
              aria-invalid={erros.senha ? 'true' : undefined}
              aria-describedby={erros.senha ? 'senha-erro' : cadastro ? 'senha-dica' : undefined}
            />
            <button
              type="button"
              className="ver-senha"
              onClick={() => setVerSenha((v) => !v)}
              aria-pressed={verSenha}
            >
              {verSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {erros.senha ? (
            <p className="erro-campo" id="senha-erro">
              {erros.senha}
            </p>
          ) : (
            cadastro && (
              <p className="dica" id="senha-dica">
                Pelo menos 8 caracteres.
              </p>
            )
          )}
        </div>

        {erroGeral && (
          <p className="erro-geral" role="alert">
            {erroGeral}
          </p>
        )}

        <button type="submit" className="botao primario largo" disabled={enviando}>
          {enviando ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}
        </button>

        <p className="troca">
          {cadastro ? 'Já tem conta? ' : 'Ainda não tem conta? '}
          <button type="button" className="link" onClick={() => trocarModo(cadastro ? 'entrar' : 'cadastro')}>
            {cadastro ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </form>
    </div>
  );
}

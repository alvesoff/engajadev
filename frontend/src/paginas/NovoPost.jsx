import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, redeDoLink } from '../api.js';
import { useSessao } from '../sessao.jsx';
import { SeloRede } from '../componentes/CardPost.jsx';

export default function NovoPost() {
  const { avisar, recarregar } = useSessao();
  const [campos, setCampos] = useState({ url: '', titulo: '', descricao: '' });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState(null);
  const navegar = useNavigate();
  const rede = redeDoLink(campos.url);

  useEffect(() => {
    api('/regras')
      .then((r) => setTexto(r.texto))
      .catch(() => {});
  }, []);

  function mudar(e) {
    const { name, value } = e.target;
    setCampos((c) => ({ ...c, [name]: value }));
    if (erros[name]) setErros((x) => ({ ...x, [name]: undefined }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErroGeral('');
    const novos = {};
    if (!campos.url.trim()) novos.url = 'Cole o link do seu post.';
    else if (!rede) novos.url = 'Este link não parece válido. Ele precisa começar com http:// ou https://.';
    if (campos.titulo.trim().length < 3) novos.titulo = `O título deve ter de 3 a ${texto?.tituloMax ?? 120} caracteres.`;
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      const r = await api('/posts', { metodo: 'POST', corpo: campos });
      avisar(
        r.pontos?.criador > 0
          ? { tipo: 'ok', texto: `Post no ar! +${r.pontos.criador} pontos.` }
          : { tipo: 'ok', texto: 'Post no ar! Agora é com a comunidade.' },
      );
      recarregar();
      navegar(`/p/${r.post.id}`);
    } catch (e2) {
      if (e2.campo) setErros({ [e2.campo]: e2.message });
      else setErroGeral(e2.message);
    } finally {
      setEnviando(false);
    }
  }

  const campo = (nome) => ({
    id: nome,
    name: nome,
    value: campos[nome],
    onChange: mudar,
    'aria-invalid': erros[nome] ? 'true' : undefined,
    'aria-describedby': erros[nome] ? `${nome}-erro` : undefined,
  });
  const Erro = ({ nome }) =>
    erros[nome] ? (
      <p className="erro-campo" id={`${nome}-erro`}>
        {erros[nome]}
      </p>
    ) : null;

  return (
    <div className="pilha estreito">
      <h1>Divulgar um post</h1>
      <p className="sutil">Cole o link do seu post de tecnologia. Ele entra no feed e a comunidade pode curtir e comentar.</p>
      <form className="cartao formulario" onSubmit={enviar} noValidate>
        <div className={`campo${erros.url ? ' com-erro' : ''}`}>
          <label htmlFor="url">Link do post</label>
          <input {...campo('url')} type="url" inputMode="url" autoCapitalize="none" spellCheck="false" placeholder="https://www.linkedin.com/posts/…" />
          <Erro nome="url" />
          {rede && !erros.url && (
            <p className="detectado">
              Rede detectada: <SeloRede rede={rede} />
            </p>
          )}
        </div>
        <div className={`campo${erros.titulo ? ' com-erro' : ''}`}>
          <label htmlFor="titulo">Título</label>
          <input {...campo('titulo')} maxLength={texto?.tituloMax ?? 120} placeholder="Do que o post fala?" />
          <Erro nome="titulo" />
        </div>
        <div className={`campo${erros.descricao ? ' com-erro' : ''}`}>
          <label htmlFor="descricao">
            Descrição <span className="sutil">(opcional)</span>
          </label>
          <textarea
            {...campo('descricao')}
            rows={4}
            maxLength={texto?.descricaoMax ?? 500}
            placeholder="Conte em poucas linhas por que vale a pena ler."
          />
          <Erro nome="descricao" />
        </div>
        {erroGeral && (
          <p className="erro-geral" role="alert">
            {erroGeral}
          </p>
        )}
        <button type="submit" className="botao primario largo" disabled={enviando}>
          {enviando ? 'Publicando…' : 'Publicar no feed'}
        </button>
      </form>
    </div>
  );
}

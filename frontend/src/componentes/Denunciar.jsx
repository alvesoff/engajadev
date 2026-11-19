import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

/** Botão "Denunciar" com o formulário de motivo. A moderação decide depois (o post não some sozinho). */
export default function Denunciar({ postId }) {
  const { avisar } = useSessao();
  const [aberto, setAberto] = useState(false);
  const [motivos, setMotivos] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [erro, setErro] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    if (!aberto || motivos) return;
    api('/denuncias/motivos')
      .then((r) => setMotivos(r.motivos))
      .catch((e) => setErro({ mensagem: e.message }));
  }, [aberto, motivos]);

  if (enviada) return <p className="sutil denuncia-enviada">Você denunciou este post. A moderação vai analisar.</p>;
  if (!aberto)
    return (
      <button type="button" className="link denunciar" onClick={() => setAberto(true)}>
        Denunciar post
      </button>
    );

  async function enviar(e) {
    e.preventDefault();
    if (!motivo) return setErro({ campo: 'motivo', mensagem: 'Escolha o motivo da denúncia.' });
    setEnviando(true);
    try {
      await api(`/posts/${postId}/denuncias`, { metodo: 'POST', corpo: { motivo, detalhe } });
      setEnviada(true);
      avisar({ tipo: 'ok', texto: 'Denúncia enviada. Obrigado por ajudar a cuidar da comunidade.' });
    } catch (e2) {
      // já denunciado antes: mostra como enviada
      if (e2.status === 409) {
        setEnviada(true);
        return;
      }
      setErro({ campo: e2.campo, mensagem: e2.message });
      setEnviando(false);
    }
  }

  return (
    <form className="formulario denuncia" onSubmit={enviar} noValidate>
      <fieldset className={`campo${erro.campo === 'motivo' ? ' com-erro' : ''}`} aria-describedby={erro.campo === 'motivo' ? 'denuncia-erro' : undefined}>
        <legend>Qual é o problema com este post?</legend>
        {!motivos && !erro.mensagem && <p className="sutil">Carregando…</p>}
        {motivos &&
          Object.entries(motivos).map(([chave, nome]) => (
            <label key={chave} className="opcao">
              <input
                type="radio"
                name="motivo"
                value={chave}
                checked={motivo === chave}
                onChange={() => {
                  setMotivo(chave);
                  setErro({});
                }}
              />
              {nome}
            </label>
          ))}
      </fieldset>
      <div className={`campo${erro.campo === 'detalhe' ? ' com-erro' : ''}`}>
        <label htmlFor="denuncia-detalhe">
          Detalhe <span className="sutil">{motivo === 'outro' ? '(conte qual é o problema)' : '(opcional)'}</span>
        </label>
        <textarea
          id="denuncia-detalhe"
          value={detalhe}
          onChange={(e) => {
            setDetalhe(e.target.value);
            if (erro.campo === 'detalhe') setErro({});
          }}
          rows={2}
          maxLength={300}
          aria-invalid={erro.campo === 'detalhe' ? 'true' : undefined}
          aria-describedby={erro.campo === 'detalhe' ? 'denuncia-erro' : undefined}
        />
      </div>
      {erro.mensagem && (
        <p className="erro-campo" id="denuncia-erro" role="alert">
          {erro.mensagem}
        </p>
      )}
      <p className="sutil">Só a moderação vê quem denunciou.</p>
      <div className="linha-botoes">
        <button type="submit" className="botao perigo pequeno" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar denúncia'}
        </button>
        <button type="button" className="botao pequeno" onClick={() => setAberto(false)} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

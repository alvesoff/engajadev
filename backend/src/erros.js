export class ErroHttp extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

export const erro = (status, mensagem, extra) => new ErroHttp(status, mensagem, extra);

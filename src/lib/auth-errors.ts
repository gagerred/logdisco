/** Converte códigos de erro do Firebase Auth em mensagens em português. Retorna null para erros que não devem ser exibidos. */
export function mensagemDeErro(erro: unknown): string | null {
  const codigo = (erro as { code?: string })?.code ?? "";
  switch (codigo) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/invalid-email":
      return "Informe um e-mail válido.";
    case "auth/email-already-in-use":
      return "Já existe uma conta com esse e-mail. Entre com ela ou use “Esqueci minha senha”.";
    case "auth/weak-password":
      return "A senha é muito fraca. Use pelo menos 8 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    case "auth/network-request-failed":
      return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela de login do Google. Libere pop-ups para este site.";
    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado no Firebase. Adicione-o em Authentication → Configurações → Domínios autorizados.";
    case "auth/operation-not-allowed":
      return "Esse método de login não está ativado no Firebase (Authentication → Método de login).";
    case "auth/requires-recent-login":
      return "Por segurança, entre novamente e repita a operação.";
    case "auth/credential-already-in-use":
    case "auth/provider-already-linked":
      return "Essa forma de login já está vinculada a uma conta.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}

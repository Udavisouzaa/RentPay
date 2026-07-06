import * as crypto from 'crypto';

export interface WebhookPayload {
  id_cobranca: string;
  status: string;
  valor: number;
  data_pagamento: string;
  [key: string]: any; // Permite outros campos adicionais do gateway
}

/**
 * Valida se a assinatura do webhook confere com a esperada.
 * Utiliza HMAC SHA-256 e comparação de tempo constante para prevenir timing attacks.
 *
 * @param payload Corpo da requisição crua (raw string)
 * @param signatureHeader O cabeçalho de assinatura recebido
 * @param secret A chave secreta (secret key) compartilhada com o gateway
 * @returns boolean indicando se a assinatura é válida
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    // Calcula o HMAC SHA-256 do payload usando a secret
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(payload).digest('hex');

    // Compara de forma segura contra timing attacks
    // As strings precisam ter o mesmo tamanho para o timingSafeEqual funcionar
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf-8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (error) {
    // Qualquer erro no parsing de buffers, etc, consideramos falha na validação
    return false;
  }
}

export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookValidationError';
  }
}

/**
 * Faz o parse do payload JSON do webhook e valida os campos obrigatórios.
 *
 * Consideração de Segurança (Replay Attacks):
 * Esta função valida o formato, mas para proteção contra Replay Attacks
 * (quando um atacante reenvia o mesmo webhook), a aplicação consumidora
 * DEVE implementar controle de idempotência usando o `id_cobranca` ou um `event_id`
 * único enviado pelo gateway, salvando no banco de dados que aquele evento
 * já foi processado com sucesso.
 *
 * @param rawBody Corpo da requisição crua
 * @returns Objeto tipado WebhookPayload
 * @throws WebhookValidationError se o payload for inválido ou faltarem campos
 */
export function parseWebhookPayload(rawBody: string): WebhookPayload {
  let parsed: any;

  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    throw new WebhookValidationError('Payload não é um JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new WebhookValidationError('Payload JSON deve ser um objeto.');
  }

  const requiredFields = ['id_cobranca', 'status', 'valor', 'data_pagamento'];
  const missingFields = requiredFields.filter(field => !(field in parsed));

  if (missingFields.length > 0) {
    throw new WebhookValidationError(`Campos obrigatórios ausentes no payload: ${missingFields.join(', ')}`);
  }

  // Validação básica de tipos
  if (typeof parsed.id_cobranca !== 'string') {
    throw new WebhookValidationError('O campo id_cobranca deve ser uma string.');
  }
  if (typeof parsed.status !== 'string') {
    throw new WebhookValidationError('O campo status deve ser uma string.');
  }
  if (typeof parsed.valor !== 'number') {
    throw new WebhookValidationError('O campo valor deve ser um número.');
  }
  if (typeof parsed.data_pagamento !== 'string') {
    throw new WebhookValidationError('O campo data_pagamento deve ser uma string (Data).');
  }

  return parsed as WebhookPayload;
}

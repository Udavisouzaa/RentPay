import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { verifyWebhookSignature, parseWebhookPayload, WebhookValidationError } from '../src/webhook';

describe('Webhook Validation Module', () => {
  const secret = 'minha_secret_super_segura_123';

  const validPayloadObj = {
    id_cobranca: 'cob_123456',
    status: 'pago',
    valor: 1500.50,
    data_pagamento: '2023-10-01T14:30:00Z',
    extra_field: 'algo a mais'
  };

  const validPayloadString = JSON.stringify(validPayloadObj);

  // Helper to generate correct signature
  const generateSignature = (payload: string, sec: string) => {
    return crypto.createHmac('sha256', sec).update(payload).digest('hex');
  };

  describe('verifyWebhookSignature', () => {
    it('deve retornar true para uma assinatura válida', () => {
      const signature = generateSignature(validPayloadString, secret);
      const isValid = verifyWebhookSignature(validPayloadString, signature, secret);
      expect(isValid).toBe(true);
    });

    it('deve retornar false para uma assinatura inválida ou adulterada', () => {
      const signature = generateSignature(validPayloadString, secret);
      const invalidSignature = signature.replace('a', 'b'); // Adulterando 1 caractere

      const isValid = verifyWebhookSignature(validPayloadString, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it('deve retornar false se a secret estiver incorreta', () => {
      const signature = generateSignature(validPayloadString, 'secret_errada');
      const isValid = verifyWebhookSignature(validPayloadString, signature, secret);
      expect(isValid).toBe(false);
    });

    it('deve retornar false se a assinatura tiver tamanho diferente (evitar throw no timingSafeEqual)', () => {
      const isValid = verifyWebhookSignature(validPayloadString, 'assinatura_muito_curta', secret);
      expect(isValid).toBe(false);
    });
  });

  describe('parseWebhookPayload', () => {
    it('deve fazer o parse corretamente de um payload válido', () => {
      const parsed = parseWebhookPayload(validPayloadString);
      expect(parsed).toEqual(validPayloadObj);
    });

    it('deve lançar erro se o rawBody não for um JSON válido', () => {
      const invalidJson = '{ "id_cobranca": "123", }'; // JSON malformado
      expect(() => parseWebhookPayload(invalidJson)).toThrow(WebhookValidationError);
      expect(() => parseWebhookPayload(invalidJson)).toThrow('Payload não é um JSON válido.');
    });

    it('deve lançar erro se faltar um campo obrigatório', () => {
      const missingFieldObj = {
        status: 'pago',
        valor: 1500.50,
        data_pagamento: '2023-10-01T14:30:00Z'
      }; // Falta id_cobranca
      const payloadString = JSON.stringify(missingFieldObj);

      expect(() => parseWebhookPayload(payloadString)).toThrow(WebhookValidationError);
      expect(() => parseWebhookPayload(payloadString)).toThrow('Campos obrigatórios ausentes no payload: id_cobranca');
    });

    it('deve lançar erro se faltarem múltiplos campos obrigatórios', () => {
      const missingFieldObj = {
        id_cobranca: 'cob_123',
      }; // Falta status, valor, data_pagamento
      const payloadString = JSON.stringify(missingFieldObj);

      expect(() => parseWebhookPayload(payloadString)).toThrow(WebhookValidationError);
      expect(() => parseWebhookPayload(payloadString)).toThrow('Campos obrigatórios ausentes no payload: status, valor, data_pagamento');
    });

    it('deve lançar erro se o tipo do campo obrigatório estiver incorreto', () => {
      const wrongTypeObj = {
        id_cobranca: 'cob_123456',
        status: 'pago',
        valor: '1500.50', // Deveria ser number
        data_pagamento: '2023-10-01T14:30:00Z'
      };
      const payloadString = JSON.stringify(wrongTypeObj);

      expect(() => parseWebhookPayload(payloadString)).toThrow(WebhookValidationError);
      expect(() => parseWebhookPayload(payloadString)).toThrow('O campo valor deve ser um número.');
    });
  });
});

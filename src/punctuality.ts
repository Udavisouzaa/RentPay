export interface Invoice {
  status: 'pago' | 'atrasado' | 'pendente' | 'nao_pago';
  data_vencimento: Date;
  data_pagamento: Date | null;
  valor?: number;
}

export interface PunctualityConfig {
  halfLifeDays: number;
  maxDelayDays: number;
  penaltyCurveFactor: number;
}

export const DEFAULT_CONFIG: PunctualityConfig = {
  halfLifeDays: 90,
  maxDelayDays: 30,
  penaltyCurveFactor: 1.5,
};

/**
 * Calcula o score de pontualidade de um inquilino.
 *
 * Regras e fórmulas:
 * - Decaimento temporal exponencial:
 *   peso = e^(-λ * idade_em_dias), onde λ = ln(2) / meia-vida (90 dias).
 *   Isso significa que um evento com 90 dias pesa metade, 180 dias pesa 1/4, etc.
 *
 * - Curva de penalidade de atraso:
 *   penalidade = min(1.0, (dias_atraso / limite_atraso)^fator_curva)
 *   Onde limite_atraso = 30, fator_curva = 1.5. Atrasos leves (1-5 dias) geram penalidade
 *   baixa (0.01 a 0.04). Atrasos de 30+ dias geram penalidade 1.0.
 *
 * - O score final é a média ponderada das penalidades:
 *   Score = 100 * (1 - penalidade_media_ponderada)
 */
export function calculatePunctualityScore(
  invoices: Invoice[],
  referenceDate: Date = new Date(),
  config: PunctualityConfig = DEFAULT_CONFIG
): number {
  if (!invoices || invoices.length === 0) {
    return 0;
  }

  const lambda = Math.LN2 / config.halfLifeDays;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  let totalWeightedPenalty = 0;
  let totalWeight = 0;

  for (const invoice of invoices) {
    // Calculamos a idade do evento com base na data de vencimento
    const ageDays = (referenceDate.getTime() - invoice.data_vencimento.getTime()) / MS_PER_DAY;

    // Se é uma fatura pendente e no futuro, ignoramos, pois ainda não compõe o histórico
    if (invoice.status === 'pendente' && ageDays < 0) {
      continue;
    }

    let delayDays = 0;
    let penalty = 0;

    if (invoice.status === 'nao_pago') {
      penalty = 1.0;
    } else {
      // Se foi pago, calculamos o atraso pela data de pagamento.
      // Se não, o atraso é contado até a data de referência (hoje).
      if (invoice.data_pagamento) {
        delayDays = (invoice.data_pagamento.getTime() - invoice.data_vencimento.getTime()) / MS_PER_DAY;
      } else {
        delayDays = ageDays;
      }

      if (delayDays > 0) {
        penalty = Math.pow(delayDays / config.maxDelayDays, config.penaltyCurveFactor);
        // A penalidade não pode passar de 1.0
        penalty = Math.min(1.0, penalty);
      } else {
        // Pago em dia ou antecipado gera 0 penalidade
        penalty = 0;
      }
    }

    // A idade efetiva para o decaimento não pode ser negativa
    // (para o caso de um pagamento antecipado analisado antes da data de vencimento)
    const effectiveAgeDays = Math.max(0, ageDays);
    const weight = Math.exp(-lambda * effectiveAgeDays);

    totalWeightedPenalty += penalty * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0; // Sem histórico = sem confiabilidade
  }

  const averagePenalty = totalWeightedPenalty / totalWeight;
  const score = 100 * (1 - averagePenalty);

  return Math.max(0, Math.min(100, score));
}

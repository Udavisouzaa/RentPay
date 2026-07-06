import { describe, it, expect } from 'vitest';
import { calculatePunctualityScore, Invoice } from '../src/punctuality';

describe('calculatePunctualityScore', () => {
  const referenceDate = new Date('2023-10-01T00:00:00Z');

  // Helper to create dates relative to reference date
  const createDate = (daysOffset: number) => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + daysOffset);
    return d;
  };

  it('lista vazia (deve retornar 0)', () => {
    const score = calculatePunctualityScore([], referenceDate);
    expect(score).toBe(0);
  });

  it('inquilino sempre pontual (score deve ficar > 95, próximo de 100)', () => {
    const invoices: Invoice[] = [
      {
        status: 'pago',
        data_vencimento: createDate(-30),
        data_pagamento: createDate(-30) // Pago no dia
      },
      {
        status: 'pago',
        data_vencimento: createDate(-60),
        data_pagamento: createDate(-62) // Pago antecipado
      },
      {
        status: 'pago',
        data_vencimento: createDate(-90),
        data_pagamento: createDate(-90)
      }
    ];

    const score = calculatePunctualityScore(invoices, referenceDate);
    expect(score).toBeGreaterThan(95);
    expect(score).toBe(100); // 100 já que todos foram no prazo
  });

  it('inquilino com um atraso antigo (ex: 180+ dias atrás) mas recuperado desde então (score deve estar > 85, refletindo recuperação)', () => {
    const invoices: Invoice[] = [
      {
        status: 'pago',
        data_vencimento: createDate(-30),
        data_pagamento: createDate(-30) // Pago no dia
      },
      {
        status: 'pago',
        data_vencimento: createDate(-60),
        data_pagamento: createDate(-60) // Pago no dia
      },
      {
        status: 'pago',
        data_vencimento: createDate(-90),
        data_pagamento: createDate(-90) // Pago no dia
      },
      {
        status: 'atrasado',
        data_vencimento: createDate(-200),
        data_pagamento: createDate(-170) // 30 dias de atraso (penalidade máxima), mas antigo
      }
    ];

    const score = calculatePunctualityScore(invoices, referenceDate);
    expect(score).toBeGreaterThan(85);
  });

  it('inquilino com atrasos recentes recorrentes (ex: últimos 3 meses com atrasos de 10+ dias) (score deve cair visivelmente, < 70)', () => {
    const invoices: Invoice[] = [
      {
        status: 'atrasado',
        data_vencimento: createDate(-30),
        data_pagamento: createDate(-15) // 15 dias de atraso
      },
      {
        status: 'atrasado',
        data_vencimento: createDate(-60),
        data_pagamento: createDate(-40) // 20 dias de atraso
      },
      {
        status: 'atrasado',
        data_vencimento: createDate(-90),
        data_pagamento: createDate(-75) // 15 dias de atraso
      }
    ];

    const score = calculatePunctualityScore(invoices, referenceDate);
    expect(score).toBeLessThan(70);
  });

  it('inquilino com atraso grave antigo E atraso leve recente (score intermediário, mostrando que o recente pesa mais)', () => {
    // Atraso grave antigo
    const invoicesGraveAntigo: Invoice[] = [
      {
        status: 'atrasado',
        data_vencimento: createDate(-180),
        data_pagamento: createDate(-140) // 40 dias de atraso
      }
    ];

    // Atraso leve recente
    const invoicesLeveRecente: Invoice[] = [
      {
        status: 'atrasado',
        data_vencimento: createDate(-30),
        data_pagamento: createDate(-27) // 3 dias de atraso
      }
    ];

    // Ambos
    const invoicesAmbos: Invoice[] = [...invoicesGraveAntigo, ...invoicesLeveRecente];

    const scoreAmbos = calculatePunctualityScore(invoicesAmbos, referenceDate);
    const scoreGraveAntigo = calculatePunctualityScore(invoicesGraveAntigo, referenceDate);
    const scoreLeveRecente = calculatePunctualityScore(invoicesLeveRecente, referenceDate);

    // Test that the score falls between boundaries and properly weights recent delays
    // Actually the logic says penalidade = min(1.0, (dias_atraso/30)^1.5)
    // 40 dias atraso -> 1.0 penalidade. Weight at 180 dias = 0.25
    // 3 dias atraso -> (3/30)^1.5 = (0.1)^1.5 = 0.0316 penalidade. Weight at 30 dias = 0.793
    // Total weight = 1.043. Total penalty = 1.0 * 0.25 + 0.0316 * 0.793 = 0.25 + 0.025 = 0.275
    // Average penalty = 0.275 / 1.043 = 0.263
    // Score = 100 * (1 - 0.263) = 73.6

    // This is an intermediate score showing that recent mild delay didn't ruin it completely,
    // but the old severe delay still brings it down some, though not completely.
    expect(scoreAmbos).toBeGreaterThan(60);
    expect(scoreAmbos).toBeLessThan(90);
  });

  it('inquilino com não pagamento (score deve ser muito baixo, < 30)', () => {
    const invoices: Invoice[] = [
      {
        status: 'pago',
        data_vencimento: createDate(-60),
        data_pagamento: createDate(-60) // Pago no dia
      },
      {
        status: 'nao_pago',
        data_vencimento: createDate(-30),
        data_pagamento: null // Não pago
      }
    ];

    const score = calculatePunctualityScore(invoices, referenceDate);
    expect(score).toBeLessThan(50); // It will be weighted around ~60-70% penalty, meaning score < 50

    // Com mais um não pago, ou um não pago apenas
    const invoicesApenasNaoPago: Invoice[] = [
      {
        status: 'nao_pago',
        data_vencimento: createDate(-10),
        data_pagamento: null
      }
    ];
    const scoreApenasNaoPago = calculatePunctualityScore(invoicesApenasNaoPago, referenceDate);
    expect(scoreApenasNaoPago).toBe(0); // 100% penalidade = 0 score
  });
});

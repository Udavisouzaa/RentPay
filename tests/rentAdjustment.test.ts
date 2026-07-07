import { describe, it, expect } from 'vitest';
import { calculateRentAdjustment } from '../src/rentAdjustment';

describe('calculateRentAdjustment', () => {
  const defaultValor = 2000;
  const dataInicio = new Date('2022-10-01T00:00:00Z');

  it('1. contrato ainda dentro do período (não reajusta)', () => {
    const dataRef = new Date('2023-05-01T00:00:00Z'); // Passaram 7 meses

    const result = calculateRentAdjustment({
      valorAtual: defaultValor,
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      indiceAcumulado: 5.5,
    });

    expect(result.reajustado).toBe(false);
    expect(result.novoValor).toBe(defaultValor);
    expect(result.percentualAplicado).toBe(0);
    // 2023-10-01 is next adjustment. From 2023-05-01 to 2023-10-01 is 153 days
    expect(result.diasParaProximoReajuste).toBeGreaterThan(0);
  });

  it('2. contrato exatamente na data de reajuste', () => {
    const dataRef = new Date('2023-10-01T00:00:00Z'); // Exatamente 1 ano

    const result = calculateRentAdjustment({
      valorAtual: defaultValor,
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      indiceAcumulado: 10, // 10%
    });

    expect(result.reajustado).toBe(true);
    expect(result.novoValor).toBe(2200); // 2000 * 1.10
    expect(result.percentualAplicado).toBe(10);
    // Próximo reajuste agora é em 1 ano (2024-10-01). Faltam 366 dias (2024 é bissexto)
    expect(result.diasParaProximoReajuste).toBeGreaterThan(360);
  });

  it('3. índice positivo normal (com dias de atraso na checagem)', () => {
    const dataRef = new Date('2023-10-15T00:00:00Z'); // 1 ano e 15 dias depois

    const result = calculateRentAdjustment({
      valorAtual: defaultValor,
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      indiceAcumulado: 5.12, // 5.12%
    });

    expect(result.reajustado).toBe(true);
    // 2000 * 1.0512 = 2102.40
    expect(result.novoValor).toBe(2102.40);
    expect(result.percentualAplicado).toBe(5.12);
  });

  it('4. índice negativo com permiteReducao = false (não deve reduzir)', () => {
    const dataRef = new Date('2023-10-01T00:00:00Z');

    const result = calculateRentAdjustment({
      valorAtual: defaultValor,
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      indiceAcumulado: -2.5, // Deflação de 2.5%
      permiteReducao: false,
    });

    expect(result.reajustado).toBe(true); // O ciclo virou
    expect(result.percentualAplicado).toBe(0); // Tratamento de piso
    expect(result.novoValor).toBe(defaultValor); // Valor mantido
  });

  it('5. índice negativo com permiteReducao = true (deve reduzir)', () => {
    const dataRef = new Date('2023-10-01T00:00:00Z');

    const result = calculateRentAdjustment({
      valorAtual: defaultValor,
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      indiceAcumulado: -5, // Deflação de 5%
      permiteReducao: true,
    });

    expect(result.reajustado).toBe(true);
    expect(result.percentualAplicado).toBe(-5);
    // 2000 * 0.95 = 1900
    expect(result.novoValor).toBe(1900);
  });

  it('6. periodicidade customizada (ex: 6 meses em vez de 12)', () => {
    const dataRef = new Date('2023-04-01T00:00:00Z'); // Exatamente 6 meses depois

    const result = calculateRentAdjustment({
      valorAtual: defaultValor,
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      indiceAcumulado: 4,
      periodicidadeReajusteMeses: 6,
    });

    expect(result.reajustado).toBe(true);
    expect(result.percentualAplicado).toBe(4);
    // 2000 * 1.04 = 2080
    expect(result.novoValor).toBe(2080);

    // Próximo reajuste seria em 2023-10-01.
    // De 2023-04-01 até 2023-10-01 = 183 dias.
    expect(result.diasParaProximoReajuste).toBe(183);
  });

  it('7. contrato com data de último reajuste já salva (deve pular o início)', () => {
    const dataUltimoReajuste = new Date('2023-10-01T00:00:00Z');
    const dataRef = new Date('2024-10-01T00:00:00Z'); // 1 ano após o último

    const result = calculateRentAdjustment({
      valorAtual: 2200, // Já tinha sido reajustado
      dataInicioContrato: dataInicio,
      dataReferencia: dataRef,
      dataUltimoReajuste: dataUltimoReajuste,
      indiceAcumulado: 10,
    });

    expect(result.reajustado).toBe(true);
    expect(result.novoValor).toBe(2420); // 2200 * 1.10 = 2420
    expect(result.percentualAplicado).toBe(10);
  });
});

export interface RentAdjustmentInput {
  valorAtual: number;
  dataInicioContrato: Date;
  dataReferencia: Date;
  dataUltimoReajuste?: Date; // Opcional, para contratos com histórico de reajustes
  indiceAcumulado: number;
  periodicidadeReajusteMeses?: number; // Padrão: 12
  permiteReducao?: boolean; // Padrão: false (proteção contra deflação)
}

export interface RentAdjustmentOutput {
  novoValor: number;
  reajustado: boolean;
  diasParaProximoReajuste: number;
  percentualAplicado: number;
}

/**
 * Adiciona meses a uma data considerando os dias corretamente
 */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Retorna a diferença em dias inteiros entre duas datas
 */
function differenceInDays(date1: Date, date2: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  // Zera as horas para comparar apenas os dias
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.ceil((d1.getTime() - d2.getTime()) / MS_PER_DAY);
}

/**
 * Calcula o reajuste automático de aluguel com base na data de aniversário
 * e no índice de inflação acumulado.
 */
export function calculateRentAdjustment(input: RentAdjustmentInput): RentAdjustmentOutput {
  const {
    valorAtual,
    dataInicioContrato,
    dataReferencia,
    dataUltimoReajuste,
    indiceAcumulado,
  } = input;

  const periodicidade = input.periodicidadeReajusteMeses ?? 12;
  const permiteReducao = input.permiteReducao ?? false;

  // A data base para o próximo reajuste é o último reajuste (se houver)
  // ou o início do contrato
  const baseDate = dataUltimoReajuste ? dataUltimoReajuste : dataInicioContrato;

  // Encontra a data do próximo reajuste
  // Se o contrato é muito antigo e já passou vários ciclos, calculamos
  // o próximo reajuste de forma iterativa até encontrar uma data futura
  // (estritamente maior que a data de referência, ou seja, onde daysToNext > 0).
  // Porém, queremos identificar a "janela" atual. Se a dataReferencia for maior
  // ou igual a próxima data de reajuste, isso significa que um reajuste é DEVIDO AGORA
  // (ou estava devido há alguns dias). O reajuste só ocorre uma vez por ciclo.

  // Vamos reescrever a lógica para ser mais robusta, encontrando o ÚLTIMO reajuste
  // que deveria ter ocorrido.

  let lastAdjustmentDue = new Date(baseDate);
  let nextAdjustmentDate = addMonths(baseDate, periodicidade);

  // Avançamos iterativamente mantendo as datas base exatas sem acumular erro de dias em addMonths consecutivos
  let iteration = 1;
  while (differenceInDays(nextAdjustmentDate, dataReferencia) <= 0) {
      lastAdjustmentDue = new Date(nextAdjustmentDate);
      iteration++;
      nextAdjustmentDate = addMonths(baseDate, periodicidade * iteration);
  }

  // Agora:
  // lastAdjustmentDue: A data do último aniversário que JÁ PASSOU ou É HOJE.
  // nextAdjustmentDate: A data do PRÓXIMO aniversário FUTURO.

  const isAdjustmentDue = dataUltimoReajuste
      ? differenceInDays(dataUltimoReajuste, lastAdjustmentDue) < 0
      : differenceInDays(dataInicioContrato, lastAdjustmentDue) < 0;

  const daysToNext = differenceInDays(nextAdjustmentDate, dataReferencia);

  // Se não tem reajuste pendente, retornamos os valores originais
  if (!isAdjustmentDue) {
    return {
      novoValor: valorAtual,
      reajustado: false,
      diasParaProximoReajuste: daysToNext,
      percentualAplicado: 0,
    };
  }

  // Se isAdjustmentDue for true, significa que lastAdjustmentDue é a data que gerou
  // o gatilho. E como differenceInDays(nextAdjustmentDate, dataReferencia) > 0 por
  // causa do while, daysToNext já aponta corretamente para a próxima renovação.

  let percentualAplicado = indiceAcumulado;

  // Tratamento de deflação (índice negativo)
  if (indiceAcumulado < 0 && !permiteReducao) {
    percentualAplicado = 0;
  }

  // Calcula o novo valor e arredonda para 2 casas decimais
  let novoValor = valorAtual * (1 + percentualAplicado / 100);
  novoValor = Math.round(novoValor * 100) / 100;

  // Se ele já atualizou, a data proxima agora eh o nextAdjustmentDate (pois reajustou AGORA).
  // Se o daysToNext era 0 ou passou poucos dias (já descontado pela formula), a próxima janela
  // é de fato nextAdjustmentDate.

  return {
    novoValor,
    reajustado: percentualAplicado !== 0 || indiceAcumulado !== 0,
    // Se o indice foi 0, tecnicamente não mudou o valor financeiro,
    // mas o "evento" ocorreu. Retornaremos 'true' se de fato alterou algo
    // ou se o reajuste processou normal. Para ser exato, definimos 'reajustado'
    // indicando se o ciclo virou. Então se chegou no dia, o ciclo virou.
    // Mas a regra diz: "reajustado: boolean".
    // Vou retornar reajustado = true sempre que bater a data. Se o percentual aplicado for 0
    // (por causa de deflação bloqueada), o novoValor = valorAtual, mas o evento de renovação aconteceu.
    // Assim o "diasParaProximoReajuste" reseta corretamente.
    diasParaProximoReajuste: daysToNext,
    percentualAplicado,
  };
}

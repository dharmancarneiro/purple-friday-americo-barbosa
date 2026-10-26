import { chaveFonte, noIntervalo, somarCoorte, type FiltroPublico } from './coorte';
import type { CoorteDia, Disparo } from './data';
import { div, fBrl, fInt, fPct, pct } from './format';
import { addDias, agrupar, metricas, somar, type LinhaDia } from './trafego';

export type Alerta = {
  tom: 'bom' | 'atencao' | 'ruim' | 'info';
  titulo: string;
  texto: string;
  /** O que olhar ou fazer, em uma frase. */
  acao?: string;
};

type Entrada = {
  ads: LinhaDia[]; // já filtrados pelo público
  coorte: CoorteDia[]; // já filtrado pelo público
  max: string; // último dia com dados
  listas: Disparo['listas'];
  publico: FiltroPublico;
};

const variacao = (novo: number, antigo: number) => ((novo - antigo) / antigo) * 100;

/**
 * Leituras automáticas em linguagem simples. Compara os últimos 3 dias com os 3 dias anteriores.
 * Taxas de entrada no grupo ignoram o último dia, porque quem se cadastrou hoje ainda está entrando.
 */
export function gerarAlertas({ ads, coorte, max, listas, publico }: Entrada): Alerta[] {
  if (!max) return [];
  const recIni = addDias(max, -2);
  const antIni = addDias(max, -5);
  const antFim = addDias(max, -3);

  const adsRec = noIntervalo(ads, recIni, max);
  const adsAnt = noIntervalo(ads, antIni, antFim);
  const cooRec = noIntervalo(coorte, recIni, max);
  const cooAnt = noIntervalo(coorte, antIni, antFim);

  const alertas: Alerta[] = [];
  const pago = (rows: CoorteDia[]) => somarCoorte(rows.filter((r) => chaveFonte(r.fonte) === 'trafego'));

  // 1) custo por cadastro do tráfego pago
  const gRec = somar(adsRec).gasto;
  const gAnt = somar(adsAnt).gasto;
  const cRec = pago(cooRec).cadastros;
  const cAnt = pago(cooAnt).cadastros;
  const cplRec = div(gRec, cRec);
  const cplAnt = div(gAnt, cAnt);
  if (cplRec != null && cplAnt != null && gRec >= 300 && gAnt >= 300 && cRec >= 20 && cAnt >= 20) {
    const v = variacao(cplRec, cplAnt);
    if (v >= 15) {
      alertas.push({
        tom: 'ruim',
        titulo: 'O cadastro ficou mais caro',
        texto: `Nos últimos 3 dias cada cadastro do tráfego custou ${fBrl(cplRec)}, contra ${fBrl(cplAnt)} nos 3 dias anteriores (${fPct(v, 0)} a mais).`,
        acao: 'Vale conferir na aba Tráfego quais anúncios gastaram mais e trouxeram menos.',
      });
    } else if (v <= -15) {
      alertas.push({
        tom: 'bom',
        titulo: 'O cadastro ficou mais barato',
        texto: `Nos últimos 3 dias cada cadastro do tráfego custou ${fBrl(cplRec)}, contra ${fBrl(cplAnt)} nos 3 dias anteriores (${fPct(-v, 0)} a menos).`,
      });
    }
  }

  // 2) entrada no grupo, só com dias completos
  const fimCompleto = addDias(max, -1);
  const cooRec2 = noIntervalo(coorte, addDias(max, -3), fimCompleto);
  const cooAnt2 = noIntervalo(coorte, addDias(max, -6), addDias(max, -4));
  const tRec = pago(cooRec2);
  const tAnt = pago(cooAnt2);
  const txRec = pct(tRec.entradas, tRec.cadastros);
  const txAnt = pct(tAnt.entradas, tAnt.cadastros);
  if (txRec != null && txAnt != null && tRec.cadastros >= 50 && tAnt.cadastros >= 50) {
    if (txAnt - txRec >= 5) {
      alertas.push({
        tom: 'atencao',
        titulo: 'Menos gente está entrando no grupo',
        texto: `Dos cadastros do tráfego dos últimos 3 dias completos, ${fPct(txRec, 0)} entraram no grupo. Antes eram ${fPct(txAnt, 0)}.`,
        acao: 'Confira se o link do grupo está funcionando e se o grupo não está cheio.',
      });
    } else if (txRec < 70) {
      alertas.push({
        tom: 'atencao',
        titulo: 'A entrada no grupo está baixa',
        texto: `Só ${fPct(txRec, 0)} dos cadastros recentes do tráfego entraram no grupo. O ideal é acima de 85%.`,
        acao: 'A régua de mensagens (aba Disparo e régua) ajuda a recuperar quem não entrou.',
      });
    }
  }

  // 3) anúncios que gastaram e não trouxeram cadastro
  const parados = agrupar(adsRec, 'anuncio')
    .filter((l) => l.s.gasto >= 50 && l.s.cadastros === 0)
    .sort((a, b) => b.s.gasto - a.s.gasto);
  if (parados.length > 0) {
    const nomes = parados
      .slice(0, 3)
      .map((l) => `${l.nome} (${fBrl(l.s.gasto)})`)
      .join(', ');
    alertas.push({
      tom: 'atencao',
      titulo: parados.length === 1 ? 'Um anúncio gastou e não trouxe cadastro' : `${parados.length} anúncios gastaram e não trouxeram cadastro`,
      texto: `Nos últimos 3 dias: ${nomes}${parados.length > 3 ? ' e outros' : ''}.`,
      acao: 'Vale revisar na aba Tráfego se ainda faz sentido manter esses anúncios no ar.',
    });
  }

  // 4) criativo mais barato (com gasto relevante)
  const bons = agrupar(adsRec, 'anuncio').filter((l) => l.s.gasto >= 100 && l.s.cadastros >= 10);
  if (bons.length >= 2 && cplRec != null) {
    const melhor = bons.reduce((a, b) => (metricas(b.s).cplReal! < metricas(a.s).cplReal! ? b : a));
    const cpl = metricas(melhor.s).cplReal!;
    if (cpl <= cplRec * 0.8) {
      alertas.push({
        tom: 'bom',
        titulo: `${melhor.nome} está trazendo o cadastro mais barato`,
        texto: `${fBrl(cpl)} por cadastro nos últimos 3 dias, contra ${fBrl(cplRec)} na média (${melhor.sub}).`,
        acao: 'É o candidato natural para receber mais verba ou para inspirar novos criativos.',
      });
    }
  }

  // 5) cadastros sem origem
  const totRec = somarCoorte(cooRec);
  const semOrigem = somarCoorte(cooRec.filter((r) => chaveFonte(r.fonte) === 'sem_utm'));
  const pSem = pct(semOrigem.cadastros, totRec.cadastros);
  if (pSem != null && totRec.cadastros >= 50 && pSem >= 10) {
    alertas.push({
      tom: 'atencao',
      titulo: 'Muitos cadastros sem origem',
      texto: `${fPct(pSem, 0)} dos cadastros dos últimos 3 dias (${fInt(semOrigem.cadastros)}) chegaram sem UTM. Parte deles pode ser tráfego pago sem rastreio, o que deixa o custo por cadastro mais alto do que é.`,
      acao: 'Confira se os links dos anúncios estão com os UTMs preenchidos.',
    });
  }

  // 6) convites ainda na fila
  const pendentes = listas.filter((l) => publico === 'todos' || (publico === 'aluno' ? l.publico === 'aluno' : l.publico !== 'aluno'));
  const naFila = pendentes.reduce((s, l) => s + l.pendentes, 0);
  if (naFila > 0) {
    alertas.push({
      tom: 'info',
      titulo: 'Convites aguardando envio',
      texto: `${fInt(naFila)} contatos ainda estão na fila do disparo por WhatsApp.`,
    });
  }

  if (!alertas.some((a) => a.tom === 'ruim' || a.tom === 'atencao')) {
    alertas.unshift({
      tom: 'bom',
      titulo: 'Nada fora do normal nos últimos 3 dias',
      texto: 'O custo por cadastro e a entrada no grupo estão estáveis em relação aos 3 dias anteriores.',
    });
  }

  const ordem = { ruim: 0, atencao: 1, bom: 2, info: 3 } as const;
  return alertas.sort((a, b) => ordem[a.tom] - ordem[b.tom]);
}

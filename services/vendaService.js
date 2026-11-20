const Precos = require('../js/precos');
const { ErroPedido } = require('./pedidoService');

function aplicarDesconto(calculado, desconto = { tipo: 'valor', valor: 0 }) {
    const subtotal = Precos.paraCentavos(calculado.total);
    let valor;
    try { valor = Precos.paraCentavos(desconto.valor); }
    catch { throw new ErroPedido('Informe um desconto válido com até duas casas decimais.', 400); }
    if (!['valor', 'percentual'].includes(desconto.tipo) || (desconto.tipo === 'percentual' && valor > 10000)) {
        throw new ErroPedido('O desconto percentual deve estar entre 0 e 100%.', 400);
    }
    const descontoCentavos = desconto.tipo === 'percentual' ? Number((BigInt(subtotal) * BigInt(valor) + 5000n) / 10000n) : valor;
    if (descontoCentavos > subtotal) throw new ErroPedido('O desconto não pode superar o valor dos produtos.', 400);
    return { ...calculado, subtotal: subtotal / 100, total: (subtotal - descontoCentavos) / 100,
        desconto_manual: descontoCentavos / 100, desconto_tipo: desconto.tipo, desconto_valor: valor / 100 };
}

// Rateio proporcional em centavos. Preserva quantidade e soma exata da cobrança,
// inclusive quando um desconto não pode ser dividido igualmente pelas unidades.
function itensCheckout(itens, descontoManual = 0) {
    const linhas = itens.map(i => ({ description: i.vinho_nome, quantity: Number(i.quantidade),
        price: Precos.paraCentavos(i.preco_unitario), subtotal: Precos.paraCentavos(i.subtotal) }));
    if (linhas.some(i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.price * i.quantity !== i.subtotal)) throw new ErroPedido('Os valores dos itens estão divergentes. Revise o pedido.');
    const total = linhas.reduce((s, i) => s + i.subtotal, 0);
    const desconto = Precos.paraCentavos(descontoManual);
    if (desconto > total) throw new ErroPedido('O desconto registrado excede o valor dos produtos.');
    if (!total) return [];
    const rateios = linhas.map((i, index) => {
        const multiplicado = BigInt(i.subtotal) * BigInt(desconto);
        return { index, valor: Number(multiplicado / BigInt(total)), resto: multiplicado % BigInt(total) };
    });
    let restantes = desconto - rateios.reduce((s, r) => s + r.valor, 0);
    const ordem = [...rateios].sort((a, b) => a.resto === b.resto ? a.index - b.index : a.resto > b.resto ? -1 : 1);
    for (const r of ordem) { if (restantes <= 0) break; r.valor++; restantes--; }
    return linhas.flatMap((i, index) => {
        const liquido = i.subtotal - rateios[index].valor;
        const unitario = Math.floor(liquido / i.quantity), extras = liquido % i.quantity;
        return [{ description: i.description, quantity: i.quantity - extras, price: unitario },
            { description: i.description, quantity: extras, price: unitario + 1 }].filter(i => i.quantity && i.price);
    });
}
module.exports = { aplicarDesconto, itensCheckout };

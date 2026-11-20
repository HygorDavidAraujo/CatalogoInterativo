const Precos = require('../js/precos');
const MAX_TOTAL_CENTAVOS = Precos.MAX_CENTAVOS;

class ErroPedido extends Error {
    constructor(message, statusCode = 409) {
        super(message);
        this.statusCode = statusCode;
    }
}

function calcularPrecoCentavos(precoBanco, beneficio) {
    try {
        return Precos.calcularCentavos(precoBanco, beneficio);
    } catch (error) {
        if (error.code === 'BENEFICIO_INVALIDO') {
            throw new ErroPedido('Seu benefício VIP precisa ser revisado. Entre em contato com o atendimento.');
        }
        throw new ErroPedido('Um produto está com preço inválido. Entre em contato com o atendimento.');
    }
}

// Executado na mesma transação da gravação. Os locks preservam os dados consultados
// caso preço, visibilidade ou benefício sejam alterados enquanto o pedido é salvo.
async function calcularPedido(client, usuarioId, itensSolicitados) {
    const { rows: usuarios } = usuarioId === null ? { rows: [{ is_vip: false }] } : await client.query(
        'SELECT id, is_vip, vip_tipo FROM usuarios WHERE id = $1 FOR SHARE',
        [usuarioId]
    );
    const usuario = usuarios[0];
    if (!usuario) {
        throw new ErroPedido('Sua conta não foi encontrada. Faça login novamente.', 401);
    }

    const quantidades = new Map();
    for (const item of itensSolicitados) {
        const quantidade = (quantidades.get(item.id) || 0) + item.quantidade;
        if (quantidade > 999) {
            throw new ErroPedido('A quantidade de cada produto deve ser no máximo 999.', 400);
        }
        quantidades.set(item.id, quantidade);
    }

    const { rows: vinhos } = await client.query(
        'SELECT id, nome, tipo, preco, ativo FROM vinhos WHERE id = ANY($1::int[]) ORDER BY id FOR SHARE',
        [[...quantidades.keys()]]
    );
    const vinhosPorId = new Map(vinhos.map(vinho => [vinho.id, vinho]));
    if (vinhos.length !== quantidades.size || vinhos.some(vinho => vinho.ativo === false)) {
        throw new ErroPedido('Um ou mais produtos não estão mais disponíveis. Atualize o catálogo e revise seu carrinho.');
    }

    let beneficio = null;
    if (usuario.is_vip && usuario.vip_tipo) {
        const { rows: beneficios } = await client.query(
            'SELECT tipo_desconto, valor_desconto FROM beneficios_vip WHERE slug = $1 AND ativo = TRUE FOR SHARE',
            [usuario.vip_tipo]
        );
        beneficio = beneficios[0] || null;
    }

    let totalCentavos = 0;
    const itens = [...quantidades].map(([id, quantidade]) => {
        const vinho = vinhosPorId.get(id);
        const precoCentavos = calcularPrecoCentavos(vinho.preco, beneficio);
        const subtotalCentavos = precoCentavos * quantidade;
        totalCentavos += subtotalCentavos;
        if (!Number.isSafeInteger(totalCentavos) || totalCentavos > MAX_TOTAL_CENTAVOS) {
            throw new ErroPedido('O valor do pedido excede o limite permitido. Reduza as quantidades.', 400);
        }
        return {
            id: vinho.id,
            nome: vinho.nome,
            tipo: vinho.tipo,
            quantidade,
            preco: precoCentavos / 100,
            subtotal: subtotalCentavos / 100
        };
    });

    return { total: totalCentavos / 100, itens };
}

module.exports = { calcularPedido, ErroPedido };

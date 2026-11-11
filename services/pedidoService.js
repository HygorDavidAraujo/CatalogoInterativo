const MAX_TOTAL_CENTAVOS = 9999999999; // Limite de NUMERIC(10, 2) no PostgreSQL.

class ErroPedido extends Error {
    constructor(message, statusCode = 409) {
        super(message);
        this.statusCode = statusCode;
    }
}

function calcularPrecoCentavos(precoBanco, beneficio) {
    const preco = Number(precoBanco);
    if (!Number.isFinite(preco) || preco < 0) {
        throw new ErroPedido('Um produto está com preço inválido. Entre em contato com o atendimento.');
    }

    let precoFinal = preco;
    if (beneficio) {
        const valor = Number(beneficio.valor_desconto);
        if (!Number.isFinite(valor) || valor < 0 ||
            !['percentual', 'valor_fixo'].includes(beneficio.tipo_desconto) ||
            (beneficio.tipo_desconto === 'percentual' && valor > 100)) {
            throw new ErroPedido('Seu benefício VIP precisa ser revisado. Entre em contato com o atendimento.');
        }

        precoFinal = beneficio.tipo_desconto === 'percentual'
            ? preco * (1 - valor / 100)
            : preco - valor;

        // Preserva a regra comercial atual do VipManager (preços terminados em ,90).
        // Uma mudança nessa regra deve atualizar também a exibição no catálogo.
        precoFinal = Math.max(0, precoFinal);
        precoFinal = Math.ceil(precoFinal * 100) / 100;
        precoFinal = Math.floor(precoFinal) + 0.90;
    }

    const centavos = Math.round(precoFinal * 100);
    if (!Number.isSafeInteger(centavos) || centavos > MAX_TOTAL_CENTAVOS) {
        throw new ErroPedido('Um produto está com preço inválido. Entre em contato com o atendimento.');
    }
    return centavos;
}

// Executado na mesma transação da gravação. Os locks preservam os dados consultados
// caso preço, visibilidade ou benefício sejam alterados enquanto o pedido é salvo.
async function calcularPedido(client, usuarioId, itensSolicitados) {
    const { rows: usuarios } = await client.query(
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

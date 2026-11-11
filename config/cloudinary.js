const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { AppError } = require('../middleware/errorHandler');

const variaveisObrigatorias = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const formatosPermitidos = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function verificarConfiguracaoUpload() {
    const ausentes = variaveisObrigatorias.filter(nome => !process.env[nome]?.trim());
    if (ausentes.length) {
        const error = new AppError('O envio de imagens não está configurado. Salve sem foto ou informe uma URL de imagem.', 503);
        error.code = 'UPLOAD_NOT_CONFIGURED';
        error.missingVariables = ausentes;
        throw error;
    }
}

// Configurar Cloudinary (somente via variáveis de ambiente)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️  Cloudinary não está totalmente configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no .env');
}

// Configurar storage do Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: () => {
        // Só exige Cloudinary quando existe um arquivo: URL e cadastro sem foto continuam disponíveis.
        verificarConfiguracaoUpload();
        return {
            folder: 'vinhos',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 800, height: 800, crop: 'limit' }]
        };
    }
});

// Configurar multer com Cloudinary e tratamento de erros
const upload = multer({ 
    storage: storage,
    fileFilter(req, file, callback) {
        if (!formatosPermitidos.has(file.mimetype)) {
            return callback(new AppError('Formato de imagem não suportado. Use JPG, PNG ou WebP.', 400));
        }
        callback(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

const singleOriginal = upload.single.bind(upload);
upload.single = (campo) => {
    const receberArquivo = singleOriginal(campo);
    return (req, res, next) => receberArquivo(req, res, (error) => {
        if (!error) return next();
        req.etapaOperacao = 'upload-imagem';
        if (error instanceof AppError || error.name === 'MulterError') return next(error);

        const autenticacaoFalhou = [401, 403].includes(error.http_code);
        const erroUpload = new AppError(
            autenticacaoFalhou
                ? 'O serviço de imagens recusou a autenticação. Verifique a configuração do upload.'
                : 'Não foi possível enviar a imagem. Tente novamente ou salve o produto sem upload.',
            autenticacaoFalhou ? 503 : 502
        );
        erroUpload.code = autenticacaoFalhou ? 'UPLOAD_AUTH_FAILED' : 'UPLOAD_FAILED';
        erroUpload.cause = error;
        next(erroUpload);
    });
};

module.exports = { cloudinary, upload };

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkurbmoya',
    api_key: process.env.CLOUDINARY_API_KEY || '625582187296994',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'k1hHtwzkarG7TWSMU5Q5OxLtqlQ'
});

// Configurar storage do Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'vinhos', // Pasta no Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit' }] // Otimizar tamanho
    }
});

// Configurar multer com Cloudinary
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

module.exports = { cloudinary, upload };

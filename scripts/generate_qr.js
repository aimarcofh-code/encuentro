import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const QRCode = require('qrcode');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const url = 'https://fhorg-my.sharepoint.com/:f:/g/personal/asanchez_fh_org/IgARVmNDB6J3QpcDt9TaoR5jAblgNjstH2iQG1R0hO7MJ8M?e=bfCAj8';
const outputPath = path.join(projectRoot, 'public', 'qr_memories.png');

QRCode.toFile(outputPath, url, {
    color: {
        dark: '#00f0ff',  // Accent Cyan
        light: '#00000000' // Transparent background
    },
    width: 300
}, function (err) {
    if (err) throw err;
    console.log('QR Code generated at:', outputPath);
});

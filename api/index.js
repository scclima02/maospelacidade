// Função serverless da Vercel: delega para o app NestJS compilado em dist/.
module.exports = require('../dist/vercel').default;

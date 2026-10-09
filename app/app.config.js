// Estende o app.json: liga o Firebase (push no Android) quando o google-services.json existir
// e aplica a assinatura do build release.
// Builds na nuvem da Expo (disparados pelo GitHub) recebem o arquivo pela variável de ambiente
// GOOGLE_SERVICES_JSON (variável do tipo "arquivo" cadastrada no EAS); no computador, vale o arquivo local.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const firebase = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : null);
  return {
    ...config,
    android: {
      ...config.android,
      ...(firebase ? { googleServicesFile: firebase } : {}),
    },
    plugins: [...config.plugins, './plugins/assinatura-android'],
  };
};

// Estende o app.json: liga o Firebase (push no Android) quando o google-services.json existir
// e aplica a assinatura do build release.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(firebase) ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins: [...config.plugins, './plugins/assinatura-android'],
  };
};

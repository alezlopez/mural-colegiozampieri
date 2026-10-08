// Assina o build release com a chave de upload da escola, sem guardar segredo no repositório.
// Os dados vêm de ~/.gradle/gradle.properties (ZAMPIERI_UPLOAD_*). Sem eles, o release
// continua assinado com a chave de debug (serve para teste, não para a Play Store).
const { withAppBuildGradle } = require('expo/config-plugins');

const ASSINATURA = `
        release {
            if (project.hasProperty('ZAMPIERI_UPLOAD_STORE_FILE')) {
                storeFile file(ZAMPIERI_UPLOAD_STORE_FILE)
                storePassword ZAMPIERI_UPLOAD_STORE_PASSWORD
                keyAlias ZAMPIERI_UPLOAD_KEY_ALIAS
                keyPassword ZAMPIERI_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('ZAMPIERI_UPLOAD_STORE_FILE')) return cfg;

    gradle = gradle.replace(/signingConfigs \{\n(\s+debug \{[\s\S]*?\n\s+\})/, (m) => m + ASSINATURA);
    gradle = gradle.replace(
      /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('ZAMPIERI_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (!gradle.includes('signingConfigs.release')) {
      throw new Error('[assinatura-android] formato do build.gradle mudou; revise o plugin.');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });

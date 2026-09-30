// Ne garde que les traductions Android utiles (fr, en) : les bibliothèques embarquent sinon
// leurs textes dans ~80 langues, ce qui alourdit l'APK sans rien apporter au jeu.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withResourceLanguages(config, languages = ['fr', 'en']) {
  return withAppBuildGradle(config, (c) => {
    const line = `        resourceConfigurations += [${languages.map((l) => `"${l}"`).join(', ')}]`;
    if (!c.modResults.contents.includes('resourceConfigurations')) {
      c.modResults.contents = c.modResults.contents.replace(/defaultConfig\s*\{/, (m) => `${m}\n${line}`);
    }
    return c;
  });
};

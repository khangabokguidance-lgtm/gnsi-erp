const sharp = require('sharp');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

Object.entries(sizes).forEach(([folder, size]) => {
  const out = `android/app/src/main/res/${folder}`;
  sharp('assets/icon.png').resize(size, size).toFile(`${out}/ic_launcher.png`, (err) => {
    if (err) console.error(err);
    else console.log('Done ' + folder);
  });
  sharp('assets/icon.png').resize(size, size).toFile(`${out}/ic_launcher_round.png`, () => {});
});
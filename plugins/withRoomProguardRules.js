const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# akna: room-keep-rules';
const RULES = `
${MARKER}
# Release derlemede R8 açık (android.enableMinifyInReleaseBuilds=true). WorkManager (react-native-maps
# bağımlılığı) veritabanını Room ile açar; Room *_Impl sınıflarını yansımayla oluşturduğu için R8 bu
# yapıcıları silince uygulama açılışta "Failed to create an instance of class
# androidx.work.impl.WorkDatabase" hatasıyla kapanıyordu.
-keep class * extends androidx.room.RoomDatabase { <init>(...); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
`;

/** android/app/proguard-rules.pro dosyasına Room/WorkManager koruma kurallarını ekler (prebuild sırasında). */
module.exports = function withRoomProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes(MARKER)) fs.writeFileSync(file, current + RULES);
      return cfg;
    },
  ]);
};

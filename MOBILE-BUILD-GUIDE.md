# Lions-X — Мобилно приложение: Стъпка по стъпка

## ПРЕДИ ДА ЗАПОЧНЕШ — ПОДГОТОВКА НА MAC-А

### 1. Инсталирай Node.js (ако нямаш)
Отвори Terminal (Applications → Utilities → Terminal) и напиши:
```
node --version
```
Ако получиш грешка, изтегли Node.js от: https://nodejs.org (вземи LTS версията)

### 2. Инсталирай Xcode (за iOS)
- Отвори App Store на Mac-а
- Търси "Xcode" и го инсталирай (ВНИМАНИЕ: ~12GB, отнема време!)
- След инсталиране, отвори Xcode веднъж и приеми лицензните условия
- В Terminal напиши: `xcode-select --install` (инсталира command line tools)

### 3. Инсталирай Android Studio (за Android)
- Изтегли от: https://developer.android.com/studio
- Инсталирай и при първото стартиране избери "Standard" setup
- Увери се, че Android SDK е инсталиран (Settings → SDK Manager)

---

## СТЪПКА 1: РАЗПАКЕТИРАЙ ПРОЕКТА

1. Разпакетирай ZIP файла, който ти дадох
2. Отвори Terminal
3. Навигирай до папката:
```
cd /path/to/lionsx-capacitor
```
(замени /path/to/ с реалния път — можеш да напишеш `cd ` и после да плъзнеш папката в Terminal-а)

---

## СТЪПКА 2: ИНСТАЛИРАЙ DEPENDENCIES

```
npm install
```
Изчакай да приключи (може да отнеме 1-2 минути).

---

## СТЪПКА 3: ИНСТАЛИРАЙ CAPACITOR

```
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

---

## СТЪПКА 4: BUILD НА ПРОЕКТА

```
npm run build
```
Това ще създаде `dist/` папка с компилираното приложение.

---

## СТЪПКА 5: ДОБАВИ iOS И ANDROID ПЛАТФОРМИ

```
npx cap add ios
npx cap add android
```

---

## СТЪПКА 6: СИНХРОНИЗИРАЙ

```
npx cap sync
```
Това копира build-а (dist/) в iOS и Android проектите.

---

## СТЪПКА 7: ОТВОРИ В XCODE (iOS)

```
npx cap open ios
```
Xcode ще се отвори с проекта.

В Xcode:
1. В лявото меню натисни на "App" (root на проекта)
2. В секция "Signing & Capabilities":
   - Избери Team → твоя Apple Developer акаунт
   - Bundle Identifier трябва да е: com.lionsx.app
3. Свържи iPhone с USB кабел (или избери Simulator)
4. Натисни ▶ (Run) горе вляво
5. Приложението ще се инсталира на телефона!

---

## СТЪПКА 8: ОТВОРИ В ANDROID STUDIO (Android)

```
npx cap open android
```
Android Studio ще се отвори.

1. Изчакай Gradle sync да приключи (долу вдясно ще видиш progress)
2. Свържи Android телефон с USB (или стартирай емулатор)
3. Натисни ▶ (Run) горе
4. Приложението ще се инсталира!

---

## ЗА ГЕНЕРИРАНЕ НА APK (Android за сваляне)

В Terminal:
```
cd android
./gradlew assembleRelease
```
APK файлът ще бъде в: `android/app/build/outputs/apk/release/app-release.apk`

Този файл може да се качи на landing page за директно сваляне!

---

## ЗА TESTFLIGHT (iOS)

1. В Xcode: Product → Archive
2. Изчакай archive процеса
3. Window → Organizer → избери последния archive
4. Натисни "Distribute App"
5. Избери "App Store Connect" → "Upload"
6. Следвай стъпките (signing и т.н.)
7. Отвори appstoreconnect.apple.com
8. Създай ново приложение с Bundle ID: com.lionsx.app
9. В TestFlight секцията ще видиш build-а
10. Добави тестери с имейлите им

---

## ЗА ЪПДЕЙТ (когато промениш код)

Всеки път когато направиш промяна:
```
npm run build
npx cap sync
```
После пусни отново в Xcode или Android Studio.

---

## ЧЕСТО СРЕЩАНИ ПРОБЛЕМИ

**"No signing certificate"** в Xcode:
→ Влез в Xcode → Preferences → Accounts → добави Apple ID-то си

**"SDK not found"** в Android Studio:
→ File → Settings → SDK Manager → инсталирай последния Android SDK

**Бял екран при стартиране:**
→ Увери се, че `npm run build` е минал без грешки
→ Провери дали `dist/` папката съществува и не е празна

**Камерата не работи:**
→ За iOS: Трябва да добавим Camera permission в Info.plist (ще го направя)
→ За Android: Трябва да добавим Camera permission в AndroidManifest.xml (ще го направя)

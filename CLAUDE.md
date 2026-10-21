# CLAUDE.md — Günlük AI Dedektif (Daily AI Detective)

Bu dosya projenin kalıcı talimatlarıdır. Üç bölümden oluşur:

1. **Proje promptu** (Enes'in orijinal talimatları — esas kaynak)
2. **Proje planı özeti** (PDF: "Günlük AI Dedektif — Proje Planı", 20 Ekim 2026)
3. **Durum** (her aşama bitince güncellenir)

> **Öncelik kuralı:** Prompt ile PDF planı çelişirse **prompt geçerlidir**.
> Next.js kararı kesinleşti. Site baştan sona Türkçe + İngilizce: arayüz, dava içerikleri ve şüphelilerin cevapları. Aşama 1'deki elle yazılmış örnek dava da iki dilde (EN + TR) hazırlanır.

---

## 1. Proje promptu

Benimle (Enes; 3 aydır kod yazmamış, şimdi geri dönen bir full-stack geliştirici) yurtdışındaki şirketlere yapacağım başvurular için bir portfolyo projesi geliştireceksin. Amacım projeyi yaparken ÖĞRENMEK. React biliyorum ama Next.js'te yeniyim, bu yüzden her önemli kararı kısaca açıkla, aşama aşama ilerle ve her aşamanın sonunda durup onayımı bekle. Her şeyi tek seferde yazma.

Benimle Türkçe konuş. Kod, değişken adları, yorumlar ve commit mesajları İngilizce olsun.

### Konsept

Wordle'ın dedektif versiyonu olan günlük bir cinayet gizemi oyunu. Her gün tüm oyunculara aynı yeni dava gelir. Oyuncu dava dosyasını okur, kanıtları inceler, AI'ın canlandırdığı 4 şüpheliyi chat üzerinden sorgular (toplam 20 soru hakkı), sonra suçlama yapar (katil + motif + kilit kanıt, tek hak). Sonuç ekranında gerçek hikâye anlatılır ve spoiler içermeyen bir paylaşım kartı çıkar (örn. "Case #42 · solved · 11/20 questions · 🔍🔍🗣️✅").

Site Türkçe + İngilizce olacak. Oyuncu dilini seçer; arayüz, dava metinleri ve şüphelilerin cevapları o dilde gelir.

### Stack (sabit)

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Row Level Security, Anonim Giriş (Anonymous Sign-ins), isteğe bağlı kalıcı hesap
- AI: Gemini API ücretsiz katmanı (Flash / Flash-Lite). SADECE sunucu tarafında (Route Handler veya Server Action) çağrılır. Model tek bir yerden değiştirilebilsin diye küçük, sağlayıcıdan bağımsız bir modülün arkasında olsun.
- Doğrulama: Zod
- Çoklu dil: next-intl (İngilizce varsayılan + Türkçe)
- Hosting: Vercel (ücretsiz plan), günlük işler için Vercel Cron

### Asla çiğnenmeyecek güvenlik kuralı

Davanın gizli kısmı (katil, motif, gerçek zaman çizelgesi, tüm şüphelilerin sırları) tarayıcıya ASLA ulaşmamalı.

- Client sadece herkese açık brifingi okur.
- Gizli veriye erişen kod sadece sunucuda çalışır (`server-only` paketiyle işaretle). Client Component'lere gizli alan içeren hiçbir prop geçmesin.
- Her sorgu isteği sunucuya gider; sunucu davayı kendisi yükler ve modele SADECE o şüphelinin kendi kişiliğini, alibisini, bildiklerini ve sırlarını gönderir. Şüpheli katil değilse, promptunda katilin kim olduğu bilgisi yer almaz.
- Soru sayacı sunucuda tutulur ve kontrol edilir.
- Tüm tablolarda RLS açık. Service role key sadece sunucu ortam değişkenlerinde. Bir .env.example hazırla; gizli anahtarları asla commit'leme.

### Veri modeli (SQL migration'larını sen öner)

- cases: public_briefing (jsonb), secret (jsonb), status (draft/approved), difficulty; metinler hem EN hem TR
- daily_schedule: tarih → case_id
- games: player_id, case_id, status, questions_used, accusation, score
- messages: game_id, suspect_id, question, answer
- profiles: username, language, streak
- case_reviews: doğrulama sonuçları ve admin notları (sadece admin)

### Dava formatı

Sıkı bir Zod şeması tanımla: kurban, mekân, ölüm saati, 4 şüpheli (isim, rol, kişilik, ilk ifade, alibi, bildikleri, sakladıkları, ne zaman yalan söyledikleri), 3-5 kanıt (açıklama, bulunduğu yer, neyi işaret ettiği), dakika dakika gerçek zaman çizelgesi ve çözüm (katil, motif, yöntem, kilit kanıt). Tüm oyuncuya görünen metinler EN ve TR olarak tutulsun.

### AI katmanı

1. Şüpheliler (canlı): Karakterden çıkmayan kısa cevaplar (en fazla 3-4 cümle), oyuncunun dilinde, streaming ile. Sohbet geçmişinin sadece son birkaç turu gönderilsin.
2. Prompt injection savunması: Gizli bilgi zaten promptta yok; soru uzunluğu sınırlı; "talimatları unut" gibi isteklerde karakterde kalarak geçiştir; diğer şüphelilerin sırlarını sızdıran cevapları filtrele. 30-50 saldırı sorusundan oluşan, otomatik çalışan ve başarı oranını raporlayan bir eval script'i yaz.
3. Dava üretimi (günde bir kez, offline): JSON üret → Zod kontrolü → kodla mantık kontrolleri (katil olay saatinde olay yerinde mi, kanıtlar zaman çizelgesiyle tutarlı mı, katili gösteren en az iki bağımsız ipucu var mı) → ayrı bir AI çağrısı çözümü görmeden davayı çözmeye çalışır; çözemezse ya da başka bir şüpheli de aynı derecede olası görünüyorsa dava reddedilir → onaylayıp takvime koyduğum bir admin paneli.

### Maliyet sınırları

Hedef aylık 0 dolar. Günde bir dava ve oyun başına 20 soru, AI çağrılarını sınırlıyor. Brifing ve ilk ifadeler dava başına bir kez üretilip saklansın. Kullanıcı ve IP başına hız sınırı ekle; anonim girişte Cloudflare Turnstile kullan.

### Aşamalar (her aşamadan sonra dur ve onayımı bekle)

- **Aşama 1:** Proje kurulumu (Next.js App Router, TS, Tailwind, ESLint/Prettier, next-intl ile EN/TR iskeleti), GitHub'a hazır yapı, Supabase client'ları (server ve browser ayrı), Vercel deploy ayarları. Zod dava şeması + elle yazılmış TEK bir dava (EN + TR) JSON fixture olarak. Dava dosyası ve kanıt ekranları.
- **Aşama 2:** Sorgu: şüpheli seçimi, chat arayüzü, şüpheli cevapları için streaming yapan Route Handler, sunucu tarafında 20 soru sayacı.
- **Aşama 3:** Supabase tabloları + RLS migration'ları, anonim giriş, oyun ilerlemesinin kaydedilmesi, suçlama, puanlama, sonuç ekranı ve paylaşım kartı, ipuçlarını işaretlemek için not defteri, hız sınırları, injection eval'inin ilk versiyonu.
- **Aşama 4:** AI dava üretici + tüm doğrulama adımları, admin onay paneli, Vercel Cron ile günlük yayın, ana sayfa, dava arşivi, mobil uyum ve cilalama.
- **Aşama 5:** Recruiter'lar için İngilizce README (canlı link, demo GIF, mimari diyagramı, gizli verinin izolasyonu, dava doğrulama ve maliyet kontrolünü anlatan "Engineering decisions" bölümü, eval başarı oranı).

### Çalışma kuralları

- Her önemli adımdan önce ne yaptığını ve neden yaptığını 2-3 cümleyle açıkla. Özellikle Next.js'e özgü kavramları (Server ve Client Component farkı, Route Handler, Server Action, middleware, caching) ilk kullandığında kısaca öğret.
- Küçük ve anlamlı commit'ler at.
- Yukarıda listelenmeyen bir bağımlılık eklemeden önce bana sor.
- Component'ler küçük ve tipli olsun; `any` kullanma.
- Benim yapmam gereken bir şey olduğunda (Supabase projesi açmak, API anahtarı almak, Vercel ayarları) tam olarak ne yapacağımı adım adım söyle.

---

## 2. Proje planı özeti (PDF)

**Özet:** Her gün herkese aynı yeni cinayet gizemini sunan, şüphelileri AI'ın canlandırdığı tarayıcı oyunu. Değeri: günlük gizem + AI sohbeti adil, çözülebilir ve hile yapılamayan bir sistemde birleştirmek.

**CV hedefi:** "Gerçek kullanıcısı olan, AI'ı ciddi mühendislikle kullanan ürün." Mülakatta anlatılacak üç konu: (1) çözümün oyuncuya sızmaması, (2) AI karakterlerin tutarlı kalması, (3) maliyetin sıfıra yakın tutulması.

**Alınan kararlar:** TypeScript + Supabase + Tailwind + Next.js (App Router) · EN (varsayılan) + TR · mümkün olduğunca ücretsiz AI (ücretsiz katman + sıkı limitler) · hibrit gizem üretimi (AI üretir, sistem doğrular, Enes onaylar) · üyeliksiz oyna, seri/sıralama için isteğe bağlı giriş · haftada 20+ saat · birlikte, her adım açıklanarak · MVP 2-3 hafta.

**Oyun akışı (10-15 dk):**

1. Dava dosyası: kurban, mekân, olay zamanı, 4 şüpheli (kısa profil + ilk ifade)
2. İnceleme: 3-5 kanıt; ücretsiz, soru hakkı harcamaz
3. Sorgu: serbest metin, toplam 20 soru (hem gerilim hem maliyet tavanı)
4. Not defteri: cevapları/kanıtları işaretle, çelişkileri yan yana koy
5. Suçlama: katil + motif + kilit kanıt, tek hak
6. Sonuç: doğru mu, kaç soruda, hangi ipucu kaçtı; ardından gerçek hikâye
7. Paylaşım kartı: spoiler'sız özet

**Puanlama:** doğru katil = temel puan; doğru motif ve kanıt = bonus; kullanılmayan her soru = ek puan.
**Zorluk:** Pazartesi kolay → hafta sonu zor (MVP'de tek seviye olabilir).

**Mimari:** Tarayıcı (sadece açık brifing) ↔ Next.js sunucusu/Vercel (sorgu ve suçlama API'leri, soru sayacı, gizli dava dosyası) → Supabase (Postgres + RLS + anonim giriş) ve AI modeli (Gemini Flash, sadece şüpheli promptu). Günlük dava üretici (üret, doğrula, onayla; günde bir kez) onaylı davayı sunucu üzerinden yayına alır.

**Veri modeli:** 6 tablo — `cases` (açık kısım view üzerinden okunur), `daily_schedule` (okunabilir), `games` / `messages` (sadece kendi oyunu), `profiles` (kendi profili; sıralama için ad + puan), `case_reviews` (sadece admin). Altın kural: gizli kısım tarayıcıdan hiçbir zaman okunamaz. Gizli alanlara sadece sunucudaki service key erişir.

**AI katmanı:**

- Gizem üretimi: sabit JSON şeması → Zod → kodla mantık kontrolü → çözümü görmeyen ayrı AI çözücü → admin onayı.
- Şüpheliler: her system prompt'ta sadece o şüphelinin bilgisi; 3-4 cümle; oyuncunun dilinde; streaming; sadece son birkaç tur geçmiş.
- Injection savunması: gizli bilgi promptta yok · soru uzunluğu sınırlı · karakterde kalarak geçiştirme · çıktı filtresi · 30-50 saldırılık otomatik eval (mülakatta en etkileyici parça).

**Maliyet:** Aylık 0 $ hedefi. Gemini ücretsiz katmanı (limitler proje başına; güncel limit AI Studio'dan kontrol edilecek). Ücretsiz katmanda promptlar Google tarafından model geliştirmede kullanılabilir → gizlilik politikasında belirtilmeli. AI çağrıları tek modülden geçer (sağlayıcı değişimi tek satır). Kötüye kullanım: Turnstile + IP/kullanıcı hız sınırı. Brifing, kanıtlar, ilk ifadeler bir kez yazılır. Vercel Hobby + Supabase Free.

**Yol haritası stratejisi:** Önce elle yazılmış tek davayla oyunun eğlenceli olup olmadığını görmek; AI üretimi en sona. Her haftanın sonunda canlıda çalışan bir şey. Hafta 1 sonunda 2-3 arkadaşa oynatıp gözlemlemek.

**MVP sonrası:** liderlik tablosu ve seriler, sürükle-bırak kanıt panosu, sesli sorgu, arşiv modu, eval panosu (tutarlılık + injection direnci grafikleri).

**CV ve sunum:** README'nin en üstünde canlı link + 60 sn demo; mimari diyagramı + "Engineering decisions"; sayılar (oyun sayısı, günlük oyuncu, eval geçme oranı); temiz commit geçmişi.

- CV satırı taslağı: _"Built a daily AI murder-mystery game (Next.js, Supabase, LLM) with server-side secret isolation, an automated solvability checker for generated cases, and a prompt-injection eval suite; X daily players."_

**Açık sorular:**

- [ ] Proje adı ve domain (çalışma adı: "DailyAlibi" gibi)
- [ ] Gemini ücretsiz katmanının Türkiye'den kullanılabildiğini AI Studio'da doğrulamak; değilse alternatif ücretsiz sağlayıcı
- [ ] Atmosfer: klasik Agatha Christie mi, modern noir mı? (tasarım + dava tonu)
- [x] Next.js onaylandı

---

## 3. Durum

| Aşama                                                                                     | Durum                       | Not                                                                                     |
| ----------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| 1 — Kurulum, şema, fixture dava, dava/kanıt ekranları                                     | ✅ Onaylandı                | Supabase anahtarları ve Gemini anahtarı `.env.local`'de; GitHub/Vercel adımları Enes'te |
| 2 — Sorgu, streaming, soru sayacı                                                         | 🟢 Kod tamam, onay bekliyor | Sayaç şimdilik bellekte; Aşama 3'te Supabase'e taşınacak                                |
| 3 — Tablolar/RLS, anonim giriş, suçlama, puan, paylaşım, not defteri, hız sınırı, eval v1 | ⚪ Bekliyor                 |                                                                                         |
| 4 — AI üretici + doğrulama, admin paneli, cron, ana sayfa, arşiv, cila                    | ⚪ Bekliyor                 |                                                                                         |
| 5 — README                                                                                | ⚪ Bekliyor                 |                                                                                         |

### Aşama 1'de yapılanlar

- Next.js 16.4 (App Router, Turbopack, **Cache Components + Partial Prefetching açık**), React 19.3, TS strict, Tailwind 4, ESLint 9 (`no-explicit-any: error`) + Prettier.
- next-intl 4: `src/i18n/` (routing, request, navigation, locale), `src/proxy.ts` (Next 16'da middleware'in yeni adı), tüm sayfalar `app/[locale]/` altında. Dil `next/root-params` ile okunur (next-intl'in önerdiği yeni yol).
- Zod dava şeması: `src/lib/case/schema.ts` (public/secret ayrımı + referans bütünlüğü kontrolleri).
- Örnek dava: `src/server/cases/fixtures/case-001.json`, "Death at Ashcombe Manor / Ashcombe Konağı'nda Ölüm" (klasik Christie havası, 1934). Katil: Dr. Helena Voss (radyogram alibisi).
- `src/server/cases/repository.ts` (`server-only`): `getPublicCase()`, `getCaseSecret()`, `listCaseNumbers()`. Fixture'lar yüklenirken Zod ile doğrulanır.
- Supabase client'ları: `src/lib/supabase/browser.ts` (publishable key), `src/server/supabase.ts` (server + admin/secret key), `src/server/env.ts` (Zod ile env doğrulama), `.env.example`.
- Ekranlar: ana sayfa, dava dosyası (`/[locale]/case/[caseNumber]`), kanıt detayı (`.../evidence/[evidenceId]`), dile uygun 404. Hepsi build'de statik üretiliyor.
- `npm run check:leaks`: build çıktısında (client JS + HTML/RSC) gizli metin arar; sızıntı varsa hata verir. Şu an: 112 gizli metin, 0 sızıntı.

### Aşama 2'de yapılanlar

- AI modülü `src/server/ai/` (sağlayıcıdan bağımsız `ChatModel` arayüzü). Gemini SDK'sız, `fetch` + SSE ile (`gemini.ts`). Anahtar yoksa dev'de `mock.ts`. Model tek yerden: `getChatModel()`; `GEMINI_MODEL` env (varsayılan `gemini-flash-lite-latest`).
- Şüpheli prompt'u `src/server/interrogation/prompt.ts`: girdi olarak sadece açık brifing + o şüphelinin kendi sırrı + `isKiller` boolean'ı alır. Çözüm ve diğer sırlar parametre değil → prompt'a giremez.
- `POST /api/interrogate`: Zod ile istek doğrulama → sayaç rezervasyonu (aynı anda tek soru, 20 sınır) → AI → düz metin streaming. AI hata verirse soru iade edilir; 429 → `rate_limited`. Oyuncu ayrılırsa (`request.signal`) model çağrısı durur.
- `GET /api/game/[caseNumber]`: oyuncunun kendi sayacı + konuşması (sayfa yenilenince).
- Oyun durumu `game-store.ts` (bellekte, `GameStore` arayüzü arkasında). Oyuncu kimliği httpOnly `dd_session` çerezi.
- Sorgu ekranı `/[locale]/case/[caseNumber]/interrogate`: `useInterrogation` hook'u + `SuspectPicker`, `ChatLog`, `QuestionForm`, `QuestionCounter`.
- Dinamik sayfalarda `params` artık `<Suspense>` içinde okunuyor (Next 16 instant navigation uyarısı giderildi).
- `npm run check:prompts`: her şüphelinin gerçek prompt'unu kurar; başka şüphelinin sırrı veya (masumlar için) çözüm metni varsa hata verir. Negatif testle doğrulandı.

### Aşama 2 AI kalite notları (gerçek Gemini ile denendi)

- Flash-Lite: karakterde kalıyor, EN/TR injection denemelerini geçiştiriyor, sırları doğru koşulda açıyor (Margaret → telefon kaydı, Reed → "Margaret başka yerdeydi").
- `gemini-flash-latest` bir thinking modeli: düşünme token'ları cevap bütçesini yiyor, yavaş, bir cevapta düşünme notu sızdı → kullanılmıyor.
- Düzeltilen sorunlar: (1) karışık dilli geçmiş dil kaymasına yol açıyordu → geçmiş sadece aynı dildeki sorulardan, dil hatırlatması sorudan sonra; (2) uydurma saatler → "saatleri sadece verildiği gibi kullan" kuralı; (3) yalan/sır önceliği belirsizdi → "açılma koşulu yalandan önce gelir".
- Ücretsiz katman dakikalık limiti ~13-15 hızlı istekte doldu (429). Aşama 3'teki hız sınırı bunu oyuncu tarafında yumuşatmalı.
- Henüz yok (Aşama 3): çıktı filtresi (başka şüphelinin sırrını sızdıran cevabı engelleme), injection eval seti, kalıcı sayaç.

### Notlar / alınan teknik kararlar

- Next 16: `middleware.ts` → `proxy.ts`; `cacheComponents` açıkken her kök parametre için `generateStaticParams` zorunlu, `dynamicParams` kullanılamaz. Bulunamayan sayfalar stream sonrası 200 + `noindex` döner (Next'in belgelenmiş davranışı).
- AGENTS.md'yi `next dev` üretiyor: kod yazmadan önce `node_modules/next/dist/docs/` okunmalı.
- Şüphelilerin gizli alanları (kişilik, alibi gerçeği, sırlar, yalanlar) yalnızca İngilizce; oyuncuya görünen her metin EN + TR.
- Motif çoktan seçmeli (`motiveOptions`), kilit kanıt `keyEvidenceIds` listesinden herhangi biri olabilir.
- Supabase'in yeni anahtar isimleri kullanılıyor: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- Çalışma adı: "Daily Alibi" (messages dosyalarında; isim kesinleşince değişecek).
- `npm audit`: 5 high uyarısı yalnızca ESLint geliştirme araçlarının alt bağımlılıklarında (braces/micromatch); `--force` düzeltmesi eslint-config-next'i 14'e düşürdüğü için uygulanmadı.
- `prettier-plugin-tailwindcss` eklenmedi (onay bekliyor).
- Tarayıcıdaki ColorZilla eklentisi `<body>`'ye `cz-shortcut-listen` ekleyip hydration uyarısı veriyor; bizim hatamız değil.
- Script'ler ek paket olmadan Node 24'ün TypeScript desteğiyle çalışıyor (`.mts`, `allowImportingTsExtensions`). Test runner (ör. Vitest) gerekirse Aşama 3'te sorulacak.

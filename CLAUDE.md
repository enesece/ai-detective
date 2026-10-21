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

| Aşama                                                                                     | Durum                           | Not                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| 1 — Kurulum, şema, fixture dava, dava/kanıt ekranları                                     | ✅ Onaylandı                    | Supabase anahtarları ve Gemini anahtarı `.env.local`'de; GitHub/Vercel adımları Enes'te |
| 2 — Sorgu, streaming, soru sayacı                                                         | ✅ Onaylandı                    | + not defteri, ipucu, suçlama/sonuç ara özellikleri                                     |
| 3 — Tablolar/RLS, anonim giriş, kalıcılık, hız sınırı, Turnstile, çıktı filtresi, eval v1 | ✅ Onaylandı                    | Canlı: https://dailyalibi.vercel.app (Turnstile + Supabase CAPTCHA açık)               |
| 4 — AI üretici + doğrulama, admin paneli, cron, ana sayfa, arşiv, cila                    | 🟢 4a + 4b + 4c bitti, onay bekliyor | 4a üretici + doğrulama; 4b admin paneli; 4c cron, ana sayfa, arşiv, cila                |
| 5 — README                                                                                | ⚪ Bekliyor                     |                                                                                         |

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

### Ara özellik: not defteri + sorgu ekranında ifadeler (Aşama 2 sonrası, Enes'in isteğiyle)

- Sorgu ekranında seçili şüphelinin ilk ifadesi sohbetin üstünde (`StatementCard`).
- Not defteri: serbest not + ifade / sorgu cevabı / kanıt işaretleme. İşaretlenenler şüpheliye göre gruplu (ifade + cevaplar alt alta → çelişki yan yana), sonra kanıtlar.
- Şimdilik localStorage'da (`dd:notebook:v1:case-{n}`), Zod ile doğrulanarak okunur; Aşama 3'te Supabase'e taşınacak. Kod: `src/lib/notebook/schema.ts`, `src/components/notebook/` (`notebookStore.ts` + `useSyncExternalStore` ile `useNotebook`).
- İfade/kanıt id ile saklanır (dil değişince doğru dilde görünür); cevaplar metin kopyası + `exchangeIndex` ile.
- Yerleşim: xl'de 3 sütun (şüpheliler | sohbet | not defteri); daha dar ekranda "Not defteri (n)" düğmesiyle açılır. Genel içerik genişliği `max-w-6xl`; metin sayfaları `max-w-4xl` kalır.
- Kanıt detay sayfasında da işaretleme düğmesi var.

### Ara özellikler 2: ipucu, suçlama, sonuç (Enes'in isteğiyle, Aşama 3'ün bir kısmı öne çekildi)

- **Suçlama her an yapılabilir** (20 soru dolmadan da): `/[locale]/case/[n]/accuse`, katil + motif + kilit kanıt, onaylı tek hak. `POST /api/accuse` sunucuda kontrol eder, puanlar, oyunu kapatır; çözüm ancak bundan sonra tarayıcıya gider. Kapanan oyunda soru/ipucu/suçlama `game_over` döner.
- **İpuçları davaya yazılı, kademeli** (`secret.hints`, 1-3 adet, EN+TR): genel yön → nereye bakılmalı → çözüme çok yakın. `POST /api/hint` sıradakini açar; sadece açılanlar gönderilir. AI çağrısı yok. `check:prompts` ipuçlarının hiçbir şüpheli prompt'una girmediğini de kontrol eder.
- **Puanlama** (`src/lib/game/scoring.ts`, saf fonksiyon): doğru katil 100, motif +30, kanıt +20, kullanılmayan soru başına +5, ipucu başına −15; yanlış katil = 0. Maks 250.
- **Sonuç ekranı** `/[locale]/case/[n]/result`: seçim vs gerçek tablosu, puan dökümü, yöntem + gerçek hikâye, her kanıtın açıklaması (🔑 kilit kanıtlar). Paylaşım bölümü Enes'in isteğiyle kaldırıldı.
- Oyun durumu (`game-store.ts`) artık `hintsUsed` ve `result` da tutuyor; `GET /api/game/[n]` → `toSnapshot()` sadece açılmış ipuçlarını ekler. Hâlâ bellekte; Aşama 3'te Supabase.
- Hata kodları `GAME_ERRORS` / `GameError` (eski adı `InterrogateError`).
- Sohbet artık sadece kendi kutusunda kayıyor (sabit yükseklik, `scrollTop`; `scrollIntoView` tüm sayfayı kaydırıyordu). Not defterindeki kanıtlar kanıt sayfasına link.
- Bilinen sınır: suçlama sonrası çözüm görüldüğü için, çerezi silen biri aynı davayı yeniden oynayabilir (Wordle'daki gibi doğal bir sınır; Aşama 3'te anonim giriş + hız sınırı ile hafifletilecek).

### Aşama 3 planı ve kararlar

- 3a (kalıcılık + kimlik) → onay → 3b (hız sınırı, Turnstile, çıktı filtresi, injection eval).
- Migration'lar Claude'un Supabase bağlantısıyla uygulanacak (Enes bağlantıyı projenin olduğu hesapla yeniden yetkilendirecek). Proje ref: `teyynpxdasdpidvvevwk`.
- Eval için `tsx` devDependency onaylandı.
- Şema: `cases.secret` tarayıcı rollerine sütun bazlı yetkiyle kapalı; `games`/`messages` yalnızca sunucu fonksiyonlarıyla yazılır (`start_game`, `reserve_question`, `refund_question`, `complete_question`, `reveal_hint`, `finish_game`; execute sadece `service_role`); `notes` (not defteri) RLS ile tarayıcıdan doğrudan; `daily_schedule` gelecek günleri gizler; `profiles` yeni kullanıcıda trigger ile oluşur, seri `finish_game`'de güncellenir.
- Sunucuda kimlik: `getClaims()`; oturum yenileme `proxy.ts` içinde (next-intl ile birlikte).
- Paylaşım kartı kaldırıldı (Enes'in isteği).

### Aşama 3a'da yapılanlar

- Migration'lar uygulandı (`core_schema`, `game_functions`, `notes_case_number_index`). Supabase güvenlik denetiminde sadece beklenen INFO'lar (case_reviews'ta politika yok, yeni indeksler kullanılmamış).
- `npm run db:seed`: fixture'ları Zod ile doğrulayıp `cases`'e upsert eder, takvimde olmayanı bugüne koyar.
- `src/lib/supabase/database.types.ts`: Supabase'den üretilen tipler (her migration'dan sonra yeniden üret).
- `repository.ts` Supabase'den okur: public kısım `'use cache'` (saatlik), secret her istekte taze ve hiç cache'lenmez. `getTodaysCaseNumber()` ana sayfa için.
- Kimlik: `src/server/player.ts` (`getClaims`), `src/lib/supabase/proxy.ts` + `src/proxy.ts` (next-intl + oturum yenileme, `/api` dahil), tarayıcıda `ensureSession()`/`gameFetch()` (`src/lib/supabase/session.ts`). `dd_session` çerezi kaldırıldı. Oturumsuz → 401 `unauthenticated`.
- `game-store.ts` Supabase RPC'leri üzerinden; DB'den gelen her değer Zod ile doğrulanır (`GameResultSchema`).
- Not defteri `notes` tablosuna senkron (RLS ile özel); localStorage hızlı yerel kopya.
- `npm run smoke`: çalışan uygulamaya karşı anonim oyuncuyla tam oyun + aynı kimlikle hile denemeleri (gizli veri okuma, sayaç sıfırlama, RPC çağırma, başkasının notu). Geçti.
- `.env.local`'deki Supabase URL'sindeki `hhttps://` yazım hatası düzeltildi.
- Not: smoke testi her çalıştığında 2 anonim kullanıcı oluşturur. Temizlik: `delete from auth.users where is_anonymous and created_at < now() - interval '30 days';`

### Aşama 3b'de yapılanlar

- **Hız sınırı** (`rate_limits` tablosu + `check_rate_limits` fonksiyonu, migration `rate_limits`; `src/server/rate-limit.ts`): dakikada oyuncu başına soru 8 / ipucu 10 / suçlama 10, IP başına 30/40/40; tüm uygulama için günlük AI çağrısı `AI_DAILY_LIMIT` (varsayılan 1000). IP'ler sunucu anahtarıyla HMAC'lenmiş saklanır. Aşılınca 429 `rate_limited`. Limiter hata verirse açık bırakır (oyunun 20 soru sınırı yine geçerli).
- **Çıktı filtresi** (`answer-guard.ts` + `guarded-stream.ts`): karakterden çıkma, prompt'u tekrarlama ve (katil için) itiraf, EN+TR kalıplarla. Akış 40 karakter geride tutulur; ihlalde model durur, gönderilmemiş kısım karakterde kalan bir cümleyle değişir, kaydedilen = oyuncunun gördüğü. `npm run check:guard` (14 ifade + 4 akış senaryosu). Bu sırada bulunan hata: hiçbir şey göndermeyen `pull()` akışı kilitleyebiliyordu → döngüyle düzeltildi.
- **Injection eval** (`eval/attacks.json`, `scripts/eval-injection.mts`, `npm run eval`): 40 saldırı, 10 kategori, EN+TR; oyunun gerçek prompt'u ve ayarlarıyla (API'yi atlayarak). İlk sonuç (gemini-flash-lite): **model tek başına 40/40, filtreyle 40/40, doğru dil 40/40**. Cevaplar elle de okundu. Sınırlar: tek tur, tek dava, kalıp tabanlı hakem. Sonuç: `eval/results/latest.json`.
- **Turnstile** (`src/lib/turnstile.ts`, paket yok): anonim girişte görünmez kontrol, token Supabase'e `captchaToken` olarak gider. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` boşsa devre dışı. Enes'in deploy'da yapacağı: Cloudflare'de Turnstile widget'ı oluştur (domain + localhost), site key'i Vercel env'e, secret key'i Supabase → Authentication → Attack Protection → CAPTCHA (Turnstile) alanına gir.
- Supabase güvenlik denetimi: "anonim erişim politikaları" uyarıları bilinçli (oyuncular anonim, politikalar sadece kendi satırı). "Sızdırılmış şifre koruması" kalıcı hesap eklenince açılmalı.

### Deploy (21 Ekim 2026)

- Canlı: https://dailyalibi.vercel.app (Vercel, GitHub `main`'den otomatik deploy). Env değişkenleri Vercel'de; `NEXT_PUBLIC_*` olanlar "Config", gizliler "Sensitive". Build, dava listesi için Supabase'e bağlandığı için Supabase değişkenleri build sırasında da gerekli.
- Turnstile widget'ı hostname: `dailyalibi.vercel.app`. Supabase CAPTCHA açık → yerelde yeni anonim giriş için gerçek site key + `localhost` hostname'i gerekir. Vercel preview adresleri listede değil, orada giriş başarısız olur.
- Canlı kontroller (Enes elle + Claude dışarıdan): tam oyun akışı EN/TR, yenilemede kalıcılık, not defteri senkronu; 12 sayfa + 15 JS dosyasında 115 gizli metin, 0 sızıntı; oturumsuz `/api/interrogate` → 401; token'sız anonim giriş → `captcha_failed`; anon rolüyle `cases.secret` → permission denied.

### Aşama 4 planı ve kararlar (Enes onayladı)

- 4a üretici + doğrulama → onay → 4b admin paneli → onay → 4c cron, ana sayfa, arşiv, mobil, smoke testi (CAPTCHA'lı).
- Üretici modeli `gemini-flash-latest` (düşünen model; offline olduğu için yavaşlık sorun değil). Admin girişi e-posta + şifre, admin rolü `app_metadata` ile. Admin paneli sadece İngilizce. Takvimde boş gün → cron onaylı havuzdan en eski davayı koyar. **Dava üretimi otomatik değil, sadece elle** (panelden ya da `npm run generate`); cron sadece yayın yapar.

### Aşama 4a'da yapılanlar

- **Yayın kapısı (güvenlik düzeltmesi):** ileri tarihe konmuş onaylı dava önceden okunup oynanabiliyordu. Artık "yayınlanmış" = onaylı + `daily_schedule.publish_date <= bugün (UTC)`: RLS politikası, `start_game` ve `repository.ts`'teki tüm okumalar bunu ister. Migration `drafts_and_publishing` (Enes SQL Editor'de elle çalıştırdı; MCP izni o sırada kapalıydı).
- Taslakların dava numarası yok (`case_number` boş olabilir, onayda verilecek) → reddedilen taslaklar numaralarda boşluk bırakmaz.
- AI modülüne `JsonModel` (structured output, akışsız) + `withRetry` (429/503'te bekleyip tekrar dener; günlük kota dolduysa beklemez). Gemini büyük şemada `minLength/minItems/maxItems`'ı reddediyor ("invalid argument") → Gemini'ye giden şemadan çıkarılıyor, Zod yine kontrol ediyor.
- `src/server/generator/`:
  - `prompt.ts`: kurallar + örnek dava (fixture) + rastgele tema + zorluk rehberi + mevcut başlıklar.
  - `logic-checks.ts`: 14 kod kontrolü (katil ölüm anında olay yerinde, masumlar değil, kimse aynı anda iki yerde değil, katile giden ≥2 bağımsız ipucu, katil en çok işaret edilen, kilit kanıtlar katili gösteriyor, katil yalan söylüyor, ipucu zaman çizelgesiyle uyumlu, kurban ölümden sonra hareket etmiyor, TR çevrilmiş; uyarılar: yanıltıcı ipucu, masumların sırrı, 3 ipucu, masumların alibisi).
  - `solver.ts`: kör çözücü. Görebildiği = açık brifing + masumların bildikleri/açılabilir sırları/yalanlarının doğrusu + katilin sadece iddia ettiği alibi ve yalanları. Çözüm, zaman çizelgesi, kanıt açıklamaları, ipuçları, katilin itirafı yok. `npm run check:solver` bunu test eder (negatif testle doğrulandı). Geçme şartı: katil en olası, ≥%50, ikinciden ≥20 puan önde; 2 tam çalıştırma.
  - `pipeline.ts`: üret → zaman çizelgesini sırala → Zod → mantık → çözücü → (sorun varsa 1 onarım turu: hatalar + çözücünün gerekçesi modele geri verilir) → taslak + `case_reviews` (pending/rejected). Çözücü çökerse dava kaybolmaz, reddedilmiş olarak kaydedilir. `recheckDraft(id)` kayıtlı taslağı yeniden kontrol eder.
- `npm run generate -- --difficulty=medium [--theme=...]`, `npm run generate -- --recheck=<id>`.
- Çözücü `gemini-flash-lite-latest` (ayrı ve büyük kota; daha zayıf model bile çözebiliyorsa dava adil; ~3 sn).
- **Ölçümler:** flash üretim 187-242 sn (+onarım ~80 sn) → Vercel'in 300 sn sınırına sığmıyor (4c'de çözülecek). `gemini-3.8-flash` ücretsiz kotası **günde 20 istek, dakikada 5**. Lite üretim ~20 sn ama mantık hataları çok.
- **Zorluk bulgusu:** elle yazdığımız dava #1 ve ilk üretilen davalar sadece brifingle çözülebiliyor ("çok kolay"). Kural: kolay davada uyarı, orta/zor davada ret. Prompt'a "tek kanıt katili tek başına göstermesin" kuralları eklendi + onarım turunda çözücünün gerekçesi veriliyor. Flash ile yeni prompt henüz denenmedi (kota).
- DB'de deneme taslakları var (hepsi reddedilmiş/numarasız, oyunculara görünmez): Cold Commit in Cappadocia, Death at the Abbey of San Lorenzo, Blood at the Bosphorus Engagement.

### Aşama 4b'de yapılanlar

- **Admin kimliği:** Supabase'de e-posta + şifreli kullanıcı (enesece005@gmail.com), `app_metadata.role = "admin"` SQL ile verildi (kullanıcı değiştiremez). `src/server/admin/auth.ts` → `getAdmin()` / `requireAdmin()` (`getClaims` ile imza doğrulanır, anonim kullanıcı admin olamaz). Her admin sayfası (`guard.ts` → `adminOrRedirect`) ve her Server Action kendi kontrolünü yapar.
- **Migration `admin_functions`** (Enes SQL Editor'de çalıştırdı): `approve_case(id, gün?)` (tek transaction: sıradaki numara + onay + isteğe bağlı takvim + inceleme "approved"; tablo kilidiyle aynı numara iki kez verilmez), `schedule_case`, `unschedule_day` (sadece ileri günler). Hepsi sadece `service_role`. Rollback'li transaction'da test edildi.
- **Sayfalar** (`/[locale]/admin`, sadece İngilizce, `noindex`): Cases (pending/rejected/approved/all + "Generate" formu), dava detayı (Approve/Reject/Run checks again, son inceleme: 14 kontrol + çözücü gerekçeleri + onarım geçmişi, davanın tamamı EN/TR yan yana), Schedule (14 gün + havuz), Login (Turnstile token'lı `signInWithPassword`).
- **Server Actions** (`src/server/admin/actions.ts`): her biri `requireAdmin` + Zod; değişiklikten sonra `updateTag("cases"/"schedule")` (Next 16: Server Action içinde anında önbellek yenileme). Üretim/yeniden kontrol sayfalarında `maxDuration = 300`; panelden üretimde 270 sn bütçe (onarım turuna genelde süre kalmaz).
- Gizli veri sadece Server Component'lerde HTML'e dönüşür; Client Component'lere (ActionForm, LoginForm) sadece id'ler gider. Build + `check:leaks` temiz.
- `SiteHeader`'daki `LocaleSwitcher` `<Suspense>` içine alındı (runtime parametreli sayfalarda `usePathname` prerender'ı engelliyordu).
- Yerel test için `scripts/tmp/admin-cookie.mts` (git'e girmez): gizli anahtarla magic link üretip oturum çerezi yazar; Turnstile'ı tarayıcı olmadan aşmak için.
- Yerelde admin girişi için `.env.local`'e gerçek Turnstile site key + Cloudflare'de `localhost` hostname gerekir (Supabase CAPTCHA açık).

### Aşama 4c'de yapılanlar

- **Günlük yayın cron'u:** `vercel.json` → `GET /api/cron/publish` her gün 00:05 UTC (Hobby: günde 1 kez, saat içinde herhangi bir dakika, tekrar denemez). `CRON_SECRET` Bearer başlığı sabit zamanlı karşılaştırmayla kontrol edilir. `ensureTodayHasCase()` (`src/server/cases/publish.ts`): bugün boşsa takvimde olmayan en eski onaylı davayı koyar; iki kez çalışması zararsız. Sonra `revalidateTag("schedule"/"cases", { expire: 0 })`.
- **Ana sayfa:** bugünün davası (özet + zorluk), nasıl oynanır (4 adım), oyuncunun serisi ve bugünkü durumu (`TodayStatus`).
- **Arşiv** `/[locale]/archive`: yayınlanmış tüm davalar (`listPublishedCases`, önbellekli) + oyuncunun kendi sonucu (çözüldü/çözülemedi/devam ediyor). Üst bilgide "Arşiv" bağlantısı.
- Oyuncu verisi (`usePlayerRecord`) tarayıcıda RLS ile kendi satırlarından okunur; sadece `result->correct->killer` seçilir (çözüm metni değil). Oturumu olmayan ziyaretçi için sorgu yok, sırf sayfaya bakan biri için anonim kullanıcı açılmaz. Gösterilen seri: son çözüm bugün/dün değilse 0.
- **Seri hatası düzeltmesi** (migration `streak_today_only`): `finish_game` seriyi artık sadece günün davası için günceller; arşivden eski dava çözmek `last_solved_date`'i geri götürüyordu.
- **Smoke testi CAPTCHA açıkken çalışır:** oyuncular gizli anahtarla oluşturulan geçici e-posta kullanıcıları (tek kullanımlık giriş bağlantısı), test sonunda silinir. `SMOKE_CAPTCHA_TOKEN` kaldırıldı. Seri beklentisi dava #1 günün davası mı ona göre.
- **Mobil:** 375 px'te ana sayfa, sorgu, suçlama (TR) ve arşiv headless Chrome'la (375 px iframe) kontrol edildi; taşma yok. Not: headless Chrome penceresi 500 px'ten dar açılmıyor, bu yüzden iframe kullanıldı.
- Canlıda panelden ilk üretim (Enes, "easy"): Vercel'de 177 sn, mantık kontrolleri temiz, "çok kolay" uyarısıyla onay bekliyor (The Blackout at Craigmhor Light).

### Tasarım: "Evening Gazette" (Enes seçti, 3 yön arasından)

- 1930'lar akşam gazetesi: Abril Fatface (manşet), Libre Caslon Text (metin), Libre Franklin (etiketler, büyük harf + harf aralığı); hepsi `next/font` ile, `latin-ext` (Türkçe). Renkler `globals.css` → `@theme`: paper `#f3eee3`, ink `#17140f`, accent koyu yeşil `#1f4d43`, hatalar için ayrı `alert` kırmızı. Köşeler kare, ayraçlar mürekkep çizgisi.
- Ortak parçalar `src/components/ui/`: `styles.ts` (kicker, label, buttonPrimary/Ink/Outline, linkCaps), `SectionHeading`, `Portrait` (baş harfli yer tutucu).
- Ana sayfa = gazete ön sayfası (büyük manşet + tarih/baskı satırı + ana haber + "Kısaca" + oyun kuralları + arşivden). Diğer sayfalarda ince üst şerit (`SiteHeader`, ana sayfada küçük logo gizlenir).
- Şüpheliler "persons of interest" sütunları, kanıtlar gazete kupürü, sorgu basılı röportaj ("SİZ: … / REED: …"), sonuç ekranında "DAVA KAPANDI / ÇÖZÜLEMEDİ" damgası.
- Mobil 375 ve 320 px'te kontrol edildi. Admin paneli yeni renkleri alır ama ayrıca elden geçirilmedi.
- Not: Cache Components açıkken önceden üretilen sayfada `new Date()` okunamaz; "bugün mü" bilgisi önbellekli `getTodaysCase()` içinde hesaplanır.
- Tasarım tuvali (3 yön): https://claude.ai/artifact/1qYw6hKZtBy3JAbCtdvwDa
- Masaüstünde kök yazı boyutu %90 (≥640 px), telefonda %100: Tailwind rem kullandığı için her şey eşit küçülür.
- **Şüpheli portreleri kodla çiziliyor** (`src/components/ui/Portrait.tsx`, SVG gazete gravürü): Gemini görsel modellerinin ücretsiz kotası yok (fatura gerekir), 0 $ hedefi için seçilmedi. Şüpheli şemasında isteğe bağlı, herkese açık `appearance` (cinsiyet, yaş, saç, saç rengi, şapka, gözlük, sakal/bıyık, kıyafet); yoksa `resolveAppearance()` (`src/lib/case/appearance.ts`) id'den sabit özellikler seçer. Dava #1 fixture'ında ve dava #2'de (SQL ile) dolduruldu; üretici prompt'u yeni davalarda ister. `crop="head"` küçük resimler için.

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

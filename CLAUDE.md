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
- CV satırı taslağı: *"Built a daily AI murder-mystery game (Next.js, Supabase, LLM) with server-side secret isolation, an automated solvability checker for generated cases, and a prompt-injection eval suite; X daily players."*

**Açık sorular:**
- [ ] Proje adı ve domain (çalışma adı: "DailyAlibi" gibi)
- [ ] Gemini ücretsiz katmanının Türkiye'den kullanılabildiğini AI Studio'da doğrulamak; değilse alternatif ücretsiz sağlayıcı
- [ ] Atmosfer: klasik Agatha Christie mi, modern noir mı? (tasarım + dava tonu)
- [x] Next.js onaylandı

---

## 3. Durum

| Aşama | Durum | Not |
|---|---|---|
| 1 — Kurulum, şema, fixture dava, dava/kanıt ekranları | 🟡 Başladı | CLAUDE.md yazıldı; klasör yapısı + Zod şeması onay bekliyor |
| 2 — Sorgu, streaming, soru sayacı | ⚪ Bekliyor | |
| 3 — Tablolar/RLS, anonim giriş, suçlama, puan, paylaşım, not defteri, hız sınırı, eval v1 | ⚪ Bekliyor | |
| 4 — AI üretici + doğrulama, admin paneli, cron, ana sayfa, arşiv, cila | ⚪ Bekliyor | |
| 5 — README | ⚪ Bekliyor | |

### Notlar / alınan teknik kararlar
- (Aşama ilerledikçe buraya eklenecek.)

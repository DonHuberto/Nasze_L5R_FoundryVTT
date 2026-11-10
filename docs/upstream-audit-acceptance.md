# Upstream audit acceptance — 2026-11-05

## Aktualne próby lokalne — Foundry 14.370 / core 1.14.119

- U1, trzy postacie: otwarcie GM Monitor pokazuje wszystkie trzy wiersze bez
  przewijania. Potwierdzono na rzeczywistym kodzie, bez podmiany CSS.
- Włączono Argon CORE 5.0.2, adapter L5R 2.0.15 i Combat Tracker 0.1.2.
  Tactical Grid pozostaje wyłączony: brakuje zależności lib-wrapper.
- D6: pierwsze generowanie NPC zmieniło imię, lecz nie zapisało identity/notes.
  Potwierdzono pustą tożsamość w eksporcie wykonanym z menu aktora. Naprawiono
  przygotowanie danych na oddzielnym snapshotcie zamiast modyfikacji modelu aktora.
  Ponowne generowanie zapisało atrybuty i umiejętności oraz notatki: wiek 21,
  płeć Male, klan Ronin, stan Unmarried. Notatki pozostały po ponownym otwarciu.
  Aktor audytowy: Bayushi Muranosuke, ID 8nlzJZdWReETkHqJ.
- D1, NPC: użytkownik ręcznie przeciągnął Fitness+1 na aktora audytowego;
  agent następnie odczytał w arkuszu Martial = 2, wcześniej 1. Próba gestem
  narzędzia przeglądarkowego nie dawała wyniku i nie jest liczona jako zaliczona.
- D3: dodanie podprzedmiotu do tytułu początkowo kończyło się wyjątkiem
  `value.map is not a function`. Naprawiono serializację przygotowanych kolekcji
  Map w schemacie tablicy Item, zachowując format zapisu. Po przeładowaniu:
  dodanie advancement przeszło; wybranie Fitness wyliczyło 2 XP pełne i 1 XP
  curriculum. Zaznaczenie curriculum dało 2/2. Zmiana kosztu na 6 dała Used = 6,
  Saved = 94 i curriculum = 6, bez zamykania arkuszy. Usunięcie podprzedmiotu
  dało Used = 0, Saved = 100, curriculum = 0; Fitness PC wróciło do 0.
- D2: w rzeczywistym menu JournalEntrySheet brak akcji wysyłania opisu do czatu;
  dostępne jest Show Players. Nie dodano makra ani wywołania konsolowego jako
  zamiennika testu. Ten punkt nie ma potwierdzenia przeglądarkowego.
- D5: utworzono dziennik AUDYT Szkoła (bHuVnoIIZQAxLQzi), przygotowano Player1
  z pustym curriculum i poproszono użytkownika o ręczne przeciągnięcie na PC/NPC.
  Wynik pozostaje do sprawdzenia.
- Pełne `npm run ci` po poprawkach: 104 testy zaliczone, brak niepowodzeń;
  składnia, lint, kompilacja CSS i walidacja wydania zaliczone. Kompilator zgłasza
  ostrzeżenia o bazie Browserslist i istniejących wartościach start/end w CSS.

Poniższy opis starszych prób zachowano jako historię. Nie oznacza pełnego odbioru
nowego wydania: nadal nie wykonano wszystkich wariantów U1/U2, D1/D5/D6 ani
regresji wieloklientowych. Commit, push i publikacja pozostają wstrzymane.

## Scope

Candidate core version: 1.14.119. Working branch: `agent/bugfix-release-sprint`.
Base commit: `b4be80c31cd8a24be22bfec4fd4437f18af284fc`.

Implemented the report's first small-repairs group: D1–D3, D5–D6, U1–U2.
H1 already uses the V14 context-menu API and has existing regression coverage.
The report's base was 1.14.105; the working tree and browser started at 1.14.118.

Bug repairs: NPC advancement, journal page selection/chat links, title XP,
curriculum journal drops, generated identity consistency, translated 20Q keys.
UI improvement: GM Monitor content sizing. No new technique mechanics.

D4/D7 compendium performance, H2–H8 technique mechanics/multiple targets and
D8–D12 larger UI changes remain later report phases. No unverified technique
definitions, duplicate resolution services or changes to house rules were added.

## Browser observations

Shared browser: Foundry 14.369, system 1.14.118, scene Gospoda, Gamemaster [GM].

| Scenario | Actions | Expected | Observed / status |
| --- | --- | --- | --- |
| U1 baseline, three actors | Open GM Monitor from GM ToolBox | All three rows fit automatically | Failed: fixed-size monitor clipped the third row and showed a vertical scrollbar |
| U1 layout experiment | Temporarily replace the open monitor's inline width/height with `auto` using browser developer tools | Three rows fit | Observed all three rows without a scrollbar; original inline style restored afterwards |
| Script hot replacement | Attempt a dry run of browser Debugger script replacement | Test modified module code in the same client | Unavailable: browser reports `setScriptSource functionality no longer available`; no script replacement occurred |

The CSS experiment is a diagnostic result, not a pass for the new system version.
The user confirmed the server does not consume the local checkout. All acceptance
cases below remain pending on an instance running the candidate code. No actor
resources, campaign documents or server package files were modified during these
browser checks. No release may be described as browser-validated yet.

## Required UI acceptance on candidate code

Use disposable test documents, retaining existing campaign data.

| ID | Account/data and actions | Expected |
| --- | --- | --- |
| D1 | GM, test NPC and PC: add/remove skill advancement, then exercise 0 and 9 boundaries | NPC category changes; PC individual skill changes; no unrelated skills change; values stay 0–9 |
| D2 | GM/player, journal whose creation order differs from displayed order: select later page and send to chat; repeat with hidden/deleted/no pages | Content and link both identify the selected accessible page; inaccessible/missing selection is skipped; unopened journal selects first accessible page by sort |
| D3 | GM, PC with test title: add/edit/remove advancement/technique, toggle curriculum | Persisted full/curriculum XP, actor XP balance and title ability update without reopening the sheet; deletion resets totals |
| D5 | GM, PC with no curriculum and NPC: drag the same school journal onto each | PC stores the journal; NPC does not |
| D6 | GM, test generator with missing family and with existing identity | No leading name space; age/status agree between identity and notes; existing values remain consistent; valid paragraph markup |
| U1 | GM monitor with 0, 1 and several test actors, including short viewport | Content sizes naturally and remains accessible within the viewport |
| U2 | GM monitor global tooltip on ordinary and Path of Waves PC templates, English/Polish | Correct localized 14/15/20 question labels and character descriptions |
| Regression | GM/player clients: virtual Punch/Kick/Bite with equipped katana; Soaring Slice; preValidation Opportunity; both improvised-throw modes; armor policy; token blocking on/off | Existing house-rule behavior and single authoritative resolution preserved |

Automatic tests supplement these scenarios. Run the full `npm run ci` before
release; `tests/upstream-audit.test.js` exercises the actual changed document
methods with test documents and validates monitor configuration/localization keys.
It does not substitute for UI, multi-client or server acceptance.

## Aktualizacja testów lokalnych — 05.11.2026

Środowisko: lokalny TestowyRokugan, Foundry 14.370, kandydat systemu 1.14.119.
Konto AUDYT Gracz ma Owner wyłącznie do Player1, zgodnie z jednoznaczną zgodą użytkownika.
Potwierdzono edycję Fire w kliencie gracza i zmianę widoczną w osobnym kliencie GM.

| Scenariusz | Czynności i wynik zaobserwowany | Status |
| --- | --- | --- |
| D1 NPC | Użytkownik przeciągnął Fitness+1 na Bayushi Muranosuke; odczytano Martial 2 zamiast 1 | Częściowy; usuwanie i granice nieprzetestowane w UI |
| D3 | Dodanie Fitness do tytułu, curriculum, edycja kosztu do 6, usunięcie; XP aktora 6/94, następnie 0/100, curriculum 6/3, następnie 0/3 | Przeszedł sprawdzony przepływ advancement; techniki nieprzetestowane |
| D5 | Użytkownik przeciągnął AUDYT Szkoła na PC i NPC. PC pokazuje szkołę; eksport NPC nadal zawiera curriculum {} | Przeszedł, gesty ręczne użytkownika |
| D6 generator NPC | Wygenerowano Bayushi Muranosuke; eksport potwierdza age 21 i unmarried w identity oraz odpowiadających akapitach notes | Przeszedł sprawdzony przypadek; brak rodziny nieprzetestowany w UI |
| U1 | Monitor trzech aktorów i pusty widok army dopasowują wysokość | Częściowy; jeden aktor nieprzetestowany; 1280x720 poniżej minimum Foundry |
| U2 | W tooltipach odczytano angielskie pytania 14/15/20 dla Core i Path of Waves | Częściowy; polski nieprzetestowany |
| Zapis 20Q | Po pełnym odświeżeniu obie odpowiedzi Player2 były zapisane. Wcześniejszy pusty Q14 w tooltipie nie dowodzi utraty danych | Brak potwierdzonej utraty danych |
| Rzut gracza | Unarmed 2, Void 2, TN1; zachowano dwie kości; 0 sukcesów, 2 okazje, 2 Strife; Void redukuje zmianę Strife do 0; oba zatwierdzenia wykonano | Przeszedł podstawowy przepływ; bez potwierdzenia profili ataku i technik |
| 20Q inicjalizacja | GM otworzył 20Q Player1; odtworzono wyjątek _createDragDropHandlers: this._onDragStart jest undefined, wywołanie bind w linii 102 | NIE PRZESZEDŁ; blokuje publikację |

Wyjątek 20Q ponownie zaobserwowano w logu przeglądarki o 14:39:56 UTC.
Zgodnie z warunkiem zatrzymania po nieudanym teście nie wprowadzono po nim dalszych zmian funkcjonalnych.
D2 nie ma potwierdzonej dostępnej ścieżki UI wysyłania strony dziennika; nie zaliczono testu.
Pełna regresja Soaring Slice, preValidation, improwizowanych rzutów, pancerza i blokowania pól pozostaje otwarta.
Nie wykonano commita, push ani publikacji. Starsza paczka candidate jest nieaktualna i nie nadaje się do instalacji jako zweryfikowane wydanie.
Dowody ekranowe: ../tmp/audyt-rzut-gracza.jpg oraz ../tmp/audyt-20q-blokada.jpg (poza repo).

## Walka — przebieg obserwowany 05.11.2026

20Q odłożono decyzją użytkownika. Własne wstępne poprawki zachowania formularza usunięto z zakresu; propozycja: propozycja-naprawy-20q.md.

| Przypadek | Zaobserwowany wynik |
| --- | --- |
| Inicjatywa Player1 | Focus 4 + 1 zachowany sukces = 5 w trackerze; rzut wykonano jako GM przy aktywnym właścicielu-graczu |
| Void bez 2 opportunity | Przed poprawką Finalize pozostawał zablokowany. Po poprawce wynik z 0 opportunity automatycznie zamknął okno i usunął nową kartę; VP 2, Fatigue 9, Strife 0 i niewykorzystana akcja pozostały bez zmian |
| Void z opłaconym obejściem | 2 opportunity, wybór Incapacitated, zastosowanie i zatwierdzenie; VP 2 → 1, akcja zużyta; następny picker pozwala wybrać wszystkie Kręgi mimo widocznego Incapacitated |
| Pierwsza flaga zawieszenia | Odtworzono fałszywy konflikt: oczekiwane {} zamiast faktycznego braku flagi. Po naprawie ten sam wynik zapisano bez nowego błędu |
| Atak kataną z arkusza | Damage 4 + 1 bonusowy sukces, Resistance 0 → Enemy1 Fatigue 0 → 5. Uwaga: pierwotny picker arkusza miał TN 1; rozbieżność z HUD TN 2 naprawiono, retest tej poprawki pozostaje otwarty |
| GM zmiana TN | TN 1 → 3: Fatigue 5 → 0; TN 3 → 1: ponownie dokładnie 5. Po poprawce karta pokazuje aktualny TN, cel i bonusowe sukcesy |
| GM zmiana celu | Enemy1 Fatigue 5 → 0; Player2 Fatigue 0 → 5 przy Endurance 4, automatycznie Incapacitated. Odtworzono i naprawiono przestarzały cel na karcie czatu |
| Automatyczny krytyk | Kolejne trafienie Incapacitated otworzyło Fitness. Po naprawie reaktywnego testu: severity 5 − 1 = 4, Lightly Wounded (Void) i Unconscious na Player2 |
| Cofnięcie konsekwencji krytyka | Retrospektywna zmiana celu, a następnie TN usuwała powiązane rany i Unconscious, zachowując wcześniejsze Incapacitated |
| Uszkodzenie pancerza | Enemy1 z pancerzem physical 2, Incapacitated, testowa broń Deadliness 1; Fitness 1 sukces → severity 0; pancerz otrzymał Damaged, cel Unconscious |
| Profile HUD | Przy gotowej katanie wybór Punch/Kick/Bite dostępny; każdy otwiera Unarmed 2, TN 2; anulowanie pickera zachowuje akcję. Pełnych obrażeń każdego profilu jeszcze nie zaliczono |
| Start po przerwie serwera | Zgłoszono brak RollL5r5e/API i błąd portretu Argon. Pełne odświeżenie przywróciło system, tracker i HUD; przyczyna nieustalona, brak trwałej poprawki tego przypadku |

Otwarte: pełne obrażenia Punch/Kick/Bite, Strike-critical za 2 opportunity, overspend i błędne decyzje, ręczne anulowanie Void z niewydanym budżetem, Unconscious/wiele stanów, Fire/Air/Dazed, NPC/minion/tie initiative, Shattering Parry, blizny/krwawienie, Soaring Slice, improwizowane rzuty, token blocking i regresja wieloklientowa. Żaden otwarty przypadek nie jest uznany za zaliczony.

### Kolejne potwierdzenia walki

- Atak z arkusza po naprawie: TN 2, zgodny z HUD Strike; test automatyczny sprawdza także brak narzuconego TN dla zwykłego skilla.
- Punch, Kick i Bite: osobno wybrano każdy profil i otwarto Unarmed/TN 2; sprawdzono anulowanie przed rzutem.
- Replay rzutu z wcześniejszej rundy: zmiana TN do 4 pozostawiła obecną akcję Player1 niewykorzystaną.
- Cofnięcie trafienia o severity 0: usunięto Damaged z pancerza i Unconscious, pozostawiając wcześniejsze Incapacitated.
- Strike-critical: pula 4dr+4ds, zachowane 2 sukcesy i 2 opportunity przy TN 2. Wybór krytyka i dodatkowego punktu Sense disturbance zablokował Apply selections oraz pokazał komunikat wydania 3 z budżetu 2. Usunięcie nadmiaru odblokowało zapis.
- Zatwierdzony Strike-critical: Enemy1 Fatigue 0 → 2 (Damage 4 minus physical resistance 2), automatycznie otwarto Fitness mimo braku Incapacitated.
- Redukcja tego krytyka: 3 sukcesy przy TN 1, severity 5 → 2; pancerz Damaged, Fatigue 2, brak Unconscious i brak dodatkowej rany.
- Aktualne pełne npm run ci: 113/113, składnia, lint, CSS oraz validate:release przeszły. Pozostają dotychczasowe ostrzeżenia Browserslist/autoprefixer. Log: ../tmp/combat-ci.log.

Dowody poza repo: ../tmp/audyt-void-obejscie-stanu.jpg, ../tmp/audyt-pancerz-damaged.jpg, ../tmp/audyt-hud-profile.jpg, ../tmp/audyt-krytyk-opportunity.jpg.

### Retest ponownej rewizji i profile ataku — 06.11.2026

- Ponowne otwarcie planu Opportunity dla zatwierdzonego trafienia z krytykiem pozwoliło usunąć wydatek krytyka, zastosować nową rewizję i zamknąć okno bez błędu dawnej rezerwacji. Fatigue Enemy1 pozostało 2, pancerz wrócił do stanu bez Damaged, historia pokazała rewizję 2 z kosztem 0. Karta po tej zmianie nie pokazywała podsumowania; naprawiono flagę `hasAppliedResults` i retest karty pokazał nowe podsumowanie.
- Retrospektywna zmiana TN Shattering Parry cofnęła Severely Wounded (Void), Unconscious i Damaged na broni Player2, zachowując wcześniejsze Incapacitated.
- Punch: rzut TN 2, 2 sukcesy, profil ataku zapisał Damage 1/Deadliness 2. Przy pancerzu physical 2 wynik to 0 obrażeń; zużyto akcję Strike. Kick: rzut TN 2, 3 sukcesy, Fatigue Enemy1 wzrosła z 2 do 3. Zakres testu nie obejmował pełnego odczytu modyfikatorów Kick z historii.
- Odczyt HUD przed dodaniem walidacji pokazał cel Enemy1 w Range band 3 przy przygotowanym profilu Unarmed; Strike mimo to się rozstrzygnął. Dodano blokadę na podstawie odległości tokenów i skonfigurowanych pasm zasięgu. Testów UI tej nowej blokady jeszcze nie wykonano: scena ponownie zapauzowała się podczas przejścia tury. Nie deklarujemy wyniku.
- Automatyczne kontrole po tej zmianie: 120/120 testów; zakończyły się lint, kompilacja CSS i `validate:release` dla wersji 1.14.120. Ostrzeżenia Browserslist i autoprefixer dotyczą istniejących danych wsparcia/przypisania flex.

Otwarta pełna regresja walki: ataki poza zasięgiem (test UI oczekuje odpauzowanej sceny), Bite, obrażenia i pancerz w większej liczbie wariantów, tie/Minion/NPC initiative, Fire/Air/multistanowe Void, repeat Shattering Parry, krwawienie/blizny, Soaring Slice/improwizowany rzut, movement/token blocking, regresja wielu klientów oraz niestandardowe scenariusze homebrew. Nie tworzono commita ani paczki do publikacji, dopóki te przebiegi pozostają otwarte.

### Void — zakończone przypadki brzegowe

- Po poprawkach sprawdzono automatyczny fallback dla 0 i 1 opportunity. Obie próby z zaznaczonym wydaniem punktu Void zostały anulowane bez kosztu punktu i bez zużycia akcji.
- Ręczny fallback przy 2 opportunity bez wybranego obejścia: przycisk Cancel impossible check usunął próbę. VP pozostał 1, Fatigue 9, Strife 0, bieżąca akcja niewykorzystana.
- Odtworzono stare zawieszenie, które błędnie udostępniało wszystkie Kręgi bez kontekstu czasu. Naprawiono wspólne isSuspended i usuwanie wygasłych flag przez natywny operator `ForcedDeletion` Foundry 14; nowe efekty identyfikują też walkę.
- Retest: Incapacitated pozwala wyłącznie na Void; opłacone 2 opportunity udostępnia wszystkie Kręgi podczas rundy użycia (6) i następnej tury postaci (runda 7, tura 1); po jej zakończeniu (runda 7, tura 2) ponownie dostępny wyłącznie Void.
- Zidentyfikowano też odczyt nowej tury zamiast kończącej się w TurnStateService. Jawny lifecycle ma pierwszeństwo; zamknięcie starej próby nie może nadpisać akcji nowej tury. Dodano testy tych przypadków.

Dalsze testy całej walki wciąż otwarte, szczególnie pełne obrażenia profili unarmed, Shattering Parry, rzuty improwizowane/Soaring Slice, przypadki inicjatywy NPC i ruch. Wydanie pozostaje nieopublikowane.

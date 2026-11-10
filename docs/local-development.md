# Lokalne testowanie zmian — Foundry 14.370, Windows

Wersją docelową jest stabilne Foundry **14.370**. Dotychczasowe obserwacje
przeglądarkowe wykonano na serwerze 14.369. Lokalna instancja będzie korzystać
bezpośrednio z repozytoriów; do testów nie potrzeba wydania na GitHubie.

## Pierwsze uruchomienie

1. Na swoim koncie Foundry pobierz **14.370**, wybierając wariant **Node.js**.
   Zachowaj ZIP bez rozpakowywania.
2. Wklej do PowerShell:

```powershell
Set-Location 'C:\Users\hmpoz\Downloads\repos\L5R_by_codex\Nasze_L5R_FoundryVTT'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\setup-local-foundry.ps1'
```

Skrypt zapyta o pełną ścieżkę do ZIP, rozpakowuje aplikację do
`%LOCALAPPDATA%\FoundryDev-14.370\app`, tworzy osobny katalog danych `userdata`,
łączy system oraz sześć lokalnych modułów dowiązaniami katalogowymi i uruchamia serwer.
Przed utworzeniem dowiązania do Damage Vignette buduje moduł do `dist`, jeśli
brakuje tam manifestu lub `main.bundle.js`; dowiązanie wskazuje na ten gotowy
katalog Foundry, a nie na katalog źródeł. Dla libWrapper skrypt instaluje przez
HTTPS brakujący submoduł `src/shared`, instaluje zależności developerskie przez
`npm ci` i buduje moduł, gdy nie ma wymaganego `dist/lib-wrapper.css`.
Nie nadpisuje istniejących katalogów pakietów. Node 24 jest już dostępny na tym
komputerze. Parametr ExecutionPolicy dotyczy tylko uruchamianego procesu;
nie zmienia zapisanej polityki Windows.

3. Otwórz [lokalne Foundry](http://127.0.0.1:30001), potwierdź wersję **14.370**,
   wprowadź licencję i samodzielnie zaakceptuj umowę. Utwórz nowy świat testowy
   z systemem L5R oraz konta GM i gracza. Doinstaluj zależności modułów, np.
   bazowy Argon, przed włączeniem modułów, które ich wymagają.

Skrypt nie pobiera aplikacji ani nie wpisuje klucza licencji. Wersję pobranego
Foundry potwierdza użytkownik w jego interfejsie; skrypt sprawdza jedynie Node
oraz obecność pliku startowego. Serwer LAN pozostaje osobną instalacją.

## Kolejne uruchomienia

Użyj tych samych dwóch poleceń. Po rozpakowaniu aplikacji skrypt nie pyta ponownie
o ZIP. Każde uruchomienie sprawdza i dodaje brakujące dowiązania repozytoriów,
więc zaktualizuje również istniejącą instalację testową. Istniejący katalog lub
dowiązanie wskazujące na inną ścieżkę powoduje bezpieczne przerwanie; wyjątkiem jest
znana poprzednia junction Damage Vignette do katalogu źródeł, którą skrypt przełącza
na `dist`. Pozostaw terminal otwarty; **Ctrl+C** zatrzymuje serwer. Zajęty port
30001 powoduje przerwanie uruchomienia, bez zatrzymywania innych procesów.

## Jak kod trafia do Foundry

- `Nasze_L5R_FoundryVTT/system` jest połączony z `userdata/Data/systems/l5r5e`.
- Repozytoria modułów są połączone z `userdata/Data/modules/<id z manifestu>`.
- `L5R-damage-vignette` jest połączony przez katalog `dist`, ponieważ manifest
  modułu wymaga zbudowanego `main.bundle.js`.
- Przeglądarka korzysta z `http://127.0.0.1:30001`.

Zapis kodu jest od razu dostępny dla serwera. Po zmianach JavaScript odśwież
wszystkie klienty, po zmianach manifestów uruchom serwer ponownie, a po zmianach
SCSS wykonaj `npm run compile`. Hot reload wymaga również konfiguracji
`flags.hotReload` w manifeście pakietu; skrypt nie dodaje jej do manifestów
produkcyjnych. Pełne odświeżenie pozostaje podstawą testów zmian logiki.

Testuj scenariusze z `upstream-audit-acceptance.md`, wykonaj `npm run ci`, sprawdź
paczkę i dopiero po odbiorze wykonaj commit, push i publikację wydania.

Instancja testowa ma osobne dane. Nie wskazuj jej bazy świata używanej przez
działający serwer LAN. Świat przenoś z kopii zapasowej zrobionej przy zatrzymanym
źródle.

## Docker i serwer LAN

Docker może osiągnąć to samo przez bind mount lokalnego katalogu `system` do
katalogu systemu wewnątrz kontenera. Przykładowo dla katalogu danych `/data`
celem jest `/data/Data/systems/l5r5e`. Dane świata wymagają osobnego trwałego
wolumenu lub katalogu. Port można udostępnić jako `127.0.0.1:30001`.
Ścieżki zależą od obrazu; w tym zadaniu nie wybrano ani nie zainstalowano obrazu.

Docker na zdalnym serwerze LAN montuje pliki tego serwera, nie pliki komputera
Codexa. Testy w LAN wymagają osobnej instancji i synchronizacji źródeł.
Opisany wyżej wariant Node.js pozwala pracować bez tej synchronizacji.

## Źródła

- [Wydanie stabilne 14.370](https://foundryvtt.com/releases/14.370)
- [Tworzenie systemów](https://foundryvtt.com/article/system-development/)
- [Instalacja Node.js](https://foundryvtt.com/article/installation/)
- [Konfiguracja i hot reload](https://foundryvtt.com/article/configuration/)
- [Bind mounts Dockera](https://docs.docker.com/engine/storage/bind-mounts/)

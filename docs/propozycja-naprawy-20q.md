# Odłożona naprawa formularza 20Q

Data: 05.11.2026. Poza bieżącym zakresem walki, zgodnie z decyzją użytkownika.

## Odtworzony problem

Na Foundry 14.370 otwarcie 20Q Player1 wyświetla formularz, ale zgłasza TypeError w TwentyQuestionsDialog._createDragDropHandlers, twenty-questions-dialog.js:102. Kod próbuje wykonać this._onDragStart.bind(this), choć klasa ani jej adapter ApplicationV2 nie udostępniają tej metody. Nie oznacza to udowodnionej utraty odpowiedzi: po pełnym odświeżeniu obie wcześniej wpisane odpowiedzi Player2 były zapisane.

## Propozycja na później (niezaimplementowana)

1. Ustalić, czy formularz potrzebuje przeciągania elementów na zewnątrz, czy tylko przyjmowania dropów. Nie obejmować selektorem .item przycisków zakładek.
2. Dostosować istniejące handlery DragDrop do ApplicationV2: poprawne funkcje uprawnień i obsługa istniejących dokumentów/UUID; nie dodawać równoległego zapisu dokumentów.
3. Zachować cztery obecne strefy: przedmioty, techniki, peculiarities i bonds oraz reguły dozwolonych typów.
4. Sprawdzić otwarcie bez wyjątku, nawigację Next, zapis odpowiedzi po odświeżeniu i w drugim kliencie, dodawanie/usuwanie dokumentów dla Core i Path of Waves, uprawnienia gracza.
5. Dodać test budowy handlerów, który wykryje brak metody zanim formularz trafi do przeglądarki.

Wstępne lokalne zmiany 20Q zostały wycofane z zakresu tego wydania (wyłącznie własne zmiany z tego zadania). Na później pozostaje także propozycja pobierania odłączonego snapshotu actor.system przez toObject()/duplicate() w TwentyQuestions.fromActor i toActor oraz usunięcia bezpośredniego przypisania actor.system.twenty_questions przed actor.update w dialogu. Nie jest to samo w sobie naprawą wyjątku DragDrop ani dowodem utraty danych. Błąd 20Q nie blokuje kontynuowania prac nad walką, ale segment nie może być opisany jako przetestowany.

## Dalsze poprawki walki (odłożone)

- Dodać reset ręcznie naliczonego ruchu tokenu. W teście Foundry ruch Player1 podniósł pomiar do 33, a następnie do 36 kafelków; HUD nie oferował resetu, a tracker nadal pokazywał 3 pozostałe. Zaprojektować widoczną akcję resetu dla GM i zweryfikować, czy zeruje licznik właściwego tokenu bez zmiany jego pozycji ani tur innych uczestników.
- Zablokować przesunięcie tokenu, gdy jego koszt przekroczy pozostały budżet ruchu. Obserwacja: Player1 został przesunięty dalej mimo przekroczenia; odczyt pomiaru rósł do 36, ale tracker nie zmniejszył pozostałej wartości 3. Powtórzyć test na znanym rozmiarze siatki, kontrolując ruch ortogonalny i diagonalny.

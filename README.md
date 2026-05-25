# 📥 CradleDown

**CradleDown** to premium rozszerzenie do przeglądarki Google Chrome (zbudowane w oparciu o standard Manifest V3), zaprojektowane z myślą o ułatwieniu pracy z platformą zarządzania plikami Cradle (`cradle.egplusww.pl`).

Pozwala ono na wygodne, sekwencyjne pobieranie wielu załączników bezpośrednio z kolumny komentarzy do dedykowanego podkatalogu nazwanego numerem **Asset ID** powiązanego z daną stroną.

---

## ✨ Kluczowe Funkcje

*   **Precyzyjny Filtr Kolumn**: Rozszerzenie wstrzykuje okrągłe wskaźniki wyboru `+` **wyłącznie** w kolumnie **Attachment**, celowo ignorując pozostałe (np. *NC Attachment*).
*   **Dynamiczna Kolejka (Klik-po-Kliku)**: Kolejność zaznaczania plików definiuje kolejność ich pobierania. Rozszerzenie wizualizuje tę sekwencję za pomocą dynamicznie aktualizowanej numeracji (`①`, `②`, `③`). Odznaczenie elementu z środka kolejki automatycznie przesuwa w dół pozostałe numery.
*   **Premium Glassmorphic Side Panel**: Estetyczna konsola sterująca w prawym dolnym rogu z efektem rozmycia tła (`backdrop-filter`), gradientami i pełną wizualizacją postępu ściągania pojedynczych plików.
*   **Automatyczna segregacja (Asset ID)**: Automatycznie wykrywa numer identyfikacyjny zasobu (Asset ID) i zapisuje załączniki do katalogu `Pobrane/<Asset ID>/<nazwa_pliku>`.
*   **Reaktywne Statystyki**: Podręczne okno popup rozszerzenia wyświetla na żywo liczbę pobranych plików oraz aktualnie zakolejkowanych pozycji korzystając z pamięci lokalnej (`chrome.storage.local`).

---

## 📁 Struktura Projektu

```text
CradleDown/
├── manifest.json            # Manifest V3 (uprawnienia, dopasowania URL)
├── RULES.md                 # Zasady pracy z kodem projektu
├── README.md                # Dokumentacja (ten plik)
├── background/
│   └── service-worker.js    # Stabilne pobieranie w tle (chrome.downloads API)
├── content/
│   └── cradle-down.js       # Detekcja Asset ID, MutationObserver, UI panelu i wstrzykiwanie logiki
└── popup/
    ├── popup.html           # Interfejs popupu z instrukcją
    ├── popup.css            # Stylizacja popupu w ciemnym stylu Glassmorphism
    └── popup.js             # Skrypt obsługi statystyk i sprawdzania adresu URL
```

---

## 🛠️ Brak pliku `requirements.txt` — Dlaczego go nie potrzebujemy?

W projektach opartych o język Python plik `requirements.txt` jest kluczowy do instalacji zewnętrznych bibliotek. 

**CradleDown** jest w 100% natywnym projektem front-endowym przeglądarki Chrome (**Pure Vanilla JS / HTML / CSS**). Działa w całości wewnątrz piaskownicy przeglądarki przy użyciu wbudowanych API Chrome (`chrome.downloads`, `chrome.storage`). 
*   **Nie wymaga** uruchamiania środowiska Pythona.
*   **Nie posiada** żadnych zewnętrznych zależności (npm / pip).
*   Jest niesamowicie lekki, bezpieczny i łatwy w dystrybucji.

---

## 🚀 Instrukcja Instalacji (Dla zespołu)

1.  Sklonuj to repozytorium na swój dysk lokalny:
    ```bash
    git clone https://github.com/hury77/CradleDown.git
    ```
2.  Otwórz przeglądarkę **Google Chrome** i przejdź na stronę: `chrome://extensions/`
3.  Włącz **Tryb dewelopera (Developer mode)** w prawym górnym rogu.
4.  Kliknij przycisk **Załaduj rozpakowane (Load unpacked)** po lewej stronie.
5.  Wskaż główny katalog sklonowanego projektu: `/sciezka/do/CradleDown`

Rozszerzenie zostanie załadowane i uruchomi się automatycznie po przejściu na platformę Cradle.

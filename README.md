# wnetrzarski
aplikacja dla architektow

## Table Configurator — Silnik Walidacji Konstrukcji

Moduł TypeScript do walidacji konfiguracji stołów z kamienia / spieku kwarcowego.
Sprawdza reguły strukturalne i fizyczne, zwraca listę naruszeń (po polsku) oraz
sugerowaną poprawną konfigurację.

## Instalacja i uruchomienie testów

```bash
npm install
npm test
```

Wyniki testów pojawią się w terminalu. Wszystkie 19 przypadków testowych
znajduje się w `src/__tests__/engine.test.ts`.

## Budowanie projektu

```bash
npm run build
```

Skompilowane pliki trafią do katalogu `dist/`.

## Otwieranie test-harness.html

Plik `test-harness.html` działa **bez serwera** — wystarczy otworzyć go
bezpośrednio w przeglądarce:

```
open test-harness.html        # macOS
xdg-open test-harness.html    # Linux
start test-harness.html       # Windows
```

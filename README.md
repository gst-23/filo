# Filo. — Attività senza distrazioni

Un sito web statico in italiano (HTML/CSS/JS) pronto per **GitHub Pages**. Nessuna compilazione, nessun account per entrare nella lista: un solo link condivisibile. **Per sincronizzare attività e allegati tra dispositivi devi configurare Supabase**; pubblicare su GitHub, da solo, non salva i dati online.

## Funzionalità

- Tema scuro, logo minimal **Filo.**, giallo fluo. Nessuna icona personalizzata accanto ai titoli; nessuna priorità, dashboard, barra laterale o ricerca.
- Attività **non completate ordinate rigorosamente per scadenza crescente**: scadute prima, poi oggi, poi futuro; le senza data in fondo. **Le completate** stanno in una sezione richiudibile separata, anch'essa cronologica.
- Date brevi: *Ieri*, *Oggi*, *Domani*, oppure giorno e mese senza anno. Il giorno/mese/anno completo è visibile passando il mouse sopra la data o dal modulo Modifica.
- Scadenze passate e odierne evidenziate in giallo fluo.
- Rinvio rapido con uno **slider 0–7 giorni**, inizialmente nascosto: compare al passaggio del mouse o al focus. Rilasciando lo slider su 1–7 giorni il rinvio viene applicato, con possibilità di **Annulla**. Se la scadenza è passata, il conteggio parte da oggi; altrimenti dalla scadenza esistente. Si contano **giorni di calendario**.
- **+** grigio in alto per aggiungere attività. Clic su un titolo o sulla freccia per aprire sotto-attività, note e allegati nella stessa lista; vicino alla freccia compare il conteggio delle sotto-attività.
- Menu **⋯** per Modifica, Duplica (senza copiare gli allegati), Copia link specifico, Aggiungi allegato, Elimina.
- Sotto-attività con checkbox e note. File allegati da scaricare o rimuovere, fino a **20 MB per file**.
- Salvataggio dopo ogni operazione. In cloud tutti i dispositivi vedono gli stessi dati e la pagina li ricarica automaticamente ogni ~30 secondi mentre non si sta scrivendo, oltre al comando «Aggiorna».
- Backup JSON con allegati ed importazione (compatibile anche con backup del prototipo **Piano**).

## 1. Pubblicazione del sito su GitHub Pages

1. Accedi a https://github.com e clicca sul **+** in alto a destra, poi **New repository**.
2. Chiama il repository ad esempio **filo**, scegli **Public**, poi **Create repository**. (Non inserire credenziali segrete nel repository.)
3. Estrai il file ZIP allegato. Entra nella cartella `filo` e seleziona **tutti i file al suo interno** (`index.html`, `styles.css`, `app.js`, `config.js`, `favicon.svg`, `database.sql`, `README.md` e, se visibile, `.nojekyll`). **Non caricare soltanto lo ZIP** e non creare una cartella `filo` annidata nel repository: `index.html` deve trovarsi nella radice.
4. Nel repository appena creato, clicca **Add file → Upload files** (oppure il collegamento *uploading an existing file*), trascina i file, poi **Commit changes**.
5. Apri **Settings → Pages**; in **Build and deployment** scegli **Deploy from a branch**, imposta **main** e **/(root)**, quindi **Save**.
6. La pagina sarà pubblicata all'indirizzo: `https://TUO-USERNAME.github.io/filo/` (sostituisci il vero username GitHub). GitHub mostra l'URL effettivo in **Settings → Pages**.
7. Se la pagina non appare subito, controlla dopo la pubblicazione la sezione **Actions** o **Settings → Pages** per eventuali errori di build.

> **IMPORTANTE:** in questo stato iniziale `config.js` è vuoto: il sito funziona, ma le attività e i file sono salvati SOLO nel browser locale. **Per condividere la stessa lista tra PC, smartphone e altre persone esegui anche il punto 2.**

## 2. Attivare il salvataggio online SENZA LOGIN (Supabase)

La configurazione è intenzionalmente **pubblica in lettura e scrittura**: chi apre il link può vedere e modificare la lista senza password. Non usate questo modello per dati aziendali, personali o riservati; anche chi ricava l'URL/chiave pubblica dall'applicazione potrebbe accedere direttamente al database e agli allegati. Non esiste un controllo di accesso per singolo visitatore. Senza un livello server aggiuntivo non è possibile rendere privati i dati e mantenere una bacheca pubblica interamente anonima.

1. Crea un progetto su https://supabase.com (serve un account **solo a chi configura il backend**, non a chi consulta il sito).
2. Apri il progetto, poi **SQL Editor**. Incolla l'intero file **`database.sql`** incluso nello ZIP e premi **Run**. Vengono create la tabella condivisa, le policy RLS per accesso anonimo e un bucket pubblico per gli allegati. Leggi prima l'avviso all'inizio del file.
3. In Supabase cerca **Connect** oppure **Project Settings → API Keys**. Copia il **Project URL** e la chiave **Publishable**, il cui prefisso è `sb_publishable_`. La chiave publishable è pubblica per definizione, NON protegge il database.
4. Modifica il file **`config.js`** come segue, usando i tuoi valori:

   ```js
   window.FILO_CONFIG = {
     supabaseUrl: 'https://IL-TUO-PROGETTO.supabase.co',
     supabasePublishableKey: 'sb_publishable_...'
   };
   ```

5. Carica il `config.js` modificato su GitHub, sostituendo il precedente file, ed effettua un **Commit changes**.
6. Ricarica la pagina GitHub Pages. In fondo deve comparire **«Online · modifiche salvate automaticamente»**. Prova a creare un'attività dal computer e apri lo stesso link sul telefono (aggiorna la pagina, se necessario): vedrai lo stesso elenco.

**Non inserire mai `sb_secret_...`, `service_role`, password di database o token di amministratore nei file pubblici.** Il database del progetto è comunque accessibile senza credenziali, per scelta: imposta quote adeguate e non caricare file sensibili. Il piano Supabase può avere limiti e costi.

## 3. Prova locale prima di caricare su GitHub

Senza Supabase, basta servire la cartella `filo` con un piccolo web server:

```bash
cd filo
python3 -m http.server 8000
```

Apri `http://localhost:8000` nel browser. In questa modalità le attività sono conservate in `localStorage` e gli allegati in `IndexedDB`; non vengono sincronizzati tra dispositivi. Il salvataggio locale mantiene le chiavi del vecchio prototipo Piano, per non perdere eventuali dati già inseriti sullo stesso origin del browser.

Per passare dalla modalità locale al cloud: **esporta un backup** tramite il link a piè di pagina, configura Supabase come sopra, quindi **importa il backup** nella nuova bacheca online. I backup incorporano gli allegati come dati Base64 e possono essere grandi e non cifrati: conservali attentamente.

## 4. Aggiornare Filo in futuro

Puoi sostituire `index.html`, `styles.css`, `app.js` e `favicon.svg` caricando le versioni nuove nel repository GitHub. Le attività cloud rimangono su Supabase, non dentro i file di GitHub; se fai modifiche allo schema SQL, valuta prima un backup.

## Note e limiti

- Chiunque abbia l'accesso pubblico API può **leggere, aggiungere, modificare, cancellare** attività e file. Il solo fatto di tenere segreto il link non costituisce protezione. Non installare in un ambiente con documentazione aziendale o privata senza aggiungere un'autenticazione o un backend controllato.
- Il sistema non gestisce al momento permessi, versioni, annullamento delle cancellazioni o avvisi via email. Gli allegati eliminati potrebbero non essere recuperabili.
- Se due persone modificano simultaneamente **la stessa attività**, prevale l'ultimo salvataggio; le modifiche a note/sotto-attività della stessa attività possono quindi sovrascriversi. Esporta backup periodici.
- La sincronizzazione su altri dispositivi non è istantanea: aggiornamento automatico ogni circa **30 secondi** (o clic su **Aggiorna**). Il salvataggio di ogni modifica avviene online subito, quando la connessione è disponibile.
- Se `config.js` contiene parametri Supabase errati o la connessione cade, Filo segnala un errore e **non** fa finta che le modifiche siano state sincronizzate.
- La dimensione massima configurata degli allegati è 20 MB per file, indipendentemente dai limiti di piano applicati dal fornitore.

## Struttura file

| File | Utilizzo |
|---|---|
| `index.html` | Struttura interfaccia |
| `styles.css` | Grafica dark responsive |
| `app.js` | Funzionalità, salvataggi, backup, slider |
| `favicon.svg` | Logo minimal «F.» |
| `config.js` | Attivazione opzionale backend cloud (chiave **pubblica** soltanto) |
| `database.sql` | Tabelle e policy pubbliche Supabase |
| `.nojekyll` | Compatibilità GitHub Pages |
| `README.md` | Questo manuale |

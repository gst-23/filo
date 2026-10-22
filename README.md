# Filo. — aggiornamento interfaccia (ottobre 2026)

Questo pacchetto aggiorna **il progetto Filo già online** su GitHub Pages con Supabase configurato. La grafica resta scura, con logo minimal e giallo fluo. Non richiede nuove tabelle, query SQL o chiavi API.

## Come aggiornare `gst-23/filo` senza perdere il collegamento Supabase

1. Per sicurezza, sul sito Filo già funzionante premi **Esporta backup** prima di intervenire: il file JSON include attività e allegati.
2. Estrai lo ZIP **Filo-aggiornamento-v2-GitHub.zip** sul computer.
3. Apri il repository **https://github.com/gst-23/filo** e scegli **Add file → Upload files**.
4. Trascina nella radice del repository questi **quattro file estratti**: `index.html`, `styles.css`, `app.js` e `README.md`. GitHub sostituirà le versioni precedenti. Non caricare lo ZIP intero e non creare sottocartelle.
5. Clicca su **Commit changes**. La pubblicazione automatica GitHub Pages usa la configurazione già esistente (branch `main`, cartella `/ (root)`).
6. Una volta completata la pubblicazione in **Actions**, apri **https://gst-23.github.io/filo/**. Se appare ancora la versione precedente, usa **Ctrl+F5** o prova una scheda in incognito.

### Non sovrascrivere questi file

- **`config.js`**: contiene il Project URL e la chiave pubblica Supabase che hai già configurato. Il file **non è incluso in questo pacchetto**, proprio per impedire di azzerare il collegamento.
- **`database.sql`**: le tabelle e le policy Supabase esistenti sono compatibili; non va ricaricato o rieseguito.
- **`favicon.svg`** e **`.nojekyll`**: non richiedono modifiche, quindi rimangono quelli già presenti.

Le attività e gli allegati sono conservati in Supabase, **non nel repository GitHub**. Un aggiornamento dei quattro file indicati non cancella i dati esistenti.

## Cosa cambia

- **Righe più basse:** circa 62 px su desktop (prima 88 px), più compatte anche su smartphone.
- **Solo titolo e scadenza:** rimossi dalla grafica il campo «Progetto / categoria», la «Descrizione» e le etichette ridondanti sotto la data (come «Scade oggi»).
- **Nuova attività in riga:** cliccando sul **+** appare direttamente una riga vuota **in cima alla lista**. Inserisci il titolo e seleziona la data di scadenza; premi la piccola **spunta gialla** o **Invio** per salvare, oppure **×** / **Esc** per annullare. L'attività viene inviata online a Supabase appena salvata e assume immediatamente la posizione cronologica corretta.
- **Modifica in riga:** anche **⋯ → Modifica** permette di cambiare titolo e scadenza nello stesso punto, senza popup. Titolo e scadenza sono obbligatori per una nuova attività.
- **Completamento = eliminazione:** cliccando sul cerchietto alla sinistra del titolo, l'attività viene cancellata **definitivamente** dalla lista **e dal database Supabase**, insieme ai relativi allegati. **Non c'è più una sezione «Attività completate».** Non c'è annullamento per questa operazione. È consigliato esportare un backup ogni tanto, soprattutto prima di aggiornare il sito.
- **Dettagli più puliti:** cliccando sul titolo o sulla freccia a destra compaiono solo **Sotto-attività** e **Allegati**. Il piccolo numero vicino alla freccia indica quante sotto-attività sono presenti. Le note non compaiono più.
- **Slider discreto:** resta il rinvio da 1 a 7 giorni al passaggio del mouse o al clic. La frase «Trascina da 1 a 7 giorni» è stata eliminata. Il rinvio parte dalla data attuale se la precedente è già scaduta, altrimenti dalla scadenza impostata. È ancora possibile annullare un rinvio tramite la notifica temporanea.
- **Ordine cronologico:** prima le scadenze passate, poi oggi, poi quelle future. Le attività senza scadenza già esistenti rimangono in fondo.

## Compatibilità con i dati preesistenti

Per non richiedere una migrazione Supabase, i vecchi campi `project`, `description` e `notes` **restano nello schema e negli eventuali record precedenti**, ma sono nascosti nella nuova interfaccia. I dati legacy sono inclusi nel backup JSON fino a quando il relativo record viene eliminato.

Le attività eventualmente **già completate nella vecchia versione** non vengono mostrate, ma non vengono cancellate automaticamente dal database. Solo il completamento effettuato da questa versione in poi elimina subito il record.

## Salvataggio e sicurezza

Il salvataggio delle operazioni continua a usare la tabella `filo_tasks` e lo storage `filo-files` della configurazione Supabase esistente. I cambiamenti vengono inviati online appena confermati; gli altri dispositivi ricaricano periodicamente i dati o manualmente con **Aggiorna**. Se il database non è raggiungibile, compare un errore invece di dare per riuscita la modifica.

**Attenzione:** il sito è volutamente senza login. Il database e gli allegati sono leggibili e modificabili da chi dispone della chiave pubblica esposta nel browser, anche senza conoscere il link della pagina. Non inserire materiali confidenziali, dati personali o aziendali riservati senza protezioni server/autenticazione appropriate.

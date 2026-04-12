interface Props {
  onBack: () => void
}

interface Item {
  q: string
  a: string
}

interface Section {
  emoji: string
  title: string
  items: Item[]
}

const SECTIONS: Section[] = [
  {
    emoji: '🔒',
    title: 'Datenschutz & Privatsphäre',
    items: [
      {
        q: 'Werden meine Daten auf einen Server hochgeladen?',
        a: 'Nein. Remember Me funktioniert vollständig ohne Server. Alle deine Antworten, Fotos und Sprachaufnahmen werden ausschließlich in deinem Browser gespeichert – Texte im localStorage, Medien in IndexedDB. Es findet keinerlei Netzwerkübertragung deiner Inhalte statt.',
      },
      {
        q: 'Wer kann meine Antworten sehen?',
        a: 'Nur du. Da es kein Konto und keinen Login gibt, existiert kein zentraler Speicher, auf den Dritte zugreifen könnten. Andere Personen am selben Gerät bräuchten Zugang zu deinem Browser-Profil, um deine Daten lesen zu können.',
      },
      {
        q: 'Was passiert mit meinen Daten, wenn ich den Browser-Cache leere?',
        a: '„Browserdaten löschen" entfernt in den meisten Browsern auch localStorage und IndexedDB – damit würden alle Antworten, Fotos und Audios dauerhaft gelöscht. Erstelle daher vorher immer ein Backup unter Profil → Exportieren & Sichern.',
      },
      {
        q: 'Sind meine Fotos und Sprachaufnahmen sicher?',
        a: 'Ja. Fotos und Audioaufnahmen verlassen nie deinen Browser. Sie werden lokal in IndexedDB gespeichert und sind nicht im Backup enthalten – sie bleiben an das jeweilige Gerät und den jeweiligen Browser gebunden.',
      },
      {
        q: 'Verwendet die Spracherkennung externe Server?',
        a: 'Die Spracherkennung nutzt die Web Speech API des Browsers. In Chrome und Edge kann das bedeuten, dass Audio während der Aufnahme kurzzeitig an Server von Google bzw. Microsoft übermittelt wird – wie bei der normalen Diktierfunktion. In Firefox ist keine Spracherkennung verfügbar; die Audioaufnahme selbst bleibt aber immer lokal. Du kannst die Transkription einfach ignorieren und nur die Originalaufnahme nutzen.',
      },
    ],
  },
  {
    emoji: '📥',
    title: 'Import',
    items: [
      {
        q: 'Wie importiere ich meine Instagram-Daten?',
        a: 'Gehe zu Profil → Importieren → Social Media importieren. Dort findest du eine schrittweise Anleitung, wie du deine Daten bei Instagram anforderst und anschließend die ZIP-Datei hochlädst. Remember Me liest deine Beiträge aus und schlägt vor, daraus Antworten zu erstellen.',
      },
      {
        q: 'Wie stelle ich ein Backup wieder her?',
        a: 'Gehe zu Profil → Exportieren & Sichern → Backup-Datei laden. Wähle eine zuvor erstellte .json-Backup-Datei aus. Alle aktuellen Daten werden damit überschrieben – der Dialog fragt zur Sicherheit nach.',
      },
      {
        q: 'Sind Fotos und Audioaufnahmen im Backup enthalten?',
        a: 'Nein. Das Backup enthält Textantworten, dein Profil, eigene Fragen und Freundes-Beiträge. Fotos und Originalaufnahmen sind nicht enthalten, da sie als Binärdaten lokal im Browser-Speicher liegen und die Datei sonst sehr groß werden würde. Plane diese bei einem Gerätewechsel manuell ein.',
      },
      {
        q: 'Was passiert mit meinen bisherigen Daten beim Backup-Import?',
        a: 'Sie werden vollständig überschrieben. Erstelle vorher ein Backup deines aktuellen Stands, falls du Daten beider Versionen behalten möchtest.',
      },
    ],
  },
  {
    emoji: '📤',
    title: 'Export & Backup',
    items: [
      {
        q: 'Welche Exportformate gibt es?',
        a: 'Es gibt drei Formate: Markdown (.md) – gut lesbar für Menschen und KI-Systeme, ideal für Texteditoren. JSON (.json) – strukturierter, maschinenlesbarer Export mit Kategorien und Metadaten. Backup (.json) – enthält alle Rohdaten und kann wieder in Remember Me importiert werden.',
      },
      {
        q: 'Was ist der Unterschied zwischen Backup und JSON-Export?',
        a: 'Das Backup ist für den Re-Import gedacht und enthält alle internen Datenstrukturen (inkl. Freunde, eigene Fragen und Metadaten). Der JSON-Export ist ein lesbarer Snapshot ohne Re-Import-Funktion – zum Beispiel für die Übergabe an eine KI oder zur Archivierung.',
      },
      {
        q: 'Wie übertrage ich meine Daten auf ein neues Gerät?',
        a: 'Erstelle ein Backup unter Profil → Exportieren & Sichern → Backup. Übertrage die Backup-Datei auf das neue Gerät (z. B. per E-Mail, AirDrop oder Cloud-Speicher). Öffne Remember Me auf dem neuen Gerät und wähle Profil → Backup-Datei laden.',
      },
      {
        q: 'Kann ich meine Daten in anderen Apps nutzen?',
        a: 'Ja. Der Markdown-Export lässt sich in Notiz-Apps, Word oder als Input für KI-Assistenten (z. B. ChatGPT) verwenden. Der JSON-Export eignet sich für Entwickler oder strukturierte Weiterverarbeitung.',
      },
    ],
  },
]

export function FaqView({ onBack }: Props) {
  return (
    <div className="faq-view">
      <div className="faq-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <span className="faq-topbar__title">Hilfe & FAQ</span>
      </div>

      <div className="faq-intro">
        <p>Antworten auf häufige Fragen rund um Datenschutz, Import und Export.</p>
      </div>

      {SECTIONS.map(section => (
        <section key={section.title} className="faq-section">
          <h2 className="faq-section__title">
            {section.emoji} {section.title}
          </h2>
          <div className="faq-list">
            {section.items.map(item => (
              <details key={item.q} className="faq-item">
                <summary className="faq-item__q">
                  <span>{item.q}</span>
                  <span className="faq-item__chevron" aria-hidden="true">›</span>
                </summary>
                <p className="faq-item__a">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="faq-footer">
        Noch eine Frage? Feedback oder Fehler melden unter{' '}
        <strong>remember-me.app</strong>.
      </p>
    </div>
  )
}

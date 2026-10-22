import type { ActionError } from './state/actions';
import type { ParseError } from './state/model';

/** All user-facing text (Swedish) lives here so it can be swapped or translated later. */
export const strings = {
  appTitle: 'Kostnadsfördelning',
  appIntro:
    'Lägg till deltagare och utgifter så visar vi vem som är skyldig vem. Allt sparas bara i din webbläsare och i länken.',

  participants: {
    heading: 'Deltagare',
    nameLabel: 'Namn',
    add: 'Lägg till deltagare',
    empty: 'Inga deltagare ännu.',
    rename: 'Byt namn',
    renameLabel: (name: string) => `Nytt namn för ${name}`,
    remove: 'Ta bort',
    removeLabel: (name: string) => `Ta bort ${name}`,
    renameButtonLabel: (name: string) => `Byt namn på ${name}`,
    save: 'Spara',
    cancel: 'Avbryt',
  },

  expenses: {
    heading: 'Utgifter',
    newHeading: 'Ny utgift',
    needParticipants:
      'Lägg till minst en deltagare innan du lägger till en utgift.',
    description: 'Beskrivning',
    amount: 'Belopp (kr)',
    amountHint: 'Till exempel 249,50',
    payer: 'Betalad av',
    split: 'Fördelning',
    splitLegend: 'Vem delar utgiften?',
    splitKinds: {
      equal: 'Lika',
      shares: 'Andelar',
      exact: 'Exakta belopp',
      percent: 'Procent',
    },
    splitHints: {
      equal: 'Markera de som delar utgiften.',
      shares:
        'Ange en andel per person, till exempel 1, 2 eller 3. Lämna tomt för dem som inte delar.',
      exact:
        'Ange belopp i kr per person. Beloppen måste summera till utgiftens belopp.',
      percent: 'Ange procent per person. Summan måste bli 100.',
    },
    shareFieldLabel: (name: string) => `Andel för ${name}`,
    exactFieldLabel: (name: string) => `Belopp för ${name} (kr)`,
    percentFieldLabel: (name: string) => `Procent för ${name}`,
    add: 'Lägg till utgift',
    empty: 'Inga utgifter ännu.',
    remove: 'Ta bort',
    removeLabel: (description: string) => `Ta bort utgiften ${description}`,
    paidBy: (name: string) => `Betalad av ${name}`,
  },

  summary: {
    heading: 'Sammanfattning',
    total: 'Totalt för alla utgifter',
    donutLabel: (total: string) =>
      `Cirkeldiagram över alla utgifter, totalt ${total}`,
    balances: 'Saldo',
    positive: 'ska få',
    negative: 'ska betala',
    even: 'kvitt',
    transfers: 'Så gör ni upp',
    settled: 'Alla är kvitt.',
    transfer: (from: string, to: string, amount: string) =>
      `${from} betalar ${to} ${amount}`,
  },

  share: {
    heading: 'Dela',
    copy: 'Kopiera länk',
    linkLabel: 'Länk att dela',
    copied: 'Länken kopierades.',
    copyFailed:
      'Det gick inte att kopiera. Markera länken och kopiera den manuellt.',
    tooLong:
      'Länken är lång och fungerar kanske inte överallt, till exempel i vissa chattappar.',
    note: 'Den som öppnar länken ser en kopia av just nu. Ändringar synkas inte.',
  },

  errors: {
    dismiss: 'Stäng',
    load: {
      corrupt:
        'Länken går inte att läsa. Den kan vara ofullständig eller skadad. Du börjar om med en tom lista.',
      'too-long':
        'Länken är för lång för att öppnas. Du börjar om med en tom lista.',
      'unsupported-version':
        'Länken kommer från en version som inte stöds. Du börjar om med en tom lista.',
      invalid: 'Länkens innehåll är ogiltigt. Du börjar om med en tom lista.',
    } satisfies Record<ParseError['kind'], string>,
    action: {
      'invalid-name': 'Skriv ett namn på högst 40 tecken.',
      'duplicate-name': 'Det finns redan en deltagare med det namnet.',
      'invalid-description': 'Skriv en beskrivning på högst 60 tecken.',
      'invalid-amount': 'Ange ett giltigt belopp, till exempel 249,50.',
      'invalid-split':
        'Fördelningen stämmer inte. Kontrollera värdena och att summan blir rätt.',
      'unknown-participant': 'Deltagaren finns inte längre.',
      'unknown-expense': 'Utgiften finns inte längre.',
      'participant-in-use':
        'Deltagaren används i en utgift. Ta bort utgiften först.',
      'limit-reached':
        'Du har nått maxgränsen för antal deltagare eller utgifter.',
    } satisfies Record<ActionError, string>,
    invalidAmount: 'Ange ett giltigt belopp, till exempel 249,50.',
    invalidShares: 'Andelar måste vara heltal, till exempel 1, 2 eller 3.',
    invalidValue:
      'Något värde i fördelningen är ogiltigt. Använd siffror, och högst två decimaler.',
    noSharers: 'Välj minst en person som delar utgiften.',
  },
} as const;

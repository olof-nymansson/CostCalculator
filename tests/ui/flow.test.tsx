// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';

const setHash = (hash: string) =>
  window.history.replaceState(null, '', hash === '' ? '/' : hash);

beforeEach(() => setHash(''));
afterEach(cleanup);

const addParticipant = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.type(screen.getByLabelText('Namn'), name);
  await user.click(screen.getByRole('button', { name: 'Lägg till deltagare' }));
};

const addEqualExpense = async (
  user: ReturnType<typeof userEvent.setup>,
  description: string,
  amount: string,
  payer: string,
) => {
  await user.type(screen.getByLabelText('Beskrivning'), description);
  await user.type(screen.getByLabelText(/^Belopp/), amount);
  await user.selectOptions(screen.getByLabelText(/^Betalad av/), payer);
  await user.click(screen.getByRole('button', { name: 'Lägg till utgift' }));
};

describe('central flow: add expense → see balance → share link → open link', () => {
  it('shows who owes whom and restores the same state from the shared link', async () => {
    const user = userEvent.setup();
    const first = render(<App />);

    await addParticipant(user, 'Anna');
    await addParticipant(user, 'Björn');
    await addEqualExpense(user, 'Middag', '100', 'Anna');

    // Balance and suggested transfer
    const summary = screen.getByRole('region', { name: 'Sammanfattning' });
    expect(
      within(summary).getByText(/Björn betalar Anna 50,00\s+kr/),
    ).toBeTruthy();
    expect(within(summary).getByText(/ska få 50,00\s+kr/)).toBeTruthy();
    expect(within(summary).getByText(/ska betala 50,00\s+kr/)).toBeTruthy();

    // Share link contains the state in the hash and is what gets copied
    expect(window.location.hash.length).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Kopiera länk' }));
    expect(await screen.findByText('Länken kopierades.')).toBeTruthy();
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain(window.location.hash);

    // Open the link in a fresh app instance
    const link = window.location.hash;
    first.unmount();
    setHash(link);
    render(<App />);

    expect(screen.getAllByText('Anna').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Björn').length).toBeGreaterThan(0);
    expect(screen.getByText('Middag')).toBeTruthy();
    const restored = screen.getByRole('region', { name: 'Sammanfattning' });
    expect(
      within(restored).getByText(/Björn betalar Anna 50,00\s+kr/),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('settles up when expenses cancel out', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addParticipant(user, 'Anna');
    await addParticipant(user, 'Björn');
    await addEqualExpense(user, 'Lunch', '50', 'Anna');
    await addEqualExpense(user, 'Fika', '50', 'Björn');
    expect(screen.getByText('Alla är kvitt.')).toBeTruthy();
  });
});

describe('errors and empty states', () => {
  it('starts empty and asks for participants before expenses', () => {
    render(<App />);
    expect(screen.getByText('Inga deltagare ännu.')).toBeTruthy();
    expect(screen.getByText(/Lägg till minst en deltagare innan/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a clear message and an empty start for a corrupt link', () => {
    setHash('#thisisnotavalidlink!!');
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain(
      'Länken går inte att läsa',
    );
    expect(screen.getByText('Inga deltagare ännu.')).toBeTruthy();
  });

  it('rejects an invalid amount with a message and keeps the form data', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addParticipant(user, 'Anna');
    await user.type(screen.getByLabelText('Beskrivning'), 'Middag');
    await user.type(screen.getByLabelText(/^Belopp/), 'abc');
    await user.click(screen.getByRole('button', { name: 'Lägg till utgift' }));
    expect(screen.getByRole('alert').textContent).toContain('giltigt belopp');
    expect(
      (screen.getByLabelText('Beskrivning') as HTMLInputElement).value,
    ).toBe('Middag');
  });

  it('refuses to remove a participant that is used in an expense', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addParticipant(user, 'Anna');
    await addEqualExpense(user, 'Middag', '100', 'Anna');
    await user.click(screen.getByRole('button', { name: 'Ta bort Anna' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Ta bort utgiften först',
    );
  });
});

describe('other split modes', () => {
  it('splits by percentage', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addParticipant(user, 'Anna');
    await addParticipant(user, 'Björn');

    await user.type(screen.getByLabelText('Beskrivning'), 'Hyra');
    await user.type(screen.getByLabelText(/^Belopp/), '1000');
    await user.selectOptions(screen.getByLabelText(/^Fördelning/), 'percent');
    await user.type(screen.getByLabelText('Procent för Anna'), '75');
    await user.type(screen.getByLabelText('Procent för Björn'), '25');
    await user.click(screen.getByRole('button', { name: 'Lägg till utgift' }));

    const summary = screen.getByRole('region', { name: 'Sammanfattning' });
    expect(
      within(summary).getByText(/Björn betalar Anna 250,00\s+kr/),
    ).toBeTruthy();
  });

  it('reports percentages that do not add up', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addParticipant(user, 'Anna');
    await user.type(screen.getByLabelText('Beskrivning'), 'Hyra');
    await user.type(screen.getByLabelText(/^Belopp/), '1000');
    await user.selectOptions(screen.getByLabelText(/^Fördelning/), 'percent');
    await user.type(screen.getByLabelText('Procent för Anna'), '50');
    await user.click(screen.getByRole('button', { name: 'Lägg till utgift' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Fördelningen stämmer inte',
    );
  });
});

describe('participants', () => {
  it('renames a participant', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addParticipant(user, 'Anna');
    await user.click(screen.getByRole('button', { name: 'Byt namn på Anna' }));
    const input = screen.getByLabelText('Nytt namn för Anna');
    await user.clear(input);
    await user.type(input, 'Annika');
    await user.click(screen.getByRole('button', { name: 'Spara' }));
    expect(screen.getAllByText('Annika').length).toBeGreaterThan(0);
    expect(screen.queryByText('Anna')).toBeNull();
  });
});

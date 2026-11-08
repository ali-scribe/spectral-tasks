import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountApp } from '../../test/mountApp.tsx';
import { createFakeStorage } from '../../test/fakeStorage.ts';
import { makeTask } from '../../test/factories.ts';
import { serializeEnvelope } from '../../storage/envelope.ts';
import { STORAGE_KEY } from '../../domain/constants.ts';

// Focus after a confirmed delete (the opener no longer exists): the next row's
// checkbox, else the previous row's, else the list heading (tabindex -1).
describe('focus after confirming a delete', () => {
  it('moves to the next row, then the previous row, then the list heading', async () => {
    const user = userEvent.setup();
    const tasks = ['Alpha', 'Bravo', 'Charlie'].map((title, i) =>
      makeTask({ id: `t${i}`, title, createdAt: `2026-06-15T10:0${i}:00.000Z` }),
    );
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: serializeEnvelope(tasks, null) } });
    mountApp(storage);
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));

    const order = screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label')!.replace('Release spirit: ', ''));
    expect(order).toHaveLength(3);

    const remove = async (title: string) => {
      await user.click(screen.getByRole('button', { name: `Delete spirit: ${title}` }));
      await user.click(screen.getByRole('button', { name: 'Banish' }));
    };

    // Delete the first row: focus goes to the next row (the new first row).
    await remove(order[0]!);
    expect(screen.getByRole('checkbox', { name: `Release spirit: ${order[1]}` })).toHaveFocus();

    // Delete the last remaining row: focus goes to the previous row.
    await remove(order[2]!);
    expect(screen.getByRole('checkbox', { name: `Release spirit: ${order[1]}` })).toHaveFocus();

    // Delete the only row: focus goes to the list heading.
    await remove(order[1]!);
    const heading = screen.getByRole('heading', { name: 'Your spirits' });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute('tabindex', '-1');

    // The delete announcement is unchanged.
    expect(screen.getAllByText('Spirit banished').length).toBeGreaterThan(0);
  });
});

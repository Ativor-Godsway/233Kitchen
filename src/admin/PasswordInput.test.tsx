// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './ui';

afterEach(cleanup);

function setup(onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())) {
  render(
    <form onSubmit={onSubmit}>
      <label htmlFor="pw">Password</label>
      <PasswordInput id="pw" autoComplete="current-password" />
      <button type="submit">Log in</button>
    </form>,
  );
  return {
    input: screen.getByLabelText('Password') as HTMLInputElement,
    toggle: () => screen.getByRole('button', { name: /password/i }),
    onSubmit,
  };
}

describe('PasswordInput', () => {
  it('starts hidden with the right autocomplete and an accessible toggle', () => {
    const { input, toggle } = setup();
    expect(input.type).toBe('password');
    expect(input.autocomplete).toBe('current-password');
    expect(toggle()).toHaveProperty('type', 'button');
    expect(toggle().getAttribute('aria-label')).toBe('Show password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().getAttribute('aria-controls')).toBe('pw');
  });

  it('shows and hides the password without submitting the form', async () => {
    const user = userEvent.setup();
    const { input, toggle, onSubmit } = setup();
    await user.click(toggle());
    expect(input.type).toBe('text');
    expect(toggle().getAttribute('aria-label')).toBe('Hide password');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    await user.click(toggle());
    expect(input.type).toBe('password');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    const { input, toggle, onSubmit } = setup();
    await user.click(input);
    await user.tab();
    expect(document.activeElement).toBe(toggle());
    await user.keyboard('{Enter}');
    expect(input.type).toBe('text');
    await user.keyboard(' ');
    expect(input.type).toBe('password');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps focus and the caret position in the input when toggled by pointer', async () => {
    const user = userEvent.setup();
    const { input, toggle } = setup();
    await user.type(input, 'secret-pass');
    input.setSelectionRange(3, 3);
    await user.click(toggle());
    expect(input.type).toBe('text');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
    expect(input.value).toBe('secret-pass');
  });

  it('goes back to hidden after the form is submitted', async () => {
    const user = userEvent.setup();
    const { input, toggle, onSubmit } = setup();
    await user.type(input, 'secret-pass');
    await user.click(toggle());
    expect(input.type).toBe('text');
    fireEvent.submit(input.form!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(input.type).toBe('password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });
});

jest.mock('../net/sshMonitor', () => ({ sshExec: jest.fn() }));
import { shQuote, xdotoolFor } from '../net/sshDesktop';

describe('xdotoolFor', () => {
  it('types plain characters (shift handled by xdotool)', () => {
    expect(xdotoolFor('a')).toBe("xdotool type --clearmodifiers -- 'a'");
    expect(xdotoolFor('!')).toBe("xdotool type --clearmodifiers -- '!'");
    expect(xdotoolFor('+')).toBe("xdotool type --clearmodifiers -- '+'");
  });

  it('quotes characters that are special to the shell', () => {
    expect(xdotoolFor("'")).toBe(`xdotool type --clearmodifiers -- ${shQuote("'")}`);
    expect(shQuote("'")).toBe(`''\\'''`);
  });

  it('sends named keys and combos as keysyms', () => {
    expect(xdotoolFor('Return')).toBe("xdotool key --clearmodifiers 'Return'");
    expect(xdotoolFor('BackSpace')).toBe("xdotool key --clearmodifiers 'BackSpace'");
    expect(xdotoolFor('Ctrl+c')).toBe("xdotool key --clearmodifiers 'ctrl+c'");
    expect(xdotoolFor('Ctrl+Alt+Escape')).toBe("xdotool key --clearmodifiers 'ctrl+alt+Escape'");
    expect(xdotoolFor('Super+a')).toBe("xdotool key --clearmodifiers 'super+a'");
    expect(xdotoolFor('Ctrl+/')).toBe("xdotool key --clearmodifiers 'ctrl+slash'");
  });
});

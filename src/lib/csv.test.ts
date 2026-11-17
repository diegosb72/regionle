import { describe, expect, it } from 'vitest';
import { csvDay, toCsv } from './csv';

describe('a table as a CSV file', () => {
  it('separates cells and ends every line, the last one too', () => {
    expect(toCsv([['Nombre', 'Veces'], ['Zamora', 7]])).toBe('\uFEFFNombre,Veces\r\nZamora,7\r\n');
  });

  it('starts with the mark that tells Excel the text is UTF-8', () => {
    expect(toCsv([['Ávila']]).charCodeAt(0)).toBe(0xfeff);
  });

  it('quotes a cell that holds the separator, a quote or a line break, and doubles the quotes', () => {
    expect(toCsv([['Castilla, la Nueva', 'el "Bierzo"', 'dos\nlíneas', ' margen ']])).toBe('\uFEFF"Castilla, la Nueva","el ""Bierzo""","dos\nlíneas"," margen "\r\n');
  });

  it('with semicolons, as Excel wants them where the comma is the decimal mark, a comma needs no quotes', () => {
    expect(toCsv([['Castilla, la Nueva', 'a;b']], ';')).toBe('\uFEFFCastilla, la Nueva;"a;b"\r\n');
  });

  it('writes a day as year, month and day, and nothing where there is no date', () => {
    expect(csvDay(new Date(2026, 10, 7, 23, 59).getTime())).toBe('2026-11-07');
    expect(csvDay(new Date(2027, 0, 1, 0, 0).getTime())).toBe('2027-01-01');
    expect(csvDay(0)).toBe('');
    expect(csvDay(Infinity)).toBe('');
  });
});

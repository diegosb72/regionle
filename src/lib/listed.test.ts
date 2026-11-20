import { describe, expect, it } from 'vitest';
import { joiner, listed } from './text';

describe('names in a row', () => {
  it('puts the word before the last one, and nothing where there is one name or none', () => {
    expect(listed(['Regiones', 'Países', 'Física'], 'o')).toBe('Regiones, Países o Física');
    expect(listed(['Francia', 'Portugal'], 'y')).toBe('Francia y Portugal');
    expect(listed(['Francia'], 'y')).toBe('Francia');
    expect(listed([], 'y')).toBe('');
  });

  it('writes "e" for "y" before the sound of an i, as Spanish does', () => {
    expect(listed(['Francia', 'Suiza', 'Italia'], 'y')).toBe('Francia, Suiza e Italia');
    expect(listed(['Pakistán', 'Irán'], 'y')).toBe('Pakistán e Irán');
    expect(listed(['Fiyi', 'Islas Salomón'], 'y')).toBe('Fiyi e Islas Salomón');
    expect(listed(['Guanajuato', 'Hidalgo'], 'y')).toBe('Guanajuato e Hidalgo');
    expect(listed(['Saaremaa', 'Hiiumaa'], 'y')).toBe('Saaremaa e Hiiumaa');
    expect(joiner('y', 'Íllimo')).toBe('e');
    // Not before a diphthong, where the i sounds like a consonant, nor before any other letter.
    expect(listed(['nieve', 'hielo'], 'y')).toBe('nieve y hielo');
    expect(listed(['Kioto', 'Hyōgo'], 'y')).toBe('Kioto y Hyōgo');
    expect(listed(['Somalia', 'Yibuti'], 'y')).toBe('Somalia y Yibuti');
    expect(listed(['Italia', 'Francia'], 'y')).toBe('Italia y Francia');
  });

  it('writes "u" for "o" before the sound of an o', () => {
    expect(listed(['Yemen', 'Omán'], 'o')).toBe('Yemen u Omán');
    expect(listed(['Guatemala', 'Honduras'], 'o')).toBe('Guatemala u Honduras');
    expect(listed(['Omán', 'Yemen'], 'o')).toBe('Omán o Yemen');
  });

  it('leaves the words of another language, or any other word, as they come', () => {
    expect(listed(['France', 'Italy'], 'and')).toBe('France and Italy');
    expect(listed(['Yemen', 'Oman'], 'or')).toBe('Yemen or Oman');
    expect(joiner('e', 'Italia')).toBe('e');
    expect(joiner('ni', 'Italia')).toBe('ni');
  });
});

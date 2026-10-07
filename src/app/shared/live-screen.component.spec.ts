import { stripContact } from './live-screen.component';

/** Contact details must never reach the Live Screen through a name or showroom. */
describe('stripContact', () => {
  it('keeps an ordinary name or showroom as it is', () => {
    expect(stripContact('Nur Aisyah')).toBe('Nur Aisyah');
    expect(stripContact('Proton Edar Shah Alam')).toBe('Proton Edar Shah Alam');
  });

  it('removes phone numbers in any common format', () => {
    expect(stripContact('Azri 012-345 6789')).toBe('Azri');
    expect(stripContact('Azri +60123456789')).toBe('Azri');
    expect(stripContact('Call 03 5511 2233 now')).toBe('Call now');
  });

  it('removes links, WhatsApp links and @handles', () => {
    expect(stripContact('Azri wa.me/60123456789')).toBe('Azri');
    expect(stripContact('Showroom https://example.com/promo')).toBe('Showroom');
    expect(stripContact('Showroom www.redline.my')).toBe('Showroom');
    expect(stripContact('Azri @azri.cars')).toBe('Azri');
  });

  it('keeps a model year — four digits are not a phone number', () => {
    expect(stripContact('Showroom 2026')).toBe('Showroom 2026');
  });
});

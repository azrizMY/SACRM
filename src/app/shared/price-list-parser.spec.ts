import { VEHICLES } from '../data/calculator-data';
import { matchRows, parsePriceList, textItemsToLines, undouble } from './price-list-parser';

/** Lines as pdf.js gives them for a real Omoda | Jaecoo price list (J7 2WD). */
const J7_LINES = [
  'JAECOO J7(CKD)',
  '2-WheelDrive(2WD)',
  '1.6cc 194hp 145kW 290Nm',
  'Private Company',
  'PeninsularMalaysia',
  'SellingPrice 138,250.00 138,250.00',
  'RegistrationFee 300.00 500.00',
  'OnTheRoadPricew/oInsurance 138,800.00 139,000.00',
  'RReeccoommemmennddeedSdSuum Im Innssuurreedd 138,100.00 138,300.00',
];

describe('price list parser', () => {
  it('collapses bold text drawn twice', () => {
    expect(undouble('SSuumm IInnssuurreedd 138,100.00')).toBe('Sum Insured 138,100.00');
  });

  it('joins letters set one at a time, and keeps real spaces', () => {
    const items = [
      { str: 'J', width: 5, transform: [1, 0, 0, 1, 10, 100] },
      { str: '7', width: 5, transform: [1, 0, 0, 1, 15, 100] },
      { str: ' ', width: 3, transform: [1, 0, 0, 1, 20, 100] },
      { str: 'AWD', width: 15, transform: [1, 0, 0, 1, 23, 100] },
    ];
    expect(textItemsToLines(items)).toEqual(['J7 AWD']);
  });

  it('reads the Private OTR price and the sum insured', () => {
    const [row] = parsePriceList('Omoda | Jaecoo', J7_LINES, 'JAECOO J7 Price List 2WD (Peninsular Malaysia).pdf');
    expect(row.otr).toBe(138800);
    expect(row.sumInsured).toBe(138100);
  });

  it('matches the row to the right variant', () => {
    const rows = parsePriceList('Omoda | Jaecoo', J7_LINES, 'JAECOO J7 Price List 2WD (Peninsular Malaysia).pdf');
    const { matched, unmatched } = matchRows(rows, VEHICLES.filter((v) => v.brand === 'Omoda | Jaecoo'));
    expect(unmatched.length).toBe(0);
    expect(matched[0].vehicle.id).toBe('jaecoo-j7-2wd');
  });

  it('matches Perodua table rows, telling look-alike variants apart', () => {
    const lines = [
      'MODEL OTR WITHOUT INSURANCE',
      'AXIA 1.0 E 22,000.00',
      'AXIA 1.0 SE 43,000.00',
      'BEZZA 1.0 G (MT) 34,580.00',
      'BEZZA 1.0 G (AT) 36,580.00',
      'MYVI 1.3 G (ASA) 48,500.00',
      'MYVI 1.3 G 46,500.00',
      'ATIVA 1.0T AV 72,600.00',
    ];
    const perodua = VEHICLES.filter((v) => v.brand === 'Perodua');
    const { matched, unmatched } = matchRows(parsePriceList('Perodua', lines), perodua);
    expect(unmatched).toEqual([]);
    expect(matched.map((m) => [m.vehicle.id, m.row.otr])).toEqual([
      ['perodua-axia-1-0-e', 22000],
      ['perodua-axia-1-0-se', 43000],
      ['perodua-bezza-1-0-g-mt', 34580],
      ['perodua-bezza-1-0-g-at', 36580],
      ['perodua-myvi-1-3-g-asa', 48500],
      ['perodua-myvi-1-3-g', 46500],
      ['perodua-ativa-1-0t-av', 72600],
    ]);
  });

  it('lists a row that matches no car as unmatched', () => {
    const { matched, unmatched } = matchRows([{ name: 'JAECOO J9 Something', otr: 1, sumInsured: 1 }], VEHICLES.filter((v) => v.brand === 'Omoda | Jaecoo'));
    expect(matched.length).toBe(0);
    expect(unmatched.length).toBe(1);
  });
});

import {
    stringToBoolean,
    stringToDate,
    stringToLocation,
    stringToNumber,
} from '../../src/services/utilities';

import { parseISO } from 'date-fns';

describe('utilities', () => {
    test('string to bool', () => {
        expect(stringToBoolean('true')).toBe(true);
        expect(stringToBoolean('false')).toBe(false);
        expect(stringToBoolean('True')).toBe(true);
        expect(stringToBoolean('False')).toBe(false);
        expect(stringToBoolean('TRUE')).toBe(true);
        expect(stringToBoolean('FALSE')).toBe(false);
        expect(stringToBoolean('tRuE')).toBe(true);
        expect(stringToBoolean('fAlSe')).toBe(false);
        expect(stringToBoolean('')).toBe(undefined);
        expect(stringToBoolean('anything')).toBe(undefined);
    });

    test('string to number', () => {
        expect(stringToNumber('1')).toBe(1);
        expect(stringToNumber('1.1')).toBe(1.1);
        expect(stringToNumber('1.1.1')).toBe(undefined);
        expect(stringToNumber('')).toBe(undefined);
        expect(stringToNumber('anything')).toBe(undefined);
    });

    test('string to date', () => {
        expect(stringToDate('2021-01-01')).toEqual(parseISO('2021-01-01'));
        expect(stringToDate('2021-01-32')).toBe(undefined);
        expect(stringToDate('')).toBe(undefined);
        expect(stringToDate('anything')).toBe(undefined);
    });

    test('string to location', () => {
        expect(stringToLocation('location')).toBe('location');
        expect(stringToLocation('')).toBe('');
        expect(stringToLocation('anything')).toBe('anything');
    });
});

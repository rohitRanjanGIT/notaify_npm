/**
 * Tests for notaifyHandler() — async handler wrapper
 */

import { notaifyHandler } from '../src/handler';
import { init, _reset } from '../src/notaify';
import * as sender from '../src/sender';

jest.mock('../src/sender', () => ({
    resolveServerUrl: jest.fn((url?: string) => url ?? 'https://test.notaify.vercel.app/ingest'),
    sendPayload: jest.fn().mockResolvedValue(true),
}));

const mockedSender = sender as jest.Mocked<typeof sender>;

describe('notaifyHandler()', () => {
    beforeEach(() => {
        _reset();
        jest.clearAllMocks();
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });
    });

    it('should return the result of a successful handler', async () => {
        const handler = notaifyHandler(async () => {
            return { data: 'ok' };
        });

        const result = await handler();
        expect(result).toEqual({ data: 'ok' });
        expect(mockedSender.sendPayload).not.toHaveBeenCalled();
    });

    it('should capture and re-throw on handler error', async () => {
        const handler = notaifyHandler(async () => {
            throw new Error('handler boom');
        });

        await expect(handler()).rejects.toThrow('handler boom');
        expect(mockedSender.sendPayload).toHaveBeenCalledTimes(1);

        const [, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(payload.error).toBe('handler boom');
        expect(payload.context).toEqual({ source: 'notaifyHandler' });
    });

    it('should pass through all arguments to the wrapped function', async () => {
        const handler = notaifyHandler(async (a: number, b: string) => {
            return `${a}-${b}`;
        });

        const result = await handler(42, 'hello');
        expect(result).toBe('42-hello');
    });

    it('should preserve function.length', () => {
        const original = async (_req: any, _res: any, _next: any) => { };
        const wrapped = notaifyHandler(original);
        expect(wrapped.length).toBe(original.length);
    });

    it('should work even if sender fails (error still re-thrown)', async () => {
        mockedSender.sendPayload.mockRejectedValueOnce(new Error('network'));

        const handler = notaifyHandler(async () => {
            throw new Error('still throws');
        });

        await expect(handler()).rejects.toThrow('still throws');
    });
});

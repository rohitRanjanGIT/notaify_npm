/**
 * Tests for the core notaify singleton: init(), capture(), isInitialized()
 */

import { init, capture, isInitialized, _reset, getConfig } from '../src/notaify';
import * as sender from '../src/sender';

// Mock the sender so no real HTTP calls are made
jest.mock('../src/sender', () => ({
    resolveServerUrl: jest.fn((url?: string) => url ?? 'https://test.notaify.in/api/package/nodexp/ingest'),
    sendPayload: jest.fn().mockResolvedValue(true),
}));

const mockedSender = sender as jest.Mocked<typeof sender>;

describe('notaify.init()', () => {
    beforeEach(() => {
        _reset();
        jest.clearAllMocks();
    });

    it('should throw if apiKeyId is missing', () => {
        expect(() =>
            init({ apiKeyId: '', apiKey: 'secret' }),
        ).toThrow('"apiKeyId" is required');
    });

    it('should throw if apiKey is missing', () => {
        expect(() =>
            init({ apiKeyId: 'key-id', apiKey: '' }),
        ).toThrow('"apiKey" is required');
    });

    it('should initialise successfully with valid config', () => {
        expect(isInitialized()).toBe(false);

        init({ apiKeyId: 'key-id', apiKey: 'secret' });

        expect(isInitialized()).toBe(true);

        const config = getConfig();
        expect(config).not.toBeNull();
        expect(config!.apiKeyId).toBe('key-id');
        expect(config!.apiKey).toBe('secret');
        expect(config!.environment).toBe('production');
        expect(config!.silent).toBe(false);
    });

    it('should apply default values', () => {
        init({ apiKeyId: 'id', apiKey: 'key' });

        const config = getConfig()!;
        expect(config.environment).toBe('production');
        expect(config.silent).toBe(false);
        expect(config.appName).toBeUndefined();
    });

    it('should allow custom environment and appName', () => {
        init({
            apiKeyId: 'id',
            apiKey: 'key',
            environment: 'staging',
            appName: 'My App',
        });

        const config = getConfig()!;
        expect(config.environment).toBe('staging');
        expect(config.appName).toBe('My App');
    });

    it('should warn when init() is called more than once', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        init({ apiKeyId: 'id', apiKey: 'key' });
        init({ apiKeyId: 'id2', apiKey: 'key2' });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Notaify]'),
            expect.stringContaining('init() called more than once'),
        );

        warnSpy.mockRestore();
    });

    it('should log success message unless silent', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        init({ apiKeyId: 'id', apiKey: 'key' });
        expect(logSpy).toHaveBeenCalledWith('[Notaify]', 'Initialized successfully.');

        logSpy.mockRestore();
    });

    it('should NOT log when silent is true', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        init({ apiKeyId: 'id', apiKey: 'key', silent: true });
        expect(logSpy).not.toHaveBeenCalled();

        logSpy.mockRestore();
    });
});

describe('notaify.capture()', () => {
    beforeEach(() => {
        _reset();
        jest.clearAllMocks();
    });

    it('should warn and return if not initialised', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        await capture(new Error('test'));

        expect(warnSpy).toHaveBeenCalledWith(
            '[Notaify] Not initialized. Call notaify.init() first.',
        );
        expect(mockedSender.sendPayload).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('should send a correctly shaped payload for an Error', async () => {
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });

        const err = new Error('Something broke');
        await capture(err);

        expect(mockedSender.sendPayload).toHaveBeenCalledTimes(1);

        const [url, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(url).toContain('notaify');
        expect(payload.apiKeyId).toBe('id');
        expect(payload.apiKey).toBe('key');
        expect(payload.error).toBe('Something broke');
        expect(payload.stack).toBeDefined();
        expect(payload.meta.environment).toBe('production');
        expect(payload.meta.nodeVersion).toBe(process.version);
    });

    it('should handle string errors', async () => {
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });

        await capture('plain string error');

        const [, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(payload.error).toBe('plain string error');
        expect(payload.stack).toBeUndefined();
    });

    it('should handle unknown error types', async () => {
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });

        await capture({ code: 42 });

        const [, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(payload.error).toBe('{"code":42}');
    });

    it('should include context in the payload', async () => {
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });

        await capture(new Error('ctx test'), { userId: '123', route: '/api/test' });

        const [, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(payload.context).toEqual({ userId: '123', route: '/api/test' });
    });

    it('should NOT throw when sender fails', async () => {
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });
        mockedSender.sendPayload.mockResolvedValueOnce(false);

        // Should not reject
        await expect(capture(new Error('fail test'))).resolves.toBeUndefined();
    });

    it('should NOT throw when sender throws', async () => {
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });
        mockedSender.sendPayload.mockRejectedValueOnce(new Error('network down'));

        await expect(capture(new Error('throw test'))).resolves.toBeUndefined();
    });
});

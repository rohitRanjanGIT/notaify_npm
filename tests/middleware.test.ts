/**
 * Tests for notaifyMiddleware() — Express & Fastify error middleware
 */

import { notaifyMiddleware } from '../src/middleware';
import { init, _reset } from '../src/notaify';
import * as sender from '../src/sender';

jest.mock('../src/sender', () => ({
    resolveServerUrl: jest.fn((url?: string) => url ?? 'https://test.notaify.vercel.app/ingest'),
    sendPayload: jest.fn().mockResolvedValue(true),
}));

const mockedSender = sender as jest.Mocked<typeof sender>;

describe('notaifyMiddleware() — Express', () => {
    beforeEach(() => {
        _reset();
        jest.clearAllMocks();
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });
    });

    it('should have 4 parameters (Express error middleware signature)', () => {
        const mw = notaifyMiddleware();
        expect(mw.length).toBe(4);
    });

    it('should capture the error and call next(err)', () => {
        const mw = notaifyMiddleware();
        const err = new Error('express error');
        const req = { originalUrl: '/test', method: 'GET' };
        const res = {};
        const next = jest.fn();

        mw(err, req, res, next);

        // next(err) should be called synchronously (fire-and-forget capture)
        expect(next).toHaveBeenCalledWith(err);

        // sender should have been called (capture starts synchronously)
        expect(mockedSender.sendPayload).toHaveBeenCalledTimes(1);
        const [, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(payload.error).toBe('express error');
        expect(payload.context?.url).toBe('/test');
        expect(payload.context?.method).toBe('GET');
        expect(payload.context?.source).toBe('notaifyMiddleware:express');
    });

    it('should still call next(err) even if sender fails', () => {
        mockedSender.sendPayload.mockRejectedValueOnce(new Error('network'));

        const mw = notaifyMiddleware();
        const err = new Error('resilience test');
        const next = jest.fn();

        mw(err, {}, {}, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

describe('notaifyMiddleware() — Fastify', () => {
    beforeEach(() => {
        _reset();
        jest.clearAllMocks();
        init({ apiKeyId: 'id', apiKey: 'key', silent: true });
    });

    it('should capture the error and send a 500 response', async () => {
        const mw = notaifyMiddleware({ framework: 'fastify' });
        const err = new Error('fastify error');
        const request = { url: '/api/data', method: 'POST' };
        const reply = {
            sent: false,
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await mw(err, request, reply);

        expect(mockedSender.sendPayload).toHaveBeenCalledTimes(1);
        const [, payload] = mockedSender.sendPayload.mock.calls[0];
        expect(payload.error).toBe('fastify error');
        expect(payload.context?.source).toBe('notaifyMiddleware:fastify');

        expect(reply.status).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });

    it('should not send if reply is already sent', async () => {
        const mw = notaifyMiddleware({ framework: 'fastify' });
        const err = new Error('already sent');
        const reply = {
            sent: true,
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await mw(err, {}, reply);

        expect(reply.status).not.toHaveBeenCalled();
        expect(reply.send).not.toHaveBeenCalled();
    });
});

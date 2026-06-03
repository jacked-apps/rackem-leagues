/**
 * @fileoverview Tests for the chain runtime.
 *
 * Covers the scenarios listed in
 * docs/plans/2026-06-03-001-refactor-threshold-math-modular-plan.md
 * Unit 1:
 * - Empty chain → empty bag, no throws
 * - One module writes a key → bag has that key
 * - Three modules in order → each sees prior writes
 * - One module throws → others continue, bag has successful writes
 * - Async module → awaited correctly; downstream sees its writes
 * - Sync module → runs synchronously; no unhandled promise
 *
 * Plus a defensive case for async-throw behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSystemChain } from '../runSystemChain';
import type { Context, Module } from '../types';

describe('runSystemChain', () => {
  let context: Context;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    context = {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('empty chain returns empty bag without throwing or warning', async () => {
    const bag = await runSystemChain([], context);
    expect(bag).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('one module that writes a key produces a bag with that key', async () => {
    const writeFoo: Module = {
      name: 'writeFoo',
      run: (bag) => {
        bag.foo = 42;
      },
    };
    const bag = await runSystemChain([writeFoo], context);
    expect(bag.foo).toBe(42);
  });

  it('three modules in order — each sees prior writes', async () => {
    const chain: Module[] = [
      {
        name: 'seed',
        run: (bag) => {
          bag.a = 1;
        },
      },
      {
        name: 'addB',
        run: (bag) => {
          bag.b = (bag.a as number) + 1;
        },
      },
      {
        name: 'addC',
        run: (bag) => {
          bag.c = (bag.b as number) + 1;
        },
      },
    ];
    const bag = await runSystemChain(chain, context);
    expect(bag).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('one module throws — others still run, bag has successful writes', async () => {
    const chain: Module[] = [
      {
        name: 'writesX',
        run: (bag) => {
          bag.x = 'before';
        },
      },
      {
        name: 'throws',
        run: () => {
          throw new Error('boom');
        },
      },
      {
        name: 'writesY',
        run: (bag) => {
          bag.y = 'after';
        },
      },
    ];
    const bag = await runSystemChain(chain, context);
    expect(bag).toEqual({ x: 'before', y: 'after' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('throws'),
      expect.any(Error),
    );
  });

  it('async module is awaited — downstream module sees its writes', async () => {
    const chain: Module[] = [
      {
        name: 'asyncSeed',
        run: async (bag) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          bag.value = 'async-write';
        },
      },
      {
        name: 'readsAsyncValue',
        run: (bag) => {
          bag.echoed = bag.value;
        },
      },
    ];
    const bag = await runSystemChain(chain, context);
    expect(bag.value).toBe('async-write');
    expect(bag.echoed).toBe('async-write');
  });

  it('sync module runs synchronously without leaking a promise', async () => {
    let ran = false;
    const sync: Module = {
      name: 'sync',
      run: (bag) => {
        ran = true;
        bag.ok = true;
      },
    };
    const bag = await runSystemChain([sync], context);
    expect(ran).toBe(true);
    expect(bag.ok).toBe(true);
  });

  it('async module that throws — logged, runtime still continues', async () => {
    const chain: Module[] = [
      {
        name: 'asyncThrows',
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          throw new Error('async-boom');
        },
      },
      {
        name: 'after',
        run: (bag) => {
          bag.after = true;
        },
      },
    ];
    const bag = await runSystemChain(chain, context);
    expect(bag).toEqual({ after: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('asyncThrows'),
      expect.any(Error),
    );
  });

  it('module receives the context object passed to runSystemChain', async () => {
    const received: Context[] = [];
    const ctx: Context = { matchId: 'm-123', foo: 'bar' };
    const inspector: Module = {
      name: 'inspector',
      run: (_bag, c) => {
        received.push(c);
      },
    };
    await runSystemChain([inspector], ctx);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(ctx);
  });
});

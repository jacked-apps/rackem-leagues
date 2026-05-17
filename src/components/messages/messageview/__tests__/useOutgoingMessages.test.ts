/**
 * @fileoverview Tests for the useOutgoingMessages hook.
 *
 * The hook owns the local state for in-flight + failed sends (Unit 8's
 * inline pattern). These tests pin the lifecycle of one or more
 * outgoing entries through the addPending → mark{Failed,Pending} →
 * remove transitions consumers will use.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOutgoingMessages } from '../useOutgoingMessages';

describe('useOutgoingMessages', () => {
  it('starts with an empty outgoing list', () => {
    const { result } = renderHook(() => useOutgoingMessages());
    expect(result.current.outgoing).toEqual([]);
  });

  it('addPending appends a `sending` entry and returns a unique clientId', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    let id1 = '';
    let id2 = '';
    act(() => {
      id1 = result.current.addPending('first');
    });
    act(() => {
      id2 = result.current.addPending('second');
    });

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(result.current.outgoing).toHaveLength(2);
    expect(result.current.outgoing[0]).toMatchObject({
      clientId: id1,
      content: 'first',
      status: 'sending',
    });
    expect(result.current.outgoing[1]).toMatchObject({
      clientId: id2,
      content: 'second',
      status: 'sending',
    });
  });

  it('markFailed flips status and stores the error', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    let id = '';
    act(() => {
      id = result.current.addPending('hello');
    });
    act(() => {
      result.current.markFailed(id, 'Network offline');
    });

    expect(result.current.outgoing).toHaveLength(1);
    expect(result.current.outgoing[0]).toMatchObject({
      clientId: id,
      status: 'failed',
      errorMessage: 'Network offline',
    });
  });

  it('markPending clears the prior failure on retry', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    let id = '';
    act(() => {
      id = result.current.addPending('hello');
    });
    act(() => {
      result.current.markFailed(id, 'first error');
    });
    act(() => {
      result.current.markPending(id);
    });

    expect(result.current.outgoing[0]).toMatchObject({
      clientId: id,
      status: 'sending',
    });
    expect(result.current.outgoing[0].errorMessage).toBeUndefined();
  });

  it('remove deletes only the requested entry, preserving order of the rest', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    let ids: string[] = [];
    act(() => {
      ids = [
        result.current.addPending('a'),
        // addPending uses a closure on the latest state, so each call sees
        // the previous one. Wrap each in its own act to keep the order
        // deterministic across renderers.
      ];
    });
    act(() => {
      ids.push(result.current.addPending('b'));
    });
    act(() => {
      ids.push(result.current.addPending('c'));
    });

    act(() => {
      result.current.remove(ids[1]); // remove 'b'
    });

    expect(result.current.outgoing.map((m) => m.content)).toEqual(['a', 'c']);
  });

  // Unit 17: removeByMatch is what MessageView calls when the realtime
  // push delivers a confirmed copy of an in-flight message. Eliminates
  // the brief double-render (pending bubble + confirmed bubble briefly
  // coexist) on the sender side.
  it('removeByMatch removes every entry the predicate matches', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    act(() => {
      result.current.addPending('keep me');
    });
    act(() => {
      result.current.addPending('drop me');
    });
    act(() => {
      result.current.addPending('also drop me');
    });

    act(() => {
      result.current.removeByMatch((entry) => entry.content.startsWith('drop') || entry.content.startsWith('also'));
    });

    expect(result.current.outgoing.map((m) => m.content)).toEqual(['keep me']);
  });

  it('removeByMatch with a never-true predicate leaves the list unchanged', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    act(() => {
      result.current.addPending('one');
    });
    act(() => {
      result.current.addPending('two');
    });
    const before = result.current.outgoing;

    act(() => {
      result.current.removeByMatch(() => false);
    });

    expect(result.current.outgoing).toEqual(before);
  });

  it('markFailed and markPending on an unknown clientId are no-ops', () => {
    const { result } = renderHook(() => useOutgoingMessages());

    act(() => {
      result.current.addPending('only one');
    });
    const before = result.current.outgoing;

    act(() => {
      result.current.markFailed('not-a-real-id', 'boom');
      result.current.markPending('also-not-real');
      result.current.remove('still-not-real');
    });

    expect(result.current.outgoing).toEqual(before);
  });
});

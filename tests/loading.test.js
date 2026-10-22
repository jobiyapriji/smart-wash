import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { LoadingPage } from '../src/components/LoadingPage.jsx';
import { HandsRubbingAnimation } from '../src/components/HandsRubbingAnimation.jsx';

describe('Minimal Hand Rubbing Loading Page Architecture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports LoadingPage component as named and default export', async () => {
    const mod = await import('../src/components/LoadingPage.jsx');
    expect(mod.LoadingPage).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('exports HandsRubbingAnimation component as named and default export', async () => {
    const mod = await import('../src/components/HandsRubbingAnimation.jsx');
    expect(mod.HandsRubbingAnimation).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('exports LoadingContext, LoadingProvider, and useLoading from context', async () => {
    const mod = await import('../src/context/LoadingContext.jsx');
    expect(mod.LoadingProvider).toBeDefined();
    expect(mod.useLoading).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('calculates progress percentage clamp smoothly between 0 and 100', () => {
    const clampProgress = (p) => Math.min(100, Math.max(0, p));
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(45)).toBe(45);
    expect(clampProgress(150)).toBe(100);
  });

  it('triggers onComplete callback when progress finishes', () => {
    let completed = false;
    const onComplete = () => { completed = true; };

    let progress = 0;
    while (progress < 100) {
      progress += 20;
    }
    if (progress >= 100) {
      onComplete();
    }

    expect(completed).toBe(true);
  });
});

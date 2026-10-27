import { describe, expect, it } from 'vitest';
import { findToolBySlug, liveTools, tools } from './registry';
import type { ToolDefinition } from './types';

describe('tools registry', () => {
  it('has unique ids and slugs', () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
    expect(new Set(tools.map((t) => t.slug)).size).toBe(tools.length);
  });

  it('uses URL-safe lowercase slugs', () => {
    for (const tool of tools) expect(tool.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('gives every tool the copy the UI needs', () => {
    for (const tool of tools) {
      expect(tool.name.trim()).not.toBe('');
      expect(tool.tagline.trim()).not.toBe('');
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it('requires a page loader for live tools and none for coming-soon tools', () => {
    for (const tool of tools) {
      if (tool.status === 'live') expect(tool.load, tool.id).toBeTypeOf('function');
      else expect(tool.load, tool.id).toBeUndefined();
    }
  });

  it('gives every live tool a search-friendly title, a guide and its own FAQ', () => {
    for (const tool of liveTools()) {
      // Search results cut titles at about 60 characters, and the brand goes last.
      expect(tool.seoTitle?.length, tool.id).toBeLessThanOrEqual(60);
      expect(tool.seoTitle?.endsWith(`| ${tool.name}`), tool.id).toBe(true);
      expect(tool.guide?.steps.length, tool.id).toBeGreaterThanOrEqual(2);
      expect(tool.faq?.length, tool.id).toBeGreaterThan(0);
    }
  });

  it('lists PDFold, PicFold, SnapPages, EzQR, then ReelBack', () => {
    expect(tools.map((t) => t.name)).toEqual([
      'PDFold',
      'PicFold',
      'SnapPages',
      'EzQR',
      'ReelBack',
    ]);
    expect(liveTools().map((t) => t.id)).toEqual([
      'pdfold',
      'picfold',
      'snappages',
      'ezqr',
      'reelback',
    ]);
  });

  it('finds live tools by slug only', () => {
    expect(findToolBySlug('pdfold')?.name).toBe('PDFold');
    expect(findToolBySlug('picfold')?.name).toBe('PicFold');
    expect(findToolBySlug('snappages')?.name).toBe('SnapPages');
    expect(findToolBySlug('ezqr')?.name).toBe('EzQR');
    expect(findToolBySlug('reelback')?.name).toBe('ReelBack');
    expect(findToolBySlug('nope')).toBeUndefined();
  });

  it('never routes to a planned (status "soon") tool', () => {
    const planned: ToolDefinition = {
      id: 'planned',
      slug: 'planned',
      name: 'Planned',
      tagline: 'Not built yet.',
      description: 'A tool that is announced but has no page yet.',
      icon: 'file',
      status: 'soon',
    };
    expect(liveTools([...tools, planned])).toEqual(liveTools());
    expect(findToolBySlug('planned', [...tools, planned])).toBeUndefined();
  });

  it('accepts a custom list, so adding a tool is one registry entry', () => {
    const extra: ToolDefinition = {
      id: 'demo',
      slug: 'demo',
      name: 'Demo',
      tagline: 'A demo.',
      description: 'A demo tool used in a test.',
      icon: 'file',
      status: 'live',
      load: () => Promise.resolve({ mount: () => undefined }),
    };
    expect(findToolBySlug('demo', [...tools, extra])).toBe(extra);
    expect(liveTools([...tools, extra])).toEqual([...liveTools(), extra]);
  });
});

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

  it('requires SEO keywords for live tools', () => {
    for (const tool of liveTools()) expect(tool.keywords.length, tool.id).toBeGreaterThan(0);
  });

  it('lists PDFold, PicFold, then EzQR', () => {
    expect(tools.map((t) => t.name)).toEqual(['PDFold', 'PicFold', 'EzQR']);
    expect(liveTools().map((t) => t.id)).toEqual(['pdfold', 'picfold', 'ezqr']);
  });

  it('finds live tools by slug only', () => {
    expect(findToolBySlug('pdfold')?.name).toBe('PDFold');
    expect(findToolBySlug('picfold')?.name).toBe('PicFold');
    expect(findToolBySlug('ezqr')?.name).toBe('EzQR');
    expect(findToolBySlug('nope')).toBeUndefined();
  });

  it('never routes to a planned (status "soon") tool', () => {
    const planned: ToolDefinition = {
      id: 'planned',
      slug: 'planned',
      name: 'Planned',
      tagline: 'Not built yet.',
      description: 'A tool that is announced but has no page yet.',
      keywords: [],
      icon: 'file',
      status: 'soon',
    };
    expect(liveTools([...tools, planned]).map((t) => t.id)).toEqual(['pdfold', 'picfold', 'ezqr']);
    expect(findToolBySlug('planned', [...tools, planned])).toBeUndefined();
  });

  it('accepts a custom list, so adding a tool is one registry entry', () => {
    const extra: ToolDefinition = {
      id: 'demo',
      slug: 'demo',
      name: 'Demo',
      tagline: 'A demo.',
      description: 'A demo tool used in a test.',
      keywords: ['demo'],
      icon: 'file',
      status: 'live',
      load: () => Promise.resolve({ mount: () => undefined }),
    };
    expect(findToolBySlug('demo', [...tools, extra])).toBe(extra);
    expect(liveTools([...tools, extra]).map((t) => t.id)).toEqual([
      'pdfold',
      'picfold',
      'ezqr',
      'demo',
    ]);
  });
});

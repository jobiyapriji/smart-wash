import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { IconBadge } from '../src/components/ui/IconBadge.jsx';
import { Sparkles, Search, HandMetal, Users, User, Volume2 } from 'lucide-react';

describe('IconBadge Component', () => {
  it('renders Lucide React forwardRef icons properly without throwing object-as-child error', () => {
    // These are the exact icons used in StudentApp and other views
    const icons = [Sparkles, Search, HandMetal, Users, User];

    icons.forEach(IconComp => {
      expect(() => {
        const html = renderToString(<IconBadge icon={IconComp} color="violet" size="lg" shape="arch" />);
        expect(html).toContain('icon-badge');
        expect(html).toContain('svg');
      }).not.toThrow();
    });
  });

  it('renders pre-instantiated React elements properly', () => {
    expect(() => {
      const html = renderToString(<IconBadge icon={<Volume2 size={28} strokeWidth={2.5} />} color="pink" size="lg" shape="circle" />);
      expect(html).toContain('icon-badge');
      expect(html).toContain('svg');
    }).not.toThrow();
  });

  it('renders children fallback if no icon prop is passed', () => {
    const html = renderToString(
      <IconBadge color="amber">
        <span id="child-elem">Hello</span>
      </IconBadge>
    );
    expect(html).toContain('Hello');
  });
});

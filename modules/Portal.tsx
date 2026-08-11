import React from 'react';
import { createPortal } from 'react-dom';

// Renders its children into document.body instead of wherever this
// component sits in the React tree. Every full-screen "fixed inset-0"
// modal in this app is meant to cover the *entire* viewport, but several
// of them live inside Operations' <main className="... overflow-hidden">
// content column — and `overflow: hidden` on an ancestor clips a
// position:fixed descendant to that ancestor's box regardless of the
// fixed element's own positioning, so those modals were only ever
// covering the main content area, not the sidebar (visible as a
// glassmorphism backdrop that stopped short of the left nav). Portaling
// to <body> sidesteps the clipping ancestor entirely — React's component
// state/handlers are unaffected, only where the DOM node physically lives
// changes.
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

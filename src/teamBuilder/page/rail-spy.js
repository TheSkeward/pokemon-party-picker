/**
 * @fileoverview Marks, on the team rail, the section the reader is in.
 */
import { TEAM_RAIL_SECTIONS, currentRailSection } from '../team-builder-view.js';

/**
 * @param {!Element} root The page; a render replaces the rail in it.
 * @return {{wire: function(), stop: function()}} `wire` attaches the spy
 *     to the rail now in the page. Call it after each render: it retires
 *     the listener it set up before, so one scroll listener is live at a
 *     time. `stop` retires it for good.
 */
export function createRailSpy(root) {
  let teardown = null;

  const stop = () => teardown?.();

  function wire() {
    stop();
    const rail = root.querySelector('.team-rail');
    if (!rail) return;
    // Measured once per frame however often the page scrolls.
    let frame = 0;
    const mark = () => {
      frame = 0;
      const railBottom = rail.getBoundingClientRect().bottom;
      const sections = TEAM_RAIL_SECTIONS.flatMap((id) => {
        const element = root.querySelector(`#${id}`);
        return element
          ? [{ id, top: element.getBoundingClientRect().top }]
          : [];
      });
      const current = currentRailSection(sections, railBottom);
      rail.querySelectorAll('a[href^="#"]').forEach((link) => {
        if (link.getAttribute('href') === `#${current}`) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(mark);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    mark();
    teardown = () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      teardown = null;
    };
  }

  return { wire, stop };
}

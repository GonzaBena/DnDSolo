/** Which section of the guide is being read, from the sections' tops relative
    to the viewport (in document order): the last one whose top reached the
    upper third of the screen. At the bottom of the page it is the last
    section, which may be too short to ever reach that line. -1 without sections. */
export function currentSection(tops: number[], viewportHeight: number, atBottom: boolean): number {
  if (tops.length === 0) return -1;
  if (atBottom) return tops.length - 1;
  const line = viewportHeight / 3;
  let current = 0;
  tops.forEach((top, index) => {
    if (top <= line) current = index;
  });
  return current;
}

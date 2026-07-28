/**
 * The Rod of Asclepius, lifted out of the CA monogram (see brand.tsx).
 *
 * The full logo is a wide two-colour letterform — shrunk into a 32px favicon
 * it collapses into a smudge. So the app's icons reduce the mark to the one
 * element that survives at that size, in the same two brand colours.
 *
 * Lives here rather than in src/app/icon.tsx because Next's metadata file
 * conventions (icon/apple-icon) own their module's exports; adding a second
 * export there, and importing it across route files, breaks the build.
 */
export function Rod({ px = 20 }: { px?: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5v17" stroke="white" strokeWidth={2.1} strokeLinecap="round" />
      <path
        d="M12 6.6c3.5.9 3.5 3.1 0 4s-3.5 3.1 0 4 3.5 3.1 0 4"
        stroke="#ed1b24"
        strokeWidth={2.1}
        strokeLinecap="round"
      />
      <circle cx={12} cy={4} r={2.3} fill="#ed1b24" />
    </svg>
  );
}

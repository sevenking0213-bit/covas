export const sampleImages = [
  {
    id: 'sample-original',
    title: 'Original',
    kind: 'original' as const,
    src: '/firstclaw-reference-cat.png',
    sessionImageId: 'sample-original',
  },
  {
    id: 'sample-variation',
    title: 'Variation',
    kind: 'generated' as const,
    src: '/firstclaw-reference-cat.png',
    sessionImageId: 'sample-variation',
    parentImageId: 'sample-original',
  },
];

import type { PropsWithChildren } from 'react';

function DivWrapper(props: PropsWithChildren<Record<string, unknown>>) {
  return <div>{props.children}</div>;
}

export const Stage = DivWrapper;
export const Layer = DivWrapper;
export const Group = DivWrapper;
export const Line = DivWrapper;
export const Rect = DivWrapper;
export const Ellipse = DivWrapper;
export const Arrow = DivWrapper;
export const Circle = DivWrapper;
export const Image = DivWrapper;
export const Text = DivWrapper;
export const Transformer = DivWrapper;

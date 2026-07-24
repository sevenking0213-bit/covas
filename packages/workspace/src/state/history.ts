export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function createHistoryState<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function pushHistoryState<T>(history: HistoryState<T>, next: T): HistoryState<T> {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

export function undoHistoryState<T>(history: HistoryState<T>): HistoryState<T> {
  const previous = history.past.at(-1);

  if (previous === undefined) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistoryState<T>(history: HistoryState<T>): HistoryState<T> {
  const next = history.future[0];

  if (next === undefined) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

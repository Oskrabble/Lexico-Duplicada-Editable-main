import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface DragInfo {
  type: 'rack' | 'board';
  rackIndex?: number;
  row?: number;
  col?: number;
  letter: string;
  isBlank: boolean;
  blankLetter?: string;
}

interface DragState extends DragInfo {
  x: number;
  y: number;
  startX: number;
  startY: number;
  started: boolean;
}

export interface DropTarget {
  type: 'rack' | 'board';
  rackIndex?: number;
  row?: number;
  col?: number;
}

const DRAG_THRESHOLD = 5;

export function useTileDrag(callbacks: {
  onDropRackToBoard: (row: number, col: number, rackIndex: number) => void;
  onDropBoardToBoard: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  onDropBoardToRack: (row: number, col: number) => void;
  onDropRackToRack: (fromIndex: number, toIndex: number) => void;
}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragEndedRef = useRef(false);
  const dragEndedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findDropTarget = useCallback((x: number, y: number): DropTarget | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const rackEl = el.closest('[data-drop-rack]');
    if (rackEl) {
      const idx = parseInt(rackEl.getAttribute('data-drop-rack')!, 10);
      return { type: 'rack', rackIndex: idx };
    }
    const boardEl = el.closest('[data-drop-board]');
    if (boardEl) {
      const [row, col] = boardEl.getAttribute('data-drop-board')!.split(',').map(Number);
      return { type: 'board', row, col };
    }
    return null;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (!drag.started) {
      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
      drag.started = true;
    }

    drag.x = e.clientX;
    drag.y = e.clientY;
    setDragState({ ...drag });
    setDropTarget(findDropTarget(e.clientX, e.clientY));
  }, [findDropTarget]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);

    if (!drag || !drag.started) {
      setDragState(null);
      setDropTarget(null);
      return;
    }

    dragEndedRef.current = true;
    if (dragEndedTimeoutRef.current) clearTimeout(dragEndedTimeoutRef.current);
    dragEndedTimeoutRef.current = setTimeout(() => {
      dragEndedRef.current = false;
    }, 50);

    const target = findDropTarget(e.clientX, e.clientY);
    const cb = callbacksRef.current;
    if (target) {
      if (drag.type === 'rack' && target.type === 'board') {
        cb.onDropRackToBoard(target.row!, target.col!, drag.rackIndex!);
      } else if (drag.type === 'board' && target.type === 'board') {
        if (drag.row !== target.row || drag.col !== target.col) {
          cb.onDropBoardToBoard(drag.row!, drag.col!, target.row!, target.col!);
        }
      } else if (drag.type === 'board' && target.type === 'rack') {
        cb.onDropBoardToRack(drag.row!, drag.col!);
      } else if (drag.type === 'rack' && target.type === 'rack') {
        if (drag.rackIndex !== target.rackIndex) {
          cb.onDropRackToRack(drag.rackIndex!, target.rackIndex!);
        }
      }
    }

    setDragState(null);
    setDropTarget(null);
  }, [findDropTarget, handlePointerMove]);

  const startDrag = useCallback((e: ReactPointerEvent, info: DragInfo) => {
    if (dragEndedTimeoutRef.current) clearTimeout(dragEndedTimeoutRef.current);
    const drag: DragState = {
      ...info,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
    };
    dragRef.current = drag;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  const consumeDragEnded = useCallback(() => {
    if (dragEndedRef.current) {
      dragEndedRef.current = false;
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      if (dragEndedTimeoutRef.current) clearTimeout(dragEndedTimeoutRef.current);
    };
  }, [handlePointerMove, handlePointerUp]);

  return { dragState, dropTarget, startDrag, consumeDragEnded };
}

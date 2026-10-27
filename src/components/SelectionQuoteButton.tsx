import { Quote } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../lib/i18n.ts";
import "./SelectionQuoteButton.css";

const GAP = 6;
const EDGE = 4;

type Spot = { left: number; top: number };

/**
 * "Quote in message" floated over the live selection. It reads the selection's rect itself and
 * follows it through scroll and resize. Above the selection by default; below it when there is no
 * room above, or on a touch screen, where the OS draws its own menu above.
 */
export function SelectionQuoteButton({ below, onQuote }: { below: boolean; onQuote: () => void }) {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  const place = (): void => {
    const selection = getSelection();
    const button = ref.current;
    if (!button || !selection || selection.rangeCount === 0) { setSpot((prev) => (prev === null ? prev : null)); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = button;
    if (rect.width === 0 && rect.height === 0) { setSpot((prev) => (prev === null ? prev : null)); return; }
    const wantsAbove = !below && rect.top - GAP - height >= EDGE;
    const top = wantsAbove ? rect.top - GAP - height : rect.bottom + GAP;
    const left = rect.left + rect.width / 2 - width / 2;
    const next = {
      left: Math.round(Math.max(EDGE, Math.min(left, innerWidth - width - EDGE))),
      top: Math.round(Math.max(EDGE, Math.min(top, innerHeight - height - EDGE))),
    };
    setSpot((prev) => (prev !== null && prev.left === next.left && prev.top === next.top ? prev : next));
  };

  useLayoutEffect(place);
  useEffect(() => {
    let frame = 0;
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(() => { frame = 0; place(); });
    };
    // capture: the transcript scrolls in its own box, and scroll does not bubble
    addEventListener("scroll", schedule, true);
    addEventListener("resize", schedule);
    document.addEventListener("selectionchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule, true);
      removeEventListener("resize", schedule);
      document.removeEventListener("selectionchange", schedule);
    };
  }, [below]);

  return createPortal(
    <button ref={ref} type="button" className="selection-quote" style={spot === null ? { visibility: "hidden" } : spot}
      onMouseDown={(event) => { event.preventDefault(); }} onClick={onQuote}>
      <Quote aria-hidden="true" />{t("Quote in message")}
    </button>,
    document.body,
  );
}

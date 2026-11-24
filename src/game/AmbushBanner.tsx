import { groupArrivals, type ArrivalGroup } from "../domain/arrivals";
import type { Arrival } from "../domain/types";
import { NpcAvatar } from "./NpcAvatar";
import { TopBanner } from "./TopBanner";

const SHOWN_MS = 2500;

/** At most `max` places in the row: past that, the last place becomes a
    "+N" chip for the rest, so the banner stays one line on a phone. */
export function bannerSlots(
  groups: readonly ArrivalGroup[],
  max = 4,
): { shown: ArrivalGroup[]; hidden: number } {
  if (groups.length <= max) return { shown: [...groups], hidden: 0 };
  return { shown: groups.slice(0, max - 1), hidden: groups.length - (max - 1) };
}

/** The banner's content: the title and a row of faces. Hidden from screen
    readers: the turn's announcement already names who arrived. */
export function AmbushStrip({ arrivals }: { arrivals: readonly Arrival[] }) {
  const { shown, hidden } = bannerSlots(groupArrivals(arrivals));
  return (
    <div className="ambush__inner" aria-hidden="true">
      <strong className="ambush__title">⚔ ¡Emboscada! ⚔</strong>
      <ul className="ambush__row">
        {shown.map((group, index) => (
          <li key={index} className="ambush__member">
            <span className="ambush__face">
              <NpcAvatar
                name={group.lead.name}
                npc={{
                  name: group.lead.name,
                  description: "",
                  attitude: group.lead.attitude,
                  present: true,
                  voice: "",
                  portrait: group.lead.portrait,
                  hp: null,
                  maxHp: null,
                }}
                size="lg"
              />
              {group.count > 1 && <span className="ambush__count">×{group.count}</span>}
            </span>
            <span className="ambush__name">{group.name}</span>
          </li>
        ))}
        {hidden > 0 && (
          <li className="ambush__more" aria-label={`y ${hidden} más`}>
            +{hidden}
          </li>
        )}
      </ul>
    </div>
  );
}

/** Hostiles burst in as combat starts: their faces drop from the top. */
export function AmbushBanner({ arrivals, onDone }: { arrivals: readonly Arrival[]; onDone: () => void }) {
  return (
    <TopBanner className="ambush" shownMs={SHOWN_MS} onDone={onDone}>
      <AmbushStrip arrivals={arrivals} />
    </TopBanner>
  );
}

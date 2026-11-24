import { enterArrival } from "../animations/motion";
import { ATTITUDE_LABEL, groupArrivals, type ArrivalGroup } from "../domain/arrivals";
import type { Arrival, Npc } from "../domain/types";
import { NpcAvatar } from "./NpcAvatar";
import { HealthTag } from "./SceneDrawer";
import { useEnter } from "./useEnter";

/** NpcAvatar draws from an Npc; the snapshot has all it looks at. */
function asNpc(arrival: Arrival): Npc {
  return {
    name: arrival.name,
    description: arrival.blurb,
    attitude: arrival.attitude,
    present: true,
    voice: "",
    portrait: arrival.portrait,
    hp: null,
    maxHp: null,
  };
}

function ArrivalCard({ group, animated }: { group: ArrivalGroup; animated?: boolean | undefined }) {
  const ref = useEnter<HTMLDivElement>(animated ? enterArrival : null);
  const { lead } = group;
  return (
    <div ref={ref} className="arrival-card" data-kind={lead.attitude}>
      <NpcAvatar name={lead.name} npc={asNpc(lead)} size="lg" />
      <div className="arrival-card__body">
        <div className="arrival-card__head">
          <strong className="arrival-card__name">
            {group.name}
            {group.count > 1 && <span className="arrival-card__count"> ×{group.count}</span>}
          </strong>
          <span className="arrival-card__attitude">{ATTITUDE_LABEL[lead.attitude]}</span>
        </div>
        {(lead.returning || lead.blurb !== "" || lead.health) && (
          <p className="arrival-card__text">
            {lead.returning && <span className="arrival-card__return">Vuelve a aparecer · </span>}
            {lead.blurb}
            {lead.health && (
              <>
                {" "}
                <HealthTag label={lead.health} />
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Who walked into the scene this turn, one card per group, after the
    narration. Hidden from screen readers: the turn's announcement already
    names them (see turnAnnouncement). */
export function ArrivalCards({
  arrivals,
  animated,
}: {
  arrivals: readonly Arrival[];
  animated?: boolean;
}) {
  if (arrivals.length === 0) return null;
  return (
    <div className="arrivals" aria-hidden="true">
      {groupArrivals(arrivals).map((group, index) => (
        <ArrivalCard key={index} group={group} animated={animated} />
      ))}
    </div>
  );
}

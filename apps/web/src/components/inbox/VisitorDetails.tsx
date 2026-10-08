import { format } from "date-fns";
import type { VisitorSummary } from "@repo/types";
import { visitorLabel } from "./format";

const NotGiven = () => <span className="text-muted-foreground">Not given</span>;

// The right column (or sheet on narrower screens): who this visitor is and where they are now.
export function VisitorDetails({ visitor }: { visitor: VisitorSummary }) {
  return (
    <div className="space-y-5 p-4">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {visitorLabel(visitor)}
      </h3>
      <dl className="space-y-4 text-[13px]">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="mt-0.5 text-foreground">
            {visitor.name ?? <NotGiven />}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="mt-0.5 break-all text-foreground">
            {visitor.email ? (
              <a href={`mailto:${visitor.email}`} className="hover:underline">
                {visitor.email}
              </a>
            ) : (
              <NotGiven />
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Current page</dt>
          <dd className="mt-0.5 break-all">
            {/* The server only stores http(s) addresses, so this link can't be a script URL. */}
            {visitor.lastPageUrl ? (
              <a
                href={visitor.lastPageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline-offset-2 hover:underline"
              >
                {visitor.lastPageUrl}
              </a>
            ) : (
              <span className="text-muted-foreground">Not reported yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">First visit</dt>
          <dd className="mt-0.5 text-foreground tabular-nums">
            {format(new Date(visitor.firstSeenAt), "d MMM yyyy, HH:mm")}
          </dd>
        </div>
      </dl>
    </div>
  );
}

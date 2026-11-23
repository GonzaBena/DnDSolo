// The one place the app imports Zod from. Zod v4 probes `new Function` to
// compile faster parsers; the site's CSP forbids eval, so the probe would
// report a violation on every page. Jitless mode skips the probe. This must
// run before any schema is built, which importing `z` from here guarantees.
import { z } from "zod";

z.config({ jitless: true });

export { z };

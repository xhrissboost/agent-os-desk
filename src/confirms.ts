export type Confirms = { pay: boolean; spot: boolean; defi: boolean };

/** Three separate confirms. A bare --confirm is ignored on purpose. */
export function parseConfirms(argv: string[] = process.argv): Confirms {
  return {
    pay: argv.includes("--confirm-pay"),
    spot: argv.includes("--confirm-spot"),
    defi: argv.includes("--confirm-defi"),
  };
}

export function liveRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DESK_LIVE === "1";
}

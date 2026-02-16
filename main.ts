import { parseReports } from "./parsing.ts";
import { render } from "./render.ts";

if (import.meta.main) {
    const target = Deno.args[0];
    const out = Deno.args[1] ?? "out";
    if (!target) {
        console.warn("no target specified");
        console.warn(
            `  hint: try <binary_path> <target> <output>`,
        );
        Deno.exit(1);
    }
    if (!target) {
        console.warn("no output path specified");
        console.warn(
            `  hint: try <binary_path> <target> <output>`,
        );
        Deno.exit(1);
    }

    await render(out, await parseReports(target));
    console.warn(`rendered to '${out}'`);
    Deno.exit(0);
}

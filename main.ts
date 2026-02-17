import { parseReports } from "./parsing.ts";
import { render } from "./render.ts";

if (import.meta.main) {
    const target = Deno.args[0];
    const out = Deno.args[1] ?? "out";
    let rootPathPrefix = Deno.args[2] ?? "";
    if (!rootPathPrefix.startsWith("/")) {
        rootPathPrefix = "/" + rootPathPrefix;
    }
    if (!rootPathPrefix.endsWith("/")) {
        rootPathPrefix = rootPathPrefix + "/";
    }
    if (!target) {
        console.warn("no target specified");
        console.warn(
            `  hint: try <binary_path> <target> <output> <root_path_prefix>`,
        );
        Deno.exit(1);
    }
    if (!target) {
        console.warn("no output path specified");
        console.warn(
            `  hint: try <binary_path> <target> <output> <root_path_prefix>`,
        );
        Deno.exit(1);
    }

    await render(await parseReports(target), out, rootPathPrefix);
    console.warn(`rendered to '${out}'`);
    Deno.exit(0);
}

import { ensureDir } from "@std/fs/ensure-dir";
import { Report } from "./parsing.ts";
import { join } from "@std/path/join";
import { escape } from "@std/html";

type RelationshipTreeEntry = {
    relationship: string[];
    children: RelationshipTree;
    report: Report | null;
};

type RelationshipTree = {
    [key: string]: RelationshipTreeEntry;
};

function buildTree(reports: Report[]): RelationshipTree {
    const ret: RelationshipTree = {};
    for (const report of reports) {
        let curr = ret;
        for (
            let componentIdx = 0;
            componentIdx < report.relationship.length;
            ++componentIdx
        ) {
            const component = report.relationship[componentIdx];
            if (curr[component] === undefined) {
                const relationship = [];
                for (let i = 0; i <= componentIdx; ++i) {
                    relationship.push(report.relationship[i]);
                }
                curr[component] = {
                    children: {},
                    report: null,
                    relationship,
                };
            }
            if (componentIdx === report.relationship.length - 1) {
                curr[component].report = report;
            }
            curr = curr[component]["children"];
        }
    }
    return ret;
}

function rootHtml(name: string, body: string) {
    return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${name}</title>
                <link href="/style.css" rel="stylesheet">
                <script src="/script.js" defer></script>
            </head>
            <body>
                ${body}
                <dialog closedby="any" id="case-details-dialog"><button id="case-details-dialog-close">Close</button><hr><div id="case-details-dialog-content"></div></dialog>
            </body>
        </html>
    `;
}

function renderTestCase(test: Report["cases"][number]) {
    const type: "success" | "skipped" | "failure" | "error" = test.result;

    const button = type === "success"
        ? "<span>...</span>"
        : `<case-details-button case-data="${
            escape(JSON.stringify(test))
        }">[i]</case-details-button>`;
    return `<case ${type}>${button}  <case-name>${
        escape(test.name)
    }</case-name> ${test.duration}s | ${
        type.padStart("skipped".length)
    }</case>`;
}

function renderReport(report: Report): string {
    return `
    <report>
        <h2>${nameOf(report.relationship)}</h2>
        ${report.cases.map((x) => renderTestCase(x)).join("")}
    </report>
    `;
}

function collapseChildren(tree: RelationshipTree): Report[] {
    const ret: Report[] = [];
    for (const { report, children } of Object.values(tree)) {
        if (report !== null) {
            ret.push(report);
        }
        ret.push(...collapseChildren(children));
    }
    return ret;
}

function renderChildrenTree(tree: RelationshipTree): string {
    return Object.keys(tree).map((name) => {
        const entry = tree[name];
        return `<li>
            <p><a href="/${tree[name].relationship.join("/")}">${name}</a></p>
            ${
            Object.keys(entry.children).length > 0
                ? `<ul>${renderChildrenTree(entry.children)}</ul>`
                : ""
        }
        </li>`;
    }).join("");
}

function renderTwinGrid(
    entry: RelationshipTree,
    stats: ReturnType<typeof reduceReportStats>,
    includeBack: boolean,
): string {
    return `
    <twin-grid>
        <report-children>
            ${includeBack ? `<h2><a href="..">Back</a></h2>` : ""}
            ${
        Object.keys(entry).length > 0
            ? `<ul>${renderChildrenTree(entry)}</ul>`
            : ""
    }
        </report-children>

        <report>
            <label for="only-bad"><p><input id="only-bad" type="checkbox"> Only show non-success</p></label>
            <hr>
            <case success><case-name>Success:</case-name> ${stats.success}</case>
            <case failure><case-name>Failure:</case-name> ${stats.failures}</case>
            <case skipped><case-name>Skipped:</case-name> ${stats.skipped}</case>
            <case error><case-name>Error:</case-name> ${stats.errors}</case>
            <case><case-name>Total:</case-name> ${stats.total}</case>
        </report>
    </twin-grid>`;
}

function renderReportPageRoot(entry: RelationshipTree) {
    const reports = collapseChildren(entry);
    const stats = reduceReportStats(reports);
    return `
        <h1>root</h1>
        ${renderTwinGrid(entry, stats, false)}
        <hr>
        <report-grid>
            ${reports.map(renderReport).join("")}
        <report-grid>
`;
}

function reduceReportStats(reports: Report[]) {
    const base = {
        total: 0,
        success: 0,
        failures: 0,
        skipped: 0,
        errors: 0,
    };
    return reports.reduce(
        (acc, curr) => ({
            total: acc.total + curr.tests,
            success: acc.success + curr.tests -
                (curr.skipped + curr.failures + curr.errors),
            failures: acc.failures + curr.failures,
            skipped: acc.skipped + curr.skipped,
            errors: acc.errors + curr.errors,
        }),
        base,
    );
}

function renderReportPage(entry: RelationshipTreeEntry) {
    const existing = entry.report ? [entry.report] : [];
    const reports = [...existing, ...collapseChildren(entry.children)];
    const stats = reduceReportStats(reports);
    return `
        <h1>${nameOf(entry.relationship)}</h1>
        ${renderTwinGrid(entry.children, stats, true)}
        <hr>
        <report-grid>
            ${reports.map(renderReport).join("")}
        <report-grid>
`;
}

function nameOf(relationship: string[]): string {
    const last = relationship.at(-1);
    if (!last) {
        return "root";
    }
    return last;
}

async function renderTree(
    tree: RelationshipTree,
    out: string,
) {
    for (const key in tree) {
        await ensureDir(join(out, ...tree[key].relationship));
        await Deno.writeTextFile(
            join(out, ...tree[key].relationship, "index.html"),
            rootHtml(
                nameOf(tree[key].relationship),
                renderReportPage(tree[key]),
            ),
        );
        await renderTree(tree[key].children, out);
    }
}

export async function render(out: string, reports: Report[]) {
    await ensureDir(out);

    await Deno.writeTextFile(join(out, ".gitignore"), "*");
    await Deno.copyFile("assets/style.css", join(out, "style.css"));
    await Deno.copyFile(
        "assets/script.js",
        join(out, "script.js"),
    );
    const tree = buildTree(reports);
    await renderTree(tree, out);
    await Deno.writeTextFile(
        join(out, "index.html"),
        rootHtml(
            "root",
            renderReportPageRoot(tree),
        ),
    );
}

import { ensureDir } from "@std/fs/ensure-dir";
import { Report } from "./parsing.ts";
import { join } from "@std/path/join";
import { escape } from "@std/html";
import { stripPrepending } from "./shared.ts";

function rootHtml(name: string, body: string) {
    return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${name}</title>
                <link href="/style.css" rel="stylesheet">
            </head>
            <body>
                ${body}
            </body>
        </html>
    `;
}

function renderTestCase(test: Report["cases"][number]) {
    const type: "success" | "skipped" | "failure" | "error" = test.result;

    return `<case ${type}><case-name>${
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

function renderChildLink(report: Report, root: string[]): string {
    const components = [];
    const links = [];
    for (
        const stage of stripPrepending(root, report.relationship)
    ) {
        components.push(stage);
        const [head, ...tail] = components;
        links.push(`<a href="${join(head, ...tail)}">${stage}</a>`);
    }
    links.unshift("<span>.</span>");
    return `<h3>${links.join(" / ")}</h3>`;
}

function renderReportPage(level: string[], reports: Report[]) {
    const existing = findEntity(level, reports);
    const children = findChildren(level, reports);
    const toRender = [...existing, ...children];
    return `
        <h1>${nameOf(level)}</h1>
        <report-children>
            <h2><a href="..">Back</a></h2>
            ${children.map((x) => renderChildLink(x, level)).join("")}
        </report-children>
        <hr>
        <report-grid>
            ${toRender.map(renderReport).join("")}
        <report-grid>
`;
}

function isEqual(lhs: string[], rhs: string[]): boolean {
    if (lhs.length !== rhs.length) {
        return false;
    }
    for (let i = 0; i < lhs.length; ++i) {
        if (lhs[i] !== rhs[i]) {
            return false;
        }
    }
    return true;
}

function isChild(parent: string[], child: string[]): boolean {
    if (parent.length >= child.length) {
        return false;
    }
    for (let i = 0; i < parent.length; ++i) {
        if (parent[i] !== child[i]) {
            return false;
        }
    }
    return true;
}

function findEntity(
    parent: Report["relationship"],
    reports: Report[],
): Report[] {
    return reports.filter((x) => isEqual(parent, x.relationship));
}

function findChildren(
    parent: Report["relationship"],
    reports: Report[],
): Report[] {
    return reports.filter((x) => isChild(parent, x.relationship));
}

function style() {
    return `
:root {
    color-scheme: dark;
    font-family:
        system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
}

report-children {
    display: grid;
    border: 1px solid;
    padding: 1rem;

    h2 {
        margin-top: 0;
    }
    h3 {
        margin: 0.5rem 0;
    }
}

report-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 0.5rem;

    report {
        padding: 1rem;
        border: 1px solid;
        h2 {
            margin-top: 0;
        }
    }

    case {
        &[passed] {
            background-color: #589b31;
        }
        &[skipped] {
            background-color: #ffe74c;
            color: black;
        }
        &[failed] {
            background-color: #d6371f;
        }
        padding: 0.25rem;
        display: flex;
        font-family: monospace;

        case-name {
            flex: 1;
        }
    }
}

body {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
}`;
}

function nameOf(relationship: string[]): string {
    const last = relationship.at(-1);
    if (!last) {
        return "root";
    }
    return last;
}

export async function render(out: string, reports: Report[]) {
    await Deno.writeTextFile(join(out, ".gitignore"), "*");
    await Deno.writeTextFile(join(out, "style.css"), style());
    const relationships = reports.map((x) => x.relationship);
    for (const relationship of relationships) {
        await ensureDir(join(out, ...relationship));
        const acc = [];
        for (const link of relationship) {
            acc.push(link);
            await Deno.writeTextFile(
                join(out, ...acc, "index.html"),
                rootHtml(
                    nameOf(acc),
                    renderReportPage(
                        acc,
                        reports,
                    ),
                ),
            );
        }
    }
    await Deno.writeTextFile(
        join(out, "index.html"),
        rootHtml(
            "root",
            renderReportPage(
                [],
                reports,
            ),
        ),
    );
}

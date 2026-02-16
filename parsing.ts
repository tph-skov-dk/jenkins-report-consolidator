import * as fs from "@std/fs";
import * as xml from "@libs/xml";
import * as z from "zod";

const TestCaseBase = z.strictObject({
    "@classname": z.string(),
    "@name": z.string(),
    "@time": z.coerce.number(),
});

const TestCase = TestCaseBase.transform((x) => ({
    ...x,
    tag: "success" as const,
}))
    .or(
        TestCaseBase.extend({
            failure: z.strictObject({
                "#text": z.string(),
                "@message": z.string(),
            }),
        }).transform((x) => ({ ...x, tag: "failure" as const })),
    )
    .or(
        TestCaseBase.extend({
            error: z.strictObject({
                "#text": z.string(),
                "@message": z.string(),
            }),
        }).transform((x) => ({ ...x, tag: "error" as const })),
    )
    .or(
        TestCaseBase.extend({
            skipped: z.strictObject({
                "@type": z.string(),
                "#text": z.string(),
                "@message": z.string(),
            }),
        }).transform((x) => ({ ...x, tag: "skipped" as const })),
    );

const TestSuite = z.object({
    "@name": z.literal("pytest"),
    "@errors": z.coerce.number(),
    "@failures": z.coerce.number(),
    "@skipped": z.coerce.number(),
    "@tests": z.coerce.number(),
    "@time": z.coerce.number(),
    "@timestamp": z.coerce.date(),
    testcase: z.array(TestCase).or(TestCase).transform((x) => [x].flat()),
});

const Root = z.object({ testsuites: z.object({ testsuite: TestSuite }) });

export type Case =
    & {
        name: string;
        duration: number;
    }
    & ({
        result: "success";
    } | {
        result: "failure";
        trace: string;
        message: string;
    } | {
        result: "error";
        trace: string;
        message: string;
    } | {
        result: "skipped";
        type: string;
        message: string;
        trace: string;
    });

export type Report = {
    relationship: string[];
    errors: number;
    failures: number;
    skipped: number;
    tests: number;
    duration: number;
    timestamp: Date;
    cases: Case[];
};

function withoutRoot(root: string, path: string): string[] {
    const rootComponents = root
        .split(/[\\/]/)
        .filter((x) => x.trim() !== "");
    const pathComponents = path
        .split(/[\\/]/)
        .filter((x) => x.trim() !== "");

    return stripPrepending(rootComponents, pathComponents);
}

export function stripPrepending(root: string[], target: string[]): string[] {
    const cp = [...target];
    for (let i = 0; i < root.length; ++i) {
        if (cp.shift() !== root[i]) {
            throw new Error(
                `expected root '${root}' to match target '${target}'`,
            );
        }
    }
    return cp;
}

function parseTestCase(x: z.infer<typeof TestCase>): Case {
    const shared = { name: x["@name"], duration: x["@time"] };
    switch (x.tag) {
        case "success":
            return { ...shared, result: "success" };
        case "failure":
            return {
                ...shared,
                result: "failure",
                message: x["failure"]["@message"],
                trace: x["failure"]["#text"],
            };
        case "error":
            return {
                ...shared,
                result: "error",
                message: x["error"]["@message"],
                trace: x["error"]["#text"],
            };
        case "skipped":
            return {
                ...shared,
                result: "skipped",
                message: x["skipped"]["@message"],
                trace: x.skipped["#text"],
                type: x.skipped["@type"],
            };
    }
}

export async function parseReports(root: string): Promise<Report[]> {
    const reports: Report[] = [];
    for await (
        const { path } of fs.walk(root, {
            match: [/[/\\]report.xml$/],
            skip: [/tmp/],
            includeDirs: false,
            includeSymlinks: false,
            includeFiles: true,
        })
    ) {
        const component = withoutRoot(root, path);
        if (component.pop() !== "report.xml") {
            throw new Error("unreachable");
        }
        const content = Root.parse(xml.parse(await Deno.readTextFile(path)));
        const testSuite = content.testsuites.testsuite;
        reports.push({
            relationship: component,
            duration: testSuite["@time"],
            errors: testSuite["@errors"],
            failures: testSuite["@failures"],
            skipped: testSuite["@skipped"],
            tests: testSuite["@tests"],
            timestamp: testSuite["@timestamp"],
            cases: testSuite["testcase"].map(parseTestCase),
        });
    }
    return reports;
}

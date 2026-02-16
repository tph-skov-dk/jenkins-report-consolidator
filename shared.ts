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

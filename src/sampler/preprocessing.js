// Deterministically assigns a unique integer id to each node in the data.
export function labelData(nodes, i) {
    for (const n of nodes) {
        n.id = i++;
    }
    for (const n of nodes) {
        if (n.children) {
            i = labelData(n.children, i);
        }
    }
    return i;
}

// Uses the 'data.classSources' map to annotate node objects with their source
export function labelDataWithSource(data) {
    function apply(sources, nodes) {
        for (const node of nodes) {
            if (
                node.className &&
                !node.className.startsWith(
                    'com.destroystokyo.paper.event.executor.asm.generated.'
                )
            ) {
                const source = sources[node.className];
                if (source) {
                    node.source = source;
                }
            }
            apply(sources, node.children);
        }
    }

    if (data.classSources) {
        for (const thread of data.threads) {
            apply(data.classSources, thread.children);
        }
    }
}

export function generateSourceViews(data) {
    if (!data.classSources) {
        return;
    }

    const { classSources, threads } = data;

    // get a list of each distinct source
    const sources = classSources
        ? [...new Set(Object.values(classSources))]
        : [];

    function mergeIntoArray(arr, node) {
        for (const [i, n] of arr.entries()) {
            if (
                n.className === node.className &&
                n.methodName === node.methodName &&
                n.methodDesc === node.methodDesc
            ) {
                // merge
                arr[i] = mergeNodes(n, node);
                return;
            }
        }

        // just append
        arr.push(node);
    }

    function mergeNodes(a, b) {
        const children = [];
        for (const c of a.children) {
            mergeIntoArray(children, c);
        }
        for (const c of b.children) {
            mergeIntoArray(children, c);
        }
        children.sort((a, b) => b.time - a.time);

        return {
            className: a.className,
            methodName: a.methodName,
            methodDesc: a.methodDesc,
            lineNumber: a.lineNumber,
            parentLineNumber: 0,
            source: a.source,
            time: a.time + b.time,
            id: [].concat(a.id, b.id),
            children,
        };
    }

    // function to scan a thread for matches
    function findMatches(acc, mergeMode, source, node) {
        if (node.source === source) {
            // if the source of the node matches, add it to the accumulator
            if (mergeMode) {
                mergeIntoArray(acc, node);
            } else {
                acc.push(node);
            }
        } else {
            // otherwise, search the nodes children (recursively...)
            for (const child of node.children) {
                findMatches(acc, mergeMode, source, child);
            }
        }
    }

    function generate(mergeMode) {
        return sources
            .map(source => {
                const out = [];
                let totalTime = 0;
                for (const thread of threads) {
                    const acc = [];
                    findMatches(acc, mergeMode, source, thread);
                    acc.sort((a, b) => b.time - a.time);

                    if (acc.length) {
                        let copy = Object.assign({}, thread);
                        copy.children = acc;
                        copy.sourceTime = acc.reduce((a, c) => a + c.time, 0);
                        out.push(copy);

                        totalTime += copy.sourceTime;
                    }
                }
                return { source, totalTime, threads: out };
            })
            .sort((a, b) => b.totalTime - a.totalTime);
    }

    data.bySource = generate(true);
    data.bySourceSeparate = generate(false);
}

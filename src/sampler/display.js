import React, { useState, useMemo } from 'react';

import classnames from 'classnames';

import { humanFriendlyPercentage, formatTime } from '../misc/util';
import { resolveMappings } from './mappings';

// context menu
import { useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';

// We use React.memo to avoid re-renders. This is because the trees we work with are really deep.
const BaseNode = React.memo(
    ({ parents, node, searchQuery, highlighted, mappings, isSourceRoot }) => {
        if (!searchQuery.matches(node, parents)) {
            return null;
        }

        const directParent =
            parents.length !== 0 ? parents[parents.length - 1] : null;

        const [expanded, setExpanded] = useState(() => {
            if (highlighted.check(node)) {
                return true;
            }
            return directParent && directParent.children.length === 1;
        });
        const classNames = classnames({
            node: true,
            collapsed: !expanded,
            parent: parents.length === 0,
        });
        const nameClassNames = classnames({
            name: true,
            bookmarked: highlighted.has(node.id),
        });
        const parentsForChildren = useMemo(
            () => parents.concat([node]),
            [parents, node]
        );
        const threadTime = parents.length === 0 ? node.time : parents[0].time;

        function handleClick(e) {
            if (e.altKey) {
                highlighted.toggle(node.id);
            } else {
                setExpanded(!expanded);
            }
        }

        const { show } = useContextMenu({ id: 'sampler-cm' });

        function handleContextMenu(event) {
            event.preventDefault();
            show(event, { props: { node } });
        }

        const selfTime =
            node.time - node.children.reduce((acc, n) => acc + n.time, 0);

        let significance;
        let importance;
        if (!directParent) {
            significance = 1;
            importance = 0;
        } else {
            const parentTime = directParent.sourceTime || directParent.time;
            significance = node.time / parentTime;
            importance = parentTime !== node.time ? significance : 0;
        }

        return (
            <li className={classNames}>
                <div
                    className={nameClassNames}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                >
                    <NodeInfo
                        time={node.time}
                        selfTime={selfTime}
                        threadTime={threadTime}
                        importance={importance}
                        significance={significance}
                        source={node.source}
                        isSourceRoot={isSourceRoot}
                    >
                        <Name node={node} mappings={mappings} />
                        {!!node.parentLineNumber && (
                            <LineNumber node={node} parent={directParent} />
                        )}
                    </NodeInfo>
                </div>
                {expanded && (
                    <ul className="children">
                        {node.children.map((node, i) => (
                            <BaseNode
                                node={node}
                                parents={parentsForChildren}
                                searchQuery={searchQuery}
                                highlighted={highlighted}
                                mappings={mappings}
                                key={i}
                            />
                        ))}
                    </ul>
                )}
            </li>
        );
    }
);

const NodeInfo = ({
    children,
    time,
    selfTime,
    threadTime,
    importance,
    significance,
    source,
    isSourceRoot,
}) => {
    // if this the root of a source (a thread node), display the total of the
    // source instead of the thread as a whole
    if (isSourceRoot) {
        time = threadTime - selfTime;
    }

    const filter =
        `hue-rotate(-${25 * importance}deg)` +
        ' ' +
        `saturate(${1 + 13 * importance})`;

    const opacity = significance < 0.01 ? 0.5 + (significance * 100) / 2 : null;

    return (
        <>
            {children}
            <span className="percent" style={{ filter, opacity }}>
                {humanFriendlyPercentage(time / threadTime)}
            </span>
            {selfTime > 0 && !isSourceRoot ? (
                <span className="time">
                    {formatTime(time)}ms (self: {formatTime(selfTime)}ms -{' '}
                    {humanFriendlyPercentage(selfTime / threadTime)})
                </span>
            ) : (
                <span className="time">{formatTime(time)}ms</span>
            )}
            {!!source && <span className="time">({source})</span>}
            <span className="bar">
                <span
                    className="bar-inner"
                    style={{
                        width: humanFriendlyPercentage(time / threadTime),
                    }}
                />
            </span>
        </>
    );
};

const Name = ({ node, mappings }) => {
    let {
        thread,
        native,
        className,
        methodName,
        packageName,
        lambda,
        remappedClass,
        remappedMethod,
    } = resolveMappings(node, mappings);

    if (thread) {
        return <>{node.name}</>;
    }

    if (native) {
        return (
            <>
                <span className="native-part">{node.methodName}</span>
                <span className="package-part"> (native)</span>
            </>
        );
    }

    return (
        <>
            {!!packageName && (
                <span className="package-part">{packageName}</span>
            )}
            {remappedClass ? (
                <span className="class-part remapped" title={node.className}>
                    {className}
                </span>
            ) : (
                <span className="class-part">{className}</span>
            )}
            {!!lambda && <span className="lambda-part">{lambda}</span>}.
            {remappedMethod ? (
                <span className="method-part remapped" title={node.methodName}>
                    {methodName}
                </span>
            ) : (
                <span className="method-part">{methodName}</span>
            )}
            ()
        </>
    );
};

const LineNumber = ({ node, parent }) => {
    const title =
        'Invoked on line ' +
        node.parentLineNumber +
        ' of ' +
        parent.className +
        '.' +
        parent.methodName +
        '()';
    return (
        <span className="lineNumber" title={title}>
            :{node.parentLineNumber}
        </span>
    );
};

export { BaseNode };

/**
 * Parse raw gateway JSON into a structured array of groups and parsed cards.
 * This file is purely for data transformation and can be used in Node.js (for linting) or the browser.
 */

export interface NetworkInfo {
    id: string;
    names: string[];
    logo?: string;
}

export interface PrefillData {
    number: string | null;
    name: string | null;
    csc: string | null;
    exp: string | null;
}

export interface Card {
    id: string;
    network: string[];
    prefill: PrefillData;
    display: Record<string, unknown>;
    search: string;
}

export interface ParsedGroup {
    group: string;
    items: Card[];
}

export interface RawCardItem {
    number?: string | boolean | null;
    name?: string | boolean | null;
    csc?: string | number | boolean | null;
    exp?: string | boolean | null;
    network?: string | string[];
    [key: string]: unknown;
}

export interface RawGatewayFile {
    id: string;
    name: string;
    docsLink?: string;
    cards: { group: string; items: RawCardItem[] }[];
}

const AUTOFILL_KEYS = new Set(['number', 'name', 'csc', 'exp']);

// djb2 hash → 6-char lowercase hex string
function hashCard(card: Record<string, unknown>): string {
    const str = stableStringify(card);
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
        h = h >>> 0; // keep unsigned 32-bit
    }
    return h.toString(16).padStart(8, '0').slice(-6);
}

function stableStringify(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

    const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(',')}}`;
}

// Resolves a +XY shorthand (e.g. "+3Y") to an MM/YY expiry string, or passes through as-is.
function resolveExpiry(raw: string): string {
    const match = /^\+(\d+)Y$/.exec(raw);
    if (!match) return raw;
    const years = parseInt(match[1], 10);
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear() + years).slice(-2);
    return `${month}/${year}`;
}

// Resolves a raw autofill field value into a prefill string or undefined.
// - null/undefined: skip autofill
// - false or "": explicitly clear the field
// - true: field default)
// - otherwise, use as-is
function resolveField(value: string | number | boolean | null | undefined, defaultValue: string | undefined): string | null {
    if (value == null) return null;
    if (value === false || value === "") return "";
    if (value === true) return defaultValue ?? null;
    return String(value);
}

export function parseGatewayData(gatewayId: string, rawGroups: { group: string; items: RawCardItem[] }[], networksList: NetworkInfo[] = []): ParsedGroup[] {
    const parsedGroups: ParsedGroup[] = [];
    const networkMap = new Map(networksList.map(n => [n.id, n]));

    rawGroups.forEach((group) => {
        const parsedGroup: ParsedGroup = {
            group: group.group,
            items: []
        };

        group.items.forEach((item: RawCardItem) => {

            const networksArr = Array.isArray(item.network)
                ? item.network
                : item.network
                    ? [item.network]
                    : ["unknown"];
            const isAmex = networksArr.includes("amex");

            // Resolve expiry: apply +XY shorthand if present
            const rawExp = resolveField(item.exp, "+3Y");
            const resolvedExp = rawExp !== null ? resolveExpiry(rawExp) : null;

            const prefill: PrefillData = {
                number: resolveField(item.number, undefined),
                name:   resolveField(item.name, "J. Smith"),
                csc:    resolveField(item.csc, isAmex ? "1234" : "123"),
                exp:    resolvedExp,
            };

            // Build the display object
            const display: Record<string, unknown> = {};
            Object.keys(item).forEach((key) => {
                if (key !== 'network' && key !== 'id') {
                    const val = item[key];
                    // For autofill fields, only display explicit non-empty string values
                    if (AUTOFILL_KEYS.has(key) && (typeof val !== 'string' || val === '')) return;
                    // For exp, show the resolved date (e.g. +3Y → MM/YY) rather than the raw shorthand
                    display[key] = key === 'exp' ? resolvedExp : val;
                }
            });

            // Compute stable card ID from the source card fields and group.
            const id = `${gatewayId}-${hashCard({
                group: group.group,
                card: item,
            })}`;

            // Compute search content
            const networkNames = networksArr
                .map(networkId => networkMap.get(networkId)?.names?.join(" ") ?? "")
                .join(" ");
            let search = `${group.group} ${networkNames} `;
            Object.entries(display).forEach(([key, val]) => {
                if (val !== null && val !== undefined) {
                    if (typeof val === 'boolean') {
                        if (val) search += key + " ";
                    } else {
                        search += val + " ";
                    }
                }
            });
            search = search.toLowerCase();

            parsedGroup.items.push({
                id: id,
                network: networksArr,
                prefill: prefill,
                display: display,
                search: search
            });
        });

        parsedGroups.push(parsedGroup);
    });

    return parsedGroups;
}

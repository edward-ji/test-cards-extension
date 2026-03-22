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
    number: string | undefined;
    name: string | undefined;
    csc: string | undefined;
    exp: string | undefined;
}

export interface Card {
    id: string;
    network: string | string[];
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

// Resolves a raw autofill field value into a prefill string or undefined.
// - null/undefined: skip autofill
// - false or "": explicitly clear the field
// - true: field default)
// - otherwise, use as-is
function resolveField(value: string | number | boolean | null | undefined, defaultValue: string | undefined): string | undefined {
    if (value == null) return undefined;
    if (value === false || value === "") return "";
    if (value === true) return defaultValue;
    return String(value);
}

export function parseGatewayData(gatewayId: string, rawGroups: { group: string; items: RawCardItem[] }[], networksList: NetworkInfo[] = []): ParsedGroup[] {
    const parsedGroups: ParsedGroup[] = [];

    rawGroups.forEach((group, gIndex) => {
        const parsedGroup: ParsedGroup = {
            group: group.group,
            items: []
        };

        group.items.forEach((item: RawCardItem, iIndex: number) => {
            const id = `${gatewayId}-${gIndex}-${iIndex}`;

            const networksArr = Array.isArray(item.network)
                ? item.network
                : item.network
                    ? [item.network]
                    : ["unknown"];
            const isAmex = networksArr.includes("amex");

            // Resolve expiry: apply +XY shorthand if present
            const rawExp = resolveField(item.exp, "+3Y");
            let resolvedExp: string | undefined;
            if (rawExp !== undefined) {
                const expMatch = /^\+(\d+)Y$/.exec(rawExp);
                if (expMatch) {
                    const years = parseInt(expMatch[1], 10);
                    const date = new Date();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = String(date.getFullYear() + years).slice(-2);
                    resolvedExp = `${month}/${year}`;
                } else {
                    resolvedExp = rawExp;
                }
            }

            const prefill: PrefillData = {
                number: resolveField(item.number, undefined),
                name:   resolveField(item.name, "J. Smith"),
                csc:    resolveField(item.csc, isAmex ? "1234" : "123"),
                exp:    resolvedExp,
            };

            // Build the display object
            const AUTOFILL_KEYS = new Set(['number', 'name', 'csc', 'exp']);
            const display: Record<string, unknown> = {};
            Object.keys(item).forEach((key) => {
                if (key !== 'network' && key !== 'id') {
                    const val = item[key];
                    // For autofill fields, only display explicit non-empty string values
                    if (AUTOFILL_KEYS.has(key) && (typeof val !== 'string' || val === '')) return;
                    display[key] = val;
                }
            });
            // Display resolved date only if exp was an explicit string
            if ('exp' in item && typeof item.exp === 'string' && item.exp !== '') {
                display.exp = resolvedExp;
            }

            // Compute search content
            const networkNames = networksArr
                .map(networkId => {
                    const networkInfo = networksList.find(net => net.id === networkId);
                    return networkInfo?.names?.join(" ") ?? "";
                })
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

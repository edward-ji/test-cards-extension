/**
 * Parse raw gateway JSON into a structured array of groups and parsed cards.
 * This file is purely for data transformation and can be used in Node.js (for linting) or the browser.
 */

export interface NetworkInfo {
    id: string;
    names: string[];
}

export interface PrefillData {
    number: string;
    name: string;
    csc: string;
    exp: string;
}

export interface Card {
    id: string;
    network: string;
    prefill: PrefillData;
    display: Record<string, unknown>;
    search: string;
}

export interface ParsedGroup {
    group: string;
    items: Card[];
}

export interface RawCardItem {
    number: string;
    name?: string;
    csc?: string | number | null;
    exp?: string;
    network?: string;
    [key: string]: unknown;
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

            // Build the prefill object
            const prefill = {
                number: item.number,
                name: item.name !== undefined ? item.name : "J. Smith",
                csc: item.csc === undefined || item.csc === null ? "" : String(item.csc),
                exp: ""
            };

            // Resolve dynamic expiry for prefill
            let rawExp = item.exp;
            if (!rawExp) {
                rawExp = "+3Y"; // default if empty or missing
            }

            const expMatch = /^\+(\d+)Y$/.exec(rawExp);
            if (expMatch) {
                const years = parseInt(expMatch[1], 10);
                const date = new Date();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear() + years).slice(-2);
                prefill.exp = `${month}/${year}`;
            } else {
                prefill.exp = rawExp;
            }

            // Build the display object
            const display: Record<string, unknown> = {};
            Object.keys(item).forEach((key) => {
                // Skip network/logo and our new prefill/display internals
                if (key !== 'network' && key !== 'id') {
                    display[key] = item[key];
                }
            });

            // Compute search content
            const networkInfo = networksList.find(n => n.id === item.network);
            const networkNames = networkInfo?.names?.join(" ") || "";
            let search = `${group.group} ${networkNames} `;
            Object.values(display).forEach((val) => {
                if (val !== null && val !== undefined) {
                    search += val + " ";
                }
            });
            search = search.toLowerCase();

            parsedGroup.items.push({
                id: id,
                network: item.network || "unknown",
                prefill: prefill,
                display: display,
                search: search
            });
        });

        parsedGroups.push(parsedGroup);
    });

    return parsedGroups;
}



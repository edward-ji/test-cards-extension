/**
 * Parse raw gateway JSON into a structured array of groups and parsed cards.
 * This file is purely for data transformation and can be used in Node.js (for linting) or the browser.
 */

function parseGatewayData(gatewayId, rawGroups, networksList = []) {
    const parsedGroups = [];

    rawGroups.forEach((group, gIndex) => {
        const parsedGroup = {
            group: group.group,
            items: []
        };

        group.items.forEach((item, iIndex) => {
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

            if (rawExp.match(/^\+(\d+)Y$/)) {
                const years = parseInt(rawExp.match(/^\+(\d+)Y$/)[1], 10);
                const date = new Date();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear() + years).slice(-2);
                prefill.exp = `${month}/${year}`;
            } else {
                prefill.exp = rawExp;
            }

            // Build the display object
            const display = {};
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

// Export for Node.js if applicable (e.g. for lint scripts later)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseGatewayData };
}
